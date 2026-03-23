import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const ALGORITHM = "aes-256-gcm";
// AES-GCM is specified and safest with a 96-bit (12-byte) IV
const IV_LENGTH = 12;

const KEY_FILE = path.join(os.homedir(), ".config", "tomu", ".keyfile");

/**
 * Deterministic fallback key derived from system identity.
 * Used as a last-resort decrypt attempt for data encrypted before the
 * keyfile-based approach was introduced.
 */
function getDeterministicKey(): Buffer {
  const seed = os.hostname() + os.userInfo().username;
  return crypto.createHash("sha256").update(seed).digest();
}

/**
 * Returns a 32-byte key stored in ~/.config/tomu/.keyfile.
 * On first call the file is created with a random key.
 * Falls back to hostname+username derivation only if the file cannot be read
 * (e.g. during tests without a real home directory).
 */
function loadOrCreateKey(): Buffer {
  try {
    if (fs.existsSync(KEY_FILE)) {
      const raw = fs.readFileSync(KEY_FILE);
      if (raw.length === 32) return raw;
    }
    // Create a new random key and persist it
    const key = crypto.randomBytes(32);
    fs.mkdirSync(path.dirname(KEY_FILE), { recursive: true });
    fs.writeFileSync(KEY_FILE, key, { mode: 0o600 });
    return key;
  } catch {
    // Fallback: deterministic key from system identity (less secure but
    // maintains decryptability if the key file is unavailable)
    return getDeterministicKey();
  }
}

// Cache the key for the process lifetime to avoid repeated disk reads
let _cachedKey: Buffer | undefined;
function getKey(): Buffer {
  if (!_cachedKey) {
    _cachedKey = loadOrCreateKey();
  }
  return _cachedKey;
}

export function encrypt(text: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decrypt(encrypted: string): string {
  return decryptWithKey(encrypted, getKey());
}

function decryptWithKey(encrypted: string, key: Buffer): string {
  const [ivHex, authTagHex, ciphertext] = encrypted.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/**
 * Tries to decrypt with the primary key, then falls back to the deterministic
 * key. Returns null if both fail (e.g. data encrypted with an unknown old key).
 * Also returns the key that succeeded so callers can re-encrypt if needed.
 */
export function tryDecryptWithFallback(
  encrypted: string,
): { plaintext: string; usedFallback: boolean } | null {
  const primaryKey = getKey();
  try {
    return { plaintext: decryptWithKey(encrypted, primaryKey), usedFallback: false };
  } catch {
    // Primary key failed — try deterministic fallback
    try {
      const fallbackKey = getDeterministicKey();
      // Only worth trying if the fallback key differs from the primary key
      if (!fallbackKey.equals(primaryKey)) {
        return { plaintext: decryptWithKey(encrypted, fallbackKey), usedFallback: true };
      }
    } catch {
      // both failed
    }
    return null;
  }
}

export function maskApiKey(key: string): string {
  if (key.length <= 7) return "***";
  return `${key.slice(0, 3)}...${key.slice(-4)}`;
}

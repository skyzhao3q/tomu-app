import * as crypto from "node:crypto";
import * as os from "node:os";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;

function deriveKey(): Buffer {
  const seed = os.hostname() + os.userInfo().username;
  return crypto.createHash("sha256").update(seed).digest();
}

export function encrypt(text: string): string {
  const key = deriveKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decrypt(encrypted: string): string {
  const key = deriveKey();
  const [ivHex, authTagHex, ciphertext] = encrypted.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export function maskApiKey(key: string): string {
  if (key.length <= 7) return "***";
  return `${key.slice(0, 3)}...${key.slice(-4)}`;
}

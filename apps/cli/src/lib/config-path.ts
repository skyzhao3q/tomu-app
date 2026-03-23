/**
 * Get a value from a nested object using a dot-separated path.
 * e.g. getNestedValue({chat: {defaultModel: "gpt-4"}}, "chat.defaultModel") => "gpt-4"
 */
export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * Set a value in a nested object using a dot-separated path, mutating in place.
 * e.g. setNestedValue(obj, "chat.defaultModel", "gpt-4")
 */
export function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const parts = path.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (typeof current[part] !== "object" || current[part] === null) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

/**
 * Parse a raw string value into the appropriate JS type.
 * "true" => true, "false" => false, "42" => 42, "null" => null, else string.
 */
export function parseValue(raw: string): unknown {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null") return null;
  const num = Number(raw);
  if (!isNaN(num) && raw.trim() !== "") return num;
  return raw;
}

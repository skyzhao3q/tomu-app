const SECRET_PATTERNS: RegExp[] = [
  // OpenAI / Anthropic style keys
  /sk-[A-Za-z0-9]{20,}/g,
  // GitHub personal access tokens
  /ghp_[A-Za-z0-9]{36,}/g,
  // GitHub server-to-server tokens
  /ghs_[A-Za-z0-9]{36,}/g,
  // AWS access key IDs
  /AKIA[A-Z0-9]{16}/g,
  // Generic long tokens preceded by key/token/secret/password keywords
  /(?<=(?:key|token|secret|password|apikey|api_key)\s*[:=]\s*["']?)[A-Za-z0-9_\-]{32,}/gi,
];

export function redactSecrets(text: string): string {
  let result = text;
  for (const pattern of SECRET_PATTERNS) {
    // Reset lastIndex since these are global regexes
    pattern.lastIndex = 0;
    result = result.replace(pattern, "[REDACTED]");
  }
  return result;
}

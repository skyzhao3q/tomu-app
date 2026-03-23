if (cmd === "provider-key") {
  const providerType = args[1]; // e.g., 'google', 'openai', 'anthropic'
  if (!providerType) {
    console.error(
      "Usage: alma provider-key <type>  (e.g., google, openai, anthropic)",
    );
    process.exit(1);
  }
  const providers = await api("GET", "/api/providers");
  const match = (providers || []).find(
    (p) => p.type === providerType && p.apiKey && p.enabled !== false,
  );
  if (match) {
    // Output ONLY the key (no newline decoration) for easy shell capture
    process.stdout.write(match.apiKey);
  } else {
    console.error(`No enabled ${providerType} provider with API key found`);
    process.exit(1);
  }
  process.exit(0);
}
if (cmd === 'provider-key') {
        const providerType = args[1]; // e.g., 'google', 'openai', 'anthropic'
        if (!providerType) {
            console.error('Usage: alma provider-key <type>  (e.g., google, openai, anthropic)');
            process.exit(1);
        }
        const providers = await api('GET', '/api/providers');
        const match = (providers || []).find(p => p.type === providerType && p.apiKey && p.enabled !== false);
        if (match) {
            // Output ONLY the key (no newline decoration) for easy shell capture
            process.stdout.write(match.apiKey);
        } else {
            console.error(`No enabled ${providerType} provider with API key found`);
            process.exit(1);
        }
        process.exit(0);
    }


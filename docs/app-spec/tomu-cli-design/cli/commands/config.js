if (cmd === "config") {
  const subcmd = args[1];

  if (subcmd === "get" || subcmd === "list") {
    const settings = await api("GET", "/api/settings");
    const path = args[2];
    prettyPrint(subcmd === "list" ? settings : getNestedValue(settings, path));
    return;
  }

  if (subcmd === "set") {
    const path = args[2];
    const rawValue = args[3];
    if (!path || rawValue === undefined) {
      console.error("Usage: alma config set <path> <value>");
      process.exit(1);
    }
    const value = parseValue(rawValue);

    // Validate defaultModel changes — must be a real provider:model and not an image-only model
    if (
      (path === "chat.defaultModel" || path === "telegram.defaultModel") &&
      typeof value === "string" &&
      value.includes(":")
    ) {
      const [providerId, modelId] = value.split(":");
      const providers = await api("GET", "/api/providers");
      const provider = (providers || []).find((p) => p.id === providerId);
      if (!provider) {
        console.error(
          `❌ Provider "${providerId}" not found. Run 'alma providers' to see available providers.`,
        );
        process.exit(1);
      }
      if (!provider.enabled) {
        console.error(`❌ Provider "${provider.name}" is disabled.`);
        process.exit(1);
      }
      // Block image-only models as default chat model
      const imageOnlyPatterns = [
        "nano-banana",
        "imagen",
        "image-generation",
        "dall-e",
        "stable-diffusion",
      ];
      if (imageOnlyPatterns.some((p) => modelId.toLowerCase().includes(p))) {
        console.error(
          `❌ "${modelId}" is an image generation model. Use the image-gen skill for image generation instead of changing the default chat model.`,
        );
        process.exit(1);
      }
    }

    const settings = await api("GET", "/api/settings");
    delete settings.needsEmbeddingRebuild;
    setNestedValue(settings, path, value);
    await api("PUT", "/api/settings", settings);
    console.log(`✅ ${path} = ${JSON.stringify(value)}`);
    return;
  }

  console.error("Usage: alma config <get|set|list>");
  process.exit(1);
}
if (cmd === 'config') {
        const subcmd = args[1];

        if (subcmd === 'get' || subcmd === 'list') {
            const settings = await api('GET', '/api/settings');
            const path = args[2];
            prettyPrint(subcmd === 'list' ? settings : getNestedValue(settings, path));
            return;
        }

        if (subcmd === 'set') {
            const path = args[2];
            const rawValue = args[3];
            if (!path || rawValue === undefined) {
                console.error('Usage: alma config set <path> <value>');
                process.exit(1);
            }
            const value = parseValue(rawValue);

            // Validate defaultModel changes — must be a real provider:model and not an image-only model
            if ((path === 'chat.defaultModel' || path === 'telegram.defaultModel') && typeof value === 'string' && value.includes(':')) {
                const [providerId, modelId] = value.split(':');
                const providers = await api('GET', '/api/providers');
                const provider = (providers || []).find(p => p.id === providerId);
                if (!provider) {
                    console.error(`❌ Provider "${providerId}" not found. Run 'alma providers' to see available providers.`);
                    process.exit(1);
                }
                if (!provider.enabled) {
                    console.error(`❌ Provider "${provider.name}" is disabled.`);
                    process.exit(1);
                }
                // Block image-only models as default chat model
                const imageOnlyPatterns = ['nano-banana', 'imagen', 'image-generation', 'dall-e', 'stable-diffusion'];
                if (imageOnlyPatterns.some(p => modelId.toLowerCase().includes(p))) {
                    console.error(
                        `❌ "${modelId}" is an image generation model. Use the image-gen skill for image generation instead of changing the default chat model.`
                    );
                    process.exit(1);
                }
            }

            const settings = await api('GET', '/api/settings');
            delete settings.needsEmbeddingRebuild;
            setNestedValue(settings, path, value);
            await api('PUT', '/api/settings', settings);
            console.log(`✅ ${path} = ${JSON.stringify(value)}`);
            return;
        }

        console.error('Usage: alma config <get|set|list>');
        process.exit(1);
    }


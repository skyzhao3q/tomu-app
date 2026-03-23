if (cmd === "model") {
  if (args[1] === "set" && args[2]) {
    const modelId = args[2];
    const settings = await api("GET", "/api/settings");
    delete settings.needsEmbeddingRebuild;
    settings.chat = settings.chat || {};
    settings.chat.defaultModel = modelId;
    await api("PUT", "/api/settings", settings);
    console.log(`✅ Default model set to: ${modelId}`);
    return;
  }
  console.error("Usage: alma model set <provider:model>");
  process.exit(1);
}
if (cmd === 'model') {
        if (args[1] === 'set' && args[2]) {
            const modelId = args[2];
            const settings = await api('GET', '/api/settings');
            delete settings.needsEmbeddingRebuild;
            settings.chat = settings.chat || {};
            settings.chat.defaultModel = modelId;
            await api('PUT', '/api/settings', settings);
            console.log(`✅ Default model set to: ${modelId}`);
            return;
        }
        console.error('Usage: alma model set <provider:model>');
        process.exit(1);
    }


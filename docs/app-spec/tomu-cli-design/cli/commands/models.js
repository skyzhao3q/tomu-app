if (cmd === "models") {
  const models = await api("GET", "/api/models");
  if (Array.isArray(models)) {
    for (const m of models) {
      const id = typeof m === "string" ? m : m.id || m.name;
      const provider = m.provider || "";
      console.log(`${provider ? provider + ":" : ""}${id}`);
    }
  } else {
    prettyPrint(models);
  }
  return;
}
if (cmd === 'models') {
        const models = await api('GET', '/api/models');
        if (Array.isArray(models)) {
            for (const m of models) {
                const id = typeof m === 'string' ? m : m.id || m.name;
                const provider = m.provider || '';
                console.log(`${provider ? provider + ':' : ''}${id}`);
            }
        } else {
            prettyPrint(models);
        }
        return;
    }


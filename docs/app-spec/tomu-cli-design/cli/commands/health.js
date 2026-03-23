if (cmd === "health") {
  const data = await api("GET", "/api/health");
  prettyPrint(data);
  return;
}
if (cmd === 'health') {
        const data = await api('GET', '/api/health');
        prettyPrint(data);
        return;
    }


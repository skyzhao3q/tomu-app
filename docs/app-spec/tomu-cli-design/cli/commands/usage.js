if (cmd === "usage") {
  const stats = await api("GET", "/api/usage/stats");
  prettyPrint(stats);
  return;
}
if (cmd === 'usage') {
        const stats = await api('GET', '/api/usage/stats');
        prettyPrint(stats);
        return;
    }


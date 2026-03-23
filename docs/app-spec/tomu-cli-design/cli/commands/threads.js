if (cmd === "threads") {
  const limit = parseInt(args[1] || "10", 10);
  const threads = await api("GET", `/api/threads?limit=${limit}`);
  if (Array.isArray(threads)) {
    for (const t of threads) {
      const date = t.updatedAt || t.createdAt || "";
      const parent = t.parentThreadId
        ? ` ← ${t.parentThreadId.slice(0, 8)}…`
        : "";
      console.log(`${t.id}  ${date}  ${t.title || "(untitled)"}${parent}`);
    }
  } else {
    prettyPrint(threads);
  }
  return;
}
if (cmd === 'threads') {
        const limit = parseInt(args[1] || '10', 10);
        const threads = await api('GET', `/api/threads?limit=${limit}`);
        if (Array.isArray(threads)) {
            for (const t of threads) {
                const date = t.updatedAt || t.createdAt || '';
                const parent = t.parentThreadId ? ` ← ${t.parentThreadId.slice(0, 8)}…` : '';
                console.log(`${t.id}  ${date}  ${t.title || '(untitled)'}${parent}`);
            }
        } else {
            prettyPrint(threads);
        }
        return;
    }


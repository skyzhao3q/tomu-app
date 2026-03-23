if (cmd === "workspace") {
  const subcmd = args[1];

  if (subcmd === "list" || !subcmd) {
    const workspaces = await api("GET", "/api/workspaces");
    if (Array.isArray(workspaces)) {
      if (workspaces.length === 0) {
        console.log("No workspaces.");
        return;
      }
      for (const w of workspaces) {
        console.log(`${w.id}  ${w.path || w.name || "(unknown)"}`);
      }
    } else {
      prettyPrint(workspaces);
    }
    return;
  }

  if (subcmd === "set") {
    const id = args[2];
    const wsPath = args[3];
    if (!id || !wsPath) {
      console.error("Usage: alma workspace set <id> <path>");
      process.exit(1);
    }
    await api("PUT", `/api/workspaces/${id}`, { path: wsPath });
    console.log(`✅ Workspace ${id} path set to: ${wsPath}`);
    return;
  }

  console.error("Usage: alma workspace <list|set>");
  process.exit(1);
}
if (cmd === 'workspace') {
        const subcmd = args[1];

        if (subcmd === 'list' || !subcmd) {
            const workspaces = await api('GET', '/api/workspaces');
            if (Array.isArray(workspaces)) {
                if (workspaces.length === 0) {
                    console.log('No workspaces.');
                    return;
                }
                for (const w of workspaces) {
                    console.log(`${w.id}  ${w.path || w.name || '(unknown)'}`);
                }
            } else {
                prettyPrint(workspaces);
            }
            return;
        }

        if (subcmd === 'set') {
            const id = args[2];
            const wsPath = args[3];
            if (!id || !wsPath) {
                console.error('Usage: alma workspace set <id> <path>');
                process.exit(1);
            }
            await api('PUT', `/api/workspaces/${id}`, { path: wsPath });
            console.log(`✅ Workspace ${id} path set to: ${wsPath}`);
            return;
        }

        console.error('Usage: alma workspace <list|set>');
        process.exit(1);
    }


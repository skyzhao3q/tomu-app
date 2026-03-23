if (cmd === "chat") {
  const fs = await import("fs");
  const pathMod = await import("path");
  const chatLogDir = pathMod.default.join(
    _os.homedir(),
    ".config",
    "alma",
    "chats",
  );
  const subcmd = args[1];

  if (subcmd === "list") {
    if (!fs.existsSync(chatLogDir)) {
      console.log("No private chat logs.");
      return;
    }
    const files = fs
      .readdirSync(chatLogDir)
      .filter((f) => f.endsWith(".log"))
      .sort()
      .reverse();
    const chatIds = [...new Set(files.map((f) => f.split("_")[0]))];
    for (const id of chatIds) {
      const latest = files.find((f) => f.startsWith(id + "_"));
      const date = latest
        ? latest.replace(id + "_", "").replace(".log", "")
        : "";
      console.log(`${id}  (latest: ${date})`);
    }
    return;
  }

  if (subcmd === "history") {
    const chatId = args[2];
    const limit = parseInt(args[3]) || 50;
    if (!chatId) {
      console.error("Usage: alma chat history <chatId> [limit]");
      process.exit(1);
    }
    if (!fs.existsSync(chatLogDir)) {
      console.log("No private chat logs.");
      return;
    }
    const files = fs
      .readdirSync(chatLogDir)
      .filter((f) => f.startsWith(chatId + "_") && f.endsWith(".log"))
      .sort()
      .reverse();
    const lines = [];
    for (const f of files) {
      const content = fs.readFileSync(
        pathMod.default.join(chatLogDir, f),
        "utf-8",
      );
      const fileLines = content.split("\n").filter((l) => l.trim());
      lines.push(...fileLines.reverse());
      if (lines.length >= limit) break;
    }
    lines
      .reverse()
      .slice(-limit)
      .forEach((l) => console.log(l));
    return;
  }

  if (subcmd === "search") {
    const query = args.slice(2).join(" ");
    if (!query) {
      console.error("Usage: alma chat search <keyword>");
      process.exit(1);
    }
    if (!fs.existsSync(chatLogDir)) {
      console.log("No private chat logs.");
      return;
    }
    const files = fs
      .readdirSync(chatLogDir)
      .filter((f) => f.endsWith(".log"))
      .sort();
    let found = 0;
    for (const f of files) {
      const content = fs.readFileSync(
        pathMod.default.join(chatLogDir, f),
        "utf-8",
      );
      const matching = content
        .split("\n")
        .filter((l) => l.toLowerCase().includes(query.toLowerCase()));
      for (const line of matching) {
        console.log(`[${f}] ${line}`);
        found++;
      }
    }
    if (!found) console.log("No matches.");
    return;
  }

  console.error("Usage: alma chat <list|history|search> [args]");
  process.exit(1);
}
if (cmd === 'chat') {
        const fs = await import('fs');
        const pathMod = await import('path');
        const chatLogDir = pathMod.default.join(_os.homedir(), '.config', 'alma', 'chats');
        const subcmd = args[1];

        if (subcmd === 'list') {
            if (!fs.existsSync(chatLogDir)) {
                console.log('No private chat logs.');
                return;
            }
            const files = fs
                .readdirSync(chatLogDir)
                .filter(f => f.endsWith('.log'))
                .sort()
                .reverse();
            const chatIds = [...new Set(files.map(f => f.split('_')[0]))];
            for (const id of chatIds) {
                const latest = files.find(f => f.startsWith(id + '_'));
                const date = latest ? latest.replace(id + '_', '').replace('.log', '') : '';
                console.log(`${id}  (latest: ${date})`);
            }
            return;
        }

        if (subcmd === 'history') {
            const chatId = args[2];
            const limit = parseInt(args[3]) || 50;
            if (!chatId) {
                console.error('Usage: alma chat history <chatId> [limit]');
                process.exit(1);
            }
            if (!fs.existsSync(chatLogDir)) {
                console.log('No private chat logs.');
                return;
            }
            const files = fs
                .readdirSync(chatLogDir)
                .filter(f => f.startsWith(chatId + '_') && f.endsWith('.log'))
                .sort()
                .reverse();
            const lines = [];
            for (const f of files) {
                const content = fs.readFileSync(pathMod.default.join(chatLogDir, f), 'utf-8');
                const fileLines = content.split('\n').filter(l => l.trim());
                lines.push(...fileLines.reverse());
                if (lines.length >= limit) break;
            }
            lines
                .reverse()
                .slice(-limit)
                .forEach(l => console.log(l));
            return;
        }

        if (subcmd === 'search') {
            const query = args.slice(2).join(' ');
            if (!query) {
                console.error('Usage: alma chat search <keyword>');
                process.exit(1);
            }
            if (!fs.existsSync(chatLogDir)) {
                console.log('No private chat logs.');
                return;
            }
            const files = fs
                .readdirSync(chatLogDir)
                .filter(f => f.endsWith('.log'))
                .sort();
            let found = 0;
            for (const f of files) {
                const content = fs.readFileSync(pathMod.default.join(chatLogDir, f), 'utf-8');
                const matching = content.split('\n').filter(l => l.toLowerCase().includes(query.toLowerCase()));
                for (const line of matching) {
                    console.log(`[${f}] ${line}`);
                    found++;
                }
            }
            if (!found) console.log('No matches.');
            return;
        }

        console.error('Usage: alma chat <list|history|search> [args]');
        process.exit(1);
    }


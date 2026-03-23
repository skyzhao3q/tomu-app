if (cmd === "ignore") {
  const pathMod = await import("path");
  const fsMod = await import("fs");
  const osMod = await import("os");
  const ignoreFile = pathMod.default.join(
    osMod.default.homedir(),
    ".config",
    "alma",
    "ignore.json",
  );

  const loadIgnoreList = () => {
    try {
      if (fsMod.default.existsSync(ignoreFile)) {
        return JSON.parse(fsMod.default.readFileSync(ignoreFile, "utf-8"));
      }
    } catch {}
    return [];
  };
  const saveIgnoreList = (list) => {
    const dir = pathMod.default.dirname(ignoreFile);
    if (!fsMod.default.existsSync(dir))
      fsMod.default.mkdirSync(dir, { recursive: true });
    fsMod.default.writeFileSync(ignoreFile, JSON.stringify(list, null, 2));
  };

  const subcmd = args[1];
  if (subcmd === "add") {
    const userId = args[2];
    const reason = args[3] || "no reason";
    const duration = args[4]; // e.g. "30m", "2h", "1d", or omit for permanent
    if (!userId) {
      console.error("Usage: alma ignore add <userId> [reason] [duration]");
      console.error("  duration: 30m, 2h, 1d, etc. Omit for permanent.");
      process.exit(1);
    }
    let until = null;
    if (duration) {
      const match = duration.match(/^(\d+)(m|h|d)$/);
      if (match) {
        const ms =
          parseInt(match[1]) *
          (match[2] === "m" ? 60000 : match[2] === "h" ? 3600000 : 86400000);
        until = new Date(Date.now() + ms).toISOString();
      }
    }
    const list = loadIgnoreList();
    // Remove existing entry for same userId
    const filtered = list.filter((e) => String(e.userId) !== String(userId));
    filtered.push({
      userId: String(userId),
      reason,
      until,
      addedAt: new Date().toISOString(),
    });
    saveIgnoreList(filtered);
    console.log(
      `✅ User ${userId} ignored${until ? ` until ${until}` : " permanently"}. Reason: ${reason}`,
    );
  } else if (subcmd === "remove") {
    const userId = args[2];
    if (!userId) {
      console.error("Usage: alma ignore remove <userId>");
      process.exit(1);
    }
    const list = loadIgnoreList();
    const filtered = list.filter((e) => String(e.userId) !== String(userId));
    saveIgnoreList(filtered);
    console.log(`✅ User ${userId} removed from ignore list.`);
  } else if (subcmd === "list") {
    const list = loadIgnoreList();
    if (list.length === 0) {
      console.log("Ignore list is empty.");
    } else {
      const now = new Date();
      for (const e of list) {
        const expired = e.until && new Date(e.until) < now;
        const status = expired
          ? " [EXPIRED]"
          : e.until
            ? ` [until ${e.until}]`
            : " [permanent]";
        console.log(`- userId: ${e.userId}, reason: ${e.reason}${status}`);
      }
    }
  } else {
    console.log("Usage: alma ignore <add|remove|list>");
    console.log(
      "  add <userId> [reason] [duration]  - Ignore a user (duration: 30m, 2h, 1d)",
    );
    console.log("  remove <userId>                   - Unignore a user");
    console.log("  list                              - Show ignore list");
  }
  return;
}
if (cmd === 'ignore') {
        const pathMod = await import('path');
        const fsMod = await import('fs');
        const osMod = await import('os');
        const ignoreFile = pathMod.default.join(osMod.default.homedir(), '.config', 'alma', 'ignore.json');

        const loadIgnoreList = () => {
            try {
                if (fsMod.default.existsSync(ignoreFile)) {
                    return JSON.parse(fsMod.default.readFileSync(ignoreFile, 'utf-8'));
                }
            } catch {}
            return [];
        };
        const saveIgnoreList = list => {
            const dir = pathMod.default.dirname(ignoreFile);
            if (!fsMod.default.existsSync(dir)) fsMod.default.mkdirSync(dir, { recursive: true });
            fsMod.default.writeFileSync(ignoreFile, JSON.stringify(list, null, 2));
        };

        const subcmd = args[1];
        if (subcmd === 'add') {
            const userId = args[2];
            const reason = args[3] || 'no reason';
            const duration = args[4]; // e.g. "30m", "2h", "1d", or omit for permanent
            if (!userId) {
                console.error('Usage: alma ignore add <userId> [reason] [duration]');
                console.error('  duration: 30m, 2h, 1d, etc. Omit for permanent.');
                process.exit(1);
            }
            let until = null;
            if (duration) {
                const match = duration.match(/^(\d+)(m|h|d)$/);
                if (match) {
                    const ms = parseInt(match[1]) * (match[2] === 'm' ? 60000 : match[2] === 'h' ? 3600000 : 86400000);
                    until = new Date(Date.now() + ms).toISOString();
                }
            }
            const list = loadIgnoreList();
            // Remove existing entry for same userId
            const filtered = list.filter(e => String(e.userId) !== String(userId));
            filtered.push({ userId: String(userId), reason, until, addedAt: new Date().toISOString() });
            saveIgnoreList(filtered);
            console.log(`✅ User ${userId} ignored${until ? ` until ${until}` : ' permanently'}. Reason: ${reason}`);
        } else if (subcmd === 'remove') {
            const userId = args[2];
            if (!userId) {
                console.error('Usage: alma ignore remove <userId>');
                process.exit(1);
            }
            const list = loadIgnoreList();
            const filtered = list.filter(e => String(e.userId) !== String(userId));
            saveIgnoreList(filtered);
            console.log(`✅ User ${userId} removed from ignore list.`);
        } else if (subcmd === 'list') {
            const list = loadIgnoreList();
            if (list.length === 0) {
                console.log('Ignore list is empty.');
            } else {
                const now = new Date();
                for (const e of list) {
                    const expired = e.until && new Date(e.until) < now;
                    const status = expired ? ' [EXPIRED]' : e.until ? ` [until ${e.until}]` : ' [permanent]';
                    console.log(`- userId: ${e.userId}, reason: ${e.reason}${status}`);
                }
            }
        } else {
            console.log('Usage: alma ignore <add|remove|list>');
            console.log('  add <userId> [reason] [duration]  - Ignore a user (duration: 30m, 2h, 1d)');
            console.log('  remove <userId>                   - Unignore a user');
            console.log('  list                              - Show ignore list');
        }
        return;
    }


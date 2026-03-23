if (cmd === "group") {
  const fs = await import("fs");
  const os = await import("os");
  const pathMod = await import("path");
  const logDir = pathMod.default.join(
    _os.homedir(),
    ".config",
    "alma",
    "groups",
  );

  const subcmd = args[1]; // list | history | search

  if (!subcmd || subcmd === "list") {
    if (!fs.existsSync(logDir)) {
      console.log("No group chat logs yet.");
      return;
    }
    const files = fs.readdirSync(logDir).filter((f) => f.endsWith(".log"));
    const groups = new Set(files.map((f) => f.split("_")[0]));
    for (const g of groups) {
      const groupFiles = files.filter((f) => f.startsWith(g + "_"));
      const latest = groupFiles.sort().pop();
      console.log(
        `  Group ${g} (${groupFiles.length} day(s), latest: ${latest})`,
      );
    }
    return;
  }

  if (subcmd === "history") {
    const chatId = args[2];
    const limit = parseInt(args[3]) || 50;
    if (!chatId) {
      console.error("Usage: alma group history <chatId> [limit]");
      process.exit(1);
    }
    if (!fs.existsSync(logDir)) {
      console.log("No group chat logs.");
      return;
    }
    // Read all log files for this group, most recent first
    const files = fs
      .readdirSync(logDir)
      .filter((f) => f.startsWith(chatId + "_") && f.endsWith(".log"))
      .sort()
      .reverse();
    const lines = [];
    for (const f of files) {
      const content = fs.readFileSync(pathMod.default.join(logDir, f), "utf-8");
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
      console.error("Usage: alma group search <keyword>");
      process.exit(1);
    }
    if (!fs.existsSync(logDir)) {
      console.log("No group chat logs.");
      return;
    }
    const files = fs
      .readdirSync(logDir)
      .filter((f) => f.endsWith(".log"))
      .sort();
    let found = 0;
    for (const f of files) {
      const content = fs.readFileSync(pathMod.default.join(logDir, f), "utf-8");
      const matching = content
        .split("\n")
        .filter((l) => l.toLowerCase().includes(query.toLowerCase()));
      for (const line of matching) {
        console.log(`[${f}] ${line}`);
        found++;
      }
    }
    if (found === 0) console.log("No matches found.");
    return;
  }

  if (subcmd === "send") {
    const chatId = args[2];
    const message = args.slice(3).join(" ").replace(/\\n/g, "\n");
    if (!chatId || !message) {
      console.error("Usage: alma group send <chatId> <message>");
      process.exit(1);
    }
    // Send via Alma API so that lastBotReplyTime and groupHistory are updated
    try {
      const result = await api("POST", `/api/groups/${chatId}/send`, {
        message,
      });
      if (result?.ok || result?.messageId) {
        console.log(`✅ Message sent to group ${chatId}`);
      } else {
        console.error(
          "Failed:",
          result?.error || result?.description || "unknown error",
        );
      }
    } catch {
      // Fallback: direct Telegram API (in case /api/groups/:chatId/send doesn't exist yet)
      const settings = await api("GET", "/api/settings");
      const botToken = settings?.telegram?.botToken;
      if (!botToken) {
        console.error("Telegram bot not configured.");
        process.exit(1);
      }
      const resp = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: message }),
        },
      );
      const result = await resp.json();
      if (result.ok) {
        console.log(`✅ Message sent to group ${chatId} (direct)`);
      } else {
        console.error("Failed:", result.description);
      }
    }
    return;
  }

  if (subcmd === "send-photo") {
    const chatId = args[2];
    const filePath = args[3];
    const caption = args.slice(4).join(" ") || undefined;
    if (!chatId || !filePath) {
      console.error(
        "Usage: alma group send-photo <chatId> <filePath> [caption]",
      );
      process.exit(1);
    }
    const result = await api("POST", `/api/groups/${chatId}/send-photo`, {
      filePath,
      caption,
    });
    if (result?.ok) console.log(`✅ Photo sent to group ${chatId}`);
    else console.error("Failed:", result?.error || "unknown");
    return;
  }

  if (subcmd === "send-document") {
    const chatId = args[2];
    const filePath = args[3];
    const caption = args.slice(4).join(" ") || undefined;
    if (!chatId || !filePath) {
      console.error(
        "Usage: alma group send-document <chatId> <filePath> [caption]",
      );
      process.exit(1);
    }
    const result = await api("POST", `/api/groups/${chatId}/send-document`, {
      filePath,
      caption,
    });
    if (result?.ok) console.log(`✅ Document sent to group ${chatId}`);
    else console.error("Failed:", result?.error || "unknown");
    return;
  }

  if (subcmd === "send-video") {
    const chatId = args[2];
    const filePath = args[3];
    const caption = args.slice(4).join(" ") || undefined;
    if (!chatId || !filePath) {
      console.error(
        "Usage: alma group send-video <chatId> <filePath> [caption]",
      );
      process.exit(1);
    }
    const result = await api("POST", `/api/groups/${chatId}/send-video`, {
      filePath,
      caption,
    });
    if (result?.ok) console.log(`✅ Video sent to group ${chatId}`);
    else console.error("Failed:", result?.error || "unknown");
    return;
  }

  if (subcmd === "pin") {
    const chatId = args[2];
    const messageId = args[3];
    if (!chatId || !messageId) {
      console.error("Usage: alma group pin <chatId> <messageId>");
      process.exit(1);
    }
    try {
      const res = await api("POST", `/api/groups/${chatId}/pin`, {
        messageId: Number(messageId),
      });
      console.log(
        res?.success
          ? `✅ Message ${messageId} pinned`
          : `❌ Failed to pin: ${res?.error || "unknown"}`,
      );
    } catch {
      console.error("❌ Failed. Is Alma running?");
    }
    return;
  }

  if (subcmd === "unpin") {
    const chatId = args[2];
    const messageId = args[3]; // optional
    if (!chatId) {
      console.error("Usage: alma group unpin <chatId> [messageId]");
      process.exit(1);
    }
    try {
      const body = messageId ? { messageId: Number(messageId) } : {};
      const res = await api("POST", `/api/groups/${chatId}/unpin`, body);
      console.log(
        res?.success
          ? `✅ Unpinned${messageId ? ` message ${messageId}` : " all"}`
          : `❌ Failed: ${res?.error || "unknown"}`,
      );
    } catch {
      console.error("❌ Failed. Is Alma running?");
    }
    return;
  }

  if (subcmd === "context") {
    const chatId = args[2];
    const limit = parseInt(args[3]) || 100;
    if (!chatId) {
      console.error("Usage: alma group context <chatId> [limit]");
      process.exit(1);
    }

    // 1. Group info from Telegram API
    const settings = await api("GET", "/api/settings");
    const botToken = settings?.telegram?.botToken;
    if (botToken) {
      try {
        const chatResp = await fetch(
          `https://api.telegram.org/bot${botToken}/getChat`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId }),
          },
        );
        const chatData = await chatResp.json();
        if (chatData.ok) {
          const c = chatData.result;
          console.log(`=== Group Info ===`);
          console.log(`Title: ${c.title || "N/A"}`);
          console.log(`Type: ${c.type}`);
          console.log(`Description: ${c.description || "N/A"}`);
          if (c.pinned_message) {
            const pin = c.pinned_message;
            const pinFrom = pin.from?.first_name || "Unknown";
            console.log(
              `Pinned: [${pinFrom}] ${pin.text || pin.caption || "[media]"}`,
            );
          }
          console.log("");
        }
      } catch {
        /* ignore */
      }

      // 2. Member count + admin list
      try {
        const countResp = await fetch(
          `https://api.telegram.org/bot${botToken}/getChatMemberCount`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId }),
          },
        );
        const countData = await countResp.json();
        if (countData.ok) console.log(`Members: ${countData.result}`);

        const adminsResp = await fetch(
          `https://api.telegram.org/bot${botToken}/getChatAdministrators`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId }),
          },
        );
        const adminsData = await adminsResp.json();
        if (adminsData.ok) {
          const admins = adminsData.result.map((a) => {
            const name = a.user.first_name || a.user.username || a.user.id;
            const uname = a.user.username ? ` (@${a.user.username})` : "";
            const bot = a.user.is_bot ? " [BOT]" : "";
            return `  ${a.status}: ${name}${uname}${bot}`;
          });
          console.log(`Admins:\n${admins.join("\n")}`);
        }
      } catch {
        /* ignore */
      }
      console.log("");
    }

    // 3. Local log history
    console.log(`=== Recent Messages (last ${limit}) ===`);
    if (!fs.existsSync(logDir)) {
      console.log("No local logs.");
      return;
    }
    const files = fs
      .readdirSync(logDir)
      .filter((f) => f.startsWith(chatId + "_") && f.endsWith(".log"))
      .sort()
      .reverse();
    const lines = [];
    for (const f of files) {
      const content = fs.readFileSync(pathMod.default.join(logDir, f), "utf-8");
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

  if (subcmd === "leave") {
    const chatId = args[2];
    if (!chatId) {
      console.error("Usage: alma group leave <chatId>");
      process.exit(1);
    }
    try {
      const res = await api("POST", `/api/groups/${chatId}/leave`);
      if (res?.success) {
        console.log(
          `✅ Left group ${chatId} (chat history preserved, use "alma group history ${chatId}" to review)`,
        );
      } else {
        console.error("Failed to leave group:", res?.error || "unknown error");
      }
    } catch (e) {
      console.error("❌ Failed to leave group. Is Alma running?");
    }
    return;
  }

  if (subcmd === "participation") {
    const settingsPath = pathMod.default.join(
      _os.homedir(),
      ".config",
      "alma",
      "group-settings.json",
    );
    const action = args[2]; // show | set | reset

    // Load current settings
    let settings = {
      defaults: {
        randomBoostRate: 0.2,
        cooldownMinutes: 30,
        quietMinutes: 5,
        enabled: true,
      },
      groups: {},
    };
    try {
      if (fs.existsSync(settingsPath)) {
        settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
      }
    } catch {
      /* use defaults */
    }

    if (!action || action === "show") {
      console.log("Group Participation Settings");
      console.log("===========================");
      console.log(`\nDefaults:`);
      console.log(
        `  randomBoostRate: ${settings.defaults?.randomBoostRate ?? 0.2} (0-1, probability of responding when AI says NO)`,
      );
      console.log(
        `  cooldownMinutes: ${settings.defaults?.cooldownMinutes ?? 30} (min time between patrol replies per group)`,
      );
      console.log(
        `  quietMinutes: ${settings.defaults?.quietMinutes ?? 5} (only patrol if no messages for this long)`,
      );
      console.log(`  enabled: ${settings.defaults?.enabled ?? true}`);
      if (settings.groups && Object.keys(settings.groups).length > 0) {
        console.log(`\nPer-group overrides:`);
        for (const [gid, overrides] of Object.entries(settings.groups)) {
          console.log(`  ${gid}: ${JSON.stringify(overrides)}`);
        }
      }
      console.log(`\nFile: ${settingsPath}`);
      console.log(
        `Edit directly or use: alma group participation set <key> <value> [chatId]`,
      );
      return;
    }

    if (action === "set") {
      const key = args[3];
      const value = args[4];
      const chatId = args[5]; // optional, for per-group override
      if (!key || !value) {
        console.error(
          "Usage: alma group participation set <key> <value> [chatId]",
        );
        console.error(
          "Keys: randomBoostRate, cooldownMinutes, quietMinutes, enabled",
        );
        process.exit(1);
      }
      const numVal = key === "enabled" ? value === "true" : Number(value);
      if (chatId) {
        if (!settings.groups) settings.groups = {};
        if (!settings.groups[chatId]) settings.groups[chatId] = {};
        settings.groups[chatId][key] = numVal;
        console.log(`✅ Set ${key}=${numVal} for group ${chatId}`);
      } else {
        if (!settings.defaults) settings.defaults = {};
        settings.defaults[key] = numVal;
        console.log(`✅ Set default ${key}=${numVal}`);
      }
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
      return;
    }

    if (action === "reset") {
      const chatId = args[3];
      if (chatId && settings.groups?.[chatId]) {
        delete settings.groups[chatId];
        fs.writeFileSync(
          settingsPath,
          JSON.stringify(settings, null, 2) + "\n",
        );
        console.log(`✅ Reset overrides for group ${chatId}`);
      } else if (!chatId) {
        settings = {
          defaults: {
            randomBoostRate: 0.2,
            cooldownMinutes: 30,
            quietMinutes: 5,
            enabled: true,
          },
          groups: {},
        };
        fs.writeFileSync(
          settingsPath,
          JSON.stringify(settings, null, 2) + "\n",
        );
        console.log("✅ Reset all participation settings to defaults");
      }
      return;
    }

    console.error("Usage: alma group participation [show|set|reset]");
    process.exit(1);
  }

  if (subcmd === "rules") {
    const action = args[2]; // show | set | add | clear
    const chatId = args[3];

    if (!action || action === "help") {
      console.log(
        "Usage: alma group rules <show|set|add|clear> <chatId> [text]",
      );
      console.log("  show <chatId>    — Show current rules for a group");
      console.log('  set <chatId> "rules text"  — Replace all rules');
      console.log('  add <chatId> "new rule"    — Append a rule');
      console.log("  clear <chatId>   — Remove all rules");
      console.log("\nRules file: ~/.config/alma/groups/<chatId>.rules.md");
      return;
    }

    if (!chatId) {
      console.error("Error: chatId is required");
      process.exit(1);
    }

    const rulesPath = pathMod.default.join(
      _os.homedir(),
      ".config",
      "alma",
      "groups",
      `${chatId}.rules.md`,
    );

    if (action === "show") {
      if (fs.existsSync(rulesPath)) {
        console.log(fs.readFileSync(rulesPath, "utf-8"));
      } else {
        console.log("No rules set for this group.");
      }
      return;
    }

    if (action === "set") {
      const text = args.slice(4).join(" ");
      if (!text) {
        console.error("Error: rules text required");
        process.exit(1);
      }
      const groupsDir = pathMod.default.join(
        _os.homedir(),
        ".config",
        "alma",
        "groups",
      );
      if (!fs.existsSync(groupsDir))
        fs.mkdirSync(groupsDir, { recursive: true });
      fs.writeFileSync(rulesPath, text + "\n");
      console.log(`✅ Rules set for group ${chatId}`);
      return;
    }

    if (action === "add") {
      const text = args.slice(4).join(" ");
      if (!text) {
        console.error("Error: rule text required");
        process.exit(1);
      }
      const groupsDir = pathMod.default.join(
        _os.homedir(),
        ".config",
        "alma",
        "groups",
      );
      if (!fs.existsSync(groupsDir))
        fs.mkdirSync(groupsDir, { recursive: true });
      const existing = fs.existsSync(rulesPath)
        ? fs.readFileSync(rulesPath, "utf-8")
        : "";
      fs.writeFileSync(rulesPath, existing + `- ${text}\n`);
      console.log(`✅ Rule added for group ${chatId}`);
      return;
    }

    if (action === "clear") {
      if (fs.existsSync(rulesPath)) {
        fs.unlinkSync(rulesPath);
        console.log(`✅ Rules cleared for group ${chatId}`);
      } else {
        console.log("No rules to clear.");
      }
      return;
    }

    console.error(
      "Usage: alma group rules <show|set|add|clear> <chatId> [text]",
    );
    process.exit(1);
  }

  console.error(
    "Usage: alma group <list|history|search|context|send|pin|unpin|leave|participation|rules> [args]",
  );
  process.exit(1);
}
if (cmd === 'group') {
        const fs = await import('fs');
        const os = await import('os');
        const pathMod = await import('path');
        const logDir = pathMod.default.join(_os.homedir(), '.config', 'alma', 'groups');

        const subcmd = args[1]; // list | history | search

        if (!subcmd || subcmd === 'list') {
            if (!fs.existsSync(logDir)) {
                console.log('No group chat logs yet.');
                return;
            }
            const files = fs.readdirSync(logDir).filter(f => f.endsWith('.log'));
            const groups = new Set(files.map(f => f.split('_')[0]));
            for (const g of groups) {
                const groupFiles = files.filter(f => f.startsWith(g + '_'));
                const latest = groupFiles.sort().pop();
                console.log(`  Group ${g} (${groupFiles.length} day(s), latest: ${latest})`);
            }
            return;
        }

        if (subcmd === 'history') {
            const chatId = args[2];
            const limit = parseInt(args[3]) || 50;
            if (!chatId) {
                console.error('Usage: alma group history <chatId> [limit]');
                process.exit(1);
            }
            if (!fs.existsSync(logDir)) {
                console.log('No group chat logs.');
                return;
            }
            // Read all log files for this group, most recent first
            const files = fs
                .readdirSync(logDir)
                .filter(f => f.startsWith(chatId + '_') && f.endsWith('.log'))
                .sort()
                .reverse();
            const lines = [];
            for (const f of files) {
                const content = fs.readFileSync(pathMod.default.join(logDir, f), 'utf-8');
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
                console.error('Usage: alma group search <keyword>');
                process.exit(1);
            }
            if (!fs.existsSync(logDir)) {
                console.log('No group chat logs.');
                return;
            }
            const files = fs
                .readdirSync(logDir)
                .filter(f => f.endsWith('.log'))
                .sort();
            let found = 0;
            for (const f of files) {
                const content = fs.readFileSync(pathMod.default.join(logDir, f), 'utf-8');
                const matching = content.split('\n').filter(l => l.toLowerCase().includes(query.toLowerCase()));
                for (const line of matching) {
                    console.log(`[${f}] ${line}`);
                    found++;
                }
            }
            if (found === 0) console.log('No matches found.');
            return;
        }

        if (subcmd === 'send') {
            const chatId = args[2];
            const message = args.slice(3).join(' ').replace(/\\n/g, '\n');
            if (!chatId || !message) {
                console.error('Usage: alma group send <chatId> <message>');
                process.exit(1);
            }
            // Send via Alma API so that lastBotReplyTime and groupHistory are updated
            try {
                const result = await api('POST', `/api/groups/${chatId}/send`, { message });
                if (result?.ok || result?.messageId) {
                    console.log(`✅ Message sent to group ${chatId}`);
                } else {
                    console.error('Failed:', result?.error || result?.description || 'unknown error');
                }
            } catch {
                // Fallback: direct Telegram API (in case /api/groups/:chatId/send doesn't exist yet)
                const settings = await api('GET', '/api/settings');
                const botToken = settings?.telegram?.botToken;
                if (!botToken) {
                    console.error('Telegram bot not configured.');
                    process.exit(1);
                }
                const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: chatId, text: message }),
                });
                const result = await resp.json();
                if (result.ok) {
                    console.log(`✅ Message sent to group ${chatId} (direct)`);
                } else {
                    console.error('Failed:', result.description);
                }
            }
            return;
        }

        if (subcmd === 'send-photo') {
            const chatId = args[2];
            const filePath = args[3];
            const caption = args.slice(4).join(' ') || undefined;
            if (!chatId || !filePath) {
                console.error('Usage: alma group send-photo <chatId> <filePath> [caption]');
                process.exit(1);
            }
            const result = await api('POST', `/api/groups/${chatId}/send-photo`, { filePath, caption });
            if (result?.ok) console.log(`✅ Photo sent to group ${chatId}`);
            else console.error('Failed:', result?.error || 'unknown');
            return;
        }

        if (subcmd === 'send-document') {
            const chatId = args[2];
            const filePath = args[3];
            const caption = args.slice(4).join(' ') || undefined;
            if (!chatId || !filePath) {
                console.error('Usage: alma group send-document <chatId> <filePath> [caption]');
                process.exit(1);
            }
            const result = await api('POST', `/api/groups/${chatId}/send-document`, { filePath, caption });
            if (result?.ok) console.log(`✅ Document sent to group ${chatId}`);
            else console.error('Failed:', result?.error || 'unknown');
            return;
        }

        if (subcmd === 'send-video') {
            const chatId = args[2];
            const filePath = args[3];
            const caption = args.slice(4).join(' ') || undefined;
            if (!chatId || !filePath) {
                console.error('Usage: alma group send-video <chatId> <filePath> [caption]');
                process.exit(1);
            }
            const result = await api('POST', `/api/groups/${chatId}/send-video`, { filePath, caption });
            if (result?.ok) console.log(`✅ Video sent to group ${chatId}`);
            else console.error('Failed:', result?.error || 'unknown');
            return;
        }

        if (subcmd === 'pin') {
            const chatId = args[2];
            const messageId = args[3];
            if (!chatId || !messageId) {
                console.error('Usage: alma group pin <chatId> <messageId>');
                process.exit(1);
            }
            try {
                const res = await api('POST', `/api/groups/${chatId}/pin`, { messageId: Number(messageId) });
                console.log(res?.success ? `✅ Message ${messageId} pinned` : `❌ Failed to pin: ${res?.error || 'unknown'}`);
            } catch {
                console.error('❌ Failed. Is Alma running?');
            }
            return;
        }

        if (subcmd === 'unpin') {
            const chatId = args[2];
            const messageId = args[3]; // optional
            if (!chatId) {
                console.error('Usage: alma group unpin <chatId> [messageId]');
                process.exit(1);
            }
            try {
                const body = messageId ? { messageId: Number(messageId) } : {};
                const res = await api('POST', `/api/groups/${chatId}/unpin`, body);
                console.log(res?.success ? `✅ Unpinned${messageId ? ` message ${messageId}` : ' all'}` : `❌ Failed: ${res?.error || 'unknown'}`);
            } catch {
                console.error('❌ Failed. Is Alma running?');
            }
            return;
        }

        if (subcmd === 'context') {
            const chatId = args[2];
            const limit = parseInt(args[3]) || 100;
            if (!chatId) {
                console.error('Usage: alma group context <chatId> [limit]');
                process.exit(1);
            }

            // 1. Group info from Telegram API
            const settings = await api('GET', '/api/settings');
            const botToken = settings?.telegram?.botToken;
            if (botToken) {
                try {
                    const chatResp = await fetch(`https://api.telegram.org/bot${botToken}/getChat`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ chat_id: chatId }),
                    });
                    const chatData = await chatResp.json();
                    if (chatData.ok) {
                        const c = chatData.result;
                        console.log(`=== Group Info ===`);
                        console.log(`Title: ${c.title || 'N/A'}`);
                        console.log(`Type: ${c.type}`);
                        console.log(`Description: ${c.description || 'N/A'}`);
                        if (c.pinned_message) {
                            const pin = c.pinned_message;
                            const pinFrom = pin.from?.first_name || 'Unknown';
                            console.log(`Pinned: [${pinFrom}] ${pin.text || pin.caption || '[media]'}`);
                        }
                        console.log('');
                    }
                } catch {
                    /* ignore */
                }

                // 2. Member count + admin list
                try {
                    const countResp = await fetch(`https://api.telegram.org/bot${botToken}/getChatMemberCount`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ chat_id: chatId }),
                    });
                    const countData = await countResp.json();
                    if (countData.ok) console.log(`Members: ${countData.result}`);

                    const adminsResp = await fetch(`https://api.telegram.org/bot${botToken}/getChatAdministrators`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ chat_id: chatId }),
                    });
                    const adminsData = await adminsResp.json();
                    if (adminsData.ok) {
                        const admins = adminsData.result.map(a => {
                            const name = a.user.first_name || a.user.username || a.user.id;
                            const uname = a.user.username ? ` (@${a.user.username})` : '';
                            const bot = a.user.is_bot ? ' [BOT]' : '';
                            return `  ${a.status}: ${name}${uname}${bot}`;
                        });
                        console.log(`Admins:\n${admins.join('\n')}`);
                    }
                } catch {
                    /* ignore */
                }
                console.log('');
            }

            // 3. Local log history
            console.log(`=== Recent Messages (last ${limit}) ===`);
            if (!fs.existsSync(logDir)) {
                console.log('No local logs.');
                return;
            }
            const files = fs
                .readdirSync(logDir)
                .filter(f => f.startsWith(chatId + '_') && f.endsWith('.log'))
                .sort()
                .reverse();
            const lines = [];
            for (const f of files) {
                const content = fs.readFileSync(pathMod.default.join(logDir, f), 'utf-8');
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

        if (subcmd === 'leave') {
            const chatId = args[2];
            if (!chatId) {
                console.error('Usage: alma group leave <chatId>');
                process.exit(1);
            }
            try {
                const res = await api('POST', `/api/groups/${chatId}/leave`);
                if (res?.success) {
                    console.log(`✅ Left group ${chatId} (chat history preserved, use "alma group history ${chatId}" to review)`);
                } else {
                    console.error('Failed to leave group:', res?.error || 'unknown error');
                }
            } catch (e) {
                console.error('❌ Failed to leave group. Is Alma running?');
            }
            return;
        }

        if (subcmd === 'participation') {
            const settingsPath = pathMod.default.join(_os.homedir(), '.config', 'alma', 'group-settings.json');
            const action = args[2]; // show | set | reset

            // Load current settings
            let settings = { defaults: { randomBoostRate: 0.2, cooldownMinutes: 30, quietMinutes: 5, enabled: true }, groups: {} };
            try {
                if (fs.existsSync(settingsPath)) {
                    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
                }
            } catch {
                /* use defaults */
            }

            if (!action || action === 'show') {
                console.log('Group Participation Settings');
                console.log('===========================');
                console.log(`\nDefaults:`);
                console.log(`  randomBoostRate: ${settings.defaults?.randomBoostRate ?? 0.2} (0-1, probability of responding when AI says NO)`);
                console.log(`  cooldownMinutes: ${settings.defaults?.cooldownMinutes ?? 30} (min time between patrol replies per group)`);
                console.log(`  quietMinutes: ${settings.defaults?.quietMinutes ?? 5} (only patrol if no messages for this long)`);
                console.log(`  enabled: ${settings.defaults?.enabled ?? true}`);
                if (settings.groups && Object.keys(settings.groups).length > 0) {
                    console.log(`\nPer-group overrides:`);
                    for (const [gid, overrides] of Object.entries(settings.groups)) {
                        console.log(`  ${gid}: ${JSON.stringify(overrides)}`);
                    }
                }
                console.log(`\nFile: ${settingsPath}`);
                console.log(`Edit directly or use: alma group participation set <key> <value> [chatId]`);
                return;
            }

            if (action === 'set') {
                const key = args[3];
                const value = args[4];
                const chatId = args[5]; // optional, for per-group override
                if (!key || !value) {
                    console.error('Usage: alma group participation set <key> <value> [chatId]');
                    console.error('Keys: randomBoostRate, cooldownMinutes, quietMinutes, enabled');
                    process.exit(1);
                }
                const numVal = key === 'enabled' ? value === 'true' : Number(value);
                if (chatId) {
                    if (!settings.groups) settings.groups = {};
                    if (!settings.groups[chatId]) settings.groups[chatId] = {};
                    settings.groups[chatId][key] = numVal;
                    console.log(`✅ Set ${key}=${numVal} for group ${chatId}`);
                } else {
                    if (!settings.defaults) settings.defaults = {};
                    settings.defaults[key] = numVal;
                    console.log(`✅ Set default ${key}=${numVal}`);
                }
                fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
                return;
            }

            if (action === 'reset') {
                const chatId = args[3];
                if (chatId && settings.groups?.[chatId]) {
                    delete settings.groups[chatId];
                    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
                    console.log(`✅ Reset overrides for group ${chatId}`);
                } else if (!chatId) {
                    settings = { defaults: { randomBoostRate: 0.2, cooldownMinutes: 30, quietMinutes: 5, enabled: true }, groups: {} };
                    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
                    console.log('✅ Reset all participation settings to defaults');
                }
                return;
            }

            console.error('Usage: alma group participation [show|set|reset]');
            process.exit(1);
        }

        if (subcmd === 'rules') {
            const action = args[2]; // show | set | add | clear
            const chatId = args[3];

            if (!action || action === 'help') {
                console.log('Usage: alma group rules <show|set|add|clear> <chatId> [text]');
                console.log('  show <chatId>    — Show current rules for a group');
                console.log('  set <chatId> "rules text"  — Replace all rules');
                console.log('  add <chatId> "new rule"    — Append a rule');
                console.log('  clear <chatId>   — Remove all rules');
                console.log('\nRules file: ~/.config/alma/groups/<chatId>.rules.md');
                return;
            }

            if (!chatId) {
                console.error('Error: chatId is required');
                process.exit(1);
            }

            const rulesPath = pathMod.default.join(_os.homedir(), '.config', 'alma', 'groups', `${chatId}.rules.md`);

            if (action === 'show') {
                if (fs.existsSync(rulesPath)) {
                    console.log(fs.readFileSync(rulesPath, 'utf-8'));
                } else {
                    console.log('No rules set for this group.');
                }
                return;
            }

            if (action === 'set') {
                const text = args.slice(4).join(' ');
                if (!text) {
                    console.error('Error: rules text required');
                    process.exit(1);
                }
                const groupsDir = pathMod.default.join(_os.homedir(), '.config', 'alma', 'groups');
                if (!fs.existsSync(groupsDir)) fs.mkdirSync(groupsDir, { recursive: true });
                fs.writeFileSync(rulesPath, text + '\n');
                console.log(`✅ Rules set for group ${chatId}`);
                return;
            }

            if (action === 'add') {
                const text = args.slice(4).join(' ');
                if (!text) {
                    console.error('Error: rule text required');
                    process.exit(1);
                }
                const groupsDir = pathMod.default.join(_os.homedir(), '.config', 'alma', 'groups');
                if (!fs.existsSync(groupsDir)) fs.mkdirSync(groupsDir, { recursive: true });
                const existing = fs.existsSync(rulesPath) ? fs.readFileSync(rulesPath, 'utf-8') : '';
                fs.writeFileSync(rulesPath, existing + `- ${text}\n`);
                console.log(`✅ Rule added for group ${chatId}`);
                return;
            }

            if (action === 'clear') {
                if (fs.existsSync(rulesPath)) {
                    fs.unlinkSync(rulesPath);
                    console.log(`✅ Rules cleared for group ${chatId}`);
                } else {
                    console.log('No rules to clear.');
                }
                return;
            }

            console.error('Usage: alma group rules <show|set|add|clear> <chatId> [text]');
            process.exit(1);
        }

        console.error('Usage: alma group <list|history|search|context|send|pin|unpin|leave|participation|rules> [args]');
        process.exit(1);
    }


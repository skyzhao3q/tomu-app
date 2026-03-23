if (cmd === "msg") {
  const subcmd = args[1];
  if (subcmd === "delete") {
    const chatId = args[2];
    const messageId = args[3];
    if (!chatId || !messageId) {
      console.error("Usage: alma msg delete <chatId> <messageId>");
      process.exit(1);
    }
    const settings = await api("GET", "/api/settings");
    const botToken = settings?.telegram?.botToken;
    if (!botToken) {
      console.error("Telegram bot not configured.");
      process.exit(1);
    }
    const resp = await fetch(
      `https://api.telegram.org/bot${botToken}/deleteMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: parseInt(messageId),
        }),
      },
    );
    const result = await resp.json();
    if (result.ok) {
      console.log(`✅ Deleted message ${messageId} in chat ${chatId}`);
    } else {
      console.error("Failed:", result.description);
    }
    return;
  }
  if (subcmd === "react") {
    const chatId = args[2];
    const messageId = args[3];
    const emoji = args[4];
    if (!chatId || !messageId || !emoji) {
      console.error("Usage: alma msg react <chatId> <messageId> <emoji>");
      process.exit(1);
    }
    const settings = await api("GET", "/api/settings");
    const botToken = settings?.telegram?.botToken;
    if (!botToken) {
      console.error("Telegram bot not configured.");
      process.exit(1);
    }
    const resp = await fetch(
      `https://api.telegram.org/bot${botToken}/setMessageReaction`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: parseInt(messageId),
          reaction: [{ type: "emoji", emoji }],
        }),
      },
    );
    const result = await resp.json();
    if (result.ok) {
      console.log(
        `✅ Reacted ${emoji} to message ${messageId} in chat ${chatId}`,
      );
    } else {
      console.error("Failed:", result.description);
    }
    return;
  }
  if (subcmd === "sticker-search" || subcmd === "sticker-list") {
    const setName = args[2];
    if (!setName) {
      // List known sticker sets from index
      const fs = await import("fs");
      const indexPath = _path.join(
        _os.homedir(),
        ".config",
        "alma",
        "stickers",
        "index.json",
      );
      if (fs.existsSync(indexPath)) {
        const index = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
        const sets = Object.keys(index);
        if (sets.length === 0) {
          console.log(
            "No sticker sets indexed yet. Send/receive stickers to build the index.",
          );
        } else {
          console.log(`Known sticker sets (${sets.length}):`);
          for (const s of sets) {
            console.log(`  ${s} — ${index[s].length} stickers`);
          }
        }
      } else {
        console.log(
          "No sticker index yet. Alma builds it as she sees stickers.",
        );
      }
      return;
    }
    const settings = await api("GET", "/api/settings");
    const botToken = settings?.telegram?.botToken;
    if (!botToken) {
      console.error("Telegram bot not configured.");
      process.exit(1);
    }
    const resp = await fetch(
      `https://api.telegram.org/bot${botToken}/getStickerSet?name=${encodeURIComponent(setName)}`,
    );
    const result = await resp.json();
    if (!result.ok) {
      console.error("Failed:", result.description);
      process.exit(1);
    }
    const stickers = result.result.stickers || [];
    console.log(
      `Sticker set: ${result.result.name} (${result.result.title}) — ${stickers.length} stickers`,
    );
    // Save to index
    const fs = await import("fs");
    const stickerDir = _path.join(_os.homedir(), ".config", "alma", "stickers");
    if (!fs.existsSync(stickerDir))
      fs.mkdirSync(stickerDir, { recursive: true });
    const indexPath = _path.join(stickerDir, "index.json");
    let index = {};
    if (fs.existsSync(indexPath)) {
      try {
        index = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
      } catch {
        /* */
      }
    }
    index[setName] = stickers.map((s) => ({
      emoji: s.emoji,
      file_id: s.file_id,
      is_animated: s.is_animated,
      is_video: s.is_video,
    }));
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
    // Print stickers
    for (const s of stickers) {
      console.log(`  ${s.emoji || "?"}  file_id: ${s.file_id}`);
    }
    console.log(`\nIndexed ${stickers.length} stickers from "${setName}".`);
    return;
  }

  if (subcmd === "sticker-find") {
    // Find stickers by emoji across all indexed sets
    const emoji = args[2];
    if (!emoji) {
      console.error("Usage: alma msg sticker-find <emoji>");
      process.exit(1);
    }
    const fs = await import("fs");
    const indexPath = _path.join(
      _os.homedir(),
      ".config",
      "alma",
      "stickers",
      "index.json",
    );
    if (!fs.existsSync(indexPath)) {
      console.log(
        "No sticker index. Use `alma msg sticker-search <set_name>` first.",
      );
      return;
    }
    const index = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
    let found = 0;
    for (const [setName, stickers] of Object.entries(index)) {
      for (const s of stickers) {
        if (s.emoji === emoji) {
          console.log(`  ${s.emoji}  set:${setName}  file_id:${s.file_id}`);
          found++;
        }
      }
    }
    if (found === 0) console.log(`No stickers found for emoji "${emoji}".`);
    else console.log(`\nFound ${found} sticker(s).`);
    return;
  }

  if (subcmd === "sticker") {
    const chatId = args[2];
    const stickerId = args[3];
    if (!chatId || !stickerId) {
      console.error("Usage: alma msg sticker <chatId> <sticker_file_id>");
      process.exit(1);
    }
    const settings = await api("GET", "/api/settings");
    const botToken = settings?.telegram?.botToken;
    if (!botToken) {
      console.error("Telegram bot not configured.");
      process.exit(1);
    }
    // Show "choosing sticker" action before sending
    await fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, action: "choose_sticker" }),
    }).catch(() => {});
    const resp = await fetch(
      `https://api.telegram.org/bot${botToken}/sendSticker`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, sticker: stickerId }),
      },
    );
    const result = await resp.json();
    if (result.ok) {
      console.log(`✅ Sent sticker to ${chatId}`);
    } else {
      console.error("Failed:", result.description);
    }
    return;
  }
  console.error("Usage: alma msg <delete|react|sticker> ...");
  return;
}
if (cmd === 'msg') {
        const subcmd = args[1];
        if (subcmd === 'delete') {
            const chatId = args[2];
            const messageId = args[3];
            if (!chatId || !messageId) {
                console.error('Usage: alma msg delete <chatId> <messageId>');
                process.exit(1);
            }
            const settings = await api('GET', '/api/settings');
            const botToken = settings?.telegram?.botToken;
            if (!botToken) {
                console.error('Telegram bot not configured.');
                process.exit(1);
            }
            const resp = await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId, message_id: parseInt(messageId) }),
            });
            const result = await resp.json();
            if (result.ok) {
                console.log(`✅ Deleted message ${messageId} in chat ${chatId}`);
            } else {
                console.error('Failed:', result.description);
            }
            return;
        }
        if (subcmd === 'react') {
            const chatId = args[2];
            const messageId = args[3];
            const emoji = args[4];
            if (!chatId || !messageId || !emoji) {
                console.error('Usage: alma msg react <chatId> <messageId> <emoji>');
                process.exit(1);
            }
            const settings = await api('GET', '/api/settings');
            const botToken = settings?.telegram?.botToken;
            if (!botToken) {
                console.error('Telegram bot not configured.');
                process.exit(1);
            }
            const resp = await fetch(`https://api.telegram.org/bot${botToken}/setMessageReaction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    message_id: parseInt(messageId),
                    reaction: [{ type: 'emoji', emoji }],
                }),
            });
            const result = await resp.json();
            if (result.ok) {
                console.log(`✅ Reacted ${emoji} to message ${messageId} in chat ${chatId}`);
            } else {
                console.error('Failed:', result.description);
            }
            return;
        }
        if (subcmd === 'sticker-search' || subcmd === 'sticker-list') {
            const setName = args[2];
            if (!setName) {
                // List known sticker sets from index
                const fs = await import('fs');
                const indexPath = _path.join(_os.homedir(), '.config', 'alma', 'stickers', 'index.json');
                if (fs.existsSync(indexPath)) {
                    const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
                    const sets = Object.keys(index);
                    if (sets.length === 0) {
                        console.log('No sticker sets indexed yet. Send/receive stickers to build the index.');
                    } else {
                        console.log(`Known sticker sets (${sets.length}):`);
                        for (const s of sets) {
                            console.log(`  ${s} — ${index[s].length} stickers`);
                        }
                    }
                } else {
                    console.log('No sticker index yet. Alma builds it as she sees stickers.');
                }
                return;
            }
            const settings = await api('GET', '/api/settings');
            const botToken = settings?.telegram?.botToken;
            if (!botToken) {
                console.error('Telegram bot not configured.');
                process.exit(1);
            }
            const resp = await fetch(`https://api.telegram.org/bot${botToken}/getStickerSet?name=${encodeURIComponent(setName)}`);
            const result = await resp.json();
            if (!result.ok) {
                console.error('Failed:', result.description);
                process.exit(1);
            }
            const stickers = result.result.stickers || [];
            console.log(`Sticker set: ${result.result.name} (${result.result.title}) — ${stickers.length} stickers`);
            // Save to index
            const fs = await import('fs');
            const stickerDir = _path.join(_os.homedir(), '.config', 'alma', 'stickers');
            if (!fs.existsSync(stickerDir)) fs.mkdirSync(stickerDir, { recursive: true });
            const indexPath = _path.join(stickerDir, 'index.json');
            let index = {};
            if (fs.existsSync(indexPath)) {
                try {
                    index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
                } catch {
                    /* */
                }
            }
            index[setName] = stickers.map(s => ({ emoji: s.emoji, file_id: s.file_id, is_animated: s.is_animated, is_video: s.is_video }));
            fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
            // Print stickers
            for (const s of stickers) {
                console.log(`  ${s.emoji || '?'}  file_id: ${s.file_id}`);
            }
            console.log(`\nIndexed ${stickers.length} stickers from "${setName}".`);
            return;
        }

        if (subcmd === 'sticker-find') {
            // Find stickers by emoji across all indexed sets
            const emoji = args[2];
            if (!emoji) {
                console.error('Usage: alma msg sticker-find <emoji>');
                process.exit(1);
            }
            const fs = await import('fs');
            const indexPath = _path.join(_os.homedir(), '.config', 'alma', 'stickers', 'index.json');
            if (!fs.existsSync(indexPath)) {
                console.log('No sticker index. Use `alma msg sticker-search <set_name>` first.');
                return;
            }
            const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
            let found = 0;
            for (const [setName, stickers] of Object.entries(index)) {
                for (const s of stickers) {
                    if (s.emoji === emoji) {
                        console.log(`  ${s.emoji}  set:${setName}  file_id:${s.file_id}`);
                        found++;
                    }
                }
            }
            if (found === 0) console.log(`No stickers found for emoji "${emoji}".`);
            else console.log(`\nFound ${found} sticker(s).`);
            return;
        }

        if (subcmd === 'sticker') {
            const chatId = args[2];
            const stickerId = args[3];
            if (!chatId || !stickerId) {
                console.error('Usage: alma msg sticker <chatId> <sticker_file_id>');
                process.exit(1);
            }
            const settings = await api('GET', '/api/settings');
            const botToken = settings?.telegram?.botToken;
            if (!botToken) {
                console.error('Telegram bot not configured.');
                process.exit(1);
            }
            // Show "choosing sticker" action before sending
            await fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId, action: 'choose_sticker' }),
            }).catch(() => {});
            const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendSticker`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId, sticker: stickerId }),
            });
            const result = await resp.json();
            if (result.ok) {
                console.log(`✅ Sent sticker to ${chatId}`);
            } else {
                console.error('Failed:', result.description);
            }
            return;
        }
        console.error('Usage: alma msg <delete|react|sticker> ...');
        return;
    }


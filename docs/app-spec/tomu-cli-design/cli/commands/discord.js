if (cmd === "discord") {
  const subcmd = args[1];
  if (subcmd === "list" || subcmd === "servers") {
    const result = await api("GET", "/api/discord/servers");
    const servers = result.servers || [];
    if (servers.length === 0) {
      console.log("No Discord servers connected.");
    } else {
      for (const s of servers) {
        console.log(`\n🏠 ${s.name} (ID: ${s.id}, ${s.memberCount} members)`);
        for (const ch of s.channels) {
          console.log(`  #${ch.name} — ${ch.id} (${ch.type})`);
        }
      }
    }
    process.exit(0);
  }
  if (subcmd === "send") {
    const channelId = args[2];
    // Parse --reply-to flag
    let replyTo;
    const replyIdx = args.indexOf("--reply-to");
    let msgArgs = args.slice(3);
    if (replyIdx >= 0) {
      replyTo = args[replyIdx + 1];
      msgArgs = [...args.slice(3, replyIdx), ...args.slice(replyIdx + 2)];
    }
    const message = msgArgs.join(" ").replace(/\\n/g, "\n");
    if (!channelId || !message) {
      console.error(
        'Usage: alma discord send <channelId> "<message>" [--reply-to <messageId>]',
      );
      process.exit(1);
    }
    try {
      const result = await api(
        "POST",
        `/api/discord/channels/${channelId}/send`,
        { message, replyTo },
      );
      if (result?.ok || result?.messageId) {
        console.log(`✅ Message sent to Discord channel ${channelId}`);
      } else {
        console.error(
          "Failed:",
          result?.error || result?.description || "unknown error",
        );
      }
    } catch (err) {
      console.error("Error sending Discord message:", err.message || err);
      process.exit(1);
    }
  } else if (subcmd === "send-photo" || subcmd === "send-file") {
    const channelId = args[2];
    const filePath = args[3];
    const caption = args.slice(4).join(" ") || undefined;
    if (!channelId || !filePath) {
      console.error(
        `Usage: alma discord ${subcmd} <channelId> <filePath> [caption]`,
      );
      process.exit(1);
    }
    try {
      const endpoint = subcmd === "send-photo" ? "send-photo" : "send-file";
      const result = await api(
        "POST",
        `/api/discord/channels/${channelId}/${endpoint}`,
        { filePath, caption },
      );
      if (result?.ok || result?.messageId) {
        console.log(
          `✅ ${subcmd === "send-photo" ? "Photo" : "File"} sent to Discord channel ${channelId}`,
        );
      } else {
        console.error("Failed:", result?.error || "unknown error");
      }
    } catch (err) {
      console.error(`Error sending Discord ${subcmd}:`, err.message || err);
      process.exit(1);
    }
  } else if (subcmd === "sticker") {
    const channelId = args[2];
    const stickerId = args[3];
    if (!channelId || !stickerId) {
      console.error("Usage: alma discord sticker <channelId> <stickerId>");
      process.exit(1);
    }
    try {
      const result = await api(
        "POST",
        `/api/discord/channels/${channelId}/sticker`,
        { stickerId },
      );
      if (result?.ok || result?.messageId) {
        console.log(`✅ Sticker sent to Discord channel ${channelId}`);
      } else {
        console.error("Failed:", result?.error || "unknown error");
      }
    } catch (err) {
      console.error("Error sending Discord sticker:", err.message || err);
      process.exit(1);
    }
  } else if (subcmd === "sticker-list") {
    const guildId = args[2] || "";
    try {
      const qs = guildId ? `?guildId=${guildId}` : "";
      const result = await api("GET", `/api/discord/stickers${qs}`);
      if (result?.stickers) {
        for (const s of result.stickers) {
          console.log(`${s.id}\t${s.name}\t[${s.guildName}]`);
        }
        if (result.stickers.length === 0) console.log("No stickers found.");
      } else {
        console.error("Failed:", result?.error || "unknown error");
      }
    } catch (err) {
      console.error("Error listing stickers:", err.message || err);
      process.exit(1);
    }
  } else if (subcmd === "sticker-find") {
    const query = args.slice(2).join(" ").toLowerCase();
    if (!query) {
      console.error("Usage: alma discord sticker-find <query>");
      process.exit(1);
    }
    try {
      const result = await api("GET", `/api/discord/stickers`);
      if (result?.stickers) {
        const matches = result.stickers.filter((s) =>
          s.name.toLowerCase().includes(query),
        );
        for (const s of matches) {
          console.log(`${s.id}\t${s.name}\t[${s.guildName}]`);
        }
        if (matches.length === 0) console.log("No stickers matching query.");
      } else {
        console.error("Failed:", result?.error || "unknown error");
      }
    } catch (err) {
      console.error("Error searching stickers:", err.message || err);
      process.exit(1);
    }
  } else if (subcmd === "dm") {
    const userId = args[2];
    const message = args.slice(3).join(" ").replace(/\\n/g, "\n");
    if (!userId || !message) {
      console.error('Usage: alma discord dm <userId> "<message>"');
      console.error("  userId: Discord numeric user ID");
      console.error(
        "  Note: The user must share a server with the bot or have DMs enabled.",
      );
      process.exit(1);
    }
    try {
      const result = await api("POST", "/api/discord/dm", { userId, message });
      if (result?.ok || result?.messageId) {
        console.log(`✅ DM sent to Discord user ${userId}`);
      } else {
        console.error(
          "Failed:",
          result?.error || result?.description || "unknown error",
        );
      }
    } catch (err) {
      console.error("Error sending Discord DM:", err.message || err);
      process.exit(1);
    }
  } else if (subcmd === "delete") {
    const channelId = args[2];
    const messageId = args[3];
    if (!channelId || !messageId) {
      console.error("Usage: alma discord delete <channelId> <messageId>");
      process.exit(1);
    }
    try {
      await api(
        "DELETE",
        `/api/discord/channels/${channelId}/messages/${messageId}`,
      );
      console.log("✅ Message deleted.");
    } catch (err) {
      console.error("Error deleting Discord message:", err.message || err);
      process.exit(1);
    }
  } else if (subcmd === "messages" || subcmd === "history") {
    // alma discord messages <channelId> [--limit N] [--around messageId]
    const channelId = args[2];
    if (!channelId) {
      console.error(
        "Usage: alma discord messages <channelId> [--limit N] [--around <messageId>]",
      );
      process.exit(1);
    }
    const limitIdx = args.indexOf("--limit");
    const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) || 20 : 20;
    const aroundIdx = args.indexOf("--around");
    const around = aroundIdx >= 0 ? args[aroundIdx + 1] : undefined;
    try {
      let url = `/api/discord/channels/${channelId}/messages?limit=${limit}`;
      if (around) url += `&around=${around}`;
      const result = await api("GET", url);
      if (result.messages) {
        for (const m of result.messages) {
          const ts = new Date(m.timestamp).toLocaleTimeString("en-US", {
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
          });
          const attachHint =
            m.attachments?.length > 0
              ? ` [${m.attachments.length} attachment(s)]`
              : "";
          console.log(
            `[${ts}] [${m.id}] ${m.author} (${m.authorId}): ${m.content}${attachHint}`,
          );
        }
      }
    } catch (err) {
      console.error("Error fetching messages:", err.message || err);
      process.exit(1);
    }
  } else if (subcmd === "fetch") {
    // alma discord fetch <channelId> <messageId> — fetch a single message
    const channelId = args[2];
    const messageId = args[3];
    if (!channelId || !messageId) {
      console.error("Usage: alma discord fetch <channelId> <messageId>");
      process.exit(1);
    }
    try {
      const result = await api(
        "GET",
        `/api/discord/channels/${channelId}/messages?limit=1&around=${messageId}`,
      );
      if (result.messages) {
        for (const m of result.messages) {
          console.log(`Author: ${m.author} (${m.authorId})`);
          console.log(`Time: ${m.timestamp}`);
          console.log(`Content: ${m.content}`);
          if (m.attachments?.length > 0) {
            console.log(`Attachments: ${m.attachments.join(", ")}`);
          }
        }
      }
    } catch (err) {
      console.error("Error fetching message:", err.message || err);
      process.exit(1);
    }
  } else {
    console.error(
      "Usage: alma discord <list|send|send-photo|send-file|dm|delete|messages|fetch|sticker|sticker-list|sticker-find> [args]",
    );
    process.exit(1);
  }
  process.exit(0);
}
if (cmd === 'discord') {
        const subcmd = args[1];
        if (subcmd === 'list' || subcmd === 'servers') {
            const result = await api('GET', '/api/discord/servers');
            const servers = result.servers || [];
            if (servers.length === 0) {
                console.log('No Discord servers connected.');
            } else {
                for (const s of servers) {
                    console.log(`\n🏠 ${s.name} (ID: ${s.id}, ${s.memberCount} members)`);
                    for (const ch of s.channels) {
                        console.log(`  #${ch.name} — ${ch.id} (${ch.type})`);
                    }
                }
            }
            process.exit(0);
        }
        if (subcmd === 'send') {
            const channelId = args[2];
            // Parse --reply-to flag
            let replyTo;
            const replyIdx = args.indexOf('--reply-to');
            let msgArgs = args.slice(3);
            if (replyIdx >= 0) {
                replyTo = args[replyIdx + 1];
                msgArgs = [...args.slice(3, replyIdx), ...args.slice(replyIdx + 2)];
            }
            const message = msgArgs.join(' ').replace(/\\n/g, '\n');
            if (!channelId || !message) {
                console.error('Usage: alma discord send <channelId> "<message>" [--reply-to <messageId>]');
                process.exit(1);
            }
            try {
                const result = await api('POST', `/api/discord/channels/${channelId}/send`, { message, replyTo });
                if (result?.ok || result?.messageId) {
                    console.log(`✅ Message sent to Discord channel ${channelId}`);
                } else {
                    console.error('Failed:', result?.error || result?.description || 'unknown error');
                }
            } catch (err) {
                console.error('Error sending Discord message:', err.message || err);
                process.exit(1);
            }
        } else if (subcmd === 'send-photo' || subcmd === 'send-file') {
            const channelId = args[2];
            const filePath = args[3];
            const caption = args.slice(4).join(' ') || undefined;
            if (!channelId || !filePath) {
                console.error(`Usage: alma discord ${subcmd} <channelId> <filePath> [caption]`);
                process.exit(1);
            }
            try {
                const endpoint = subcmd === 'send-photo' ? 'send-photo' : 'send-file';
                const result = await api('POST', `/api/discord/channels/${channelId}/${endpoint}`, { filePath, caption });
                if (result?.ok || result?.messageId) {
                    console.log(`✅ ${subcmd === 'send-photo' ? 'Photo' : 'File'} sent to Discord channel ${channelId}`);
                } else {
                    console.error('Failed:', result?.error || 'unknown error');
                }
            } catch (err) {
                console.error(`Error sending Discord ${subcmd}:`, err.message || err);
                process.exit(1);
            }
        } else if (subcmd === 'sticker') {
            const channelId = args[2];
            const stickerId = args[3];
            if (!channelId || !stickerId) {
                console.error('Usage: alma discord sticker <channelId> <stickerId>');
                process.exit(1);
            }
            try {
                const result = await api('POST', `/api/discord/channels/${channelId}/sticker`, { stickerId });
                if (result?.ok || result?.messageId) {
                    console.log(`✅ Sticker sent to Discord channel ${channelId}`);
                } else {
                    console.error('Failed:', result?.error || 'unknown error');
                }
            } catch (err) {
                console.error('Error sending Discord sticker:', err.message || err);
                process.exit(1);
            }
        } else if (subcmd === 'sticker-list') {
            const guildId = args[2] || '';
            try {
                const qs = guildId ? `?guildId=${guildId}` : '';
                const result = await api('GET', `/api/discord/stickers${qs}`);
                if (result?.stickers) {
                    for (const s of result.stickers) {
                        console.log(`${s.id}\t${s.name}\t[${s.guildName}]`);
                    }
                    if (result.stickers.length === 0) console.log('No stickers found.');
                } else {
                    console.error('Failed:', result?.error || 'unknown error');
                }
            } catch (err) {
                console.error('Error listing stickers:', err.message || err);
                process.exit(1);
            }
        } else if (subcmd === 'sticker-find') {
            const query = args.slice(2).join(' ').toLowerCase();
            if (!query) {
                console.error('Usage: alma discord sticker-find <query>');
                process.exit(1);
            }
            try {
                const result = await api('GET', `/api/discord/stickers`);
                if (result?.stickers) {
                    const matches = result.stickers.filter(s => s.name.toLowerCase().includes(query));
                    for (const s of matches) {
                        console.log(`${s.id}\t${s.name}\t[${s.guildName}]`);
                    }
                    if (matches.length === 0) console.log('No stickers matching query.');
                } else {
                    console.error('Failed:', result?.error || 'unknown error');
                }
            } catch (err) {
                console.error('Error searching stickers:', err.message || err);
                process.exit(1);
            }
        } else if (subcmd === 'dm') {
            const userId = args[2];
            const message = args.slice(3).join(' ').replace(/\\n/g, '\n');
            if (!userId || !message) {
                console.error('Usage: alma discord dm <userId> "<message>"');
                console.error('  userId: Discord numeric user ID');
                console.error('  Note: The user must share a server with the bot or have DMs enabled.');
                process.exit(1);
            }
            try {
                const result = await api('POST', '/api/discord/dm', { userId, message });
                if (result?.ok || result?.messageId) {
                    console.log(`✅ DM sent to Discord user ${userId}`);
                } else {
                    console.error('Failed:', result?.error || result?.description || 'unknown error');
                }
            } catch (err) {
                console.error('Error sending Discord DM:', err.message || err);
                process.exit(1);
            }
        } else if (subcmd === 'delete') {
            const channelId = args[2];
            const messageId = args[3];
            if (!channelId || !messageId) {
                console.error('Usage: alma discord delete <channelId> <messageId>');
                process.exit(1);
            }
            try {
                await api('DELETE', `/api/discord/channels/${channelId}/messages/${messageId}`);
                console.log('✅ Message deleted.');
            } catch (err) {
                console.error('Error deleting Discord message:', err.message || err);
                process.exit(1);
            }
        } else if (subcmd === 'messages' || subcmd === 'history') {
            // alma discord messages <channelId> [--limit N] [--around messageId]
            const channelId = args[2];
            if (!channelId) {
                console.error('Usage: alma discord messages <channelId> [--limit N] [--around <messageId>]');
                process.exit(1);
            }
            const limitIdx = args.indexOf('--limit');
            const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) || 20 : 20;
            const aroundIdx = args.indexOf('--around');
            const around = aroundIdx >= 0 ? args[aroundIdx + 1] : undefined;
            try {
                let url = `/api/discord/channels/${channelId}/messages?limit=${limit}`;
                if (around) url += `&around=${around}`;
                const result = await api('GET', url);
                if (result.messages) {
                    for (const m of result.messages) {
                        const ts = new Date(m.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
                        const attachHint = m.attachments?.length > 0 ? ` [${m.attachments.length} attachment(s)]` : '';
                        console.log(`[${ts}] [${m.id}] ${m.author} (${m.authorId}): ${m.content}${attachHint}`);
                    }
                }
            } catch (err) {
                console.error('Error fetching messages:', err.message || err);
                process.exit(1);
            }
        } else if (subcmd === 'fetch') {
            // alma discord fetch <channelId> <messageId> — fetch a single message
            const channelId = args[2];
            const messageId = args[3];
            if (!channelId || !messageId) {
                console.error('Usage: alma discord fetch <channelId> <messageId>');
                process.exit(1);
            }
            try {
                const result = await api('GET', `/api/discord/channels/${channelId}/messages?limit=1&around=${messageId}`);
                if (result.messages) {
                    for (const m of result.messages) {
                        console.log(`Author: ${m.author} (${m.authorId})`);
                        console.log(`Time: ${m.timestamp}`);
                        console.log(`Content: ${m.content}`);
                        if (m.attachments?.length > 0) {
                            console.log(`Attachments: ${m.attachments.join(', ')}`);
                        }
                    }
                }
            } catch (err) {
                console.error('Error fetching message:', err.message || err);
                process.exit(1);
            }
        } else {
            console.error('Usage: alma discord <list|send|send-photo|send-file|dm|delete|messages|fetch|sticker|sticker-list|sticker-find> [args]');
            process.exit(1);
        }
        process.exit(0);
    }


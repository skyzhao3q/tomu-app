if (cmd === "feishu") {
  const subcmd = args[1];
  if (subcmd === "send") {
    const chatId = args[2];
    const message = args.slice(3).join(" ").replace(/\\n/g, "\n");
    if (!chatId || !message) {
      console.error('Usage: alma feishu send <chatId> "<message>"');
      process.exit(1);
    }
    try {
      const result = await api("POST", `/api/feishu/chats/${chatId}/send`, {
        message,
      });
      if (result?.ok || result?.messageId) {
        console.log(`✅ Message sent to Feishu chat ${chatId}`);
      } else {
        console.error(
          "Failed:",
          result?.error || result?.description || "unknown error",
        );
      }
    } catch (err) {
      console.error("Error sending Feishu message:", err.message || err);
      process.exit(1);
    }
  } else if (subcmd === "send-photo") {
    const chatId = args[2];
    const filePath = args[3];
    const caption = args.slice(4).join(" ") || undefined;
    if (!chatId || !filePath) {
      console.error(
        "Usage: alma feishu send-photo <chatId> <filePath> [caption]",
      );
      process.exit(1);
    }
    try {
      const result = await api("POST", "/api/feishu/send-photo", {
        chatId,
        filePath,
        caption,
      });
      if (result?.ok) {
        console.log(`✅ Photo sent to Feishu chat ${chatId}`);
      } else {
        console.error("Failed:", result?.error || "unknown error");
      }
    } catch (err) {
      console.error("Error:", err.message || err);
      process.exit(1);
    }
  } else {
    console.error("Usage: alma feishu <send|send-photo> [args]");
    process.exit(1);
  }
  process.exit(0);
}
if (cmd === 'feishu') {
        const subcmd = args[1];
        if (subcmd === 'send') {
            const chatId = args[2];
            const message = args.slice(3).join(' ').replace(/\\n/g, '\n');
            if (!chatId || !message) {
                console.error('Usage: alma feishu send <chatId> "<message>"');
                process.exit(1);
            }
            try {
                const result = await api('POST', `/api/feishu/chats/${chatId}/send`, { message });
                if (result?.ok || result?.messageId) {
                    console.log(`✅ Message sent to Feishu chat ${chatId}`);
                } else {
                    console.error('Failed:', result?.error || result?.description || 'unknown error');
                }
            } catch (err) {
                console.error('Error sending Feishu message:', err.message || err);
                process.exit(1);
            }
        } else if (subcmd === 'send-photo') {
            const chatId = args[2];
            const filePath = args[3];
            const caption = args.slice(4).join(' ') || undefined;
            if (!chatId || !filePath) {
                console.error('Usage: alma feishu send-photo <chatId> <filePath> [caption]');
                process.exit(1);
            }
            try {
                const result = await api('POST', '/api/feishu/send-photo', { chatId, filePath, caption });
                if (result?.ok) {
                    console.log(`✅ Photo sent to Feishu chat ${chatId}`);
                } else {
                    console.error('Failed:', result?.error || 'unknown error');
                }
            } catch (err) {
                console.error('Error:', err.message || err);
                process.exit(1);
            }
        } else {
            console.error('Usage: alma feishu <send|send-photo> [args]');
            process.exit(1);
        }
        process.exit(0);
    }


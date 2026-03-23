if (cmd === "dm") {
  const userId = args[1];
  const message = args.slice(2).join(" ").replace(/\\n/g, "\n");
  if (!userId || !message) {
    console.error("Usage: alma dm <userId> <message>");
    console.error(
      "  userId: Telegram numeric user ID (find in people profiles)",
    );
    console.error("  Note: The user must have /start-ed the bot first.");
    process.exit(1);
  }
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
      body: JSON.stringify({ chat_id: userId, text: message }),
    },
  );
  const result = await resp.json();
  if (result.ok) {
    console.log(`✅ DM sent to user ${userId}`);
  } else {
    if (
      result.description?.includes("bot was blocked") ||
      result.description?.includes("bot can't initiate")
    ) {
      console.error(
        `❌ Cannot DM: user hasn't started the bot or has blocked it.`,
      );
    } else {
      console.error("Failed:", result.description);
    }
  }
  return;
}
if (cmd === 'dm') {
        const userId = args[1];
        const message = args.slice(2).join(' ').replace(/\\n/g, '\n');
        if (!userId || !message) {
            console.error('Usage: alma dm <userId> <message>');
            console.error('  userId: Telegram numeric user ID (find in people profiles)');
            console.error('  Note: The user must have /start-ed the bot first.');
            process.exit(1);
        }
        const settings = await api('GET', '/api/settings');
        const botToken = settings?.telegram?.botToken;
        if (!botToken) {
            console.error('Telegram bot not configured.');
            process.exit(1);
        }
        const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: userId, text: message }),
        });
        const result = await resp.json();
        if (result.ok) {
            console.log(`✅ DM sent to user ${userId}`);
        } else {
            if (result.description?.includes('bot was blocked') || result.description?.includes("bot can't initiate")) {
                console.error(`❌ Cannot DM: user hasn't started the bot or has blocked it.`);
            } else {
                console.error('Failed:', result.description);
            }
        }
        return;
    }


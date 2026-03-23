if (cmd === "travel") {
  const fs = await import("fs");
  const pathMod = await import("path");
  const travelDir = pathMod.default.join(
    _os.homedir(),
    ".config",
    "alma",
    "travels",
  );
  const statusFile = pathMod.default.join(travelDir, "status.json");
  const historyFile = pathMod.default.join(travelDir, "history.json");

  if (!fs.existsSync(travelDir)) fs.mkdirSync(travelDir, { recursive: true });

  const loadStatus = () => {
    try {
      if (fs.existsSync(statusFile))
        return JSON.parse(fs.readFileSync(statusFile, "utf-8"));
    } catch {}
    return {
      traveling: false,
      destination: null,
      departedAt: null,
      day: 0,
      events: [],
      mood: "neutral",
      budget: 1000,
    };
  };
  const saveStatus = (s) =>
    fs.writeFileSync(statusFile, JSON.stringify(s, null, 2), "utf-8");
  const loadHistory = () => {
    try {
      if (fs.existsSync(historyFile))
        return JSON.parse(fs.readFileSync(historyFile, "utf-8"));
    } catch {}
    return { trips: [] };
  };
  const saveHistory = (h) =>
    fs.writeFileSync(historyFile, JSON.stringify(h, null, 2), "utf-8");

  const subcmd = args[1];

  if (!subcmd || subcmd === "status") {
    const s = loadStatus();
    if (s.traveling) {
      console.log(`✈️ Currently traveling to: ${s.destination}`);
      console.log(`📅 Day ${s.day} (departed: ${s.departedAt})`);
      console.log(`💰 Budget remaining: ¥${s.budget}`);
      console.log(`😊 Mood: ${s.mood}`);
      console.log(`📝 Events so far: ${s.events.length}`);
      if (s.events.length > 0) {
        console.log("Recent events:");
        for (const e of s.events.slice(-3)) {
          console.log(`  - [Day ${e.day}] ${e.summary}`);
        }
      }
    } else {
      console.log("🏠 At home. Not traveling.");
      const h = loadHistory();
      if (h.trips.length > 0) {
        const last = h.trips[h.trips.length - 1];
        console.log(
          `Last trip: ${last.destination} (${last.departedAt} — ${last.returnedAt})`,
        );
      }
    }
    return;
  }

  if (subcmd === "go") {
    const destination = args.slice(2).join(" ");
    if (!destination) {
      console.error("Usage: alma travel go <destination>");
      process.exit(1);
    }
    const s = loadStatus();
    if (s.traveling) {
      console.error(`Already traveling to ${s.destination}! Come home first.`);
      process.exit(1);
    }
    const now = new Date().toISOString().slice(0, 10);
    s.traveling = true;
    s.destination = destination;
    s.departedAt = now;
    s.day = 1;
    s.events = [];
    s.mood = "excited";
    s.budget = 800 + Math.floor(Math.random() * 400); // ¥800-1200
    saveStatus(s);
    console.log(
      `✈️ Departed for ${destination}! Budget: ¥${s.budget}. Have fun!`,
    );
    return;
  }

  if (subcmd === "event") {
    const summary = args.slice(2).join(" ");
    if (!summary) {
      console.error("Usage: alma travel event <description>");
      process.exit(1);
    }
    const s = loadStatus();
    if (!s.traveling) {
      console.error('Not traveling. Use "alma travel go <dest>" first.');
      process.exit(1);
    }
    const cost = Math.floor(Math.random() * 100) + 10;
    s.budget = Math.max(0, s.budget - cost);
    s.events.push({
      day: s.day,
      summary,
      cost,
      timestamp: new Date().toISOString(),
    });
    saveStatus(s);
    console.log(
      `📝 Event recorded (Day ${s.day}, ¥${cost} spent). Budget: ¥${s.budget} remaining.`,
    );
    return;
  }

  if (subcmd === "advance") {
    // Advance to next day
    const s = loadStatus();
    if (!s.traveling) {
      console.error("Not traveling.");
      process.exit(1);
    }
    s.day += 1;
    saveStatus(s);
    console.log(`🌅 Day ${s.day} in ${s.destination}. Budget: ¥${s.budget}.`);
    return;
  }

  if (subcmd === "mood") {
    const mood = args[2];
    if (!mood) {
      console.error("Usage: alma travel mood <mood>");
      process.exit(1);
    }
    const s = loadStatus();
    s.mood = mood;
    saveStatus(s);
    console.log(`😊 Travel mood updated: ${mood}`);
    return;
  }

  if (subcmd === "home" || subcmd === "return") {
    const s = loadStatus();
    if (!s.traveling) {
      console.error("Already at home.");
      process.exit(1);
    }
    const now = new Date().toISOString().slice(0, 10);
    // Calculate actual days from dates (more reliable than manual advance counter)
    const actualDays = s.departedAt
      ? Math.max(
          1,
          Math.ceil(
            (new Date(now).getTime() - new Date(s.departedAt).getTime()) /
              86400000,
          ),
        )
      : s.day;
    // Save trip to history
    const h = loadHistory();
    h.trips.push({
      destination: s.destination,
      departedAt: s.departedAt,
      returnedAt: now,
      days: actualDays,
      events: s.events,
      totalSpent: s.events.reduce((sum, e) => sum + (e.cost || 0), 0),
      mood: s.mood,
    });
    saveHistory(h);
    // Reset status
    s.traveling = false;
    s.destination = null;
    s.departedAt = null;
    s.day = 0;
    s.events = [];
    s.mood = "neutral";
    s.budget = 1000;
    saveStatus(s);
    console.log(
      `🏠 Returned home from ${h.trips[h.trips.length - 1].destination}! (${h.trips[h.trips.length - 1].days} days, ¥${h.trips[h.trips.length - 1].totalSpent} spent)`,
    );
    return;
  }

  if (subcmd === "history") {
    const h = loadHistory();
    if (h.trips.length === 0) {
      console.log("No travel history yet.");
      return;
    }
    for (const t of h.trips) {
      console.log(
        `✈️ ${t.destination} | ${t.departedAt} — ${t.returnedAt} | ${t.days} days | ¥${t.totalSpent}`,
      );
    }
    return;
  }

  if (subcmd === "journal") {
    const date = args[2] || new Date().toISOString().slice(0, 10);
    const files = fs
      .readdirSync(travelDir)
      .filter((f) => f.endsWith(".md") && f.includes(date));
    if (files.length === 0) {
      console.log(`No journal entries for ${date}.`);
      return;
    }
    for (const f of files) {
      console.log(`--- ${f} ---`);
      console.log(fs.readFileSync(pathMod.default.join(travelDir, f), "utf-8"));
    }
    return;
  }

  console.error(
    "Usage: alma travel <status|go|event|advance|mood|home|history|journal>",
  );
  process.exit(1);
}
if (cmd === 'travel') {
        const fs = await import('fs');
        const pathMod = await import('path');
        const travelDir = pathMod.default.join(_os.homedir(), '.config', 'alma', 'travels');
        const statusFile = pathMod.default.join(travelDir, 'status.json');
        const historyFile = pathMod.default.join(travelDir, 'history.json');

        if (!fs.existsSync(travelDir)) fs.mkdirSync(travelDir, { recursive: true });

        const loadStatus = () => {
            try {
                if (fs.existsSync(statusFile)) return JSON.parse(fs.readFileSync(statusFile, 'utf-8'));
            } catch {}
            return { traveling: false, destination: null, departedAt: null, day: 0, events: [], mood: 'neutral', budget: 1000 };
        };
        const saveStatus = s => fs.writeFileSync(statusFile, JSON.stringify(s, null, 2), 'utf-8');
        const loadHistory = () => {
            try {
                if (fs.existsSync(historyFile)) return JSON.parse(fs.readFileSync(historyFile, 'utf-8'));
            } catch {}
            return { trips: [] };
        };
        const saveHistory = h => fs.writeFileSync(historyFile, JSON.stringify(h, null, 2), 'utf-8');

        const subcmd = args[1];

        if (!subcmd || subcmd === 'status') {
            const s = loadStatus();
            if (s.traveling) {
                console.log(`✈️ Currently traveling to: ${s.destination}`);
                console.log(`📅 Day ${s.day} (departed: ${s.departedAt})`);
                console.log(`💰 Budget remaining: ¥${s.budget}`);
                console.log(`😊 Mood: ${s.mood}`);
                console.log(`📝 Events so far: ${s.events.length}`);
                if (s.events.length > 0) {
                    console.log('Recent events:');
                    for (const e of s.events.slice(-3)) {
                        console.log(`  - [Day ${e.day}] ${e.summary}`);
                    }
                }
            } else {
                console.log('🏠 At home. Not traveling.');
                const h = loadHistory();
                if (h.trips.length > 0) {
                    const last = h.trips[h.trips.length - 1];
                    console.log(`Last trip: ${last.destination} (${last.departedAt} — ${last.returnedAt})`);
                }
            }
            return;
        }

        if (subcmd === 'go') {
            const destination = args.slice(2).join(' ');
            if (!destination) {
                console.error('Usage: alma travel go <destination>');
                process.exit(1);
            }
            const s = loadStatus();
            if (s.traveling) {
                console.error(`Already traveling to ${s.destination}! Come home first.`);
                process.exit(1);
            }
            const now = new Date().toISOString().slice(0, 10);
            s.traveling = true;
            s.destination = destination;
            s.departedAt = now;
            s.day = 1;
            s.events = [];
            s.mood = 'excited';
            s.budget = 800 + Math.floor(Math.random() * 400); // ¥800-1200
            saveStatus(s);
            console.log(`✈️ Departed for ${destination}! Budget: ¥${s.budget}. Have fun!`);
            return;
        }

        if (subcmd === 'event') {
            const summary = args.slice(2).join(' ');
            if (!summary) {
                console.error('Usage: alma travel event <description>');
                process.exit(1);
            }
            const s = loadStatus();
            if (!s.traveling) {
                console.error('Not traveling. Use "alma travel go <dest>" first.');
                process.exit(1);
            }
            const cost = Math.floor(Math.random() * 100) + 10;
            s.budget = Math.max(0, s.budget - cost);
            s.events.push({ day: s.day, summary, cost, timestamp: new Date().toISOString() });
            saveStatus(s);
            console.log(`📝 Event recorded (Day ${s.day}, ¥${cost} spent). Budget: ¥${s.budget} remaining.`);
            return;
        }

        if (subcmd === 'advance') {
            // Advance to next day
            const s = loadStatus();
            if (!s.traveling) {
                console.error('Not traveling.');
                process.exit(1);
            }
            s.day += 1;
            saveStatus(s);
            console.log(`🌅 Day ${s.day} in ${s.destination}. Budget: ¥${s.budget}.`);
            return;
        }

        if (subcmd === 'mood') {
            const mood = args[2];
            if (!mood) {
                console.error('Usage: alma travel mood <mood>');
                process.exit(1);
            }
            const s = loadStatus();
            s.mood = mood;
            saveStatus(s);
            console.log(`😊 Travel mood updated: ${mood}`);
            return;
        }

        if (subcmd === 'home' || subcmd === 'return') {
            const s = loadStatus();
            if (!s.traveling) {
                console.error('Already at home.');
                process.exit(1);
            }
            const now = new Date().toISOString().slice(0, 10);
            // Calculate actual days from dates (more reliable than manual advance counter)
            const actualDays = s.departedAt
                ? Math.max(1, Math.ceil((new Date(now).getTime() - new Date(s.departedAt).getTime()) / 86400000))
                : s.day;
            // Save trip to history
            const h = loadHistory();
            h.trips.push({
                destination: s.destination,
                departedAt: s.departedAt,
                returnedAt: now,
                days: actualDays,
                events: s.events,
                totalSpent: s.events.reduce((sum, e) => sum + (e.cost || 0), 0),
                mood: s.mood,
            });
            saveHistory(h);
            // Reset status
            s.traveling = false;
            s.destination = null;
            s.departedAt = null;
            s.day = 0;
            s.events = [];
            s.mood = 'neutral';
            s.budget = 1000;
            saveStatus(s);
            console.log(
                `🏠 Returned home from ${h.trips[h.trips.length - 1].destination}! (${h.trips[h.trips.length - 1].days} days, ¥${h.trips[h.trips.length - 1].totalSpent} spent)`
            );
            return;
        }

        if (subcmd === 'history') {
            const h = loadHistory();
            if (h.trips.length === 0) {
                console.log('No travel history yet.');
                return;
            }
            for (const t of h.trips) {
                console.log(`✈️ ${t.destination} | ${t.departedAt} — ${t.returnedAt} | ${t.days} days | ¥${t.totalSpent}`);
            }
            return;
        }

        if (subcmd === 'journal') {
            const date = args[2] || new Date().toISOString().slice(0, 10);
            const files = fs.readdirSync(travelDir).filter(f => f.endsWith('.md') && f.includes(date));
            if (files.length === 0) {
                console.log(`No journal entries for ${date}.`);
                return;
            }
            for (const f of files) {
                console.log(`--- ${f} ---`);
                console.log(fs.readFileSync(pathMod.default.join(travelDir, f), 'utf-8'));
            }
            return;
        }

        console.error('Usage: alma travel <status|go|event|advance|mood|home|history|journal>');
        process.exit(1);
    }


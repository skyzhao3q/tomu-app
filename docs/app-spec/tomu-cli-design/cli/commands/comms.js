if (cmd === "comms") {
  const commsDir = _path.join(
    _os.homedir(),
    ".config",
    "alma",
    "missions",
    "comms",
  );
  const dmDir = _path.join(commsDir, "dm");
  if (!_fs.existsSync(commsDir)) _fs.mkdirSync(commsDir, { recursive: true });
  if (!_fs.existsSync(dmDir)) _fs.mkdirSync(dmDir, { recursive: true });

  const subcmd = args[1];

  if (subcmd === "send") {
    const target = args[2]; // missionId
    const msg = args[3];
    if (!target || !msg) {
      console.error('Usage: alma comms send <missionId> "message"');
      process.exit(1);
    }
    const channelFile = _path.join(commsDir, `${target}.jsonl`);
    const entry = JSON.stringify({
      from: process.env.ALMA_AGENT_ID || "alma",
      text: msg,
      at: new Date().toISOString(),
    });
    _fs.appendFileSync(channelFile, entry + "\n");
    console.log("Sent.");
    return;
  }

  if (subcmd === "dm") {
    const targetAgent = args[2];
    const msg = args[3];
    if (!targetAgent || !msg) {
      console.error('Usage: alma comms dm <agentTaskId> "message"');
      process.exit(1);
    }
    const dmFile = _path.join(dmDir, `${targetAgent}.jsonl`);
    const entry = JSON.stringify({
      from: process.env.ALMA_AGENT_ID || "alma",
      text: msg,
      at: new Date().toISOString(),
    });
    _fs.appendFileSync(dmFile, entry + "\n");
    console.log("DM sent.");
    return;
  }

  if (subcmd === "read") {
    const target = args[2];
    if (!target) {
      console.error("Usage: alma comms read <missionId> [--limit N]");
      process.exit(1);
    }
    const channelFile = _path.join(commsDir, `${target}.jsonl`);
    if (!_fs.existsSync(channelFile)) {
      console.log("No messages.");
      return;
    }
    const limitIdx = args.indexOf("--limit");
    const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) : 20;
    const lines = _fs
      .readFileSync(channelFile, "utf-8")
      .trim()
      .split("\n")
      .filter(Boolean);
    const msgs = lines.slice(-limit);
    for (const line of msgs) {
      try {
        const m = JSON.parse(line);
        console.log(`[${m.at}] ${m.from}: ${m.text}`);
      } catch {
        console.log(line);
      }
    }
    return;
  }

  if (subcmd === "inbox") {
    const agentId = args[2] || process.env.ALMA_AGENT_ID || "alma";
    const dmFile = _path.join(dmDir, `${agentId}.jsonl`);
    if (!_fs.existsSync(dmFile)) {
      console.log("No DMs.");
      return;
    }
    const lines = _fs
      .readFileSync(dmFile, "utf-8")
      .trim()
      .split("\n")
      .filter(Boolean);
    for (const line of lines.slice(-20)) {
      try {
        const m = JSON.parse(line);
        console.log(`[${m.at}] ${m.from}: ${m.text}`);
      } catch {
        console.log(line);
      }
    }
    return;
  }

  if (subcmd === "broadcast") {
    const msg = args[2];
    if (!msg) {
      console.error('Usage: alma comms broadcast "message"');
      process.exit(1);
    }
    const missionsFile = _path.join(
      _os.homedir(),
      ".config",
      "alma",
      "missions",
      "missions.json",
    );
    let missions = [];
    try {
      missions = JSON.parse(_fs.readFileSync(missionsFile, "utf-8"));
    } catch {}
    const active = missions.filter((m) => m.status === "active");
    for (const m of active) {
      const channelFile = _path.join(commsDir, `${m.id}.jsonl`);
      const entry = JSON.stringify({
        from: "alma-broadcast",
        text: msg,
        at: new Date().toISOString(),
      });
      _fs.appendFileSync(channelFile, entry + "\n");
    }
    console.log(`Broadcast to ${active.length} missions.`);
    return;
  }

  console.error(
    `Unknown comms subcommand: ${subcmd}. Commands: send, dm, read, inbox, broadcast`,
  );
  process.exit(1);
}
if (cmd === 'comms') {
        const commsDir = _path.join(_os.homedir(), '.config', 'alma', 'missions', 'comms');
        const dmDir = _path.join(commsDir, 'dm');
        if (!_fs.existsSync(commsDir)) _fs.mkdirSync(commsDir, { recursive: true });
        if (!_fs.existsSync(dmDir)) _fs.mkdirSync(dmDir, { recursive: true });

        const subcmd = args[1];

        if (subcmd === 'send') {
            const target = args[2]; // missionId
            const msg = args[3];
            if (!target || !msg) { console.error('Usage: alma comms send <missionId> "message"'); process.exit(1); }
            const channelFile = _path.join(commsDir, `${target}.jsonl`);
            const entry = JSON.stringify({ from: process.env.ALMA_AGENT_ID || 'alma', text: msg, at: new Date().toISOString() });
            _fs.appendFileSync(channelFile, entry + '\n');
            console.log('Sent.');
            return;
        }

        if (subcmd === 'dm') {
            const targetAgent = args[2];
            const msg = args[3];
            if (!targetAgent || !msg) { console.error('Usage: alma comms dm <agentTaskId> "message"'); process.exit(1); }
            const dmFile = _path.join(dmDir, `${targetAgent}.jsonl`);
            const entry = JSON.stringify({ from: process.env.ALMA_AGENT_ID || 'alma', text: msg, at: new Date().toISOString() });
            _fs.appendFileSync(dmFile, entry + '\n');
            console.log('DM sent.');
            return;
        }

        if (subcmd === 'read') {
            const target = args[2];
            if (!target) { console.error('Usage: alma comms read <missionId> [--limit N]'); process.exit(1); }
            const channelFile = _path.join(commsDir, `${target}.jsonl`);
            if (!_fs.existsSync(channelFile)) { console.log('No messages.'); return; }
            const limitIdx = args.indexOf('--limit');
            const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) : 20;
            const lines = _fs.readFileSync(channelFile, 'utf-8').trim().split('\n').filter(Boolean);
            const msgs = lines.slice(-limit);
            for (const line of msgs) {
                try {
                    const m = JSON.parse(line);
                    console.log(`[${m.at}] ${m.from}: ${m.text}`);
                } catch { console.log(line); }
            }
            return;
        }

        if (subcmd === 'inbox') {
            const agentId = args[2] || process.env.ALMA_AGENT_ID || 'alma';
            const dmFile = _path.join(dmDir, `${agentId}.jsonl`);
            if (!_fs.existsSync(dmFile)) { console.log('No DMs.'); return; }
            const lines = _fs.readFileSync(dmFile, 'utf-8').trim().split('\n').filter(Boolean);
            for (const line of lines.slice(-20)) {
                try {
                    const m = JSON.parse(line);
                    console.log(`[${m.at}] ${m.from}: ${m.text}`);
                } catch { console.log(line); }
            }
            return;
        }

        if (subcmd === 'broadcast') {
            const msg = args[2];
            if (!msg) { console.error('Usage: alma comms broadcast "message"'); process.exit(1); }
            const missionsFile = _path.join(_os.homedir(), '.config', 'alma', 'missions', 'missions.json');
            let missions = [];
            try { missions = JSON.parse(_fs.readFileSync(missionsFile, 'utf-8')); } catch {}
            const active = missions.filter(m => m.status === 'active');
            for (const m of active) {
                const channelFile = _path.join(commsDir, `${m.id}.jsonl`);
                const entry = JSON.stringify({ from: 'alma-broadcast', text: msg, at: new Date().toISOString() });
                _fs.appendFileSync(channelFile, entry + '\n');
            }
            console.log(`Broadcast to ${active.length} missions.`);
            return;
        }

        console.error(`Unknown comms subcommand: ${subcmd}. Commands: send, dm, read, inbox, broadcast`);
        process.exit(1);
    }


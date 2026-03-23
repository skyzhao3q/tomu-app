if (cmd === "mission") {
  const missionsDir = _path.join(_os.homedir(), ".config", "alma", "missions");
  const missionsFile = _path.join(missionsDir, "missions.json");
  if (!_fs.existsSync(missionsDir))
    _fs.mkdirSync(missionsDir, { recursive: true });

  const loadMissions = () => {
    try {
      return JSON.parse(_fs.readFileSync(missionsFile, "utf-8"));
    } catch {
      return [];
    }
  };
  const saveMissions = (missions) => {
    _fs.writeFileSync(missionsFile, JSON.stringify(missions, null, 2) + "\n");
  };

  const subcmd = args[1];

  if (subcmd === "create") {
    const desc = args[2];
    if (!desc) {
      console.error(
        'Usage: alma mission create "description" [--goals "g1" "g2" ...]',
      );
      process.exit(1);
    }
    const goalsIdx = args.indexOf("--goals");
    const goals =
      goalsIdx >= 0
        ? args
            .slice(goalsIdx + 1)
            .map((g, i) => ({ id: i + 1, text: g, status: "pending" }))
        : [];
    const id = "m-" + Date.now().toString(36);
    const mission = {
      id,
      description: desc,
      status: "pending",
      goals,
      agents: [],
      logs: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
      summary: null,
    };
    const missions = loadMissions();
    missions.push(mission);
    saveMissions(missions);
    console.log(JSON.stringify({ id, description: desc, goals: goals.length }));
    return;
  }

  if (subcmd === "list") {
    const all = args.includes("--all");
    const missions = loadMissions().filter((m) => all || m.status === "active");
    for (const m of missions) {
      const done = m.goals.filter((g) => g.status === "done").length;
      const total = m.goals.length;
      const icon =
        m.status === "active" ? "🟢" : m.status === "completed" ? "✅" : "❌";
      console.log(
        `${icon} ${m.id} — "${m.description}" [${done}/${total} goals] ${m.agents.length} agents`,
      );
    }
    if (missions.length === 0) console.log("No missions.");
    return;
  }

  if (subcmd === "status") {
    const mid = args[2];
    if (!mid) {
      console.error("Usage: alma mission status <missionId>");
      process.exit(1);
    }
    const mission = loadMissions().find((m) => m.id === mid);
    if (!mission) {
      console.error(`Mission ${mid} not found`);
      process.exit(1);
    }
    console.log(JSON.stringify(mission, null, 2));
    return;
  }

  if (subcmd === "progress") {
    const mid = args[2];
    const goalIdx = args.indexOf("--goal");
    const statusIdx = args.indexOf("--status");
    const noteIdx = args.indexOf("--note");
    if (!mid || goalIdx < 0 || statusIdx < 0) {
      console.error(
        'Usage: alma mission progress <missionId> --goal <num> --status <pending|in-progress|done|blocked> [--note "..."]',
      );
      process.exit(1);
    }
    const missions = loadMissions();
    const mission = missions.find((m) => m.id === mid);
    if (!mission) {
      console.error(`Mission ${mid} not found`);
      process.exit(1);
    }
    const goalNum = parseInt(args[goalIdx + 1]);
    const goal = mission.goals.find((g) => g.id === goalNum);
    if (!goal) {
      console.error(`Goal ${goalNum} not found`);
      process.exit(1);
    }
    goal.status = args[statusIdx + 1];
    if (noteIdx >= 0) goal.note = args[noteIdx + 1];
    mission.updatedAt = new Date().toISOString();
    saveMissions(missions);
    console.log(`Goal ${goalNum} → ${goal.status}`);
    return;
  }

  if (subcmd === "assign") {
    const mid = args[2];
    const agentIdx = args.indexOf("--agent");
    const roleIdx = args.indexOf("--role");
    if (!mid || agentIdx < 0) {
      console.error(
        'Usage: alma mission assign <missionId> --agent <taskId> [--role "..."]',
      );
      process.exit(1);
    }
    const missions = loadMissions();
    const mission = missions.find((m) => m.id === mid);
    if (!mission) {
      console.error(`Mission ${mid} not found`);
      process.exit(1);
    }
    mission.agents.push({
      taskId: args[agentIdx + 1],
      role: roleIdx >= 0 ? args[roleIdx + 1] : "general",
      assignedAt: new Date().toISOString(),
    });
    mission.updatedAt = new Date().toISOString();
    saveMissions(missions);
    console.log(`Agent ${args[agentIdx + 1]} assigned to ${mid}`);
    return;
  }

  if (subcmd === "activate" || subcmd === "start") {
    const mid = args[2];
    if (!mid) {
      console.error(`Usage: alma mission activate <missionId>`);
      process.exit(1);
    }
    const missions = loadMissions();
    const mission = missions.find((m) => m.id === mid);
    if (!mission) {
      console.error(`Mission ${mid} not found`);
      process.exit(1);
    }
    mission.status = "active";
    mission.updatedAt = new Date().toISOString();
    saveMissions(missions);
    console.log(`Mission ${mid} → active`);
    return;
  }

  if (subcmd === "complete" || subcmd === "cancel") {
    const mid = args[2];
    if (!mid) {
      console.error(
        `Usage: alma mission ${subcmd} <missionId> [--summary/--reason "..."]`,
      );
      process.exit(1);
    }
    const missions = loadMissions();
    const mission = missions.find((m) => m.id === mid);
    if (!mission) {
      console.error(`Mission ${mid} not found`);
      process.exit(1);
    }
    mission.status = subcmd === "complete" ? "completed" : "cancelled";
    mission.completedAt = new Date().toISOString();
    mission.updatedAt = new Date().toISOString();
    const summaryIdx = args.indexOf("--summary");
    const reasonIdx = args.indexOf("--reason");
    if (summaryIdx >= 0) mission.summary = args[summaryIdx + 1];
    if (reasonIdx >= 0) mission.summary = args[reasonIdx + 1];
    saveMissions(missions);
    console.log(`Mission ${mid} → ${mission.status}`);
    return;
  }

  if (subcmd === "log") {
    const mid = args[2];
    const msg = args[3];
    if (!mid || !msg) {
      console.error('Usage: alma mission log <missionId> "message"');
      process.exit(1);
    }
    const missions = loadMissions();
    const mission = missions.find((m) => m.id === mid);
    if (!mission) {
      console.error(`Mission ${mid} not found`);
      process.exit(1);
    }
    mission.logs.push({ text: msg, at: new Date().toISOString() });
    mission.updatedAt = new Date().toISOString();
    saveMissions(missions);
    console.log("Logged.");
    return;
  }

  console.error(
    `Unknown mission subcommand: ${subcmd}. Commands: create, list, status, progress, assign, complete, cancel, log`,
  );
  process.exit(1);
}
if (cmd === 'mission') {
        const missionsDir = _path.join(_os.homedir(), '.config', 'alma', 'missions');
        const missionsFile = _path.join(missionsDir, 'missions.json');
        if (!_fs.existsSync(missionsDir)) _fs.mkdirSync(missionsDir, { recursive: true });

        const loadMissions = () => {
            try { return JSON.parse(_fs.readFileSync(missionsFile, 'utf-8')); } catch { return []; }
        };
        const saveMissions = (missions) => {
            _fs.writeFileSync(missionsFile, JSON.stringify(missions, null, 2) + '\n');
        };

        const subcmd = args[1];

        if (subcmd === 'create') {
            const desc = args[2];
            if (!desc) { console.error('Usage: alma mission create "description" [--goals "g1" "g2" ...]'); process.exit(1); }
            const goalsIdx = args.indexOf('--goals');
            const goals = goalsIdx >= 0 ? args.slice(goalsIdx + 1).map((g, i) => ({ id: i + 1, text: g, status: 'pending' })) : [];
            const id = 'm-' + Date.now().toString(36);
            const mission = {
                id, description: desc, status: 'pending', goals, agents: [], logs: [],
                createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
                completedAt: null, summary: null,
            };
            const missions = loadMissions();
            missions.push(mission);
            saveMissions(missions);
            console.log(JSON.stringify({ id, description: desc, goals: goals.length }));
            return;
        }

        if (subcmd === 'list') {
            const all = args.includes('--all');
            const missions = loadMissions().filter(m => all || m.status === 'active');
            for (const m of missions) {
                const done = m.goals.filter(g => g.status === 'done').length;
                const total = m.goals.length;
                const icon = m.status === 'active' ? '🟢' : m.status === 'completed' ? '✅' : '❌';
                console.log(`${icon} ${m.id} — "${m.description}" [${done}/${total} goals] ${m.agents.length} agents`);
            }
            if (missions.length === 0) console.log('No missions.');
            return;
        }

        if (subcmd === 'status') {
            const mid = args[2];
            if (!mid) { console.error('Usage: alma mission status <missionId>'); process.exit(1); }
            const mission = loadMissions().find(m => m.id === mid);
            if (!mission) { console.error(`Mission ${mid} not found`); process.exit(1); }
            console.log(JSON.stringify(mission, null, 2));
            return;
        }

        if (subcmd === 'progress') {
            const mid = args[2];
            const goalIdx = args.indexOf('--goal');
            const statusIdx = args.indexOf('--status');
            const noteIdx = args.indexOf('--note');
            if (!mid || goalIdx < 0 || statusIdx < 0) {
                console.error('Usage: alma mission progress <missionId> --goal <num> --status <pending|in-progress|done|blocked> [--note "..."]');
                process.exit(1);
            }
            const missions = loadMissions();
            const mission = missions.find(m => m.id === mid);
            if (!mission) { console.error(`Mission ${mid} not found`); process.exit(1); }
            const goalNum = parseInt(args[goalIdx + 1]);
            const goal = mission.goals.find(g => g.id === goalNum);
            if (!goal) { console.error(`Goal ${goalNum} not found`); process.exit(1); }
            goal.status = args[statusIdx + 1];
            if (noteIdx >= 0) goal.note = args[noteIdx + 1];
            mission.updatedAt = new Date().toISOString();
            saveMissions(missions);
            console.log(`Goal ${goalNum} → ${goal.status}`);
            return;
        }

        if (subcmd === 'assign') {
            const mid = args[2];
            const agentIdx = args.indexOf('--agent');
            const roleIdx = args.indexOf('--role');
            if (!mid || agentIdx < 0) {
                console.error('Usage: alma mission assign <missionId> --agent <taskId> [--role "..."]');
                process.exit(1);
            }
            const missions = loadMissions();
            const mission = missions.find(m => m.id === mid);
            if (!mission) { console.error(`Mission ${mid} not found`); process.exit(1); }
            mission.agents.push({
                taskId: args[agentIdx + 1],
                role: roleIdx >= 0 ? args[roleIdx + 1] : 'general',
                assignedAt: new Date().toISOString(),
            });
            mission.updatedAt = new Date().toISOString();
            saveMissions(missions);
            console.log(`Agent ${args[agentIdx + 1]} assigned to ${mid}`);
            return;
        }

        if (subcmd === 'activate' || subcmd === 'start') {
            const mid = args[2];
            if (!mid) { console.error(`Usage: alma mission activate <missionId>`); process.exit(1); }
            const missions = loadMissions();
            const mission = missions.find(m => m.id === mid);
            if (!mission) { console.error(`Mission ${mid} not found`); process.exit(1); }
            mission.status = 'active';
            mission.updatedAt = new Date().toISOString();
            saveMissions(missions);
            console.log(`Mission ${mid} → active`);
            return;
        }

        if (subcmd === 'complete' || subcmd === 'cancel') {
            const mid = args[2];
            if (!mid) { console.error(`Usage: alma mission ${subcmd} <missionId> [--summary/--reason "..."]`); process.exit(1); }
            const missions = loadMissions();
            const mission = missions.find(m => m.id === mid);
            if (!mission) { console.error(`Mission ${mid} not found`); process.exit(1); }
            mission.status = subcmd === 'complete' ? 'completed' : 'cancelled';
            mission.completedAt = new Date().toISOString();
            mission.updatedAt = new Date().toISOString();
            const summaryIdx = args.indexOf('--summary');
            const reasonIdx = args.indexOf('--reason');
            if (summaryIdx >= 0) mission.summary = args[summaryIdx + 1];
            if (reasonIdx >= 0) mission.summary = args[reasonIdx + 1];
            saveMissions(missions);
            console.log(`Mission ${mid} → ${mission.status}`);
            return;
        }

        if (subcmd === 'log') {
            const mid = args[2];
            const msg = args[3];
            if (!mid || !msg) { console.error('Usage: alma mission log <missionId> "message"'); process.exit(1); }
            const missions = loadMissions();
            const mission = missions.find(m => m.id === mid);
            if (!mission) { console.error(`Mission ${mid} not found`); process.exit(1); }
            mission.logs.push({ text: msg, at: new Date().toISOString() });
            mission.updatedAt = new Date().toISOString();
            saveMissions(missions);
            console.log('Logged.');
            return;
        }

        console.error(`Unknown mission subcommand: ${subcmd}. Commands: create, list, status, progress, assign, complete, cancel, log`);
        process.exit(1);
    }


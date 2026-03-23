if (cmd === "cron") {
  const subcmd = args[1];

  if (subcmd === "list" || !subcmd) {
    const jobs = await api("GET", "/api/cron/jobs");
    if (Array.isArray(jobs) && jobs.length > 0) {
      for (const j of jobs) {
        const status = j.enabled ? "✅" : "⏸️";
        const lastRun = j.lastRunAt ? formatDate(j.lastRunAt) : "never";
        console.log(
          `${status} ${j.id.slice(0, 8)}  ${j.name}  [${j.scheduleType}:${j.schedule}]  mode:${j.executionMode}  runs:${j.runCount}  last:${lastRun}`,
        );
      }
    } else {
      console.log('No cron jobs. Use "alma cron add" to create one.');
    }
    return;
  }

  if (subcmd === "add") {
    // alma cron add <name> <type> <schedule> [--mode main|isolated] [--prompt "..."] [--thread-id ID] [--deliver-to CHAT_ID] [--model MODEL]
    const name = args[2];
    const scheduleType = args[3]; // at, every, cron
    const schedule = args[4];
    if (!name || !scheduleType || !schedule) {
      console.error(
        'Usage: alma cron add <name> <at|every|cron> <schedule> [--mode main|isolated] [--prompt "..."] [--thread-id ID] [--deliver-to CHAT_ID] [--model MODEL]',
      );
      console.error("Examples:");
      console.error(
        '  alma cron add "morning-check" cron "0 9 * * *" --prompt "Check my emails"',
      );
      console.error(
        '  alma cron add "reminder" at "2024-12-25T09:00:00" --prompt "Merry Christmas!"',
      );
      console.error(
        '  alma cron add "status" every "2h" --mode main --thread-id abc123',
      );
      process.exit(1);
    }
    const body = {
      name,
      scheduleType,
      schedule,
      executionMode: "isolated",
      payload: {},
    };
    for (let i = 5; i < args.length; i++) {
      if (args[i] === "--mode" && args[i + 1]) body.executionMode = args[++i];
      else if (args[i] === "--prompt" && args[i + 1])
        body.payload.agentTurn = args[++i];
      else if (args[i] === "--event" && args[i + 1])
        body.payload.systemEvent = args[++i];
      else if (args[i] === "--thread-id" && args[i + 1])
        body.payload.threadId = args[++i];
      else if (args[i] === "--deliver-to" && args[i + 1])
        body.payload.deliverTo = args[++i];
      else if (args[i] === "--model" && args[i + 1])
        body.payload.model = args[++i];
    }
    const job = await api("POST", "/api/cron/jobs", body);
    console.log(
      `✅ Job created: ${job.id} "${job.name}" [${job.scheduleType}:${job.schedule}]`,
    );
    return;
  }

  if (subcmd === "update" || subcmd === "edit") {
    const id = args[2];
    if (!id) {
      console.error(
        'Usage: alma cron update <id> [--name "..."] [--prompt "..."] [--schedule "..."] [--deliver-to CHAT_ID] [--mode main|isolated]',
      );
      process.exit(1);
    }
    const jobs = await api("GET", "/api/cron/jobs");
    const match = resolveCronJob(jobs, id);
    const patch = { payload: {} };
    for (let i = 3; i < args.length; i++) {
      if (args[i] === "--name" && args[i + 1]) patch.name = args[++i];
      else if (args[i] === "--prompt" && args[i + 1])
        patch.payload.agentTurn = args[++i];
      else if (args[i] === "--event" && args[i + 1])
        patch.payload.systemEvent = args[++i];
      else if (args[i] === "--schedule" && args[i + 1])
        patch.schedule = args[++i];
      else if (args[i] === "--deliver-to" && args[i + 1])
        patch.payload.deliverTo = args[++i];
      else if (args[i] === "--mode" && args[i + 1])
        patch.executionMode = args[++i];
      else if (args[i] === "--model" && args[i + 1])
        patch.payload.model = args[++i];
    }
    if (Object.keys(patch.payload).length === 0) delete patch.payload;
    const updated = await api("PUT", `/api/cron/jobs/${match.id}`, patch);
    console.log(`✅ Job updated: ${updated.id.slice(0, 8)} "${updated.name}"`);
    return;
  }

  if (subcmd === "remove" || subcmd === "delete") {
    const id = args[2];
    if (!id) {
      console.error("Usage: alma cron remove <id>");
      process.exit(1);
    }
    // Support partial ID matching
    const jobs = await api("GET", "/api/cron/jobs");
    const match = resolveCronJob(jobs, id);
    await api("DELETE", `/api/cron/jobs/${match.id}`);
    console.log(`✅ Removed job: ${match.name}`);
    return;
  }

  if (subcmd === "run") {
    const id = args[2];
    if (!id) {
      console.error("Usage: alma cron run <id>");
      process.exit(1);
    }
    const jobs = await api("GET", "/api/cron/jobs");
    const match = resolveCronJob(jobs, id);
    await api("POST", `/api/cron/jobs/${match.id}/run`);
    console.log(`✅ Job triggered: ${match.name}`);
    return;
  }

  if (subcmd === "enable" || subcmd === "disable") {
    const id = args[2];
    if (!id) {
      console.error(`Usage: alma cron ${subcmd} <id>`);
      process.exit(1);
    }
    const jobs = await api("GET", "/api/cron/jobs");
    const match = resolveCronJob(jobs, id);
    await api("POST", `/api/cron/jobs/${match.id}/toggle`, {
      enabled: subcmd === "enable",
    });
    console.log(`✅ Job ${subcmd}d: ${match.name}`);
    return;
  }

  if (subcmd === "history") {
    const id = args[2];
    if (!id) {
      console.error("Usage: alma cron history <id>");
      process.exit(1);
    }
    const jobs = await api("GET", "/api/cron/jobs");
    const match = resolveCronJob(jobs, id);
    const runs = await api("GET", `/api/cron/jobs/${match.id}/runs?limit=10`);
    if (Array.isArray(runs) && runs.length > 0) {
      for (const r of runs) {
        const status = r.error ? "❌" : "✅";
        console.log(
          `${status} ${formatDate(r.startedAt)}  ${truncate(r.error || r.result || "", 60)}`,
        );
      }
    } else {
      console.log("No run history.");
    }
    return;
  }

  console.error(
    "Usage: alma cron <list|add|update|remove|run|enable|disable|history>",
  );
  process.exit(1);
}
if (cmd === 'cron') {
        const subcmd = args[1];

        if (subcmd === 'list' || !subcmd) {
            const jobs = await api('GET', '/api/cron/jobs');
            if (Array.isArray(jobs) && jobs.length > 0) {
                for (const j of jobs) {
                    const status = j.enabled ? '✅' : '⏸️';
                    const lastRun = j.lastRunAt ? formatDate(j.lastRunAt) : 'never';
                    console.log(
                        `${status} ${j.id.slice(0, 8)}  ${j.name}  [${j.scheduleType}:${j.schedule}]  mode:${j.executionMode}  runs:${j.runCount}  last:${lastRun}`
                    );
                }
            } else {
                console.log('No cron jobs. Use "alma cron add" to create one.');
            }
            return;
        }

        if (subcmd === 'add') {
            // alma cron add <name> <type> <schedule> [--mode main|isolated] [--prompt "..."] [--thread-id ID] [--deliver-to CHAT_ID] [--model MODEL]
            const name = args[2];
            const scheduleType = args[3]; // at, every, cron
            const schedule = args[4];
            if (!name || !scheduleType || !schedule) {
                console.error(
                    'Usage: alma cron add <name> <at|every|cron> <schedule> [--mode main|isolated] [--prompt "..."] [--thread-id ID] [--deliver-to CHAT_ID] [--model MODEL]'
                );
                console.error('Examples:');
                console.error('  alma cron add "morning-check" cron "0 9 * * *" --prompt "Check my emails"');
                console.error('  alma cron add "reminder" at "2024-12-25T09:00:00" --prompt "Merry Christmas!"');
                console.error('  alma cron add "status" every "2h" --mode main --thread-id abc123');
                process.exit(1);
            }
            const body = {
                name,
                scheduleType,
                schedule,
                executionMode: 'isolated',
                payload: {},
            };
            for (let i = 5; i < args.length; i++) {
                if (args[i] === '--mode' && args[i + 1]) body.executionMode = args[++i];
                else if (args[i] === '--prompt' && args[i + 1]) body.payload.agentTurn = args[++i];
                else if (args[i] === '--event' && args[i + 1]) body.payload.systemEvent = args[++i];
                else if (args[i] === '--thread-id' && args[i + 1]) body.payload.threadId = args[++i];
                else if (args[i] === '--deliver-to' && args[i + 1]) body.payload.deliverTo = args[++i];
                else if (args[i] === '--model' && args[i + 1]) body.payload.model = args[++i];
            }
            const job = await api('POST', '/api/cron/jobs', body);
            console.log(`✅ Job created: ${job.id} "${job.name}" [${job.scheduleType}:${job.schedule}]`);
            return;
        }

        if (subcmd === 'update' || subcmd === 'edit') {
            const id = args[2];
            if (!id) {
                console.error('Usage: alma cron update <id> [--name "..."] [--prompt "..."] [--schedule "..."] [--deliver-to CHAT_ID] [--mode main|isolated]');
                process.exit(1);
            }
            const jobs = await api('GET', '/api/cron/jobs');
            const match = resolveCronJob(jobs, id);
            const patch = { payload: {} };
            for (let i = 3; i < args.length; i++) {
                if (args[i] === '--name' && args[i + 1]) patch.name = args[++i];
                else if (args[i] === '--prompt' && args[i + 1]) patch.payload.agentTurn = args[++i];
                else if (args[i] === '--event' && args[i + 1]) patch.payload.systemEvent = args[++i];
                else if (args[i] === '--schedule' && args[i + 1]) patch.schedule = args[++i];
                else if (args[i] === '--deliver-to' && args[i + 1]) patch.payload.deliverTo = args[++i];
                else if (args[i] === '--mode' && args[i + 1]) patch.executionMode = args[++i];
                else if (args[i] === '--model' && args[i + 1]) patch.payload.model = args[++i];
            }
            if (Object.keys(patch.payload).length === 0) delete patch.payload;
            const updated = await api('PUT', `/api/cron/jobs/${match.id}`, patch);
            console.log(`✅ Job updated: ${updated.id.slice(0, 8)} "${updated.name}"`);
            return;
        }

        if (subcmd === 'remove' || subcmd === 'delete') {
            const id = args[2];
            if (!id) {
                console.error('Usage: alma cron remove <id>');
                process.exit(1);
            }
            // Support partial ID matching
            const jobs = await api('GET', '/api/cron/jobs');
            const match = resolveCronJob(jobs, id);
            await api('DELETE', `/api/cron/jobs/${match.id}`);
            console.log(`✅ Removed job: ${match.name}`);
            return;
        }

        if (subcmd === 'run') {
            const id = args[2];
            if (!id) {
                console.error('Usage: alma cron run <id>');
                process.exit(1);
            }
            const jobs = await api('GET', '/api/cron/jobs');
            const match = resolveCronJob(jobs, id);
            await api('POST', `/api/cron/jobs/${match.id}/run`);
            console.log(`✅ Job triggered: ${match.name}`);
            return;
        }

        if (subcmd === 'enable' || subcmd === 'disable') {
            const id = args[2];
            if (!id) {
                console.error(`Usage: alma cron ${subcmd} <id>`);
                process.exit(1);
            }
            const jobs = await api('GET', '/api/cron/jobs');
            const match = resolveCronJob(jobs, id);
            await api('POST', `/api/cron/jobs/${match.id}/toggle`, { enabled: subcmd === 'enable' });
            console.log(`✅ Job ${subcmd}d: ${match.name}`);
            return;
        }

        if (subcmd === 'history') {
            const id = args[2];
            if (!id) {
                console.error('Usage: alma cron history <id>');
                process.exit(1);
            }
            const jobs = await api('GET', '/api/cron/jobs');
            const match = resolveCronJob(jobs, id);
            const runs = await api('GET', `/api/cron/jobs/${match.id}/runs?limit=10`);
            if (Array.isArray(runs) && runs.length > 0) {
                for (const r of runs) {
                    const status = r.error ? '❌' : '✅';
                    console.log(`${status} ${formatDate(r.startedAt)}  ${truncate(r.error || r.result || '', 60)}`);
                }
            } else {
                console.log('No run history.');
            }
            return;
        }

        console.error('Usage: alma cron <list|add|update|remove|run|enable|disable|history>');
        process.exit(1);
    }


if (cmd === "heartbeat") {
  const subcmd = args[1];

  if (subcmd === "status" || !subcmd) {
    const status = await api("GET", "/api/heartbeat/status");
    prettyPrint(status);
    return;
  }

  if (subcmd === "config") {
    const config = await api("GET", "/api/heartbeat/config");
    prettyPrint(config);
    return;
  }

  if (subcmd === "enable") {
    await api("PUT", "/api/heartbeat/config", { enabled: true });
    console.log("✅ Heartbeat enabled");
    return;
  }

  if (subcmd === "disable") {
    await api("PUT", "/api/heartbeat/config", { enabled: false });
    console.log("✅ Heartbeat disabled");
    return;
  }

  if (subcmd === "interval") {
    const minutes = parseInt(args[2], 10);
    if (!minutes || minutes < 1) {
      console.error("Usage: alma heartbeat interval <minutes>");
      process.exit(1);
    }
    await api("PUT", "/api/heartbeat/config", { intervalMinutes: minutes });
    console.log(`✅ Heartbeat interval set to ${minutes} minutes`);
    return;
  }

  if (subcmd === "patrol") {
    const action = args[2];
    if (action === "enable") {
      await api("PUT", "/api/heartbeat/config", {
        groupPatrol: { enabled: true },
      });
      console.log("✅ Group patrol enabled");
      return;
    }
    if (action === "disable") {
      await api("PUT", "/api/heartbeat/config", {
        groupPatrol: { enabled: false },
      });
      console.log("✅ Group patrol disabled");
      return;
    }
    if (action === "config") {
      const config = await api("GET", "/api/heartbeat/config");
      prettyPrint(
        config.groupPatrol || {
          enabled: true,
          cooldownMinutes: 15,
          quietMinutes: 5,
          maxGroupsPerTick: 2,
        },
      );
      return;
    }
    console.error("Usage: alma heartbeat patrol <enable|disable|config>");
    process.exit(1);
  }

  console.error(
    "Usage: alma heartbeat <status|config|enable|disable|interval|patrol>",
  );
  process.exit(1);
}
if (cmd === 'heartbeat') {
        const subcmd = args[1];

        if (subcmd === 'status' || !subcmd) {
            const status = await api('GET', '/api/heartbeat/status');
            prettyPrint(status);
            return;
        }

        if (subcmd === 'config') {
            const config = await api('GET', '/api/heartbeat/config');
            prettyPrint(config);
            return;
        }

        if (subcmd === 'enable') {
            await api('PUT', '/api/heartbeat/config', { enabled: true });
            console.log('✅ Heartbeat enabled');
            return;
        }

        if (subcmd === 'disable') {
            await api('PUT', '/api/heartbeat/config', { enabled: false });
            console.log('✅ Heartbeat disabled');
            return;
        }

        if (subcmd === 'interval') {
            const minutes = parseInt(args[2], 10);
            if (!minutes || minutes < 1) {
                console.error('Usage: alma heartbeat interval <minutes>');
                process.exit(1);
            }
            await api('PUT', '/api/heartbeat/config', { intervalMinutes: minutes });
            console.log(`✅ Heartbeat interval set to ${minutes} minutes`);
            return;
        }

        if (subcmd === 'patrol') {
            const action = args[2];
            if (action === 'enable') {
                await api('PUT', '/api/heartbeat/config', { groupPatrol: { enabled: true } });
                console.log('✅ Group patrol enabled');
                return;
            }
            if (action === 'disable') {
                await api('PUT', '/api/heartbeat/config', { groupPatrol: { enabled: false } });
                console.log('✅ Group patrol disabled');
                return;
            }
            if (action === 'config') {
                const config = await api('GET', '/api/heartbeat/config');
                prettyPrint(config.groupPatrol || { enabled: true, cooldownMinutes: 15, quietMinutes: 5, maxGroupsPerTick: 2 });
                return;
            }
            console.error('Usage: alma heartbeat patrol <enable|disable|config>');
            process.exit(1);
        }

        console.error('Usage: alma heartbeat <status|config|enable|disable|interval|patrol>');
        process.exit(1);
    }


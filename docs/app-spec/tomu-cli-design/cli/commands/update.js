if (cmd === "update") {
  const subcmd = args[1] || "check";
  if (subcmd === "check") {
    console.log("🔍 Checking for updates...");
    try {
      const res = await fetch(`${BASE_URL}/api/update/check`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.status === "update-available") {
        console.log(`🎉 New version available: v${data.version}`);
        console.log("   Run `alma update download` to download it.");
      } else if (data.status === "update-downloaded") {
        console.log(`✅ Update v${data.version} already downloaded.`);
        console.log("   Run `alma update install` to install and restart.");
      } else if (data.status === "update-not-available") {
        console.log("✅ Already up to date.");
      } else if (data.status === "unsupported") {
        console.log(
          `⚠️  ${data.message || "Auto-update not supported in dev mode."}`,
        );
      } else {
        console.log(
          `ℹ️  Status: ${data.status}${data.message ? " — " + data.message : ""}`,
        );
      }
    } catch (e) {
      console.error("❌ Failed to check for updates. Is Alma running?");
    }
  } else if (subcmd === "download") {
    console.log("📥 Downloading update...");
    try {
      const res = await fetch(`${BASE_URL}/api/update/download`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        console.log(
          "✅ Update downloaded. Run `alma update install` to install and restart.",
        );
      } else {
        console.error(`❌ Download failed: ${data.error}`);
      }
    } catch (e) {
      console.error("❌ Failed to download update. Is Alma running?");
    }
  } else if (subcmd === "install") {
    console.log("🚀 Installing update and restarting Alma...");
    try {
      await fetch(`${BASE_URL}/api/update/install`, { method: "POST" });
      console.log("✅ Alma is restarting with the new version.");
    } catch (e) {
      console.error("❌ Failed to install update. Is Alma running?");
    }
  } else if (subcmd === "status") {
    try {
      const res = await fetch(`${BASE_URL}/api/update/status`);
      const data = await res.json();
      console.log(`App: ${data.name} v${data.version}`);
      console.log(
        `Auto-update: ${data.autoUpdateSupported ? "supported" : "not supported"}`,
      );
      console.log(`Status: ${data.autoUpdateStatus?.status || "unknown"}`);
    } catch (e) {
      console.error("❌ Failed to get update status. Is Alma running?");
    }
  } else {
    console.log("Usage: alma update [check|download|install|status]");
  }
  return;
}
if (cmd === 'update') {
        const subcmd = args[1] || 'check';
        if (subcmd === 'check') {
            console.log('🔍 Checking for updates...');
            try {
                const res = await fetch(`${BASE_URL}/api/update/check`, { method: 'POST' });
                const data = await res.json();
                if (data.status === 'update-available') {
                    console.log(`🎉 New version available: v${data.version}`);
                    console.log('   Run `alma update download` to download it.');
                } else if (data.status === 'update-downloaded') {
                    console.log(`✅ Update v${data.version} already downloaded.`);
                    console.log('   Run `alma update install` to install and restart.');
                } else if (data.status === 'update-not-available') {
                    console.log('✅ Already up to date.');
                } else if (data.status === 'unsupported') {
                    console.log(`⚠️  ${data.message || 'Auto-update not supported in dev mode.'}`);
                } else {
                    console.log(`ℹ️  Status: ${data.status}${data.message ? ' — ' + data.message : ''}`);
                }
            } catch (e) {
                console.error('❌ Failed to check for updates. Is Alma running?');
            }
        } else if (subcmd === 'download') {
            console.log('📥 Downloading update...');
            try {
                const res = await fetch(`${BASE_URL}/api/update/download`, { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                    console.log('✅ Update downloaded. Run `alma update install` to install and restart.');
                } else {
                    console.error(`❌ Download failed: ${data.error}`);
                }
            } catch (e) {
                console.error('❌ Failed to download update. Is Alma running?');
            }
        } else if (subcmd === 'install') {
            console.log('🚀 Installing update and restarting Alma...');
            try {
                await fetch(`${BASE_URL}/api/update/install`, { method: 'POST' });
                console.log('✅ Alma is restarting with the new version.');
            } catch (e) {
                console.error('❌ Failed to install update. Is Alma running?');
            }
        } else if (subcmd === 'status') {
            try {
                const res = await fetch(`${BASE_URL}/api/update/status`);
                const data = await res.json();
                console.log(`App: ${data.name} v${data.version}`);
                console.log(`Auto-update: ${data.autoUpdateSupported ? 'supported' : 'not supported'}`);
                console.log(`Status: ${data.autoUpdateStatus?.status || 'unknown'}`);
            } catch (e) {
                console.error('❌ Failed to get update status. Is Alma running?');
            }
        } else {
            console.log('Usage: alma update [check|download|install|status]');
        }
        return;
    }


if (cmd === "sing") {
  const sub = args[1];
  // alma sing config <piapi-api-key>  — save PiAPI API key
  if (sub === "config") {
    const apiKey = args[2];
    if (!apiKey) {
      console.error("Usage: alma sing config <piapi-api-key>");
      console.error("Get your API key from https://app.piapi.ai/");
      process.exit(1);
    }
    const configDir = _path.join(_os.homedir(), ".config", "alma");
    if (!_fs.existsSync(configDir))
      _fs.mkdirSync(configDir, { recursive: true });
    const configPath = _path.join(configDir, "piapi.json");
    _fs.writeFileSync(configPath, JSON.stringify({ apiKey }, null, 2));
    console.log("✅ PiAPI API key saved");
    return;
  }

  // Load PiAPI API key (optional — ACE-Step is the primary backend)
  const piapiConfigPath = _path.join(
    _os.homedir(),
    ".config",
    "alma",
    "piapi.json",
  );
  let piapiKey = "";
  if (_fs.existsSync(piapiConfigPath)) {
    try {
      piapiKey =
        JSON.parse(_fs.readFileSync(piapiConfigPath, "utf-8")).apiKey || "";
    } catch {
      /* ignore */
    }
  }

  // alma sing generate "prompt" [--lyrics "lyrics"] [--duration 60] [--instrumental]
  if (sub === "generate" || sub === "gen" || !sub) {
    const rawArgs = args.slice(sub === "generate" || sub === "gen" ? 2 : 1);

    // Parse flags
    let lyrics = "";
    let duration = 60;
    let instrumental = false;
    const promptParts = [];

    for (let i = 0; i < rawArgs.length; i++) {
      if (rawArgs[i] === "--lyrics" && rawArgs[i + 1]) {
        lyrics = rawArgs[++i].replace(/\\n/g, "\n");
        continue;
      }
      if (rawArgs[i] === "--duration" && rawArgs[i + 1]) {
        duration = parseInt(rawArgs[++i]) || 60;
        continue;
      }
      if (rawArgs[i] === "--instrumental") {
        instrumental = true;
        continue;
      }
      promptParts.push(rawArgs[i]);
    }

    const prompt = promptParts.join(" ");
    if (!prompt) {
      console.error(
        'Usage: alma sing generate "style description" [--lyrics "lyrics"] [--duration 60] [--instrumental]',
      );
      process.exit(1);
    }

    // ACE-Step 1.5 on remote 3090 (10.0.0.207:8001)
    const ACESTEP_HOST = process.env.ACESTEP_HOST || "10.0.0.207";
    const ACESTEP_PORT = process.env.ACESTEP_PORT || "8001";
    const ACESTEP_URL = `http://${ACESTEP_HOST}:${ACESTEP_PORT}`;

    // SSH config for starting ACE-Step if not running
    const ACESTEP_SSH = process.env.ACESTEP_SSH || `yetone@${ACESTEP_HOST}`;

    console.error(
      `[Sing] Generating with ACE-Step 1.5 on 3090 (~${duration}s audio)...`,
    );

    const { execSync } = await import("child_process");

    // Check if ACE-Step API is running, start if not
    let apiReady = false;
    try {
      const healthCheck = execSync(
        `curl -s --max-time 5 ${ACESTEP_URL}/health`,
        { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
      );
      if (healthCheck.includes('"status"')) apiReady = true;
    } catch {
      /* not running */
    }

    if (!apiReady) {
      console.error("[Sing] ACE-Step API not running, starting on 3090...");
      try {
        // Kill ComfyUI to free VRAM, then start ACE-Step
        execSync(
          `ssh -p 22 ${ACESTEP_SSH} 'pkill -f "python main.py.*8188" || true; sleep 2; export PATH="$HOME/.local/bin:$PATH"; export HF_ENDPOINT=https://hf-mirror.com; export ACESTEP_LM_BACKEND=pt; export ACESTEP_LM_MODEL_PATH=acestep-5Hz-lm-0.6B; cd ~/ACE-Step-1.5 && nohup uv run acestep-api --host 0.0.0.0 --port 8001 > /tmp/acestep.log 2>&1 < /dev/null &'`,
          {
            timeout: 30_000,
            stdio: ["pipe", "pipe", "pipe"],
          },
        );
        // Wait for startup (LM loading takes ~100s)
        console.error("[Sing] Waiting for ACE-Step to load models (~90s)...");
        for (let i = 0; i < 24; i++) {
          execSync("sleep 5", { stdio: "pipe" });
          try {
            const h = execSync(`curl -s --max-time 3 ${ACESTEP_URL}/health`, {
              encoding: "utf-8",
              stdio: ["pipe", "pipe", "pipe"],
            });
            if (h.includes('"status"')) {
              apiReady = true;
              break;
            }
          } catch {
            /* still loading */
          }
        }
        if (!apiReady) {
          console.error(
            "❌ ACE-Step failed to start within 120s. Check /tmp/acestep.log on 3090.",
          );
          process.exit(1);
        }
        console.error("[Sing] ACE-Step API ready!");
      } catch (err) {
        console.error("❌ Failed to start ACE-Step:", err.message);
        process.exit(1);
      }
    }

    // Submit generation task
    const taskPayload = {
      prompt,
      lyrics: instrumental ? "" : lyrics,
      thinking: true,
      audio_duration: duration,
      audio_format: "mp3",
      inference_steps: 8,
    };

    let taskId;
    try {
      const resp = execSync(
        `curl -s -X POST ${ACESTEP_URL}/release_task -H "Content-Type: application/json" -d '${JSON.stringify(taskPayload).replace(/'/g, "'\\''")}'`,
        {
          encoding: "utf-8",
          timeout: 30_000,
          stdio: ["pipe", "pipe", "pipe"],
        },
      );
      const parsed = JSON.parse(resp);
      taskId = parsed?.data?.task_id;
      if (!taskId) throw new Error("No task_id in response: " + resp);
      console.error(`[Sing] Task submitted: ${taskId}`);
    } catch (err) {
      console.error("❌ Failed to submit task:", err.message);
      process.exit(1);
    }

    // Poll for result (max 5 min)
    console.error("[Sing] Generating...");
    let audioPath = null;
    const maxPolls = 60; // 60 * 5s = 5 min
    for (let i = 0; i < maxPolls; i++) {
      execSync("sleep 5", { stdio: "pipe" });
      try {
        const resp = execSync(
          `curl -s -X POST ${ACESTEP_URL}/query_result -H "Content-Type: application/json" -d '{"task_id_list": ["${taskId}"]}'`,
          {
            encoding: "utf-8",
            timeout: 10_000,
            stdio: ["pipe", "pipe", "pipe"],
          },
        );
        const parsed = JSON.parse(resp);
        if (parsed?.data?.length > 0) {
          const item = parsed.data[0];
          if (item.status === 1) {
            // Succeeded — extract audio file URL
            const result = JSON.parse(item.result || "[]");
            if (result[0]?.file) {
              audioPath = result[0].file;
            }
            break;
          } else if (item.status === 2) {
            const result = JSON.parse(item.result || "[]");
            const errMsg = result[0]?.error || "Unknown error";
            console.error("❌ Generation failed:", errMsg);
            process.exit(1);
          }
          // status 0 = still running
        }
      } catch {
        /* retry */
      }
    }

    if (!audioPath) {
      console.error("❌ Generation timed out (5 min)");
      process.exit(1);
    }

    // Download the audio file
    const outputDir = _path.join(_os.homedir(), ".config", "alma", "music");
    if (!_fs.existsSync(outputDir))
      _fs.mkdirSync(outputDir, { recursive: true });
    const outputFile = _path.join(outputDir, `song_${Date.now()}.mp3`);

    try {
      execSync(`curl -s -o "${outputFile}" "${ACESTEP_URL}${audioPath}"`, {
        timeout: 60_000,
        stdio: ["pipe", "pipe", "pipe"],
      });
      if (!_fs.existsSync(outputFile) || _fs.statSync(outputFile).size < 1000) {
        throw new Error("Downloaded file is too small or missing");
      }
      console.log(outputFile);
      console.error(`[Sing] ✅ Saved to ${outputFile}`);
    } catch (err) {
      console.error("❌ Failed to download audio:", err.message);
      process.exit(1);
    }
    process.exit(0);
  }

  console.error("Usage:");
  console.error(
    '  alma sing generate "style description" [--lyrics "lyrics"] [--duration 60] [--instrumental]',
  );
  console.error(
    "  alma sing config <piapi-api-key>  (for PiAPI/Suno fallback)",
  );
  return;
}
if (cmd === 'sing') {
        const sub = args[1];
        // alma sing config <piapi-api-key>  — save PiAPI API key
        if (sub === 'config') {
            const apiKey = args[2];
            if (!apiKey) {
                console.error('Usage: alma sing config <piapi-api-key>');
                console.error('Get your API key from https://app.piapi.ai/');
                process.exit(1);
            }
            const configDir = _path.join(_os.homedir(), '.config', 'alma');
            if (!_fs.existsSync(configDir)) _fs.mkdirSync(configDir, { recursive: true });
            const configPath = _path.join(configDir, 'piapi.json');
            _fs.writeFileSync(configPath, JSON.stringify({ apiKey }, null, 2));
            console.log('✅ PiAPI API key saved');
            return;
        }

        // Load PiAPI API key (optional — ACE-Step is the primary backend)
        const piapiConfigPath = _path.join(_os.homedir(), '.config', 'alma', 'piapi.json');
        let piapiKey = '';
        if (_fs.existsSync(piapiConfigPath)) {
            try {
                piapiKey = JSON.parse(_fs.readFileSync(piapiConfigPath, 'utf-8')).apiKey || '';
            } catch {
                /* ignore */
            }
        }

        // alma sing generate "prompt" [--lyrics "lyrics"] [--duration 60] [--instrumental]
        if (sub === 'generate' || sub === 'gen' || !sub) {
            const rawArgs = args.slice(sub === 'generate' || sub === 'gen' ? 2 : 1);

            // Parse flags
            let lyrics = '';
            let duration = 60;
            let instrumental = false;
            const promptParts = [];

            for (let i = 0; i < rawArgs.length; i++) {
                if (rawArgs[i] === '--lyrics' && rawArgs[i + 1]) {
                    lyrics = rawArgs[++i].replace(/\\n/g, '\n');
                    continue;
                }
                if (rawArgs[i] === '--duration' && rawArgs[i + 1]) {
                    duration = parseInt(rawArgs[++i]) || 60;
                    continue;
                }
                if (rawArgs[i] === '--instrumental') {
                    instrumental = true;
                    continue;
                }
                promptParts.push(rawArgs[i]);
            }

            const prompt = promptParts.join(' ');
            if (!prompt) {
                console.error('Usage: alma sing generate "style description" [--lyrics "lyrics"] [--duration 60] [--instrumental]');
                process.exit(1);
            }

            // ACE-Step 1.5 on remote 3090 (10.0.0.207:8001)
            const ACESTEP_HOST = process.env.ACESTEP_HOST || '10.0.0.207';
            const ACESTEP_PORT = process.env.ACESTEP_PORT || '8001';
            const ACESTEP_URL = `http://${ACESTEP_HOST}:${ACESTEP_PORT}`;

            // SSH config for starting ACE-Step if not running
            const ACESTEP_SSH = process.env.ACESTEP_SSH || `yetone@${ACESTEP_HOST}`;

            console.error(`[Sing] Generating with ACE-Step 1.5 on 3090 (~${duration}s audio)...`);

            const { execSync } = await import('child_process');

            // Check if ACE-Step API is running, start if not
            let apiReady = false;
            try {
                const healthCheck = execSync(`curl -s --max-time 5 ${ACESTEP_URL}/health`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
                if (healthCheck.includes('"status"')) apiReady = true;
            } catch { /* not running */ }

            if (!apiReady) {
                console.error('[Sing] ACE-Step API not running, starting on 3090...');
                try {
                    // Kill ComfyUI to free VRAM, then start ACE-Step
                    execSync(`ssh -p 22 ${ACESTEP_SSH} 'pkill -f "python main.py.*8188" || true; sleep 2; export PATH="$HOME/.local/bin:$PATH"; export HF_ENDPOINT=https://hf-mirror.com; export ACESTEP_LM_BACKEND=pt; export ACESTEP_LM_MODEL_PATH=acestep-5Hz-lm-0.6B; cd ~/ACE-Step-1.5 && nohup uv run acestep-api --host 0.0.0.0 --port 8001 > /tmp/acestep.log 2>&1 < /dev/null &'`, {
                        timeout: 30_000,
                        stdio: ['pipe', 'pipe', 'pipe'],
                    });
                    // Wait for startup (LM loading takes ~100s)
                    console.error('[Sing] Waiting for ACE-Step to load models (~90s)...');
                    for (let i = 0; i < 24; i++) {
                        execSync('sleep 5', { stdio: 'pipe' });
                        try {
                            const h = execSync(`curl -s --max-time 3 ${ACESTEP_URL}/health`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
                            if (h.includes('"status"')) { apiReady = true; break; }
                        } catch { /* still loading */ }
                    }
                    if (!apiReady) {
                        console.error('❌ ACE-Step failed to start within 120s. Check /tmp/acestep.log on 3090.');
                        process.exit(1);
                    }
                    console.error('[Sing] ACE-Step API ready!');
                } catch (err) {
                    console.error('❌ Failed to start ACE-Step:', err.message);
                    process.exit(1);
                }
            }

            // Submit generation task
            const taskPayload = {
                prompt,
                lyrics: instrumental ? '' : lyrics,
                thinking: true,
                audio_duration: duration,
                audio_format: 'mp3',
                inference_steps: 8,
            };

            let taskId;
            try {
                const resp = execSync(`curl -s -X POST ${ACESTEP_URL}/release_task -H "Content-Type: application/json" -d '${JSON.stringify(taskPayload).replace(/'/g, "'\\''")}'`, {
                    encoding: 'utf-8',
                    timeout: 30_000,
                    stdio: ['pipe', 'pipe', 'pipe'],
                });
                const parsed = JSON.parse(resp);
                taskId = parsed?.data?.task_id;
                if (!taskId) throw new Error('No task_id in response: ' + resp);
                console.error(`[Sing] Task submitted: ${taskId}`);
            } catch (err) {
                console.error('❌ Failed to submit task:', err.message);
                process.exit(1);
            }

            // Poll for result (max 5 min)
            console.error('[Sing] Generating...');
            let audioPath = null;
            const maxPolls = 60; // 60 * 5s = 5 min
            for (let i = 0; i < maxPolls; i++) {
                execSync('sleep 5', { stdio: 'pipe' });
                try {
                    const resp = execSync(`curl -s -X POST ${ACESTEP_URL}/query_result -H "Content-Type: application/json" -d '{"task_id_list": ["${taskId}"]}'`, {
                        encoding: 'utf-8',
                        timeout: 10_000,
                        stdio: ['pipe', 'pipe', 'pipe'],
                    });
                    const parsed = JSON.parse(resp);
                    if (parsed?.data?.length > 0) {
                        const item = parsed.data[0];
                        if (item.status === 1) {
                            // Succeeded — extract audio file URL
                            const result = JSON.parse(item.result || '[]');
                            if (result[0]?.file) {
                                audioPath = result[0].file;
                            }
                            break;
                        } else if (item.status === 2) {
                            const result = JSON.parse(item.result || '[]');
                            const errMsg = result[0]?.error || 'Unknown error';
                            console.error('❌ Generation failed:', errMsg);
                            process.exit(1);
                        }
                        // status 0 = still running
                    }
                } catch { /* retry */ }
            }

            if (!audioPath) {
                console.error('❌ Generation timed out (5 min)');
                process.exit(1);
            }

            // Download the audio file
            const outputDir = _path.join(_os.homedir(), '.config', 'alma', 'music');
            if (!_fs.existsSync(outputDir)) _fs.mkdirSync(outputDir, { recursive: true });
            const outputFile = _path.join(outputDir, `song_${Date.now()}.mp3`);

            try {
                execSync(`curl -s -o "${outputFile}" "${ACESTEP_URL}${audioPath}"`, {
                    timeout: 60_000,
                    stdio: ['pipe', 'pipe', 'pipe'],
                });
                if (!_fs.existsSync(outputFile) || _fs.statSync(outputFile).size < 1000) {
                    throw new Error('Downloaded file is too small or missing');
                }
                console.log(outputFile);
                console.error(`[Sing] ✅ Saved to ${outputFile}`);
            } catch (err) {
                console.error('❌ Failed to download audio:', err.message);
                process.exit(1);
            }
            process.exit(0);
        }

        console.error('Usage:');
        console.error('  alma sing generate "style description" [--lyrics "lyrics"] [--duration 60] [--instrumental]');
        console.error('  alma sing config <piapi-api-key>  (for PiAPI/Suno fallback)');
        return;
    }


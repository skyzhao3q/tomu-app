if (cmd === "tts") {
  const fs = await import("fs");
  const ttsDir = _path.join(_os.homedir(), ".config", "alma", "tts");
  const modelsDir = _path.join(ttsDir, "models");

  // alma tts auto [off|inbound|always|smart] — get/set TTS auto mode
  if (args[1] === "auto") {
    const mode = args[2];
    if (!mode) {
      // Show current
      const settings = await api("GET", "/api/settings");
      console.log(`TTS auto mode: ${settings?.tts?.auto || "off"}`);
      console.log(
        "Options: off (no auto voice), inbound (reply voice to voice), always (all replies as voice), smart (AI decides per-message)",
      );
      return;
    }
    if (!["off", "inbound", "always", "smart"].includes(mode)) {
      console.error("Invalid mode. Use: off, inbound, always");
      process.exit(1);
    }
    await api("PUT", "/api/settings", { tts: { auto: mode } });
    console.log(`✅ TTS auto mode set to: ${mode}`);
    return;
  }

  // alma tts provider [local|openai|elevenlabs] — get/set TTS provider
  if (args[1] === "provider") {
    const provider = args[2];
    if (!provider) {
      const settings = await api("GET", "/api/settings");
      console.log(`TTS provider: ${settings?.tts?.provider || "openai"}`);
      console.log("Options: local (Qwen3-TTS), openai, elevenlabs");
      return;
    }
    if (!["local", "openai", "elevenlabs"].includes(provider)) {
      console.error("Invalid provider. Use: local, openai, elevenlabs");
      process.exit(1);
    }
    await api("PUT", "/api/settings", { tts: { provider } });
    console.log(`✅ TTS provider set to: ${provider}`);
    return;
  }

  // alma tts voice [voiceName] — get/set TTS voice
  if (args[1] === "voice") {
    const voice = args[2];
    if (!voice) {
      const settings = await api("GET", "/api/settings");
      console.log(`TTS voice: ${settings?.tts?.voiceId || "vivian"}`);
      console.log(
        "Local voices: vivian, serena, ono_anna, sohee, uncle_fu, ryan, aiden, eric, dylan",
      );
      console.log("OpenAI voices: alloy, echo, fable, onyx, nova, shimmer");
      return;
    }
    await api("PUT", "/api/settings", { tts: { voiceId: voice } });
    console.log(`✅ TTS voice set to: ${voice}`);
    return;
  }

  // alma tts setup — manually trigger setup
  if (args[1] === "setup") {
    console.log("Setting up Qwen3-TTS...");
    const { execSync } = await import("child_process");
    // Create dirs
    fs.mkdirSync(modelsDir, { recursive: true });
    // Copy bundled scripts if available
    const bundledDirs = [
      _path.join(__dirname, "..", "electron", "tts"),
      _path.join(__dirname, "..", "tts"),
    ];
    for (const dir of bundledDirs) {
      if (fs.existsSync(_path.join(dir, "tts_cli.py"))) {
        for (const f of ["tts_cli.py", "main.py", "requirements.txt"]) {
          const src = _path.join(dir, f);
          if (fs.existsSync(src)) fs.copyFileSync(src, _path.join(ttsDir, f));
        }
        console.log("Scripts copied from", dir);
        break;
      }
    }
    // Create venv
    const venvPath = _path.join(ttsDir, ".venv");
    if (!fs.existsSync(_path.join(venvPath, "bin", "python3"))) {
      console.log("Creating Python venv...");
      execSync(`python3 -m venv "${venvPath}"`, {
        stdio: "inherit",
        timeout: 60000,
      });
      console.log("Installing dependencies (this may take a few minutes)...");
      execSync(
        `"${_path.join(venvPath, "bin", "pip")}" install -r "${_path.join(ttsDir, "requirements.txt")}"`,
        {
          stdio: "inherit",
          timeout: 600000,
        },
      );
    } else {
      console.log("Venv already exists");
    }
    // Model download happens on first TTS call automatically
    console.log(
      "✅ Setup complete. Model will auto-download on first use (~2.2GB).",
    );
    return;
  }

  const text = args[1];
  if (!text) {
    console.error(
      'Usage: alma tts "text" [--voice vivian] [--emotion cheerful] [--speed 1.0] [--output /tmp/voice.wav]',
    );
    console.error("       alma tts setup  — set up local TTS engine");
    process.exit(1);
  }

  // Parse options
  let voice = "",
    emotion = "",
    speed = "1.0",
    output = `/tmp/alma-tts-${Date.now()}.wav`;
  for (let i = 2; i < args.length; i++) {
    if (args[i] === "--voice" && args[i + 1]) {
      voice = args[++i];
    } else if (args[i] === "--emotion" && args[i + 1]) {
      emotion = args[++i];
    } else if (args[i] === "--speed" && args[i + 1]) {
      speed = args[++i];
    } else if (args[i] === "--output" && args[i + 1]) {
      output = args[++i];
    }
  }

  // Try server-side TTS generation (respects configured provider: ElevenLabs/OpenAI/local)
  try {
    const settings = await api("GET", "/api/settings");
    const provider = settings?.tts?.provider;
    if (provider && provider !== "local" && provider !== "qwen") {
      // Use server API for cloud TTS providers
      const resp = await fetch(`${BASE_URL}/api/tts/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (resp.ok) {
        const audioBuffer = Buffer.from(await resp.arrayBuffer());
        // Server returns OGG/Opus, adjust output extension
        if (output.endsWith(".wav")) {
          output = output.replace(/\.wav$/, ".ogg");
        }
        fs.writeFileSync(output, audioBuffer);
        console.log(output);
        return;
      }
      // Fall through to local TTS if server call fails
      console.error(
        `Server TTS failed (${resp.status}), falling back to local TTS...`,
      );
    }
  } catch {
    // Server not available, fall through to local TTS
  }

  // Local Qwen3-TTS fallback
  const pythonPath = _path.join(ttsDir, ".venv", "bin", "python3");
  const scriptPath = _path.join(ttsDir, "tts_cli.py");
  if (!fs.existsSync(scriptPath) || !fs.existsSync(pythonPath)) {
    console.error("Qwen3-TTS not set up. Run: alma tts setup");
    process.exit(1);
  }
  if (!voice) voice = "vivian";
  const cmdArgs = [
    pythonPath,
    scriptPath,
    "--text",
    text,
    "--voice",
    voice,
    "--speed",
    speed,
    "--models-dir",
    modelsDir,
    "--output",
    output,
  ];
  if (emotion) cmdArgs.push("--emotion", emotion);
  const { execFileSync } = await import("child_process");
  try {
    const result = execFileSync(cmdArgs[0], cmdArgs.slice(1), {
      encoding: "utf-8",
      timeout: 300000,
    });
    console.log(result);
    console.log(output);
  } catch (err) {
    console.error("TTS failed:", err.stderr || err.message);
    process.exit(1);
  }
  return;
}
if (cmd === 'tts') {
        const fs = await import('fs');
        const ttsDir = _path.join(_os.homedir(), '.config', 'alma', 'tts');
        const modelsDir = _path.join(ttsDir, 'models');

        // alma tts auto [off|inbound|always|smart] — get/set TTS auto mode
        if (args[1] === 'auto') {
            const mode = args[2];
            if (!mode) {
                // Show current
                const settings = await api('GET', '/api/settings');
                console.log(`TTS auto mode: ${settings?.tts?.auto || 'off'}`);
                console.log('Options: off (no auto voice), inbound (reply voice to voice), always (all replies as voice), smart (AI decides per-message)');
                return;
            }
            if (!['off', 'inbound', 'always', 'smart'].includes(mode)) {
                console.error('Invalid mode. Use: off, inbound, always');
                process.exit(1);
            }
            await api('PUT', '/api/settings', { tts: { auto: mode } });
            console.log(`✅ TTS auto mode set to: ${mode}`);
            return;
        }

        // alma tts provider [local|openai|elevenlabs] — get/set TTS provider
        if (args[1] === 'provider') {
            const provider = args[2];
            if (!provider) {
                const settings = await api('GET', '/api/settings');
                console.log(`TTS provider: ${settings?.tts?.provider || 'openai'}`);
                console.log('Options: local (Qwen3-TTS), openai, elevenlabs');
                return;
            }
            if (!['local', 'openai', 'elevenlabs'].includes(provider)) {
                console.error('Invalid provider. Use: local, openai, elevenlabs');
                process.exit(1);
            }
            await api('PUT', '/api/settings', { tts: { provider } });
            console.log(`✅ TTS provider set to: ${provider}`);
            return;
        }

        // alma tts voice [voiceName] — get/set TTS voice
        if (args[1] === 'voice') {
            const voice = args[2];
            if (!voice) {
                const settings = await api('GET', '/api/settings');
                console.log(`TTS voice: ${settings?.tts?.voiceId || 'vivian'}`);
                console.log('Local voices: vivian, serena, ono_anna, sohee, uncle_fu, ryan, aiden, eric, dylan');
                console.log('OpenAI voices: alloy, echo, fable, onyx, nova, shimmer');
                return;
            }
            await api('PUT', '/api/settings', { tts: { voiceId: voice } });
            console.log(`✅ TTS voice set to: ${voice}`);
            return;
        }

        // alma tts setup — manually trigger setup
        if (args[1] === 'setup') {
            console.log('Setting up Qwen3-TTS...');
            const { execSync } = await import('child_process');
            // Create dirs
            fs.mkdirSync(modelsDir, { recursive: true });
            // Copy bundled scripts if available
            const bundledDirs = [_path.join(__dirname, '..', 'electron', 'tts'), _path.join(__dirname, '..', 'tts')];
            for (const dir of bundledDirs) {
                if (fs.existsSync(_path.join(dir, 'tts_cli.py'))) {
                    for (const f of ['tts_cli.py', 'main.py', 'requirements.txt']) {
                        const src = _path.join(dir, f);
                        if (fs.existsSync(src)) fs.copyFileSync(src, _path.join(ttsDir, f));
                    }
                    console.log('Scripts copied from', dir);
                    break;
                }
            }
            // Create venv
            const venvPath = _path.join(ttsDir, '.venv');
            if (!fs.existsSync(_path.join(venvPath, 'bin', 'python3'))) {
                console.log('Creating Python venv...');
                execSync(`python3 -m venv "${venvPath}"`, { stdio: 'inherit', timeout: 60000 });
                console.log('Installing dependencies (this may take a few minutes)...');
                execSync(`"${_path.join(venvPath, 'bin', 'pip')}" install -r "${_path.join(ttsDir, 'requirements.txt')}"`, {
                    stdio: 'inherit',
                    timeout: 600000,
                });
            } else {
                console.log('Venv already exists');
            }
            // Model download happens on first TTS call automatically
            console.log('✅ Setup complete. Model will auto-download on first use (~2.2GB).');
            return;
        }

        const text = args[1];
        if (!text) {
            console.error('Usage: alma tts "text" [--voice vivian] [--emotion cheerful] [--speed 1.0] [--output /tmp/voice.wav]');
            console.error('       alma tts setup  — set up local TTS engine');
            process.exit(1);
        }

        // Parse options
        let voice = '',
            emotion = '',
            speed = '1.0',
            output = `/tmp/alma-tts-${Date.now()}.wav`;
        for (let i = 2; i < args.length; i++) {
            if (args[i] === '--voice' && args[i + 1]) {
                voice = args[++i];
            } else if (args[i] === '--emotion' && args[i + 1]) {
                emotion = args[++i];
            } else if (args[i] === '--speed' && args[i + 1]) {
                speed = args[++i];
            } else if (args[i] === '--output' && args[i + 1]) {
                output = args[++i];
            }
        }

        // Try server-side TTS generation (respects configured provider: ElevenLabs/OpenAI/local)
        try {
            const settings = await api('GET', '/api/settings');
            const provider = settings?.tts?.provider;
            if (provider && provider !== 'local' && provider !== 'qwen') {
                // Use server API for cloud TTS providers
                const resp = await fetch(`${BASE_URL}/api/tts/generate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text }),
                });
                if (resp.ok) {
                    const audioBuffer = Buffer.from(await resp.arrayBuffer());
                    // Server returns OGG/Opus, adjust output extension
                    if (output.endsWith('.wav')) {
                        output = output.replace(/\.wav$/, '.ogg');
                    }
                    fs.writeFileSync(output, audioBuffer);
                    console.log(output);
                    return;
                }
                // Fall through to local TTS if server call fails
                console.error(`Server TTS failed (${resp.status}), falling back to local TTS...`);
            }
        } catch {
            // Server not available, fall through to local TTS
        }

        // Local Qwen3-TTS fallback
        const pythonPath = _path.join(ttsDir, '.venv', 'bin', 'python3');
        const scriptPath = _path.join(ttsDir, 'tts_cli.py');
        if (!fs.existsSync(scriptPath) || !fs.existsSync(pythonPath)) {
            console.error('Qwen3-TTS not set up. Run: alma tts setup');
            process.exit(1);
        }
        if (!voice) voice = 'vivian';
        const cmdArgs = [pythonPath, scriptPath, '--text', text, '--voice', voice, '--speed', speed, '--models-dir', modelsDir, '--output', output];
        if (emotion) cmdArgs.push('--emotion', emotion);
        const { execFileSync } = await import('child_process');
        try {
            const result = execFileSync(cmdArgs[0], cmdArgs.slice(1), { encoding: 'utf-8', timeout: 300000 });
            console.log(result);
            console.log(output);
        } catch (err) {
            console.error('TTS failed:', err.stderr || err.message);
            process.exit(1);
        }
        return;
    }


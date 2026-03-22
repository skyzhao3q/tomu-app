# Skill Implementation: `voice`

## 💻 正体: `alma` CLI サブコマンド (Node.js/Bun)
このスキルはターミナルで `alma tts` を実行した際、メインのCLIスクリプト内の以下のロジックを呼び出します。

### Implementation of `alma tts`
```javascript
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
```

> 🔍 **分析**: このコマンドはローカルAPIサーバー (`localhost:23001`) に対してHTTPリクエストを行っています。

## 連携するCLIコマンド: `alma msg`

### Implementation of `alma msg`
```javascript
if (cmd === 'msg') {
        const subcmd = args[1];
        if (subcmd === 'delete') {
            const chatId = args[2];
            const messageId = args[3];
            if (!chatId || !messageId) {
                console.error('Usage: alma msg delete <chatId> <messageId>');
                process.exit(1);
            }
            const settings = await api('GET', '/api/settings');
            const botToken = settings?.telegram?.botToken;
            if (!botToken) {
                console.error('Telegram bot not configured.');
                process.exit(1);
            }
            const resp = await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId, message_id: parseInt(messageId) }),
            });
            const result = await resp.json();
            if (result.ok) {
                console.log(`✅ Deleted message ${messageId} in chat ${chatId}`);
            } else {
                console.error('Failed:', result.description);
            }
            return;
        }
        if (subcmd === 'react') {
            const chatId = args[2];
            const messageId = args[3];
            const emoji = args[4];
            if (!chatId || !messageId || !emoji) {
                console.error('Usage: alma msg react <chatId> <messageId> <emoji>');
                process.exit(1);
            }
            const settings = await api('GET', '/api/settings');
            const botToken = settings?.telegram?.botToken;
            if (!botToken) {
                console.error('Telegram bot not configured.');
                process.exit(1);
            }
            const resp = await fetch(`https://api.telegram.org/bot${botToken}/setMessageReaction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    message_id: parseInt(messageId),
                    reaction: [{ type: 'emoji', emoji }],
                }),
            });
            const result = await resp.json();
            if (result.ok) {
                console.log(`✅ Reacted ${emoji} to message ${messageId} in chat ${chatId}`);
            } else {
                console.error('Failed:', result.description);
            }
            return;
        }
        if (subcmd === 'sticker-search' || subcmd === 'sticker-list') {
            const setName = args[2];
            if (!setName) {
                // List known sticker sets from index
                const fs = await import('fs');
                const indexPath = _path.join(_os.homedir(), '.config', 'alma', 'stickers', 'index.json');
                if (fs.existsSync(indexPath)) {
                    const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
                    const sets = Object.keys(index);
                    if (sets.length === 0) {
                        console.log('No sticker sets indexed yet. Send/receive stickers to build the index.');
                    } else {
                        console.log(`Known sticker sets (${sets.length}):`);
                        for (const s of sets) {
                            console.log(`  ${s} — ${index[s].length} stickers`);
                        }
                    }
                } else {
                    console.log('No sticker index yet. Alma builds it as she sees stickers.');
                }
                return;
            }
            const settings = await api('GET', '/api/settings');
            const botToken = settings?.telegram?.botToken;
            if (!botToken) {
                console.error('Telegram bot not configured.');
                process.exit(1);
            }
            const resp = await fetch(`https://api.telegram.org/bot${botToken}/getStickerSet?name=${encodeURIComponent(setName)}`);
            const result = await resp.json();
            if (!result.ok) {
                console.error('Failed:', result.description);
                process.exit(1);
            }
            const stickers = result.result.stickers || [];
            console.log(`Sticker set: ${result.result.name} (${result.result.title}) — ${stickers.length} stickers`);
            // Save to index
            const fs = await import('fs');
            const stickerDir = _path.join(_os.homedir(), '.config', 'alma', 'stickers');
            if (!fs.existsSync(stickerDir)) fs.mkdirSync(stickerDir, { recursive: true });
            const indexPath = _path.join(stickerDir, 'index.json');
            let index = {};
            if (fs.existsSync(indexPath)) {
                try {
                    index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
                } catch {
                    /* */
                }
            }
            index[setName] = stickers.map(s => ({ emoji: s.emoji, file_id: s.file_id, is_animated: s.is_animated, is_video: s.is_video }));
            fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
            // Print stickers
            for (const s of stickers) {
                console.log(`  ${s.emoji || '?'}  file_id: ${s.file_id}`);
            }
            console.log(`\nIndexed ${stickers.length} stickers from "${setName}".`);
            return;
        }

        if (subcmd === 'sticker-find') {
            // Find stickers by emoji across all indexed sets
            const emoji = args[2];
            if (!emoji) {
                console.error('Usage: alma msg sticker-find <emoji>');
                process.exit(1);
            }
            const fs = await import('fs');
            const indexPath = _path.join(_os.homedir(), '.config', 'alma', 'stickers', 'index.json');
            if (!fs.existsSync(indexPath)) {
                console.log('No sticker index. Use `alma msg sticker-search <set_name>` first.');
                return;
            }
            const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
            let found = 0;
            for (const [setName, stickers] of Object.entries(index)) {
                for (const s of stickers) {
                    if (s.emoji === emoji) {
                        console.log(`  ${s.emoji}  set:${setName}  file_id:${s.file_id}`);
                        found++;
                    }
                }
            }
            if (found === 0) console.log(`No stickers found for emoji "${emoji}".`);
            else console.log(`\nFound ${found} sticker(s).`);
            return;
        }

        if (subcmd === 'sticker') {
            const chatId = args[2];
            const stickerId = args[3];
            if (!chatId || !stickerId) {
                console.error('Usage: alma msg sticker <chatId> <sticker_file_id>');
                process.exit(1);
            }
            const settings = await api('GET', '/api/settings');
            const botToken = settings?.telegram?.botToken;
            if (!botToken) {
                console.error('Telegram bot not configured.');
                process.exit(1);
            }
            // Show "choosing sticker" action before sending
            await fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId, action: 'choose_sticker' }),
            }).catch(() => {});
            const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendSticker`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId, sticker: stickerId }),
            });
            const result = await resp.json();
            if (result.ok) {
                console.log(`✅ Sent sticker to ${chatId}`);
            } else {
                console.error('Failed:', result.description);
            }
            return;
        }
        console.error('Usage: alma msg <delete|react|sticker> ...');
        return;
    }
```

> 🔍 **分析**: このコマンドはローカルAPIサーバー (`localhost:23001`) に対してHTTPリクエストを行っています。


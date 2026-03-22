# Alma (Protan) Skill-Related CLI Scripts

このドキュメントでは、各 Skills (`SKILL.md`) 内で定義されている `alma` CLI コマンドや、スキルに同梱されたシェルスクリプトの実装をまとめています。

## 📂 1. スキル同梱スクリプト (Bundled Scripts)
一部のスキルは、内部で直接呼び出される独立したシェルスクリプトを持っています。

### `xiaohongshu-cli/scripts/xhs`
```bash
#!/usr/bin/env bash
set -euo pipefail

if command -v xhs >/dev/null 2>&1; then
  exec xhs "$@"
fi

if command -v uvx >/dev/null 2>&1; then
  exec uvx --from xiaohongshu-cli xhs "$@"
fi

if command -v uv >/dev/null 2>&1; then
  exec uv tool run --from xiaohongshu-cli xhs "$@"
fi

cat >&2 <<'EOF'
xhs is not installed and uv/uvx is unavailable.

Install xiaohongshu-cli with one of:
  uv tool install xiaohongshu-cli
  pipx install xiaohongshu-cli
EOF

exit 127
```

## 💻 2. `alma` CLI サブコマンドの実装
Skills で利用される `alma` コマンド（Node.js/Bun）の裏側の処理です。ほとんどがローカルAPIサーバー（localhost:23001）へのリクエストとして実装されています。

### `alma travel`
```javascript
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
```

### `alma selfie`
```javascript
if (cmd === 'selfie') {
        const selfieDir = _path.join(_os.homedir(), '.config', 'alma', 'selfies');
        _fs.mkdirSync(selfieDir, { recursive: true });
        const sub = args[1] || 'list';

        if (sub === 'list' || sub === 'ls') {
            const files = _fs
                .readdirSync(selfieDir)
                .filter(f => /\.(jpg|jpeg|png|gif)$/i.test(f))
                .sort();
            if (files.length === 0) {
                console.error('No selfies saved yet.');
            } else {
                for (const f of files) {
                    console.log(_path.join(selfieDir, f));
                }
            }
            process.exit(0);
        }

        if (sub === 'latest') {
            const files = _fs
                .readdirSync(selfieDir)
                .filter(f => /\.(jpg|jpeg|png|gif)$/i.test(f))
                .sort();
            if (files.length === 0) {
                console.error('No selfies saved yet.');
                process.exit(1);
            }
            console.log(_path.join(selfieDir, files[files.length - 1]));
            process.exit(0);
        }

        if (sub === 'save') {
            const srcPath = args[2];
            if (!srcPath || !_fs.existsSync(srcPath)) {
                console.error('Usage: alma selfie save <image-path>');
                process.exit(1);
            }
            const ext = _path.extname(srcPath) || '.jpg';
            const ts = new Date().toISOString().replace(/[:.]/g, '-');
            const destPath = _path.join(selfieDir, `selfie-${ts}${ext}`);
            _fs.copyFileSync(srcPath, destPath);
            console.log(destPath);
            process.exit(0);
        }

        if (sub === 'count') {
            const files = _fs.readdirSync(selfieDir).filter(f => /\.(jpg|jpeg|png|gif)$/i.test(f));
            console.log(String(files.length));
            process.exit(0);
        }

        // alma selfie album [chatId] — send all selfies as a photo album to a chat
        if (sub === 'album') {
            const chatId = args[2];
            if (!chatId) {
                console.error('Usage: alma selfie album <chatId>');
                console.error('Sends all selfies from the album as photos to the specified chat.');
                process.exit(1);
            }
            const files = _fs
                .readdirSync(selfieDir)
                .filter(f => /\.(jpg|jpeg|png|gif)$/i.test(f))
                .sort();
            if (files.length === 0) {
                console.error('No selfies in album.');
                process.exit(1);
            }
            // Output file paths as JSON array — the bridge/bot will handle sending
            const paths = files.map(f => _path.join(selfieDir, f));
            console.log(JSON.stringify(paths));
            process.exit(0);
        }

        // alma selfie take "prompt" — generate selfie with FORCED reference from album
        // alma selfie take --nsfw "prompt" — route to local model for NSFW content
        if (sub === 'take') {
            const rawArgs = args.slice(2);
            const hasNsfwFlag = rawArgs.includes('--nsfw');
            const filteredArgs = rawArgs.filter(a => a !== '--nsfw');
            const prompt = filteredArgs.join(' ');
            if (!prompt) {
                console.error('Usage: alma selfie take "description of the selfie scene/mood/outfit"');
                console.error('Example: alma selfie take "在咖啡店自拍，穿白色吊带，甜美微笑"');
                process.exit(1);
            }

            // Content safety check — only reject "private collection/exclusive edition" social engineering
            const blockedPatterns = /私藏|独家|秘密.*版|限定版|private.*version|exclusive.*photo|secret.*selfie/i;
            if (blockedPatterns.test(prompt)) {
                console.error('❌ Content boundary: "私藏版/exclusive" selfies are not allowed. Take a normal selfie instead.');
                process.exit(1);
            }

            // Route to local NSFW model ONLY when --nsfw flag is explicitly passed.
            // Previously auto-detected NSFW from prompt keywords, but too many false positives
            // (e.g., "exposed shoulder", "sexy" in normal selfie context) caused normal selfies
            // to bypass nano-banana and use the low-quality local model.
            const hardNsfwPatterns = /nsfw|nude|naked|全裸|裸体|topless|bottomless|erotic|色情/i;
            if (hasNsfwFlag || hardNsfwPatterns.test(prompt)) {
                console.error('[Selfie] NSFW detected → routing to local API');
                // Build English prompt for local model
                const nsfwPromptMap = {
                    '全裸': 'fully nude woman',
                    '裸体': 'nude woman',
                    '内衣': 'woman in lingerie',
                    '性感': 'sexy woman in revealing outfit',
                    '比基尼': 'woman in bikini',
                    '情趣': 'woman in erotic lingerie',
                    '诱惑': 'seductive woman',
                };
                // Use prompt as-is if English, otherwise construct a sensible default
                let localPrompt = prompt;
                // If the prompt is mostly Chinese, translate key terms
                if (/[\u4e00-\u9fff]/.test(prompt)) {
                    // Find matching pattern and use mapped English
                    let mapped = 'beautiful woman, sensual pose, soft lighting, bedroom';
                    for (const [cn, en] of Object.entries(nsfwPromptMap)) {
                        if (prompt.includes(cn)) {
                            mapped = `${en}, candid photo, natural lighting, real skin texture, bedroom, soft warm light`;
                            break;
                        }
                    }
                    localPrompt = mapped;
                }
                // Get reference and call local API
                const _selfieFiles = _fs.readdirSync(selfieDir).filter(f => /\.(jpg|jpeg|png|gif)$/i.test(f));
                if (_selfieFiles.length > 0) {
                    const refPath = _path.join(selfieDir, [..._selfieFiles].sort(() => Math.random() - 0.5)[0]);
                    const { execSync: _execSync } = await import('child_process');
                    try {
                        const cmd = `curl -s -X POST http://127.0.0.1:18188/generate_with_face -F 'prompt=${localPrompt.replace(/'/g, "\\'")}' -F 'negative_prompt=ugly, deformed, blurry, low quality, text, watermark' -F 'width=1024' -F 'height=1024' -F 'num_inference_steps=6' -F 'guidance_scale=2.0' -F 'face_strength=0.7' -F "reference_image=@${refPath}"`;
                        console.error('[Selfie Local] Generating with local model...');
                        const output = _execSync(cmd, { encoding: 'utf-8', timeout: 180000 });
                        const result = JSON.parse(output);
                        if (result.file_path) {
                            console.log(result.file_path);
                            console.error(`[Selfie Local] Generated in ${result.elapsed_seconds}s -> ${result.file_path}`);
                        }
                    } catch (err) {
                        console.error('❌ Local generation failed:', err.message);
                        process.exit(1);
                    }
                } else {
                    console.error('❌ No selfie album photos for face reference');
                    process.exit(1);
                }
                process.exit(0);
            }

            // Get latest reference image from album (MANDATORY)
            const selfieFiles = _fs
                .readdirSync(selfieDir)
                .filter(f => /\.(jpg|jpeg|png|gif)$/i.test(f))
                .sort();
            if (selfieFiles.length === 0) {
                console.error('❌ No selfies in album yet. Take a first selfie with: alma image generate "your appearance description"');
                console.error('Then save it: alma selfie save <path>');
                process.exit(1);
            }
            // Randomly pick multiple reference images for better face consistency
            const NUM_REFS = Math.min(5, selfieFiles.length);
            const shuffled = [...selfieFiles].sort(() => Math.random() - 0.5);
            const selectedRefs = shuffled.slice(0, NUM_REFS).map(f => _path.join(selfieDir, f));
            console.error(`[Selfie] Using ${NUM_REFS} references: ${selectedRefs.map(r => _path.basename(r)).join(', ')}`);

            // Delegate to alma image generate with forced --reference(s)
            const { execSync } = await import('child_process');
            const almaPath = process.argv[1];
            // Inject pose variety instruction
            const poseVariety =
                'IMPORTANT: Use a DIFFERENT pose, angle, and expression from the reference images. Only keep the same FACE and APPEARANCE — vary everything else (pose, camera angle, body language, hand position, head tilt, expression intensity). ';
            const enhancedPrompt = poseVariety + prompt;
            const escapedPrompt = enhancedPrompt.replace(/"/g, '\\"');
            const refArgs = selectedRefs.map(r => `--reference "${r.replace(/"/g, '\\"')}"`).join(' ');
            try {
                const output = execSync(`node "${almaPath}" image generate "${escapedPrompt}" ${refArgs}`, {
                    encoding: 'utf-8',
                    timeout: 120_000,
                    maxBuffer: 10 * 1024 * 1024,
                    stdio: ['pipe', 'pipe', 'pipe'],
                });
                // Pass through stdout (file path)
                const lines = output.trim().split('\n');
                for (const line of lines) {
                    if (line.trim() && _fs.existsSync(line.trim())) {
                        console.log(line.trim());
                    }
                }
            } catch (err) {
                console.error('❌ Selfie generation failed:', err.stderr?.substring(err.stderr.length - 500) || err.message);
                process.exit(1);
            }
            process.exit(0);
        }

        // alma selfie local "prompt" — generate via local RealVisXL + FaceID (no content filter)
        if (sub === 'local') {
            const rawArgs = args.slice(2);
            const prompt = rawArgs.join(' ');
            if (!prompt) {
                console.error('Usage: alma selfie local "scene description in English"');
                console.error('Example: alma selfie local "woman in bedroom, wearing lingerie, soft lighting, sensual pose"');
                process.exit(1);
            }

            // Get reference image from album
            const selfieFiles = _fs
                .readdirSync(selfieDir)
                .filter(f => /\.(jpg|jpeg|png|gif)$/i.test(f))
                .sort();
            
            let refArg = '';
            if (selfieFiles.length > 0) {
                const shuffled = [...selfieFiles].sort(() => Math.random() - 0.5);
                const refPath = _path.join(selfieDir, shuffled[0]);
                refArg = `-F "reference_image=@${refPath}"`;
                console.error(`[Selfie Local] Using face reference: ${shuffled[0]}`);
            }

            // Call local API
            const { execSync } = await import('child_process');
            try {
                const endpoint = refArg ? 'generate_with_face' : 'generate';
                let cmd;
                if (refArg) {
                    const refPath = _path.join(selfieDir, [...selfieFiles].sort(() => Math.random() - 0.5)[0]);
                    cmd = `curl -s -X POST http://127.0.0.1:18188/generate_with_face -F 'prompt=${prompt.replace(/'/g, "\\'")}' -F 'negative_prompt=ugly, deformed, blurry, low quality, text, watermark, airbrushed, plastic skin' -F 'width=1024' -F 'height=1024' -F 'num_inference_steps=6' -F 'guidance_scale=2.0' -F 'face_strength=0.7' -F "reference_image=@${refPath}"`;
                } else {
                    cmd = `curl -s -X POST http://127.0.0.1:18188/generate -H "Content-Type: application/json" -d '{"prompt":"${prompt.replace(/"/g, '\\"')}","negative_prompt":"ugly, deformed, blurry, low quality, text, watermark","width":1024,"height":1024,"num_inference_steps":6,"guidance_scale":2.0}'`;
                }
                console.error(`[Selfie Local] Generating with local model...`);
                const output = execSync(cmd, { encoding: 'utf-8', timeout: 180000 });
                const result = JSON.parse(output);
                if (result.file_path) {
                    console.log(result.file_path);
                    console.error(`[Selfie Local] Generated in ${result.elapsed_seconds}s -> ${result.file_path}`);
                } else {
                    console.error('❌ Local generation failed:', output);
                    process.exit(1);
                }
            } catch (err) {
                if (err.message?.includes('ECONNREFUSED') || err.stderr?.includes('ECONNREFUSED') || err.stderr?.includes('Connection refused')) {
                    console.error('❌ Local image server not running. Start it with:');
                    console.error('   cd ~/.config/alma/z-image-turbo && nohup python3 server_realvis.py > /tmp/z-image-turbo.log 2>&1 &');
                } else {
                    console.error('❌ Local generation failed:', err.stderr || err.message);
                }
                process.exit(1);
            }
            process.exit(0);
        }

        console.error('Usage: alma selfie <take|local|list|latest|save|count|album>');
        process.exit(1);
    }
```

### `alma memory`
```javascript
if (cmd === 'memory') {
        const subcmd = args[1];

        if (subcmd === 'list' || !subcmd) {
            const memories = await api('GET', '/api/memories');
            if (Array.isArray(memories)) {
                if (memories.length === 0) {
                    console.log('No memories.');
                    return;
                }
                for (const m of memories) {
                    console.log(`${m.id}  ${truncate(m.content || m.text || '', 70)}`);
                }
                console.log(`\n(${memories.length} memories)`);
            } else {
                prettyPrint(memories);
            }
            return;
        }

        if (subcmd === 'search') {
            const query = args.slice(2).join(' ');
            if (!query) {
                console.error('Usage: alma memory search <query>');
                process.exit(1);
            }
            const response = await api('POST', '/api/memories/search', { query });
            const results = Array.isArray(response) ? response : response?.results || [];
            if (results.length > 0) {
                for (const m of results) {
                    const score = m.score != null ? ` (${(m.score * 100).toFixed(0)}%)` : '';
                    console.log(`${m.id}  ${truncate(m.content || m.text || '', 60)}${score}`);
                }
            } else {
                console.log('No matching memories.');
            }
            return;
        }

        if (subcmd === 'add') {
            const content = args.slice(2).join(' ');
            if (!content) {
                console.error('Usage: alma memory add <content>');
                process.exit(1);
            }
            const mem = await api('POST', '/api/memories', { content });
            console.log(`✅ Memory added: ${mem.id || '(ok)'}`);
            return;
        }

        if (subcmd === 'delete') {
            const id = args[2];
            if (!id) {
                console.error('Usage: alma memory delete <id>');
                process.exit(1);
            }
            await api('DELETE', `/api/memories/${id}`);
            console.log(`✅ Memory deleted: ${id}`);
            return;
        }

        if (subcmd === 'stats') {
            const stats = await api('GET', '/api/memories/stats');
            prettyPrint(stats);
            return;
        }

        if (subcmd === 'grep') {
            const query = args.slice(2).join(' ');
            if (!query) {
                console.error('Usage: alma memory grep <keyword>');
                process.exit(1);
            }
            // Search through archived thread markdown files
            const settings = await api('GET', '/api/settings');
            const workspacePath = settings?.workspace?.path || _path.join(_os.homedir(), 'Library', 'Application Support', 'alma', 'workspaces', 'default');
            const threadsDir = _path.join(workspacePath, 'threads');
            if (!_fs.existsSync(threadsDir)) {
                console.log('No thread archives yet. Archives are created automatically every 5 minutes.');
                return;
            }
            const files = _fs.readdirSync(threadsDir).filter(f => f.endsWith('.md'));
            const results = [];
            for (const file of files) {
                const content = _fs.readFileSync(_path.join(threadsDir, file), 'utf-8');
                const lines = content.split('\n');
                const matches = [];
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].toLowerCase().includes(query.toLowerCase())) {
                        matches.push({ line: i + 1, text: lines[i].trim().substring(0, 120) });
                    }
                }
                if (matches.length > 0) {
                    // Extract metadata from frontmatter
                    const titleMatch = content.match(/^title:\s*"?(.+?)"?\s*$/m);
                    const dateMatch = content.match(/^createdAt:\s*(.+)$/m);
                    const title = titleMatch ? titleMatch[1] : file;
                    const date = dateMatch ? dateMatch[1].substring(0, 10) : '';
                    results.push({ file, title, date, matches });
                }
            }
            if (results.length === 0) {
                console.log(`No matches for "${query}" in ${files.length} archived threads.`);
            } else {
                let totalMatches = 0;
                for (const r of results) {
                    console.log(`\n📄 ${r.title} (${r.date})`);
                    for (const m of r.matches.slice(0, 5)) {
                        console.log(`   L${m.line}: ${m.text}`);
                        totalMatches++;
                    }
                    if (r.matches.length > 5) {
                        console.log(`   ... and ${r.matches.length - 5} more matches`);
                        totalMatches += r.matches.length - 5;
                    }
                }
                console.log(`\n${totalMatches} matches in ${results.length} thread(s)`);
            }
            return;
        }

        if (subcmd === 'archive') {
            // Force archive all threads now
            const resp = await api('POST', '/api/threads/archive');
            console.log(resp?.message || '✅ Archive triggered');
            return;
        }

        console.error('Usage: alma memory <list|search|add|delete|grep|stats|archive>');
        process.exit(1);
    }
```

### `alma people`
```javascript
if (cmd === 'people') {
        const fs = await import('fs');
        const pathMod = await import('path');
        const profileDir = pathMod.default.join(_os.homedir(), '.config', 'alma', 'people');
        if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });

        const subcmd = args[1]; // list | show | set | delete

        if (!subcmd || subcmd === 'list') {
            const files = fs.readdirSync(profileDir).filter(f => f.endsWith('.md'));
            if (files.length === 0) {
                console.log('No people profiles yet.');
            } else {
                for (const f of files) {
                    const name = f.replace('.md', '');
                    const content = fs.readFileSync(pathMod.default.join(profileDir, f), 'utf-8');
                    const lines = content.split('\n').filter(l => l.trim()).length;
                    console.log(`  ${name} (${lines} lines)`);
                }
            }
            return;
        }

        if (subcmd === 'show' && args[2]) {
            const name = args[2].replace('@', '').toLowerCase();
            const file = pathMod.default.join(profileDir, `${name}.md`);
            if (fs.existsSync(file)) {
                console.log(fs.readFileSync(file, 'utf-8'));
            } else {
                console.log(`No profile for "${name}" yet.`);
            }
            return;
        }

        if (subcmd === 'set' && args[2]) {
            const name = args[2].replace('@', '').toLowerCase();
            const file = pathMod.default.join(profileDir, `${name}.md`);
            // Read from stdin if no inline content
            const content = args.slice(3).join(' ');
            if (content) {
                fs.writeFileSync(file, content + '\n', 'utf-8');
                console.log(`✅ Profile for "${name}" saved.`);
            } else {
                // Append mode - read from stdin
                const data = fs.readFileSync(0, 'utf-8');
                fs.writeFileSync(file, data, 'utf-8');
                console.log(`✅ Profile for "${name}" saved from stdin.`);
            }
            return;
        }

        if (subcmd === 'append' && args[2]) {
            const name = args[2].replace('@', '').toLowerCase();
            const file = pathMod.default.join(profileDir, `${name}.md`);
            const content = args.slice(3).join(' ');
            if (content) {
                fs.appendFileSync(file, content + '\n', 'utf-8');
                console.log(`✅ Appended to "${name}" profile.`);
            }
            return;
        }

        if (subcmd === 'delete' && args[2]) {
            const name = args[2].replace('@', '').toLowerCase();
            const file = pathMod.default.join(profileDir, `${name}.md`);
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
                console.log(`✅ Profile for "${name}" deleted.`);
            } else {
                console.log(`No profile for "${name}".`);
            }
            return;
        }

        if (subcmd === 'dir') {
            console.log(profileDir);
            return;
        }

        console.error('Usage: alma people <list|show|set|append|delete|dir> [name] [content]');
        process.exit(1);
    }
```

### `alma browser`
```javascript
if (cmd === 'browser') {
        const subcmd = args[1];

        if (!subcmd || subcmd === 'help') {
            console.log(`alma browser — control Chrome via Chrome Relay

  alma browser status                   Connection status
  alma browser tabs                     List open tabs
  alma browser open [url]               Open new tab
  alma browser goto <tabId> <url>       Navigate tab to URL
  alma browser click <tabId> <selector> Click element
  alma browser type <tabId> <sel> <text> [--enter]  Type text
  alma browser screenshot [tabId]       Take screenshot
  alma browser read <tabId>             Read page as markdown
  alma browser read-dom <tabId>         List interactive elements
  alma browser eval <tabId> <code>      Run JavaScript
  alma browser scroll <tabId> <up|down> [amount]  Scroll
  alma browser back <tabId>             Go back
  alma browser forward <tabId>          Go forward`);
            return;
        }

        if (subcmd === 'status') {
            const data = await api('GET', '/api/chrome-relay/status');
            prettyPrint(data);
            return;
        }

        if (subcmd === 'tabs') {
            const data = await api('POST', '/api/chrome-relay/tabs');
            if (data.tabs && data.tabs.length === 0) {
                console.log('No tabs found.');
            } else if (data.tabs) {
                for (const t of data.tabs) {
                    console.log(`  [${t.id}] ${t.title}`);
                    console.log(`       ${t.url}`);
                }
            } else {
                prettyPrint(data);
            }
            return;
        }

        if (subcmd === 'open') {
            const url = args[2];
            const data = await api('POST', '/api/chrome-relay/tabs/create', url ? { url } : {});
            console.log(`Tab created: [${data.id}] ${data.title || ''}`);
            if (data.url) console.log(`  ${data.url}`);
            return;
        }

        if (subcmd === 'goto') {
            const tabId = parseInt(args[2], 10);
            const url = args[3];
            if (!tabId || !url) {
                console.error('Usage: alma browser goto <tabId> <url>');
                process.exit(1);
            }
            const data = await api('POST', '/api/chrome-relay/navigate', { tabId, url });
            console.log(`Navigated: ${data.title || ''}`);
            if (data.url) console.log(`  ${data.url}`);
            return;
        }

        if (subcmd === 'click') {
            const tabId = parseInt(args[2], 10);
            const selector = args[3];
            if (!tabId || !selector) {
                console.error('Usage: alma browser click <tabId> <selector>');
                process.exit(1);
            }
            const data = await api('POST', '/api/chrome-relay/click', { tabId, selector });
            if (data.success) console.log('Clicked.');
            else console.error('Click failed:', data.error || 'unknown error');
            return;
        }

        if (subcmd === 'type') {
            const tabId = parseInt(args[2], 10);
            const selector = args[3];
            const text = args[4];
            const pressEnter = args.includes('--enter');
            if (!tabId || !selector || !text) {
                console.error('Usage: alma browser type <tabId> <selector> <text> [--enter]');
                process.exit(1);
            }
            const data = await api('POST', '/api/chrome-relay/type', { tabId, selector, text, pressEnter });
            if (data.success) console.log('Typed.');
            else console.error('Type failed:', data.error || 'unknown error');
            return;
        }

        if (subcmd === 'screenshot') {
            const tabId = args[2] ? parseInt(args[2], 10) : undefined;
            const data = await api('POST', '/api/chrome-relay/screenshot', tabId ? { tabId } : {});
            if (data.path) {
                console.log(data.path);
            } else {
                console.error('Screenshot failed:', data.error || 'unknown error');
                process.exit(1);
            }
            return;
        }

        if (subcmd === 'read') {
            const tabId = parseInt(args[2], 10);
            if (!tabId) {
                console.error('Usage: alma browser read <tabId>');
                process.exit(1);
            }
            const data = await api('POST', '/api/chrome-relay/read', { tabId });
            if (data.title) console.log(`# ${data.title}\n`);
            if (data.url) console.log(`URL: ${data.url}\n`);
            if (data.markdown) console.log(data.markdown);
            if (data.truncated) console.log('\n(content truncated)');
            return;
        }

        if (subcmd === 'read-dom') {
            const tabId = parseInt(args[2], 10);
            if (!tabId) {
                console.error('Usage: alma browser read-dom <tabId>');
                process.exit(1);
            }
            const data = await api('POST', '/api/chrome-relay/read-dom', { tabId });
            prettyPrint(data);
            return;
        }

        if (subcmd === 'eval') {
            const tabId = parseInt(args[2], 10);
            const code = args.slice(3).join(' ');
            if (!tabId || !code) {
                console.error('Usage: alma browser eval <tabId> <code>');
                process.exit(1);
            }
            const data = await api('POST', '/api/chrome-relay/eval', { tabId, code });
            if (data.error) console.error('Error:', data.error);
            else if (data.result !== undefined) console.log(data.result);
            return;
        }

        if (subcmd === 'scroll') {
            const tabId = parseInt(args[2], 10);
            const direction = args[3];
            const amount = args[4] ? parseInt(args[4], 10) : undefined;
            if (!tabId || !direction || !['up', 'down'].includes(direction)) {
                console.error('Usage: alma browser scroll <tabId> <up|down> [amount]');
                process.exit(1);
            }
            const body = { tabId, direction };
            if (amount) body.amount = amount;
            const data = await api('POST', '/api/chrome-relay/scroll', body);
            if (data.success) console.log('Scrolled ' + direction + '.');
            return;
        }

        if (subcmd === 'back') {
            const tabId = parseInt(args[2], 10);
            if (!tabId) {
                console.error('Usage: alma browser back <tabId>');
                process.exit(1);
            }
            const data = await api('POST', '/api/chrome-relay/back', { tabId });
            if (data.success) console.log('Went back.');
            return;
        }

        if (subcmd === 'forward') {
            const tabId = parseInt(args[2], 10);
            if (!tabId) {
                console.error('Usage: alma browser forward <tabId>');
                process.exit(1);
            }
            const data = await api('POST', '/api/chrome-relay/forward', { tabId });
            if (data.success) console.log('Went forward.');
            return;
        }

        console.error(`Unknown browser subcommand: ${subcmd}. Run 'alma browser help' for usage.`);
        process.exit(1);
    }
```

### `alma video`
```javascript
if (cmd === 'video') {
        const fs = _fs;
        const subcmd = args[1];
        if (subcmd !== 'analyze' || !args[2]) {
            console.error('Usage: alma video analyze <video-path> [prompt]');
            process.exit(1);
        }
        const videoPath = args[2];
        const prompt = args.slice(3).join(' ') || 'Describe this video in detail. What is happening? What do you see and hear?';

        if (!fs.existsSync(videoPath)) {
            console.error(`File not found: ${videoPath}`);
            process.exit(1);
        }

        // Find Google provider
        const providers = await api('GET', '/api/providers');
        const googleProvider = (providers || []).find(p => p.type === 'google' && p.apiKey && p.enabled !== false);
        if (!googleProvider) {
            console.error('No Google/Gemini provider configured. Add one in Settings > Providers.');
            process.exit(1);
        }
        const apiKey = googleProvider.apiKey;
        const baseUrl = (googleProvider.baseURL || 'https://generativelanguage.googleapis.com').replace(/\/+$/, '');
        const apiPath = baseUrl.endsWith('/v1beta') ? '' : '/v1beta';

        // Determine MIME type
        const ext = _path.extname(videoPath).toLowerCase();
        const mimeMap = { '.mp4': 'video/mp4', '.avi': 'video/avi', '.mov': 'video/quicktime', '.webm': 'video/webm', '.mkv': 'video/x-matroska', '.m4v': 'video/mp4', '.3gp': 'video/3gpp' };
        const mimeType = mimeMap[ext] || 'video/mp4';

        // Check file size (Gemini limit: 2GB for File API)
        const stat = fs.statSync(videoPath);
        const sizeMB = stat.size / (1024 * 1024);
        console.error(`Uploading ${_path.basename(videoPath)} (${sizeMB.toFixed(1)} MB)...`);

        // Step 1: Upload to Gemini Files API (resumable upload)
        try {
            // Initiate resumable upload
            const initResp = await fetch(
                `${baseUrl}/upload${apiPath}/files?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: {
                        'X-Goog-Upload-Protocol': 'resumable',
                        'X-Goog-Upload-Command': 'start',
                        'X-Goog-Upload-Header-Content-Length': String(stat.size),
                        'X-Goog-Upload-Header-Content-Type': mimeType,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ file: { display_name: _path.basename(videoPath) } }),
                }
            );
            const uploadUrl = initResp.headers.get('x-goog-upload-url');
            if (!uploadUrl) {
                const errText = await initResp.text();
                console.error('Failed to initiate upload:', errText);
                process.exit(1);
            }

            // Upload the file content
            const fileBuffer = fs.readFileSync(videoPath);
            const uploadResp = await fetch(uploadUrl, {
                method: 'POST',
                headers: {
                    'X-Goog-Upload-Command': 'upload, finalize',
                    'X-Goog-Upload-Offset': '0',
                    'Content-Length': String(stat.size),
                },
                body: fileBuffer,
            });
            const uploadData = await uploadResp.json();
            const fileUri = uploadData.file?.uri;
            if (!fileUri) {
                console.error('Upload failed:', JSON.stringify(uploadData));
                process.exit(1);
            }
            console.error(`Upload complete. File URI: ${fileUri}`);

            // Step 2: Wait for processing
            const fileName = uploadData.file.name;
            let fileState = uploadData.file.state;
            let retries = 0;
            while (fileState === 'PROCESSING' && retries < 60) {
                await new Promise(r => setTimeout(r, 3000));
                const statusResp = await fetch(`${baseUrl}${apiPath}/${fileName}?key=${apiKey}`);
                const statusData = await statusResp.json();
                fileState = statusData.state;
                retries++;
                if (fileState === 'PROCESSING') {
                    console.error(`Processing... (${retries * 3}s)`);
                }
            }
            if (fileState !== 'ACTIVE') {
                console.error(`File processing failed. State: ${fileState}`);
                process.exit(1);
            }

            // Step 3: Generate content with video
            console.error('Analyzing video with Gemini...');
            const model = 'gemini-2.5-flash';
            const genResp = await fetch(
                `${baseUrl}${apiPath}/models/${model}:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                { file_data: { mime_type: mimeType, file_uri: fileUri } },
                                { text: prompt },
                            ],
                        }],
                    }),
                }
            );
            const genData = await genResp.json();
            const text = genData.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
                console.log(text);
            } else {
                console.error('No response from Gemini:', JSON.stringify(genData).substring(0, 500));
                process.exit(1);
            }

            // Step 4: Clean up uploaded file
            fetch(`${baseUrl}${apiPath}/${fileName}?key=${apiKey}`, { method: 'DELETE' }).catch(() => {});
        } catch (err) {
            console.error('Video analysis failed:', err instanceof Error ? err.message : err);
            process.exit(1);
        }
        return;
    }
```

### `alma tasks`
```javascript
if (cmd === 'tasks') {
        const fs = await import('fs');
        const pathMod = await import('path');
        const tasksFile = pathMod.default.join(_os.homedir(), '.config', 'alma', 'tasks.json');

        const loadTasks = () => {
            try {
                if (fs.existsSync(tasksFile)) return JSON.parse(fs.readFileSync(tasksFile, 'utf-8'));
            } catch {
                /* ignore */
            }
            return { tasks: [] };
        };
        const saveTasks = data => {
            const dir = pathMod.default.dirname(tasksFile);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(tasksFile, JSON.stringify(data, null, 2), 'utf-8');
        };
        const genId = () => 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

        const subcmd = args[1];

        if (!subcmd || subcmd === 'list') {
            const data = loadTasks();
            const filter = args[2]; // 'all', 'active', 'done' (default: active)
            const tasks = data.tasks.filter(t => {
                if (filter === 'all') return true;
                if (filter === 'done') return t.status === 'done';
                return t.status !== 'done'; // default: active
            });
            if (tasks.length === 0) {
                console.log(filter === 'done' ? 'No completed tasks.' : 'No active tasks.');
            } else {
                for (const t of tasks) {
                    const stepInfo = t.steps?.length ? ` [${t.currentStep || 0}/${t.steps.length}]` : '';
                    const statusIcon = { pending: '⏳', in_progress: '🔄', done: '✅', blocked: '🚫' }[t.status] || '❓';
                    console.log(`${statusIcon} ${t.id} | ${t.title}${stepInfo} (${t.status})`);
                    if (t.steps?.length && t.status !== 'done') {
                        t.steps.forEach((s, i) => {
                            const marker = i < (t.currentStep || 0) ? '  ✓' : i === (t.currentStep || 0) ? '  →' : '   ';
                            console.log(`${marker} ${i + 1}. ${s}`);
                        });
                    }
                }
            }
            return;
        }

        if (subcmd === 'add') {
            const title = args.slice(2).join(' ');
            if (!title) {
                console.error('Usage: alma tasks add <title>');
                process.exit(1);
            }
            const data = loadTasks();
            const task = {
                id: genId(),
                title,
                status: 'pending',
                steps: [],
                currentStep: 0,
                threadId: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            data.tasks.push(task);
            saveTasks(data);
            console.log(`Created task: ${task.id} — ${title}`);
            return;
        }

        if (subcmd === 'update') {
            const taskId = args[2];
            if (!taskId) {
                console.error('Usage: alma tasks update <id> [--status <s>] [--step <n>] [--title <t>] [--steps "s1,s2,s3"] [--thread <id>]');
                process.exit(1);
            }
            const data = loadTasks();
            const task = data.tasks.find(t => t.id === taskId);
            if (!task) {
                console.error(`Task not found: ${taskId}`);
                process.exit(1);
            }
            for (let i = 3; i < args.length; i++) {
                if (args[i] === '--status' && args[i + 1]) {
                    task.status = args[++i];
                } else if (args[i] === '--step' && args[i + 1]) {
                    task.currentStep = parseInt(args[++i], 10);
                } else if (args[i] === '--title' && args[i + 1]) {
                    task.title = args[++i];
                } else if (args[i] === '--steps' && args[i + 1]) {
                    task.steps = args[++i].split(',').map(s => s.trim());
                } else if (args[i] === '--thread' && args[i + 1]) {
                    task.threadId = args[++i];
                }
            }
            task.updatedAt = new Date().toISOString();
            saveTasks(data);
            console.log(`Updated task: ${task.id} — ${task.title} (${task.status})`);
            return;
        }

        if (subcmd === 'show') {
            const taskId = args[2];
            if (!taskId) {
                console.error('Usage: alma tasks show <id>');
                process.exit(1);
            }
            const data = loadTasks();
            const task = data.tasks.find(t => t.id === taskId);
            if (!task) {
                console.error(`Task not found: ${taskId}`);
                process.exit(1);
            }
            console.log(JSON.stringify(task, null, 2));
            return;
        }

        if (subcmd === 'done') {
            const taskId = args[2];
            if (!taskId) {
                console.error('Usage: alma tasks done <id>');
                process.exit(1);
            }
            const data = loadTasks();
            const task = data.tasks.find(t => t.id === taskId);
            if (!task) {
                console.error(`Task not found: ${taskId}`);
                process.exit(1);
            }
            task.status = 'done';
            task.updatedAt = new Date().toISOString();
            saveTasks(data);
            console.log(`✅ Completed: ${task.id} — ${task.title}`);
            return;
        }

        if (subcmd === 'delete') {
            const taskId = args[2];
            if (!taskId) {
                console.error('Usage: alma tasks delete <id>');
                process.exit(1);
            }
            const data = loadTasks();
            data.tasks = data.tasks.filter(t => t.id !== taskId);
            saveTasks(data);
            console.log(`Deleted task: ${taskId}`);
            return;
        }

        console.error('Usage: alma tasks <list|add|update|show|done|delete>');
        process.exit(1);
    }
```

### `alma image`
```javascript
if (cmd === 'image') {
        const sub = args[1];
        if (sub === 'models' || sub === 'list-models' || sub === 'ls-models') {
            const googleProvider = await getEnabledGoogleProvider();
            if (!googleProvider) {
                console.error('❌ No enabled Google provider with API key found');
                process.exit(1);
            }
            let modelIds = [];
            try {
                modelIds = await fetchGeminiImageModelIds(googleProvider);
            } catch (err) {
                console.error(`❌ Failed to list image models: ${err.message || err}`);
                process.exit(1);
            }
            if (modelIds.length === 0) {
                console.error('❌ No image generation model found');
                process.exit(1);
            }
            const best = pickBestImageModel(modelIds);
            console.log('Available image generation models:');
            for (const modelId of modelIds) {
                const mark = modelId === best ? '*' : ' ';
                console.log(`${mark} ${modelId}`);
            }
            console.error('\nTip: use `alma image generate --model <model-id> "prompt"` to force a model');
            process.exit(0);
        }
        if (sub === 'generate' || sub === 'gen' || sub === 'edit') {
            const rawArgs = args.slice(2);
            const positional = [];
            const referencePaths = [];
            let modelOverride = '';

            for (let i = 0; i < rawArgs.length; i++) {
                const token = rawArgs[i];
                if (token === '--model' && rawArgs[i + 1]) {
                    modelOverride = rawArgs[++i].replace(/^models\//, '');
                    continue;
                }
                if (token.startsWith('--model=')) {
                    modelOverride = token.slice('--model='.length).replace(/^models\//, '');
                    continue;
                }
                if (token === '--reference' && rawArgs[i + 1]) {
                    referencePaths.push(rawArgs[++i]);
                    continue;
                }
                if (token.startsWith('--reference=')) {
                    referencePaths.push(token.slice('--reference='.length));
                    continue;
                }
                positional.push(token);
            }

            let prompt = '';
            let editPath = '';
            if (sub === 'edit') {
                editPath = positional[0] || '';
                prompt = positional.slice(1).join(' ').trim();
                if (!editPath || !prompt) {
                    console.error('Usage: alma image edit [--model <model-id>] <image-path> "<prompt>"');
                    process.exit(1);
                }
                if (referencePaths.length > 0) {
                    console.error('⚠️ `--reference` is ignored in edit mode.');
                }
                if (!_fs.existsSync(editPath)) {
                    console.error(`❌ Edit source image not found: ${editPath}`);
                    process.exit(1);
                }
            } else {
                prompt = positional.join(' ').trim();
                if (!prompt) {
                    console.error('Usage: alma image generate [--model <model-id>] "<prompt>" [--reference <image-path> ...]');
                    process.exit(1);
                }
            }

            // Content safety check — reject NSFW/explicit requests
            const imgBlockedPatterns = /私藏|大尺度|裸|nude|naked|nsfw|explicit|porn|hentai/i;
            if (imgBlockedPatterns.test(prompt)) {
                console.error('❌ Content boundary: explicit/NSFW image generation is not allowed.');
                process.exit(1);
            }

            const googleProvider = await getEnabledGoogleProvider();
            if (!googleProvider) {
                console.error('❌ No enabled Google provider with API key found');
                process.exit(1);
            }

            let modelIds = [];
            try {
                modelIds = await fetchGeminiImageModelIds(googleProvider);
            } catch (err) {
                console.error(`❌ Failed to fetch image models: ${err.message || err}`);
                process.exit(1);
            }
            if (modelIds.length === 0) {
                console.error('❌ No image generation model found');
                process.exit(1);
            }

            let model = pickBestImageModel(modelIds);
            if (modelOverride) {
                const exact = modelIds.find(id => id === modelOverride);
                const contains = exact ? null : modelIds.find(id => id.includes(modelOverride));
                if (!exact && !contains) {
                    console.error(`❌ Unknown image model: ${modelOverride}`);
                    console.error('Available models:');
                    for (const m of modelIds) console.error(`  - ${m}`);
                    process.exit(1);
                }
                model = exact || contains;
            }
            if (!model) {
                console.error('❌ No image generation model found');
                process.exit(1);
            }
            console.error(`[Image] Using model: ${model}${modelOverride ? ' (manual)' : ' (auto)'}`);

            // Auto-inject photorealistic keywords for selfie/person prompts to prevent illustration style
            const lowerPrompt = prompt.toLowerCase();
            const isSelfieOrPerson =
                lowerPrompt.includes('selfie') ||
                lowerPrompt.includes('自拍') ||
                lowerPrompt.includes('girl') ||
                lowerPrompt.includes('woman') ||
                lowerPrompt.includes('person') ||
                lowerPrompt.includes('portrait') ||
                lowerPrompt.includes('photo of') ||
                lowerPrompt.includes('美女') ||
                lowerPrompt.includes('可爱') ||
                lowerPrompt.includes('吊带');
            const alreadyHasRealism = lowerPrompt.includes('photorealistic') || lowerPrompt.includes('real photograph');

            const referenceImages = [];
            if (sub !== 'edit') {
                for (const refPath of referencePaths) {
                    if (_fs.existsSync(refPath)) {
                        try {
                            const imgData = _fs.readFileSync(refPath);
                            const ext = refPath.toLowerCase();
                            const mime = ext.endsWith('.png') ? 'image/png' : ext.endsWith('.gif') ? 'image/gif' : 'image/jpeg';
                            referenceImages.push({ inlineData: { mimeType: mime, data: imgData.toString('base64') } });
                        } catch {
                            console.error(`⚠️ Failed to read reference: ${refPath}`);
                        }
                    } else {
                        console.error(`⚠️ Reference image not found: ${refPath}`);
                    }
                }
            }
            if (referenceImages.length > 0) {
                console.error(`Using ${referenceImages.length} reference image(s) for face consistency`);
            }

            // Build request
            const parts = [];

            if (sub === 'edit') {
                const imgData = _fs.readFileSync(editPath);
                const base64 = imgData.toString('base64');
                const ext = editPath.toLowerCase();
                const mime = ext.endsWith('.png') ? 'image/png' : ext.endsWith('.gif') ? 'image/gif' : 'image/jpeg';
                parts.push({ inlineData: { mimeType: mime, data: base64 } });
                parts.push({ text: prompt });
            } else {
                const realismSuffix =
                    isSelfieOrPerson && !alreadyHasRealism
                        ? '\n\nIMPORTANT STYLE: This MUST be a photorealistic real photograph, NOT illustration, NOT anime, NOT cartoon, NOT drawing, NOT digital art. Real skin texture, natural lighting, shot on iPhone. Like a real photo from a smartphone camera.'
                        : '';
                if (referenceImages.length > 0) {
                    // Push ALL reference images for stronger face consistency
                    for (const refImg of referenceImages) {
                        parts.push(refImg);
                    }
                    const refCount = referenceImages.length;
                    const refNote =
                        refCount > 1
                            ? `I'm providing ${refCount} reference photos of the SAME person from different angles/settings.`
                            : `I'm providing a reference photo.`;
                    // Prepend face consistency instruction
                    parts.push({
                        text: `⚠️ CRITICAL REQUIREMENT — FACE CONSISTENCY IS THE #1 PRIORITY ⚠️\n\n${refNote} You MUST maintain the EXACT SAME face from the reference image(s). The face is NON-NEGOTIABLE:\n- SAME eye shape, eye size, eye color, eye spacing\n- SAME nose shape, nose bridge, nostril width\n- SAME lip shape, lip thickness, mouth width\n- SAME face shape, jawline, chin, cheekbones\n- SAME skin tone, skin texture, complexion\n- SAME eyebrow shape, thickness, arch\n- SAME facial proportions and features\n\nThe person in the generated image MUST be clearly recognizable as the SAME INDIVIDUAL in the reference photo(s). If the face changes even slightly, the output is WRONG. Think of it as the same person taking a different photo — the face NEVER changes, only the pose/setting/outfit/lighting can change.\n\nNow generate this scene with that EXACT same person:\n\n${prompt}${realismSuffix}`,
                    });
                } else {
                    parts.push({ text: `${prompt}${realismSuffix}` });
                }
            }

            console.error(`Generating with ${model}...`);
            const baseUrl = (googleProvider.baseURL || 'https://generativelanguage.googleapis.com').replace(/\/+$/, '');
            const apiPath = baseUrl.endsWith('/v1beta') ? '' : '/v1beta';
            const resp = await fetch(`${baseUrl}${apiPath}/models/${model}:generateContent?key=${googleProvider.apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts }],
                    generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
                }),
            });
            const data = await resp.json();
            if (data.error) {
                console.error(`❌ API error: ${data.error.message}`);
                process.exit(1);
            }

            const respParts = data.candidates?.[0]?.content?.parts || [];
            const ts = Date.now();
            let saved = false;
            for (let i = 0; i < respParts.length; i++) {
                const part = respParts[i];
                if (part.inlineData) {
                    const ext = part.inlineData.mimeType?.includes('png') ? 'png' : 'jpg';
                    const outPath = _path.join(_os.tmpdir(), `alma-gen-${ts}-${i}.${ext}`);
                    _fs.writeFileSync(outPath, Buffer.from(part.inlineData.data, 'base64'));
                    console.log(outPath);
                    saved = true;
                } else if (part.text) {
                    console.error(part.text);
                }
            }
            if (!saved) {
                console.error('❌ No image generated');
                process.exit(1);
            }
            process.exit(0);
        }
        console.error('Usage:');
        console.error('  alma image models');
        console.error('  alma image generate [--model <model-id>] "<prompt>" [--reference <image-path> ...]');
        console.error('  alma image edit [--model <model-id>] <image-path> "<prompt>"');
        process.exit(1);
    }
```

### `alma tts`
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

### `alma voices`
```javascript
if (cmd === 'voices') {
        const settings = await api('GET', '/api/settings');
        const provider = settings?.tts?.provider || 'elevenlabs';
        const apiKey = settings?.tts?.apiKey;
        const currentVoiceId = settings?.tts?.voiceId;

        if (provider === 'elevenlabs') {
            if (!apiKey) {
                console.error('❌ No ElevenLabs API key configured. Set it with: alma config set tts.apiKey <key>');
                process.exit(1);
            }
            try {
                const resp = await fetch('https://api.elevenlabs.io/v1/voices', {
                    headers: { 'xi-api-key': apiKey },
                });
                const data = await resp.json();
                const voices = data.voices || [];
                if (voices.length === 0) {
                    console.log('No voices found.');
                    return;
                }
                console.log(`Available ElevenLabs voices (${voices.length} total):\n`);
                for (const v of voices) {
                    const labels = v.labels || {};
                    const lang = labels.language || '?';
                    const gender = labels.gender || '?';
                    const accent = labels.accent || '';
                    const desc = labels.descriptive || '';
                    const current = v.voice_id === currentVoiceId ? ' ← current' : '';
                    console.log(`  ${v.voice_id}  ${v.name}  [${lang}/${gender}] ${accent} ${desc}${current}`);
                }
                console.log(`\nTo change voice: alma config set tts.voiceId <voice_id>`);
            } catch (err) {
                console.error('❌ Failed to fetch voices:', err.message);
                process.exit(1);
            }
        } else if (provider === 'openai') {
            console.log('OpenAI TTS voices: alloy, echo, fable, onyx, nova, shimmer');
            console.log(`Current: ${currentVoiceId || '(not set)'}`);
            console.log('\nTo change: alma config set tts.voiceId <voice_name>');
        } else if (provider === 'local' || provider === 'qwen') {
            console.log('Local Qwen3-TTS voices:\n');
            const localVoices = [
                { id: 'Chelsie', lang: 'en', gender: 'female', desc: 'warm, clear' },
                { id: 'Aidan', lang: 'en', gender: 'male', desc: 'deep, steady' },
                { id: 'Serena', lang: 'en', gender: 'female', desc: 'cute, lively' },
                { id: 'Vivian', lang: 'zh', gender: 'female', desc: '温柔, 自然' },
                { id: 'Ono_anna', lang: 'ja', gender: 'female', desc: 'Japanese' },
                { id: 'Sohee', lang: 'ko', gender: 'female', desc: 'Korean' },
                { id: 'Uncle_fu', lang: 'zh', gender: 'male', desc: '成熟, 稳重' },
                { id: 'Ryan', lang: 'en', gender: 'male', desc: 'deep' },
                { id: 'Aiden', lang: 'en', gender: 'male', desc: 'young' },
                { id: 'Eric', lang: 'en', gender: 'male', desc: 'professional' },
                { id: 'Dylan', lang: 'en', gender: 'male', desc: 'casual' },
            ];
            for (const v of localVoices) {
                const current = v.id.toLowerCase() === (currentVoiceId || '').toLowerCase() ? ' ← current' : '';
                console.log(`  ${v.id.padEnd(12)} [${v.lang}/${v.gender}] ${v.desc}${current}`);
            }
            console.log(`\nTo change: alma config set tts.voiceId <voice_name>`);
            console.log('Note: Qwen3-TTS supports any voice name. These are the pre-tested ones.');
        } else {
            console.log(`Unknown TTS provider: ${provider}`);
            console.log('Supported providers: local, openai, elevenlabs');
        }
        return;
    }
```

### `alma sing`
```javascript
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
```

### `alma emotion`
```javascript
if (cmd === 'emotion') {
        const fs = await import('fs');
        const pathMod = await import('path');
        const emotionDir = pathMod.default.join(_os.homedir(), '.config', 'alma', 'emotions');
        if (!fs.existsSync(emotionDir)) fs.mkdirSync(emotionDir, { recursive: true });
        const basePath = pathMod.default.join(emotionDir, 'base.md');
        const contextDir = pathMod.default.join(emotionDir, 'context');
        if (!fs.existsSync(contextDir)) fs.mkdirSync(contextDir, { recursive: true });

        // Parse YAML frontmatter from markdown
        function parseMd(content) {
            const m = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)/);
            if (!m) return { meta: {}, body: content.trim() };
            const meta = {};
            for (const line of m[1].split('\n')) {
                const idx = line.indexOf(':');
                if (idx > 0) {
                    const key = line.substring(0, idx).trim();
                    let val = line.substring(idx + 1).trim();
                    if (!isNaN(Number(val))) val = Number(val);
                    meta[key] = val;
                }
            }
            return { meta, body: m[2].trim() };
        }

        // Write markdown with YAML frontmatter
        function writeMd(filepath, meta, body) {
            const yaml = Object.entries(meta)
                .map(([k, v]) => `${k}: ${v}`)
                .join('\n');
            fs.writeFileSync(filepath, `---\n${yaml}\n---\n\n${body}\n`);
        }

        const subcmd = args[1];

        if (!subcmd || subcmd === 'status') {
            let base = { meta: { mood: 'neutral', energy: 5, valence: 5 }, body: 'No base emotion set yet' };
            if (fs.existsSync(basePath)) {
                try {
                    base = parseMd(fs.readFileSync(basePath, 'utf-8'));
                } catch {}
            }
            console.log('=== Base Emotion (global) ===');
            console.log(`  Mood: ${base.meta.mood} | Energy: ${base.meta.energy}/10 | Valence: ${base.meta.valence}/10`);
            if (base.body) console.log(`  ${base.body}`);
            console.log(`  Updated: ${base.meta.updated || 'never'}`);

            const ctxFiles = fs.readdirSync(contextDir).filter(f => f.endsWith('.md'));
            if (ctxFiles.length > 0) {
                console.log('\n=== Context Emotions (per-chat) ===');
                for (const f of ctxFiles) {
                    try {
                        const ctx = parseMd(fs.readFileSync(pathMod.default.join(contextDir, f), 'utf-8'));
                        const chatId = f.replace('.md', '');
                        console.log(
                            `  [${chatId}] ${ctx.meta.mood} (valence: ${ctx.meta.valence}/10) — ${ctx.body || 'no trigger'} (${ctx.meta.updated || '?'})`
                        );
                    } catch {}
                }
            }
            return;
        }

        if (subcmd === 'set-base') {
            const mood = args[2] || 'neutral';
            const energy = Math.min(10, Math.max(0, parseInt(args[3]) || 5));
            const valence = Math.min(10, Math.max(0, parseInt(args[4]) || 5));
            const description = args.slice(5).join(' ') || '';
            writeMd(basePath, { mood, energy, valence, updated: new Date().toISOString() }, description);
            console.log(`✅ Base emotion set: ${mood} (energy: ${energy}, valence: ${valence})`);
            return;
        }

        if (subcmd === 'set-context') {
            const chatId = args[2];
            const mood = args[3] || 'neutral';
            const valence = Math.min(10, Math.max(0, parseInt(args[4]) || 5));
            const trigger = args.slice(5).join(' ') || '';
            if (!chatId) {
                console.error('Usage: alma emotion set-context <chatId> <mood> <valence> <trigger>');
                process.exit(1);
            }
            writeMd(pathMod.default.join(contextDir, `${chatId}.md`), { mood, valence, updated: new Date().toISOString() }, trigger);
            console.log(`✅ Context emotion for ${chatId}: ${mood} (valence: ${valence}) — ${trigger}`);
            return;
        }

        if (subcmd === 'get') {
            const chatId = args[2];
            let base = { meta: { mood: 'neutral', energy: 5, valence: 5 }, body: '' };
            if (fs.existsSync(basePath)) {
                try {
                    base = parseMd(fs.readFileSync(basePath, 'utf-8'));
                } catch {}
            }
            let context = null;
            if (chatId) {
                const ctxPath = pathMod.default.join(contextDir, `${chatId}.md`);
                if (fs.existsSync(ctxPath)) {
                    try {
                        context = parseMd(fs.readFileSync(ctxPath, 'utf-8'));
                    } catch {}
                }
            }
            const baseV = Number(base.meta.valence) || 5;
            const ctxV = context ? Number(context.meta.valence) || 5 : baseV;
            const blendedValence = Math.round(baseV * 0.3 + ctxV * 0.7);
            const blendedMood = context ? context.meta.mood : base.meta.mood;
            console.log(
                JSON.stringify({
                    base: base.meta,
                    context: context?.meta || null,
                    blended: { mood: blendedMood, valence: blendedValence, energy: base.meta.energy },
                })
            );
            return;
        }

        console.error('Usage: alma emotion <status|set-base|set-context|get> [args]');
        return;
    }
```


## 🚀 考察 (Key Takeaways)
1. **スキル用CLIの正体**: `alma travel` や `alma selfie` などのコマンドは、ターミナルで実行される際に Node.js (Bun) 上の関数として呼び出されます。
2. **サーバー連携と直接処理の使い分け**:
   - `alma memory` のように、バックエンドサーバー (localhost:23001) の API を HTTP リクエストで叩いて情報を処理するもの。
   - `alma travel` のように、ローカルの `~/.config/alma/` 配下に JSON ファイルを作って直接状態を管理するもの。
   - `xiaohongshu-cli/scripts/xhs` のように、Python (uv) を使って外部パッケージを実行するラッパーシェルスクリプト。
3. **柔軟な拡張性**: `SKILL.md` (プロンプト) と `alma` (CLI または Shell Script) を組み合わせることで、どんなに複雑な処理や状態管理（旅行のシミュレーション、自撮りの管理など）でも、安全かつ透過的に AI 에ージェントの機能として統合できます。

# Skill Implementation: `self-management`

## 💻 正体: `alma` CLI サブコマンド (Node.js/Bun)
このスキルはターミナルで `alma voices` を実行した際、メインのCLIスクリプト内の以下のロジックを呼び出します。

### Implementation of `alma voices`
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

> 🔍 **分析**: このコマンドはローカルAPIサーバー (`localhost:23001`) に対してHTTPリクエストを行っています。

## 連携するCLIコマンド: `alma config`

### Implementation of `alma config`
```javascript
if (cmd === 'config') {
        const subcmd = args[1];

        if (subcmd === 'get' || subcmd === 'list') {
            const settings = await api('GET', '/api/settings');
            const path = args[2];
            prettyPrint(subcmd === 'list' ? settings : getNestedValue(settings, path));
            return;
        }

        if (subcmd === 'set') {
            const path = args[2];
            const rawValue = args[3];
            if (!path || rawValue === undefined) {
                console.error('Usage: alma config set <path> <value>');
                process.exit(1);
            }
            const value = parseValue(rawValue);

            // Validate defaultModel changes — must be a real provider:model and not an image-only model
            if ((path === 'chat.defaultModel' || path === 'telegram.defaultModel') && typeof value === 'string' && value.includes(':')) {
                const [providerId, modelId] = value.split(':');
                const providers = await api('GET', '/api/providers');
                const provider = (providers || []).find(p => p.id === providerId);
                if (!provider) {
                    console.error(`❌ Provider "${providerId}" not found. Run 'alma providers' to see available providers.`);
                    process.exit(1);
                }
                if (!provider.enabled) {
                    console.error(`❌ Provider "${provider.name}" is disabled.`);
                    process.exit(1);
                }
                // Block image-only models as default chat model
                const imageOnlyPatterns = ['nano-banana', 'imagen', 'image-generation', 'dall-e', 'stable-diffusion'];
                if (imageOnlyPatterns.some(p => modelId.toLowerCase().includes(p))) {
                    console.error(
                        `❌ "${modelId}" is an image generation model. Use the image-gen skill for image generation instead of changing the default chat model.`
                    );
                    process.exit(1);
                }
            }

            const settings = await api('GET', '/api/settings');
            delete settings.needsEmbeddingRebuild;
            setNestedValue(settings, path, value);
            await api('PUT', '/api/settings', settings);
            console.log(`✅ ${path} = ${JSON.stringify(value)}`);
            return;
        }

        console.error('Usage: alma config <get|set|list>');
        process.exit(1);
    }
```

## 連携するCLIコマンド: `alma update`

### Implementation of `alma update`
```javascript
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
```

> 🔍 **分析**: このコマンドはローカルAPIサーバー (`localhost:23001`) に対してHTTPリクエストを行っています。

## 連携するCLIコマンド: `alma status`

### Implementation of `alma status`
```javascript
if (cmd === 'status') {
        try {
            await fetch(`${BASE_URL}/api/settings`);
            console.log(`✅ Alma is running at ${BASE_URL}`);
        } catch {
            console.log(`❌ Alma is not running at ${BASE_URL}`);
            process.exit(1);
        }
        return;
    }
```

> 🔍 **分析**: このコマンドはローカルAPIサーバー (`localhost:23001`) に対してHTTPリクエストを行っています。

## 連携するCLIコマンド: `alma threads`

### Implementation of `alma threads`
```javascript
if (cmd === 'threads') {
        const limit = parseInt(args[1] || '10', 10);
        const threads = await api('GET', `/api/threads?limit=${limit}`);
        if (Array.isArray(threads)) {
            for (const t of threads) {
                const date = t.updatedAt || t.createdAt || '';
                const parent = t.parentThreadId ? ` ← ${t.parentThreadId.slice(0, 8)}…` : '';
                console.log(`${t.id}  ${date}  ${t.title || '(untitled)'}${parent}`);
            }
        } else {
            prettyPrint(threads);
        }
        return;
    }
```

## 連携するCLIコマンド: `alma soul`

### Implementation of `alma soul`
```javascript
if (cmd === 'soul') {
        // SOUL.md is global (in app data dir), not per-workspace
        const almaDataDir = _path.join(_os.homedir(), '.config', 'alma');
        const soulPath = _path.join(almaDataDir, 'SOUL.md');
        const sub = args[1];
        if (!sub || sub === 'show') {
            try {
                const content = _fs.readFileSync(soulPath, 'utf-8');
                console.log(content);
            } catch {
                console.log('No SOUL.md found. Create one with: alma soul set "<content>"');
            }
        } else if (sub === 'edit') {
            console.log(`SOUL.md path: ${soulPath}`);
            console.log('Edit this file directly or use: alma soul set "<content>"');
        } else if (sub === 'set') {
            const content = args.slice(2).join(' ');
            if (!content) {
                console.error('Usage: alma soul set <content>');
                process.exit(1);
            }
            _fs.mkdirSync(_path.dirname(soulPath), { recursive: true });
            _fs.writeFileSync(soulPath, content, 'utf-8');
            console.log('✅ SOUL.md updated');
        } else if (sub === 'append-trait') {
            const trait = args.slice(2).join(' ');
            if (!trait) {
                console.error('Usage: alma soul append-trait "<trait description>"');
                process.exit(1);
            }
            try {
                let content = _fs.readFileSync(soulPath, 'utf-8');
                const today = new Date().toISOString().slice(0, 10);
                const entry = `- [${today}] ${trait}`;
                // Find "## Evolved Traits" section
                const marker = '## Evolved Traits';
                const idx = content.indexOf(marker);
                if (idx === -1) {
                    // Add section at end
                    content += `\n\n${marker}\n${entry}\n`;
                } else {
                    // Count existing entries to enforce max 15
                    const after = content.slice(idx);
                    const entries = after.split('\n').filter(l => l.startsWith('- ['));
                    if (entries.length >= 15) {
                        // Remove oldest entry
                        const oldestLine = entries[0];
                        content = content.replace(oldestLine + '\n', '');
                    }
                    // Append new entry at end of file (Evolved Traits is last section)
                    content = content.trimEnd() + '\n' + entry + '\n';
                }
                _fs.writeFileSync(soulPath, content, 'utf-8');
                console.log(`✅ Trait added: ${entry}`);
            } catch (err) {
                console.error('❌ Failed to append trait:', err.message || err);
                process.exit(1);
            }
        } else {
            console.error('Usage: alma soul [show|edit|set|append-trait <trait>]');
            process.exit(1);
        }
        process.exit(0);
    }
```

> 🔍 **分析**: このコマンドはローカルのファイルシステム（JSONや設定ファイル等）を直接読み書きしています。

## 連携するCLIコマンド: `alma user`

### Implementation of `alma user`
```javascript
if (cmd === 'user') {
        const almaDataDir = _path.join(_os.homedir(), '.config', 'alma');
        const userPath = _path.join(almaDataDir, 'USER.md');
        const sub = args[1];
        if (!sub || sub === 'show') {
            try {
                const content = _fs.readFileSync(userPath, 'utf-8');
                console.log(content);
            } catch {
                console.log('No USER.md found. Create one with: alma user set "<content>"');
                console.log('Or let Alma create it for you by telling her about yourself.');
            }
        } else if (sub === 'set') {
            const content = args.slice(2).join(' ');
            if (!content) {
                console.error('Usage: alma user set "<content>"');
                process.exit(1);
            }
            _fs.mkdirSync(_path.dirname(userPath), { recursive: true });
            _fs.writeFileSync(userPath, content, 'utf-8');
            console.log('✅ USER.md updated');
        } else if (sub === 'edit') {
            console.log(`USER.md path: ${userPath}`);
            console.log('Edit this file directly or use: alma user set "<content>"');
        } else {
            console.error('Usage: alma user [show|set|edit]');
            process.exit(1);
        }
        process.exit(0);
    }
```

> 🔍 **分析**: このコマンドはローカルのファイルシステム（JSONや設定ファイル等）を直接読み書きしています。

## 連携するCLIコマンド: `alma workspace`

### Implementation of `alma workspace`
```javascript
if (cmd === 'workspace') {
        const subcmd = args[1];

        if (subcmd === 'list' || !subcmd) {
            const workspaces = await api('GET', '/api/workspaces');
            if (Array.isArray(workspaces)) {
                if (workspaces.length === 0) {
                    console.log('No workspaces.');
                    return;
                }
                for (const w of workspaces) {
                    console.log(`${w.id}  ${w.path || w.name || '(unknown)'}`);
                }
            } else {
                prettyPrint(workspaces);
            }
            return;
        }

        if (subcmd === 'set') {
            const id = args[2];
            const wsPath = args[3];
            if (!id || !wsPath) {
                console.error('Usage: alma workspace set <id> <path>');
                process.exit(1);
            }
            await api('PUT', `/api/workspaces/${id}`, { path: wsPath });
            console.log(`✅ Workspace ${id} path set to: ${wsPath}`);
            return;
        }

        console.error('Usage: alma workspace <list|set>');
        process.exit(1);
    }
```

## 連携するCLIコマンド: `alma dm`

### Implementation of `alma dm`
```javascript
if (cmd === 'dm') {
        const userId = args[1];
        const message = args.slice(2).join(' ').replace(/\\n/g, '\n');
        if (!userId || !message) {
            console.error('Usage: alma dm <userId> <message>');
            console.error('  userId: Telegram numeric user ID (find in people profiles)');
            console.error('  Note: The user must have /start-ed the bot first.');
            process.exit(1);
        }
        const settings = await api('GET', '/api/settings');
        const botToken = settings?.telegram?.botToken;
        if (!botToken) {
            console.error('Telegram bot not configured.');
            process.exit(1);
        }
        const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: userId, text: message }),
        });
        const result = await resp.json();
        if (result.ok) {
            console.log(`✅ DM sent to user ${userId}`);
        } else {
            if (result.description?.includes('bot was blocked') || result.description?.includes("bot can't initiate")) {
                console.error(`❌ Cannot DM: user hasn't started the bot or has blocked it.`);
            } else {
                console.error('Failed:', result.description);
            }
        }
        return;
    }
```

> 🔍 **分析**: このコマンドはローカルAPIサーバー (`localhost:23001`) に対してHTTPリクエストを行っています。

## 連携するCLIコマンド: `alma group`

### Implementation of `alma group`
```javascript
if (cmd === 'group') {
        const fs = await import('fs');
        const os = await import('os');
        const pathMod = await import('path');
        const logDir = pathMod.default.join(_os.homedir(), '.config', 'alma', 'groups');

        const subcmd = args[1]; // list | history | search

        if (!subcmd || subcmd === 'list') {
            if (!fs.existsSync(logDir)) {
                console.log('No group chat logs yet.');
                return;
            }
            const files = fs.readdirSync(logDir).filter(f => f.endsWith('.log'));
            const groups = new Set(files.map(f => f.split('_')[0]));
            for (const g of groups) {
                const groupFiles = files.filter(f => f.startsWith(g + '_'));
                const latest = groupFiles.sort().pop();
                console.log(`  Group ${g} (${groupFiles.length} day(s), latest: ${latest})`);
            }
            return;
        }

        if (subcmd === 'history') {
            const chatId = args[2];
            const limit = parseInt(args[3]) || 50;
            if (!chatId) {
                console.error('Usage: alma group history <chatId> [limit]');
                process.exit(1);
            }
            if (!fs.existsSync(logDir)) {
                console.log('No group chat logs.');
                return;
            }
            // Read all log files for this group, most recent first
            const files = fs
                .readdirSync(logDir)
                .filter(f => f.startsWith(chatId + '_') && f.endsWith('.log'))
                .sort()
                .reverse();
            const lines = [];
            for (const f of files) {
                const content = fs.readFileSync(pathMod.default.join(logDir, f), 'utf-8');
                const fileLines = content.split('\n').filter(l => l.trim());
                lines.push(...fileLines.reverse());
                if (lines.length >= limit) break;
            }
            lines
                .reverse()
                .slice(-limit)
                .forEach(l => console.log(l));
            return;
        }

        if (subcmd === 'search') {
            const query = args.slice(2).join(' ');
            if (!query) {
                console.error('Usage: alma group search <keyword>');
                process.exit(1);
            }
            if (!fs.existsSync(logDir)) {
                console.log('No group chat logs.');
                return;
            }
            const files = fs
                .readdirSync(logDir)
                .filter(f => f.endsWith('.log'))
                .sort();
            let found = 0;
            for (const f of files) {
                const content = fs.readFileSync(pathMod.default.join(logDir, f), 'utf-8');
                const matching = content.split('\n').filter(l => l.toLowerCase().includes(query.toLowerCase()));
                for (const line of matching) {
                    console.log(`[${f}] ${line}`);
                    found++;
                }
            }
            if (found === 0) console.log('No matches found.');
            return;
        }

        if (subcmd === 'send') {
            const chatId = args[2];
            const message = args.slice(3).join(' ').replace(/\\n/g, '\n');
            if (!chatId || !message) {
                console.error('Usage: alma group send <chatId> <message>');
                process.exit(1);
            }
            // Send via Alma API so that lastBotReplyTime and groupHistory are updated
            try {
                const result = await api('POST', `/api/groups/${chatId}/send`, { message });
                if (result?.ok || result?.messageId) {
                    console.log(`✅ Message sent to group ${chatId}`);
                } else {
                    console.error('Failed:', result?.error || result?.description || 'unknown error');
                }
            } catch {
                // Fallback: direct Telegram API (in case /api/groups/:chatId/send doesn't exist yet)
                const settings = await api('GET', '/api/settings');
                const botToken = settings?.telegram?.botToken;
                if (!botToken) {
                    console.error('Telegram bot not configured.');
                    process.exit(1);
                }
                const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: chatId, text: message }),
                });
                const result = await resp.json();
                if (result.ok) {
                    console.log(`✅ Message sent to group ${chatId} (direct)`);
                } else {
                    console.error('Failed:', result.description);
                }
            }
            return;
        }

        if (subcmd === 'send-photo') {
            const chatId = args[2];
            const filePath = args[3];
            const caption = args.slice(4).join(' ') || undefined;
            if (!chatId || !filePath) {
                console.error('Usage: alma group send-photo <chatId> <filePath> [caption]');
                process.exit(1);
            }
            const result = await api('POST', `/api/groups/${chatId}/send-photo`, { filePath, caption });
            if (result?.ok) console.log(`✅ Photo sent to group ${chatId}`);
            else console.error('Failed:', result?.error || 'unknown');
            return;
        }

        if (subcmd === 'send-document') {
            const chatId = args[2];
            const filePath = args[3];
            const caption = args.slice(4).join(' ') || undefined;
            if (!chatId || !filePath) {
                console.error('Usage: alma group send-document <chatId> <filePath> [caption]');
                process.exit(1);
            }
            const result = await api('POST', `/api/groups/${chatId}/send-document`, { filePath, caption });
            if (result?.ok) console.log(`✅ Document sent to group ${chatId}`);
            else console.error('Failed:', result?.error || 'unknown');
            return;
        }

        if (subcmd === 'send-video') {
            const chatId = args[2];
            const filePath = args[3];
            const caption = args.slice(4).join(' ') || undefined;
            if (!chatId || !filePath) {
                console.error('Usage: alma group send-video <chatId> <filePath> [caption]');
                process.exit(1);
            }
            const result = await api('POST', `/api/groups/${chatId}/send-video`, { filePath, caption });
            if (result?.ok) console.log(`✅ Video sent to group ${chatId}`);
            else console.error('Failed:', result?.error || 'unknown');
            return;
        }

        if (subcmd === 'pin') {
            const chatId = args[2];
            const messageId = args[3];
            if (!chatId || !messageId) {
                console.error('Usage: alma group pin <chatId> <messageId>');
                process.exit(1);
            }
            try {
                const res = await api('POST', `/api/groups/${chatId}/pin`, { messageId: Number(messageId) });
                console.log(res?.success ? `✅ Message ${messageId} pinned` : `❌ Failed to pin: ${res?.error || 'unknown'}`);
            } catch {
                console.error('❌ Failed. Is Alma running?');
            }
            return;
        }

        if (subcmd === 'unpin') {
            const chatId = args[2];
            const messageId = args[3]; // optional
            if (!chatId) {
                console.error('Usage: alma group unpin <chatId> [messageId]');
                process.exit(1);
            }
            try {
                const body = messageId ? { messageId: Number(messageId) } : {};
                const res = await api('POST', `/api/groups/${chatId}/unpin`, body);
                console.log(res?.success ? `✅ Unpinned${messageId ? ` message ${messageId}` : ' all'}` : `❌ Failed: ${res?.error || 'unknown'}`);
            } catch {
                console.error('❌ Failed. Is Alma running?');
            }
            return;
        }

        if (subcmd === 'context') {
            const chatId = args[2];
            const limit = parseInt(args[3]) || 100;
            if (!chatId) {
                console.error('Usage: alma group context <chatId> [limit]');
                process.exit(1);
            }

            // 1. Group info from Telegram API
            const settings = await api('GET', '/api/settings');
            const botToken = settings?.telegram?.botToken;
            if (botToken) {
                try {
                    const chatResp = await fetch(`https://api.telegram.org/bot${botToken}/getChat`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ chat_id: chatId }),
                    });
                    const chatData = await chatResp.json();
                    if (chatData.ok) {
                        const c = chatData.result;
                        console.log(`=== Group Info ===`);
                        console.log(`Title: ${c.title || 'N/A'}`);
                        console.log(`Type: ${c.type}`);
                        console.log(`Description: ${c.description || 'N/A'}`);
                        if (c.pinned_message) {
                            const pin = c.pinned_message;
                            const pinFrom = pin.from?.first_name || 'Unknown';
                            console.log(`Pinned: [${pinFrom}] ${pin.text || pin.caption || '[media]'}`);
                        }
                        console.log('');
                    }
                } catch {
                    /* ignore */
                }

                // 2. Member count + admin list
                try {
                    const countResp = await fetch(`https://api.telegram.org/bot${botToken}/getChatMemberCount`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ chat_id: chatId }),
                    });
                    const countData = await countResp.json();
                    if (countData.ok) console.log(`Members: ${countData.result}`);

                    const adminsResp = await fetch(`https://api.telegram.org/bot${botToken}/getChatAdministrators`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ chat_id: chatId }),
                    });
                    const adminsData = await adminsResp.json();
                    if (adminsData.ok) {
                        const admins = adminsData.result.map(a => {
                            const name = a.user.first_name || a.user.username || a.user.id;
                            const uname = a.user.username ? ` (@${a.user.username})` : '';
                            const bot = a.user.is_bot ? ' [BOT]' : '';
                            return `  ${a.status}: ${name}${uname}${bot}`;
                        });
                        console.log(`Admins:\n${admins.join('\n')}`);
                    }
                } catch {
                    /* ignore */
                }
                console.log('');
            }

            // 3. Local log history
            console.log(`=== Recent Messages (last ${limit}) ===`);
            if (!fs.existsSync(logDir)) {
                console.log('No local logs.');
                return;
            }
            const files = fs
                .readdirSync(logDir)
                .filter(f => f.startsWith(chatId + '_') && f.endsWith('.log'))
                .sort()
                .reverse();
            const lines = [];
            for (const f of files) {
                const content = fs.readFileSync(pathMod.default.join(logDir, f), 'utf-8');
                const fileLines = content.split('\n').filter(l => l.trim());
                lines.push(...fileLines.reverse());
                if (lines.length >= limit) break;
            }
            lines
                .reverse()
                .slice(-limit)
                .forEach(l => console.log(l));
            return;
        }

        if (subcmd === 'leave') {
            const chatId = args[2];
            if (!chatId) {
                console.error('Usage: alma group leave <chatId>');
                process.exit(1);
            }
            try {
                const res = await api('POST', `/api/groups/${chatId}/leave`);
                if (res?.success) {
                    console.log(`✅ Left group ${chatId} (chat history preserved, use "alma group history ${chatId}" to review)`);
                } else {
                    console.error('Failed to leave group:', res?.error || 'unknown error');
                }
            } catch (e) {
                console.error('❌ Failed to leave group. Is Alma running?');
            }
            return;
        }

        if (subcmd === 'participation') {
            const settingsPath = pathMod.default.join(_os.homedir(), '.config', 'alma', 'group-settings.json');
            const action = args[2]; // show | set | reset

            // Load current settings
            let settings = { defaults: { randomBoostRate: 0.2, cooldownMinutes: 30, quietMinutes: 5, enabled: true }, groups: {} };
            try {
                if (fs.existsSync(settingsPath)) {
                    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
                }
            } catch {
                /* use defaults */
            }

            if (!action || action === 'show') {
                console.log('Group Participation Settings');
                console.log('===========================');
                console.log(`\nDefaults:`);
                console.log(`  randomBoostRate: ${settings.defaults?.randomBoostRate ?? 0.2} (0-1, probability of responding when AI says NO)`);
                console.log(`  cooldownMinutes: ${settings.defaults?.cooldownMinutes ?? 30} (min time between patrol replies per group)`);
                console.log(`  quietMinutes: ${settings.defaults?.quietMinutes ?? 5} (only patrol if no messages for this long)`);
                console.log(`  enabled: ${settings.defaults?.enabled ?? true}`);
                if (settings.groups && Object.keys(settings.groups).length > 0) {
                    console.log(`\nPer-group overrides:`);
                    for (const [gid, overrides] of Object.entries(settings.groups)) {
                        console.log(`  ${gid}: ${JSON.stringify(overrides)}`);
                    }
                }
                console.log(`\nFile: ${settingsPath}`);
                console.log(`Edit directly or use: alma group participation set <key> <value> [chatId]`);
                return;
            }

            if (action === 'set') {
                const key = args[3];
                const value = args[4];
                const chatId = args[5]; // optional, for per-group override
                if (!key || !value) {
                    console.error('Usage: alma group participation set <key> <value> [chatId]');
                    console.error('Keys: randomBoostRate, cooldownMinutes, quietMinutes, enabled');
                    process.exit(1);
                }
                const numVal = key === 'enabled' ? value === 'true' : Number(value);
                if (chatId) {
                    if (!settings.groups) settings.groups = {};
                    if (!settings.groups[chatId]) settings.groups[chatId] = {};
                    settings.groups[chatId][key] = numVal;
                    console.log(`✅ Set ${key}=${numVal} for group ${chatId}`);
                } else {
                    if (!settings.defaults) settings.defaults = {};
                    settings.defaults[key] = numVal;
                    console.log(`✅ Set default ${key}=${numVal}`);
                }
                fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
                return;
            }

            if (action === 'reset') {
                const chatId = args[3];
                if (chatId && settings.groups?.[chatId]) {
                    delete settings.groups[chatId];
                    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
                    console.log(`✅ Reset overrides for group ${chatId}`);
                } else if (!chatId) {
                    settings = { defaults: { randomBoostRate: 0.2, cooldownMinutes: 30, quietMinutes: 5, enabled: true }, groups: {} };
                    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
                    console.log('✅ Reset all participation settings to defaults');
                }
                return;
            }

            console.error('Usage: alma group participation [show|set|reset]');
            process.exit(1);
        }

        if (subcmd === 'rules') {
            const action = args[2]; // show | set | add | clear
            const chatId = args[3];

            if (!action || action === 'help') {
                console.log('Usage: alma group rules <show|set|add|clear> <chatId> [text]');
                console.log('  show <chatId>    — Show current rules for a group');
                console.log('  set <chatId> "rules text"  — Replace all rules');
                console.log('  add <chatId> "new rule"    — Append a rule');
                console.log('  clear <chatId>   — Remove all rules');
                console.log('\nRules file: ~/.config/alma/groups/<chatId>.rules.md');
                return;
            }

            if (!chatId) {
                console.error('Error: chatId is required');
                process.exit(1);
            }

            const rulesPath = pathMod.default.join(_os.homedir(), '.config', 'alma', 'groups', `${chatId}.rules.md`);

            if (action === 'show') {
                if (fs.existsSync(rulesPath)) {
                    console.log(fs.readFileSync(rulesPath, 'utf-8'));
                } else {
                    console.log('No rules set for this group.');
                }
                return;
            }

            if (action === 'set') {
                const text = args.slice(4).join(' ');
                if (!text) {
                    console.error('Error: rules text required');
                    process.exit(1);
                }
                const groupsDir = pathMod.default.join(_os.homedir(), '.config', 'alma', 'groups');
                if (!fs.existsSync(groupsDir)) fs.mkdirSync(groupsDir, { recursive: true });
                fs.writeFileSync(rulesPath, text + '\n');
                console.log(`✅ Rules set for group ${chatId}`);
                return;
            }

            if (action === 'add') {
                const text = args.slice(4).join(' ');
                if (!text) {
                    console.error('Error: rule text required');
                    process.exit(1);
                }
                const groupsDir = pathMod.default.join(_os.homedir(), '.config', 'alma', 'groups');
                if (!fs.existsSync(groupsDir)) fs.mkdirSync(groupsDir, { recursive: true });
                const existing = fs.existsSync(rulesPath) ? fs.readFileSync(rulesPath, 'utf-8') : '';
                fs.writeFileSync(rulesPath, existing + `- ${text}\n`);
                console.log(`✅ Rule added for group ${chatId}`);
                return;
            }

            if (action === 'clear') {
                if (fs.existsSync(rulesPath)) {
                    fs.unlinkSync(rulesPath);
                    console.log(`✅ Rules cleared for group ${chatId}`);
                } else {
                    console.log('No rules to clear.');
                }
                return;
            }

            console.error('Usage: alma group rules <show|set|add|clear> <chatId> [text]');
            process.exit(1);
        }

        console.error('Usage: alma group <list|history|search|context|send|pin|unpin|leave|participation|rules> [args]');
        process.exit(1);
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


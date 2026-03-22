# Skill Implementation: `self-reflection`

## 💻 正体: `alma` CLI サブコマンド (Node.js/Bun)
このスキルはターミナルで `alma emotion` を実行した際、メインのCLIスクリプト内の以下のロジックを呼び出します。

### Implementation of `alma emotion`
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

> 🔍 **分析**: このコマンドはローカルのファイルシステム（JSONや設定ファイル等）を直接読み書きしています。

## 連携するCLIコマンド: `alma memory`

### Implementation of `alma memory`
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

> 🔍 **分析**: このコマンドはローカルのファイルシステム（JSONや設定ファイル等）を直接読み書きしています。

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


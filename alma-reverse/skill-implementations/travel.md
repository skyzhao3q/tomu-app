# Skill Implementation: `travel`

## 💻 正体: `alma` CLI サブコマンド (Node.js/Bun)
このスキルはターミナルで `alma travel` を実行した際、メインのCLIスクリプト内の以下のロジックを呼び出します。

### Implementation of `alma travel`
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


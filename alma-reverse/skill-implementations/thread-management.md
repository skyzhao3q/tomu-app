# Skill Implementation: `thread-management`

## 💻 正体: `alma` CLI サブコマンド (Node.js/Bun)
このスキルはターミナルで `alma threads` を実行した際、メインのCLIスクリプト内の以下のロジックを呼び出します。

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

## 連携するCLIコマンド: `alma thread`

### Implementation of `alma thread`
```javascript
if (cmd === 'thread') {
        const subcmd = args[1];

        if (subcmd === 'create') {
            const title = args.slice(2).join(' ') || 'New Thread';
            const thread = await api('POST', '/api/threads', { title });
            console.log(`✅ Created thread: ${thread.id}  "${thread.title || title}"`);
            return;
        }

        if (subcmd === 'delete') {
            const id = args[2];
            if (!id) {
                console.error('Usage: alma thread delete <id>');
                process.exit(1);
            }
            await api('DELETE', `/api/threads/${id}`);
            console.log(`✅ Deleted thread: ${id}`);
            return;
        }

        if (subcmd === 'search') {
            const query = args.slice(2).join(' ');
            if (!query) {
                console.error('Usage: alma thread search <query>');
                process.exit(1);
            }
            const results = await api('GET', `/api/search/threads?q=${encodeURIComponent(query)}`);
            if (Array.isArray(results) && results.length > 0) {
                for (const t of results) {
                    console.log(`${t.id}  ${t.title || '(untitled)'}`);
                }
            } else {
                console.log('No threads found.');
            }
            return;
        }

        if (subcmd === 'compact') {
            const id = args[2];
            if (!id) {
                console.error('Usage: alma thread compact <id>');
                process.exit(1);
            }
            const result = await api('POST', `/api/threads/${id}/compact`);
            console.log(`✅ Compacted thread: ${id}`);
            if (result && typeof result === 'object') prettyPrint(result);
            return;
        }

        if (subcmd === 'messages') {
            const id = args[2];
            if (!id) {
                console.error('Usage: alma thread messages <id> [limit]');
                process.exit(1);
            }
            const limit = parseInt(args[3] || '20', 10);
            const messages = await api('GET', `/api/threads/${id}/messages?limit=${limit}`);
            if (Array.isArray(messages)) {
                for (const m of messages) {
                    // Parse message: could be raw DB row with .message JSON string, or already parsed
                    let role = m.role || 'unknown';
                    let content = '';
                    try {
                        const msg = typeof m.message === 'string' ? JSON.parse(m.message) : m.message;
                        if (msg) {
                            role = msg.role || role;
                            if (msg.parts && Array.isArray(msg.parts)) {
                                content = msg.parts
                                    .filter(p => p.type === 'text')
                                    .map(p => p.text)
                                    .join(' ');
                            } else if (msg.content) {
                                content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
                            }
                        }
                    } catch {
                        // Fallback to direct fields
                        content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content || '');
                    }
                    if (!content && m.content) {
                        content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
                    }
                    console.log(`${role.padEnd(10)} ${truncate(content || '(empty)', 80)}`);
                }
                console.log(`\n(${messages.length} messages)`);
            } else {
                prettyPrint(messages);
            }
            return;
        }

        if (subcmd === 'switch') {
            const targetId = args[2];
            if (!targetId) {
                console.error('Usage: alma thread switch <target-thread-id> [--from <current-thread-id>]');
                process.exit(1);
            }
            // Get source thread from --from flag or ALMA_THREAD_ID env
            let sourceThreadId = process.env.ALMA_THREAD_ID;
            const fromIdx = args.indexOf('--from');
            if (fromIdx !== -1 && args[fromIdx + 1]) {
                sourceThreadId = args[fromIdx + 1];
            }
            if (!sourceThreadId) {
                console.error('Error: Cannot determine current thread. Use --from <thread-id> or ensure ALMA_THREAD_ID is set.');
                process.exit(1);
            }
            const result = await api('POST', `/api/threads/${targetId}/switch`, { sourceThreadId });
            if (result.success) {
                console.log(`✅ 已切换到: "${result.targetThread?.title || targetId}" (${result.switched} mapping(s) updated)`);
            } else {
                console.error('❌ Switch failed:', JSON.stringify(result));
            }
            return;
        }

        console.error('Usage: alma thread <create|delete|search|compact|messages|switch>');
        process.exit(1);
    }
```


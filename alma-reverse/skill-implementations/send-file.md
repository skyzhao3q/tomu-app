# Skill Implementation: `send-file`

## 💻 正体: `alma` CLI サブコマンド (Node.js/Bun)
このスキルはターミナルで `alma send` を実行した際、メインのCLIスクリプト内の以下のロジックを呼び出します。

### Implementation of `alma send`
```javascript
if (cmd === 'send') {
        const subcmd = args[1]; // photo, file, audio, video, document, voice
        const sendArgs = args.slice(2);
        let chatId = process.env.ALMA_CHAT_ID || '';
        let threadId = process.env.ALMA_THREAD_ID || '';
        let chatIdExplicit = false;
        let threadIdExplicit = false;
        const positional = [];

        for (let i = 0; i < sendArgs.length; i++) {
            const token = sendArgs[i];
            if (token === '--chat' && sendArgs[i + 1]) {
                chatId = sendArgs[++i];
                chatIdExplicit = true;
                continue;
            }
            if (token === '--thread' && sendArgs[i + 1]) {
                threadId = sendArgs[++i];
                threadIdExplicit = true;
                continue;
            }
            positional.push(token);
        }

        const actualFilePath = positional[0];
        const actualCaption = positional.slice(1).join(' ') || undefined;

        if (!subcmd || !actualFilePath) {
            console.error('Usage: alma send <photo|file|audio|video|voice> [--chat <chatId> | --thread <threadId>] <filePath> [caption]');
            console.error('Reads ALMA_CHAT_ID / ALMA_THREAD_ID from environment (set automatically by Alma during tool execution).');
            process.exit(1);
        }

        const targetMode = chatIdExplicit ? 'chat' : threadIdExplicit ? 'thread' : chatId ? 'chat' : threadId ? 'thread' : '';
        if (!targetMode) {
            console.error('❌ No target found. Set ALMA_CHAT_ID / ALMA_THREAD_ID, or use --chat <chatId> / --thread <threadId>.');
            process.exit(1);
        }
        if (!actualFilePath) {
            console.error('❌ No file path provided.');
            process.exit(1);
        }

        const fs = await import('fs');
        if (!fs.existsSync(actualFilePath)) {
            console.error(`❌ File not found: ${actualFilePath}`);
            process.exit(1);
        }

        // 🔒 Block sending files from selfie album to non-owner chats
        const _pathMod = await import('path');
        const resolvedPath = _pathMod.resolve(actualFilePath);
        const selfieAlbumDir = _pathMod.join(process.env.HOME || '', '.config', 'alma', 'selfies');
        if (targetMode === 'chat' && resolvedPath.startsWith(selfieAlbumDir)) {
            // Allow sending to owner only — check settings for ownerId
            let isOwner = false;
            try {
                const settings = await api('GET', '/api/settings');
                const ownerId = settings?.telegram?.ownerId;
                if (ownerId && chatId === String(ownerId)) {
                    isOwner = true;
                }
            } catch {
                /* can't verify, block by default */
            }
            if (!isOwner) {
                console.error(
                    '❌ BLOCKED: Cannot send selfie album photos to non-owner chats. These are private face-reference images. Use `alma selfie take` to generate a new selfie instead.'
                );
                process.exit(1);
            }
        }

        // Map subcmd to API endpoint
        const typeMap = {
            photo: 'send-photo',
            image: 'send-photo',
            file: 'send-document',
            document: 'send-document',
            doc: 'send-document',
            audio: 'send-audio',
            music: 'send-audio',
            video: 'send-video',
            voice: 'send-voice',
        };
        const endpoint = typeMap[subcmd.toLowerCase()];
        if (!endpoint) {
            console.error(`❌ Unknown type: ${subcmd}. Use: photo, file, audio, video, voice`);
            process.exit(1);
        }
        if (targetMode === 'thread' && endpoint !== 'send-photo') {
            console.error(`❌ \`${subcmd}\` is not supported for GUI thread delivery yet. Use \`alma send photo\` or target an external chat with --chat <chatId>.`);
            process.exit(1);
        }

        try {
            const targetId = targetMode === 'chat' ? chatId : threadId;
            const targetEndpoint =
                targetMode === 'chat' ? `/api/chat/${chatId}/${endpoint}` : `/api/threads/${threadId}/${endpoint}`;
            const result = await api('POST', targetEndpoint, { filePath: actualFilePath, caption: actualCaption });
            if (result?.ok || result?.messageId) {
                console.log(`✅ Sent ${subcmd} to ${targetMode} ${targetId}`);
            } else {
                console.error('Failed:', result?.error || result?.description || 'unknown error');
                process.exit(1);
            }
        } catch (err) {
            console.error('❌ Send failed:', err.message || err);
            process.exit(1);
        }
        return;
    }
```


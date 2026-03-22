# Skill Implementation: `selfie`

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

## 連携するCLIコマンド: `alma selfie`

### Implementation of `alma selfie`
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

> 🔍 **分析**: このコマンドはローカルAPIサーバー (`localhost:23001`) に対してHTTPリクエストを行っています。

## 連携するCLIコマンド: `alma image`

### Implementation of `alma image`
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

> 🔍 **分析**: このコマンドはローカルAPIサーバー (`localhost:23001`) に対してHTTPリクエストを行っています。


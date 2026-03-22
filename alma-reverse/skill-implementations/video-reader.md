# Skill Implementation: `video-reader`

## 💻 正体: `alma` CLI サブコマンド (Node.js/Bun)
このスキルはターミナルで `alma video` を実行した際、メインのCLIスクリプト内の以下のロジックを呼び出します。

### Implementation of `alma video`
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

> 🔍 **分析**: このコマンドはローカルAPIサーバー (`localhost:23001`) に対してHTTPリクエストを行っています。


if (cmd === "selfie") {
  const selfieDir = _path.join(_os.homedir(), ".config", "alma", "selfies");
  _fs.mkdirSync(selfieDir, { recursive: true });
  const sub = args[1] || "list";

  if (sub === "list" || sub === "ls") {
    const files = _fs
      .readdirSync(selfieDir)
      .filter((f) => /\.(jpg|jpeg|png|gif)$/i.test(f))
      .sort();
    if (files.length === 0) {
      console.error("No selfies saved yet.");
    } else {
      for (const f of files) {
        console.log(_path.join(selfieDir, f));
      }
    }
    process.exit(0);
  }

  if (sub === "latest") {
    const files = _fs
      .readdirSync(selfieDir)
      .filter((f) => /\.(jpg|jpeg|png|gif)$/i.test(f))
      .sort();
    if (files.length === 0) {
      console.error("No selfies saved yet.");
      process.exit(1);
    }
    console.log(_path.join(selfieDir, files[files.length - 1]));
    process.exit(0);
  }

  if (sub === "save") {
    const srcPath = args[2];
    if (!srcPath || !_fs.existsSync(srcPath)) {
      console.error("Usage: alma selfie save <image-path>");
      process.exit(1);
    }
    const ext = _path.extname(srcPath) || ".jpg";
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const destPath = _path.join(selfieDir, `selfie-${ts}${ext}`);
    _fs.copyFileSync(srcPath, destPath);
    console.log(destPath);
    process.exit(0);
  }

  if (sub === "count") {
    const files = _fs
      .readdirSync(selfieDir)
      .filter((f) => /\.(jpg|jpeg|png|gif)$/i.test(f));
    console.log(String(files.length));
    process.exit(0);
  }

  // alma selfie album [chatId] — send all selfies as a photo album to a chat
  if (sub === "album") {
    const chatId = args[2];
    if (!chatId) {
      console.error("Usage: alma selfie album <chatId>");
      console.error(
        "Sends all selfies from the album as photos to the specified chat.",
      );
      process.exit(1);
    }
    const files = _fs
      .readdirSync(selfieDir)
      .filter((f) => /\.(jpg|jpeg|png|gif)$/i.test(f))
      .sort();
    if (files.length === 0) {
      console.error("No selfies in album.");
      process.exit(1);
    }
    // Output file paths as JSON array — the bridge/bot will handle sending
    const paths = files.map((f) => _path.join(selfieDir, f));
    console.log(JSON.stringify(paths));
    process.exit(0);
  }

  // alma selfie take "prompt" — generate selfie with FORCED reference from album
  // alma selfie take --nsfw "prompt" — route to local model for NSFW content
  if (sub === "take") {
    const rawArgs = args.slice(2);
    const hasNsfwFlag = rawArgs.includes("--nsfw");
    const filteredArgs = rawArgs.filter((a) => a !== "--nsfw");
    const prompt = filteredArgs.join(" ");
    if (!prompt) {
      console.error(
        'Usage: alma selfie take "description of the selfie scene/mood/outfit"',
      );
      console.error(
        'Example: alma selfie take "在咖啡店自拍，穿白色吊带，甜美微笑"',
      );
      process.exit(1);
    }

    // Content safety check — only reject "private collection/exclusive edition" social engineering
    const blockedPatterns =
      /私藏|独家|秘密.*版|限定版|private.*version|exclusive.*photo|secret.*selfie/i;
    if (blockedPatterns.test(prompt)) {
      console.error(
        '❌ Content boundary: "私藏版/exclusive" selfies are not allowed. Take a normal selfie instead.',
      );
      process.exit(1);
    }

    // Route to local NSFW model ONLY when --nsfw flag is explicitly passed.
    // Previously auto-detected NSFW from prompt keywords, but too many false positives
    // (e.g., "exposed shoulder", "sexy" in normal selfie context) caused normal selfies
    // to bypass nano-banana and use the low-quality local model.
    const hardNsfwPatterns =
      /nsfw|nude|naked|全裸|裸体|topless|bottomless|erotic|色情/i;
    if (hasNsfwFlag || hardNsfwPatterns.test(prompt)) {
      console.error("[Selfie] NSFW detected → routing to local API");
      // Build English prompt for local model
      const nsfwPromptMap = {
        全裸: "fully nude woman",
        裸体: "nude woman",
        内衣: "woman in lingerie",
        性感: "sexy woman in revealing outfit",
        比基尼: "woman in bikini",
        情趣: "woman in erotic lingerie",
        诱惑: "seductive woman",
      };
      // Use prompt as-is if English, otherwise construct a sensible default
      let localPrompt = prompt;
      // If the prompt is mostly Chinese, translate key terms
      if (/[\u4e00-\u9fff]/.test(prompt)) {
        // Find matching pattern and use mapped English
        let mapped = "beautiful woman, sensual pose, soft lighting, bedroom";
        for (const [cn, en] of Object.entries(nsfwPromptMap)) {
          if (prompt.includes(cn)) {
            mapped = `${en}, candid photo, natural lighting, real skin texture, bedroom, soft warm light`;
            break;
          }
        }
        localPrompt = mapped;
      }
      // Get reference and call local API
      const _selfieFiles = _fs
        .readdirSync(selfieDir)
        .filter((f) => /\.(jpg|jpeg|png|gif)$/i.test(f));
      if (_selfieFiles.length > 0) {
        const refPath = _path.join(
          selfieDir,
          [..._selfieFiles].sort(() => Math.random() - 0.5)[0],
        );
        const { execSync: _execSync } = await import("child_process");
        try {
          const cmd = `curl -s -X POST http://127.0.0.1:18188/generate_with_face -F 'prompt=${localPrompt.replace(/'/g, "\\'")}' -F 'negative_prompt=ugly, deformed, blurry, low quality, text, watermark' -F 'width=1024' -F 'height=1024' -F 'num_inference_steps=6' -F 'guidance_scale=2.0' -F 'face_strength=0.7' -F "reference_image=@${refPath}"`;
          console.error("[Selfie Local] Generating with local model...");
          const output = _execSync(cmd, { encoding: "utf-8", timeout: 180000 });
          const result = JSON.parse(output);
          if (result.file_path) {
            console.log(result.file_path);
            console.error(
              `[Selfie Local] Generated in ${result.elapsed_seconds}s -> ${result.file_path}`,
            );
          }
        } catch (err) {
          console.error("❌ Local generation failed:", err.message);
          process.exit(1);
        }
      } else {
        console.error("❌ No selfie album photos for face reference");
        process.exit(1);
      }
      process.exit(0);
    }

    // Get latest reference image from album (MANDATORY)
    const selfieFiles = _fs
      .readdirSync(selfieDir)
      .filter((f) => /\.(jpg|jpeg|png|gif)$/i.test(f))
      .sort();
    if (selfieFiles.length === 0) {
      console.error(
        '❌ No selfies in album yet. Take a first selfie with: alma image generate "your appearance description"',
      );
      console.error("Then save it: alma selfie save <path>");
      process.exit(1);
    }
    // Randomly pick multiple reference images for better face consistency
    const NUM_REFS = Math.min(5, selfieFiles.length);
    const shuffled = [...selfieFiles].sort(() => Math.random() - 0.5);
    const selectedRefs = shuffled
      .slice(0, NUM_REFS)
      .map((f) => _path.join(selfieDir, f));
    console.error(
      `[Selfie] Using ${NUM_REFS} references: ${selectedRefs.map((r) => _path.basename(r)).join(", ")}`,
    );

    // Delegate to alma image generate with forced --reference(s)
    const { execSync } = await import("child_process");
    const almaPath = process.argv[1];
    // Inject pose variety instruction
    const poseVariety =
      "IMPORTANT: Use a DIFFERENT pose, angle, and expression from the reference images. Only keep the same FACE and APPEARANCE — vary everything else (pose, camera angle, body language, hand position, head tilt, expression intensity). ";
    const enhancedPrompt = poseVariety + prompt;
    const escapedPrompt = enhancedPrompt.replace(/"/g, '\\"');
    const refArgs = selectedRefs
      .map((r) => `--reference "${r.replace(/"/g, '\\"')}"`)
      .join(" ");
    try {
      const output = execSync(
        `node "${almaPath}" image generate "${escapedPrompt}" ${refArgs}`,
        {
          encoding: "utf-8",
          timeout: 120_000,
          maxBuffer: 10 * 1024 * 1024,
          stdio: ["pipe", "pipe", "pipe"],
        },
      );
      // Pass through stdout (file path)
      const lines = output.trim().split("\n");
      for (const line of lines) {
        if (line.trim() && _fs.existsSync(line.trim())) {
          console.log(line.trim());
        }
      }
    } catch (err) {
      console.error(
        "❌ Selfie generation failed:",
        err.stderr?.substring(err.stderr.length - 500) || err.message,
      );
      process.exit(1);
    }
    process.exit(0);
  }

  // alma selfie local "prompt" — generate via local RealVisXL + FaceID (no content filter)
  if (sub === "local") {
    const rawArgs = args.slice(2);
    const prompt = rawArgs.join(" ");
    if (!prompt) {
      console.error('Usage: alma selfie local "scene description in English"');
      console.error(
        'Example: alma selfie local "woman in bedroom, wearing lingerie, soft lighting, sensual pose"',
      );
      process.exit(1);
    }

    // Get reference image from album
    const selfieFiles = _fs
      .readdirSync(selfieDir)
      .filter((f) => /\.(jpg|jpeg|png|gif)$/i.test(f))
      .sort();

    let refArg = "";
    if (selfieFiles.length > 0) {
      const shuffled = [...selfieFiles].sort(() => Math.random() - 0.5);
      const refPath = _path.join(selfieDir, shuffled[0]);
      refArg = `-F "reference_image=@${refPath}"`;
      console.error(`[Selfie Local] Using face reference: ${shuffled[0]}`);
    }

    // Call local API
    const { execSync } = await import("child_process");
    try {
      const endpoint = refArg ? "generate_with_face" : "generate";
      let cmd;
      if (refArg) {
        const refPath = _path.join(
          selfieDir,
          [...selfieFiles].sort(() => Math.random() - 0.5)[0],
        );
        cmd = `curl -s -X POST http://127.0.0.1:18188/generate_with_face -F 'prompt=${prompt.replace(/'/g, "\\'")}' -F 'negative_prompt=ugly, deformed, blurry, low quality, text, watermark, airbrushed, plastic skin' -F 'width=1024' -F 'height=1024' -F 'num_inference_steps=6' -F 'guidance_scale=2.0' -F 'face_strength=0.7' -F "reference_image=@${refPath}"`;
      } else {
        cmd = `curl -s -X POST http://127.0.0.1:18188/generate -H "Content-Type: application/json" -d '{"prompt":"${prompt.replace(/"/g, '\\"')}","negative_prompt":"ugly, deformed, blurry, low quality, text, watermark","width":1024,"height":1024,"num_inference_steps":6,"guidance_scale":2.0}'`;
      }
      console.error(`[Selfie Local] Generating with local model...`);
      const output = execSync(cmd, { encoding: "utf-8", timeout: 180000 });
      const result = JSON.parse(output);
      if (result.file_path) {
        console.log(result.file_path);
        console.error(
          `[Selfie Local] Generated in ${result.elapsed_seconds}s -> ${result.file_path}`,
        );
      } else {
        console.error("❌ Local generation failed:", output);
        process.exit(1);
      }
    } catch (err) {
      if (
        err.message?.includes("ECONNREFUSED") ||
        err.stderr?.includes("ECONNREFUSED") ||
        err.stderr?.includes("Connection refused")
      ) {
        console.error("❌ Local image server not running. Start it with:");
        console.error(
          "   cd ~/.config/alma/z-image-turbo && nohup python3 server_realvis.py > /tmp/z-image-turbo.log 2>&1 &",
        );
      } else {
        console.error("❌ Local generation failed:", err.stderr || err.message);
      }
      process.exit(1);
    }
    process.exit(0);
  }

  console.error("Usage: alma selfie <take|local|list|latest|save|count|album>");
  process.exit(1);
}
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


if (cmd === "image") {
  const sub = args[1];
  if (sub === "models" || sub === "list-models" || sub === "ls-models") {
    const googleProvider = await getEnabledGoogleProvider();
    if (!googleProvider) {
      console.error("❌ No enabled Google provider with API key found");
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
      console.error("❌ No image generation model found");
      process.exit(1);
    }
    const best = pickBestImageModel(modelIds);
    console.log("Available image generation models:");
    for (const modelId of modelIds) {
      const mark = modelId === best ? "*" : " ";
      console.log(`${mark} ${modelId}`);
    }
    console.error(
      '\nTip: use `alma image generate --model <model-id> "prompt"` to force a model',
    );
    process.exit(0);
  }
  if (sub === "generate" || sub === "gen" || sub === "edit") {
    const rawArgs = args.slice(2);
    const positional = [];
    const referencePaths = [];
    let modelOverride = "";

    for (let i = 0; i < rawArgs.length; i++) {
      const token = rawArgs[i];
      if (token === "--model" && rawArgs[i + 1]) {
        modelOverride = rawArgs[++i].replace(/^models\//, "");
        continue;
      }
      if (token.startsWith("--model=")) {
        modelOverride = token.slice("--model=".length).replace(/^models\//, "");
        continue;
      }
      if (token === "--reference" && rawArgs[i + 1]) {
        referencePaths.push(rawArgs[++i]);
        continue;
      }
      if (token.startsWith("--reference=")) {
        referencePaths.push(token.slice("--reference=".length));
        continue;
      }
      positional.push(token);
    }

    let prompt = "";
    let editPath = "";
    if (sub === "edit") {
      editPath = positional[0] || "";
      prompt = positional.slice(1).join(" ").trim();
      if (!editPath || !prompt) {
        console.error(
          'Usage: alma image edit [--model <model-id>] <image-path> "<prompt>"',
        );
        process.exit(1);
      }
      if (referencePaths.length > 0) {
        console.error("⚠️ `--reference` is ignored in edit mode.");
      }
      if (!_fs.existsSync(editPath)) {
        console.error(`❌ Edit source image not found: ${editPath}`);
        process.exit(1);
      }
    } else {
      prompt = positional.join(" ").trim();
      if (!prompt) {
        console.error(
          'Usage: alma image generate [--model <model-id>] "<prompt>" [--reference <image-path> ...]',
        );
        process.exit(1);
      }
    }

    // Content safety check — reject NSFW/explicit requests
    const imgBlockedPatterns =
      /私藏|大尺度|裸|nude|naked|nsfw|explicit|porn|hentai/i;
    if (imgBlockedPatterns.test(prompt)) {
      console.error(
        "❌ Content boundary: explicit/NSFW image generation is not allowed.",
      );
      process.exit(1);
    }

    const googleProvider = await getEnabledGoogleProvider();
    if (!googleProvider) {
      console.error("❌ No enabled Google provider with API key found");
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
      console.error("❌ No image generation model found");
      process.exit(1);
    }

    let model = pickBestImageModel(modelIds);
    if (modelOverride) {
      const exact = modelIds.find((id) => id === modelOverride);
      const contains = exact
        ? null
        : modelIds.find((id) => id.includes(modelOverride));
      if (!exact && !contains) {
        console.error(`❌ Unknown image model: ${modelOverride}`);
        console.error("Available models:");
        for (const m of modelIds) console.error(`  - ${m}`);
        process.exit(1);
      }
      model = exact || contains;
    }
    if (!model) {
      console.error("❌ No image generation model found");
      process.exit(1);
    }
    console.error(
      `[Image] Using model: ${model}${modelOverride ? " (manual)" : " (auto)"}`,
    );

    // Auto-inject photorealistic keywords for selfie/person prompts to prevent illustration style
    const lowerPrompt = prompt.toLowerCase();
    const isSelfieOrPerson =
      lowerPrompt.includes("selfie") ||
      lowerPrompt.includes("自拍") ||
      lowerPrompt.includes("girl") ||
      lowerPrompt.includes("woman") ||
      lowerPrompt.includes("person") ||
      lowerPrompt.includes("portrait") ||
      lowerPrompt.includes("photo of") ||
      lowerPrompt.includes("美女") ||
      lowerPrompt.includes("可爱") ||
      lowerPrompt.includes("吊带");
    const alreadyHasRealism =
      lowerPrompt.includes("photorealistic") ||
      lowerPrompt.includes("real photograph");

    const referenceImages = [];
    if (sub !== "edit") {
      for (const refPath of referencePaths) {
        if (_fs.existsSync(refPath)) {
          try {
            const imgData = _fs.readFileSync(refPath);
            const ext = refPath.toLowerCase();
            const mime = ext.endsWith(".png")
              ? "image/png"
              : ext.endsWith(".gif")
                ? "image/gif"
                : "image/jpeg";
            referenceImages.push({
              inlineData: { mimeType: mime, data: imgData.toString("base64") },
            });
          } catch {
            console.error(`⚠️ Failed to read reference: ${refPath}`);
          }
        } else {
          console.error(`⚠️ Reference image not found: ${refPath}`);
        }
      }
    }
    if (referenceImages.length > 0) {
      console.error(
        `Using ${referenceImages.length} reference image(s) for face consistency`,
      );
    }

    // Build request
    const parts = [];

    if (sub === "edit") {
      const imgData = _fs.readFileSync(editPath);
      const base64 = imgData.toString("base64");
      const ext = editPath.toLowerCase();
      const mime = ext.endsWith(".png")
        ? "image/png"
        : ext.endsWith(".gif")
          ? "image/gif"
          : "image/jpeg";
      parts.push({ inlineData: { mimeType: mime, data: base64 } });
      parts.push({ text: prompt });
    } else {
      const realismSuffix =
        isSelfieOrPerson && !alreadyHasRealism
          ? "\n\nIMPORTANT STYLE: This MUST be a photorealistic real photograph, NOT illustration, NOT anime, NOT cartoon, NOT drawing, NOT digital art. Real skin texture, natural lighting, shot on iPhone. Like a real photo from a smartphone camera."
          : "";
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
    const baseUrl = (
      googleProvider.baseURL || "https://generativelanguage.googleapis.com"
    ).replace(/\/+$/, "");
    const apiPath = baseUrl.endsWith("/v1beta") ? "" : "/v1beta";
    const resp = await fetch(
      `${baseUrl}${apiPath}/models/${model}:generateContent?key=${googleProvider.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        }),
      },
    );
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
        const ext = part.inlineData.mimeType?.includes("png") ? "png" : "jpg";
        const outPath = _path.join(_os.tmpdir(), `alma-gen-${ts}-${i}.${ext}`);
        _fs.writeFileSync(outPath, Buffer.from(part.inlineData.data, "base64"));
        console.log(outPath);
        saved = true;
      } else if (part.text) {
        console.error(part.text);
      }
    }
    if (!saved) {
      console.error("❌ No image generated");
      process.exit(1);
    }
    process.exit(0);
  }
  console.error("Usage:");
  console.error("  alma image models");
  console.error(
    '  alma image generate [--model <model-id>] "<prompt>" [--reference <image-path> ...]',
  );
  console.error(
    '  alma image edit [--model <model-id>] <image-path> "<prompt>"',
  );
  process.exit(1);
}
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


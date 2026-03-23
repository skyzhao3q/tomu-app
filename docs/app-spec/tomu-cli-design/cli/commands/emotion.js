if (cmd === "emotion") {
  const fs = await import("fs");
  const pathMod = await import("path");
  const emotionDir = pathMod.default.join(
    _os.homedir(),
    ".config",
    "alma",
    "emotions",
  );
  if (!fs.existsSync(emotionDir)) fs.mkdirSync(emotionDir, { recursive: true });
  const basePath = pathMod.default.join(emotionDir, "base.md");
  const contextDir = pathMod.default.join(emotionDir, "context");
  if (!fs.existsSync(contextDir)) fs.mkdirSync(contextDir, { recursive: true });

  // Parse YAML frontmatter from markdown
  function parseMd(content) {
    const m = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)/);
    if (!m) return { meta: {}, body: content.trim() };
    const meta = {};
    for (const line of m[1].split("\n")) {
      const idx = line.indexOf(":");
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
      .join("\n");
    fs.writeFileSync(filepath, `---\n${yaml}\n---\n\n${body}\n`);
  }

  const subcmd = args[1];

  if (!subcmd || subcmd === "status") {
    let base = {
      meta: { mood: "neutral", energy: 5, valence: 5 },
      body: "No base emotion set yet",
    };
    if (fs.existsSync(basePath)) {
      try {
        base = parseMd(fs.readFileSync(basePath, "utf-8"));
      } catch {}
    }
    console.log("=== Base Emotion (global) ===");
    console.log(
      `  Mood: ${base.meta.mood} | Energy: ${base.meta.energy}/10 | Valence: ${base.meta.valence}/10`,
    );
    if (base.body) console.log(`  ${base.body}`);
    console.log(`  Updated: ${base.meta.updated || "never"}`);

    const ctxFiles = fs
      .readdirSync(contextDir)
      .filter((f) => f.endsWith(".md"));
    if (ctxFiles.length > 0) {
      console.log("\n=== Context Emotions (per-chat) ===");
      for (const f of ctxFiles) {
        try {
          const ctx = parseMd(
            fs.readFileSync(pathMod.default.join(contextDir, f), "utf-8"),
          );
          const chatId = f.replace(".md", "");
          console.log(
            `  [${chatId}] ${ctx.meta.mood} (valence: ${ctx.meta.valence}/10) — ${ctx.body || "no trigger"} (${ctx.meta.updated || "?"})`,
          );
        } catch {}
      }
    }
    return;
  }

  if (subcmd === "set-base") {
    const mood = args[2] || "neutral";
    const energy = Math.min(10, Math.max(0, parseInt(args[3]) || 5));
    const valence = Math.min(10, Math.max(0, parseInt(args[4]) || 5));
    const description = args.slice(5).join(" ") || "";
    writeMd(
      basePath,
      { mood, energy, valence, updated: new Date().toISOString() },
      description,
    );
    console.log(
      `✅ Base emotion set: ${mood} (energy: ${energy}, valence: ${valence})`,
    );
    return;
  }

  if (subcmd === "set-context") {
    const chatId = args[2];
    const mood = args[3] || "neutral";
    const valence = Math.min(10, Math.max(0, parseInt(args[4]) || 5));
    const trigger = args.slice(5).join(" ") || "";
    if (!chatId) {
      console.error(
        "Usage: alma emotion set-context <chatId> <mood> <valence> <trigger>",
      );
      process.exit(1);
    }
    writeMd(
      pathMod.default.join(contextDir, `${chatId}.md`),
      { mood, valence, updated: new Date().toISOString() },
      trigger,
    );
    console.log(
      `✅ Context emotion for ${chatId}: ${mood} (valence: ${valence}) — ${trigger}`,
    );
    return;
  }

  if (subcmd === "get") {
    const chatId = args[2];
    let base = { meta: { mood: "neutral", energy: 5, valence: 5 }, body: "" };
    if (fs.existsSync(basePath)) {
      try {
        base = parseMd(fs.readFileSync(basePath, "utf-8"));
      } catch {}
    }
    let context = null;
    if (chatId) {
      const ctxPath = pathMod.default.join(contextDir, `${chatId}.md`);
      if (fs.existsSync(ctxPath)) {
        try {
          context = parseMd(fs.readFileSync(ctxPath, "utf-8"));
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
        blended: {
          mood: blendedMood,
          valence: blendedValence,
          energy: base.meta.energy,
        },
      }),
    );
    return;
  }

  console.error("Usage: alma emotion <status|set-base|set-context|get> [args]");
  return;
}
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


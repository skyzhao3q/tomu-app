if (cmd === "soul") {
  // SOUL.md is global (in app data dir), not per-workspace
  const almaDataDir = _path.join(_os.homedir(), ".config", "alma");
  const soulPath = _path.join(almaDataDir, "SOUL.md");
  const sub = args[1];
  if (!sub || sub === "show") {
    try {
      const content = _fs.readFileSync(soulPath, "utf-8");
      console.log(content);
    } catch {
      console.log(
        'No SOUL.md found. Create one with: alma soul set "<content>"',
      );
    }
  } else if (sub === "edit") {
    console.log(`SOUL.md path: ${soulPath}`);
    console.log('Edit this file directly or use: alma soul set "<content>"');
  } else if (sub === "set") {
    const content = args.slice(2).join(" ");
    if (!content) {
      console.error("Usage: alma soul set <content>");
      process.exit(1);
    }
    _fs.mkdirSync(_path.dirname(soulPath), { recursive: true });
    _fs.writeFileSync(soulPath, content, "utf-8");
    console.log("✅ SOUL.md updated");
  } else if (sub === "append-trait") {
    const trait = args.slice(2).join(" ");
    if (!trait) {
      console.error('Usage: alma soul append-trait "<trait description>"');
      process.exit(1);
    }
    try {
      let content = _fs.readFileSync(soulPath, "utf-8");
      const today = new Date().toISOString().slice(0, 10);
      const entry = `- [${today}] ${trait}`;
      // Find "## Evolved Traits" section
      const marker = "## Evolved Traits";
      const idx = content.indexOf(marker);
      if (idx === -1) {
        // Add section at end
        content += `\n\n${marker}\n${entry}\n`;
      } else {
        // Count existing entries to enforce max 15
        const after = content.slice(idx);
        const entries = after.split("\n").filter((l) => l.startsWith("- ["));
        if (entries.length >= 15) {
          // Remove oldest entry
          const oldestLine = entries[0];
          content = content.replace(oldestLine + "\n", "");
        }
        // Append new entry at end of file (Evolved Traits is last section)
        content = content.trimEnd() + "\n" + entry + "\n";
      }
      _fs.writeFileSync(soulPath, content, "utf-8");
      console.log(`✅ Trait added: ${entry}`);
    } catch (err) {
      console.error("❌ Failed to append trait:", err.message || err);
      process.exit(1);
    }
  } else {
    console.error("Usage: alma soul [show|edit|set|append-trait <trait>]");
    process.exit(1);
  }
  process.exit(0);
}
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


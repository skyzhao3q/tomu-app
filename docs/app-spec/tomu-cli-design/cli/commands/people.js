if (cmd === "people") {
  const fs = await import("fs");
  const pathMod = await import("path");
  const profileDir = pathMod.default.join(
    _os.homedir(),
    ".config",
    "alma",
    "people",
  );
  if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });

  const subcmd = args[1]; // list | show | set | delete

  if (!subcmd || subcmd === "list") {
    const files = fs.readdirSync(profileDir).filter((f) => f.endsWith(".md"));
    if (files.length === 0) {
      console.log("No people profiles yet.");
    } else {
      for (const f of files) {
        const name = f.replace(".md", "");
        const content = fs.readFileSync(
          pathMod.default.join(profileDir, f),
          "utf-8",
        );
        const lines = content.split("\n").filter((l) => l.trim()).length;
        console.log(`  ${name} (${lines} lines)`);
      }
    }
    return;
  }

  if (subcmd === "show" && args[2]) {
    const name = args[2].replace("@", "").toLowerCase();
    const file = pathMod.default.join(profileDir, `${name}.md`);
    if (fs.existsSync(file)) {
      console.log(fs.readFileSync(file, "utf-8"));
    } else {
      console.log(`No profile for "${name}" yet.`);
    }
    return;
  }

  if (subcmd === "set" && args[2]) {
    const name = args[2].replace("@", "").toLowerCase();
    const file = pathMod.default.join(profileDir, `${name}.md`);
    // Read from stdin if no inline content
    const content = args.slice(3).join(" ");
    if (content) {
      fs.writeFileSync(file, content + "\n", "utf-8");
      console.log(`✅ Profile for "${name}" saved.`);
    } else {
      // Append mode - read from stdin
      const data = fs.readFileSync(0, "utf-8");
      fs.writeFileSync(file, data, "utf-8");
      console.log(`✅ Profile for "${name}" saved from stdin.`);
    }
    return;
  }

  if (subcmd === "append" && args[2]) {
    const name = args[2].replace("@", "").toLowerCase();
    const file = pathMod.default.join(profileDir, `${name}.md`);
    const content = args.slice(3).join(" ");
    if (content) {
      fs.appendFileSync(file, content + "\n", "utf-8");
      console.log(`✅ Appended to "${name}" profile.`);
    }
    return;
  }

  if (subcmd === "delete" && args[2]) {
    const name = args[2].replace("@", "").toLowerCase();
    const file = pathMod.default.join(profileDir, `${name}.md`);
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      console.log(`✅ Profile for "${name}" deleted.`);
    } else {
      console.log(`No profile for "${name}".`);
    }
    return;
  }

  if (subcmd === "dir") {
    console.log(profileDir);
    return;
  }

  console.error(
    "Usage: alma people <list|show|set|append|delete|dir> [name] [content]",
  );
  process.exit(1);
}
if (cmd === 'people') {
        const fs = await import('fs');
        const pathMod = await import('path');
        const profileDir = pathMod.default.join(_os.homedir(), '.config', 'alma', 'people');
        if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });

        const subcmd = args[1]; // list | show | set | delete

        if (!subcmd || subcmd === 'list') {
            const files = fs.readdirSync(profileDir).filter(f => f.endsWith('.md'));
            if (files.length === 0) {
                console.log('No people profiles yet.');
            } else {
                for (const f of files) {
                    const name = f.replace('.md', '');
                    const content = fs.readFileSync(pathMod.default.join(profileDir, f), 'utf-8');
                    const lines = content.split('\n').filter(l => l.trim()).length;
                    console.log(`  ${name} (${lines} lines)`);
                }
            }
            return;
        }

        if (subcmd === 'show' && args[2]) {
            const name = args[2].replace('@', '').toLowerCase();
            const file = pathMod.default.join(profileDir, `${name}.md`);
            if (fs.existsSync(file)) {
                console.log(fs.readFileSync(file, 'utf-8'));
            } else {
                console.log(`No profile for "${name}" yet.`);
            }
            return;
        }

        if (subcmd === 'set' && args[2]) {
            const name = args[2].replace('@', '').toLowerCase();
            const file = pathMod.default.join(profileDir, `${name}.md`);
            // Read from stdin if no inline content
            const content = args.slice(3).join(' ');
            if (content) {
                fs.writeFileSync(file, content + '\n', 'utf-8');
                console.log(`✅ Profile for "${name}" saved.`);
            } else {
                // Append mode - read from stdin
                const data = fs.readFileSync(0, 'utf-8');
                fs.writeFileSync(file, data, 'utf-8');
                console.log(`✅ Profile for "${name}" saved from stdin.`);
            }
            return;
        }

        if (subcmd === 'append' && args[2]) {
            const name = args[2].replace('@', '').toLowerCase();
            const file = pathMod.default.join(profileDir, `${name}.md`);
            const content = args.slice(3).join(' ');
            if (content) {
                fs.appendFileSync(file, content + '\n', 'utf-8');
                console.log(`✅ Appended to "${name}" profile.`);
            }
            return;
        }

        if (subcmd === 'delete' && args[2]) {
            const name = args[2].replace('@', '').toLowerCase();
            const file = pathMod.default.join(profileDir, `${name}.md`);
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
                console.log(`✅ Profile for "${name}" deleted.`);
            } else {
                console.log(`No profile for "${name}".`);
            }
            return;
        }

        if (subcmd === 'dir') {
            console.log(profileDir);
            return;
        }

        console.error('Usage: alma people <list|show|set|append|delete|dir> [name] [content]');
        process.exit(1);
    }


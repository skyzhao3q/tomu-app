if (cmd === "user") {
  const almaDataDir = _path.join(_os.homedir(), ".config", "alma");
  const userPath = _path.join(almaDataDir, "USER.md");
  const sub = args[1];
  if (!sub || sub === "show") {
    try {
      const content = _fs.readFileSync(userPath, "utf-8");
      console.log(content);
    } catch {
      console.log(
        'No USER.md found. Create one with: alma user set "<content>"',
      );
      console.log(
        "Or let Alma create it for you by telling her about yourself.",
      );
    }
  } else if (sub === "set") {
    const content = args.slice(2).join(" ");
    if (!content) {
      console.error('Usage: alma user set "<content>"');
      process.exit(1);
    }
    _fs.mkdirSync(_path.dirname(userPath), { recursive: true });
    _fs.writeFileSync(userPath, content, "utf-8");
    console.log("✅ USER.md updated");
  } else if (sub === "edit") {
    console.log(`USER.md path: ${userPath}`);
    console.log('Edit this file directly or use: alma user set "<content>"');
  } else {
    console.error("Usage: alma user [show|set|edit]");
    process.exit(1);
  }
  process.exit(0);
}
if (cmd === 'user') {
        const almaDataDir = _path.join(_os.homedir(), '.config', 'alma');
        const userPath = _path.join(almaDataDir, 'USER.md');
        const sub = args[1];
        if (!sub || sub === 'show') {
            try {
                const content = _fs.readFileSync(userPath, 'utf-8');
                console.log(content);
            } catch {
                console.log('No USER.md found. Create one with: alma user set "<content>"');
                console.log('Or let Alma create it for you by telling her about yourself.');
            }
        } else if (sub === 'set') {
            const content = args.slice(2).join(' ');
            if (!content) {
                console.error('Usage: alma user set "<content>"');
                process.exit(1);
            }
            _fs.mkdirSync(_path.dirname(userPath), { recursive: true });
            _fs.writeFileSync(userPath, content, 'utf-8');
            console.log('✅ USER.md updated');
        } else if (sub === 'edit') {
            console.log(`USER.md path: ${userPath}`);
            console.log('Edit this file directly or use: alma user set "<content>"');
        } else {
            console.error('Usage: alma user [show|set|edit]');
            process.exit(1);
        }
        process.exit(0);
    }


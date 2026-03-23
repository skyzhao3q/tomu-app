if (cmd === "version") {
  const path = await import("path");
  const fs = await import("fs");
  const { fileURLToPath } = await import("url");
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const pkgPath = path.resolve(dir, "..", "package.json");
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    console.log(`Alma v${pkg.version}`);
  } catch {
    console.log("Alma (version unknown)");
  }
  return;
}
if (cmd === 'version') {
        const path = await import('path');
        const fs = await import('fs');
        const { fileURLToPath } = await import('url');
        const dir = path.dirname(fileURLToPath(import.meta.url));
        const pkgPath = path.resolve(dir, '..', 'package.json');
        try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            console.log(`Alma v${pkg.version}`);
        } catch {
            console.log('Alma (version unknown)');
        }
        return;
    }


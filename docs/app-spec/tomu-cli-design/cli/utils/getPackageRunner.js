function getPackageRunner() {
  if (_cachedRunner !== undefined) return _cachedRunner;
  function tryCmd(cmd) {
    try {
      _execSync(`${cmd} --version`, { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }
  if (tryCmd("npx")) {
    _cachedRunner = "npx";
    return _cachedRunner;
  }
  if (tryCmd("bunx")) {
    _cachedRunner = "bunx";
    return _cachedRunner;
  }
  // Try Alma's bundled bun
  const bundledPaths = [
    _path.join(
      __alma_dirname,
      "..",
      "vendor",
      "bun",
      `${process.platform}-${process.arch}`,
      process.platform === "win32" ? "bun.exe" : "bun",
    ),
    _path.join(
      __alma_dirname,
      "..",
      "Resources",
      "bun",
      process.platform === "win32" ? "bun.exe" : "bun",
    ),
    _path.join(_os.homedir(), ".bun", "bin", "bun"),
  ];
  for (const p of bundledPaths) {
    if (_fs.existsSync(p)) {
      _cachedRunner = `"${p}" x`;
      return _cachedRunner;
    }
  }
  _cachedRunner = null;
  return _cachedRunner;
}

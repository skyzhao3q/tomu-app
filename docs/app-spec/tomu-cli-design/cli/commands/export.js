if (cmd === "export") {
  const fs = await import("fs");
  const resp = await apiRaw("GET", "/api/data/export");
  const data = await resp.text();
  const filename = `alma-export-${new Date().toISOString().slice(0, 10)}.json`;
  fs.writeFileSync(filename, data);
  console.log(`✅ Data exported to: ${filename}`);
  return;
}
if (cmd === 'export') {
        const fs = await import('fs');
        const resp = await apiRaw('GET', '/api/data/export');
        const data = await resp.text();
        const filename = `alma-export-${new Date().toISOString().slice(0, 10)}.json`;
        fs.writeFileSync(filename, data);
        console.log(`✅ Data exported to: ${filename}`);
        return;
    }


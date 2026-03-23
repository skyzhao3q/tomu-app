if (cmd === "import") {
  const file = args[1];
  if (!file) {
    console.error("Usage: alma import <file>");
    process.exit(1);
  }
  const fs = await import("fs");
  if (!fs.existsSync(file)) {
    console.error(`File not found: ${file}`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(file, "utf-8"));
  await api("POST", "/api/data/import", data);
  console.log(`✅ Data imported from: ${file}`);
  return;
}
if (cmd === 'import') {
        const file = args[1];
        if (!file) {
            console.error('Usage: alma import <file>');
            process.exit(1);
        }
        const fs = await import('fs');
        if (!fs.existsSync(file)) {
            console.error(`File not found: ${file}`);
            process.exit(1);
        }
        const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
        await api('POST', '/api/data/import', data);
        console.log(`✅ Data imported from: ${file}`);
        return;
    }


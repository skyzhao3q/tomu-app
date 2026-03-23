if (cmd === "status") {
  try {
    await fetch(`${BASE_URL}/api/settings`);
    console.log(`✅ Alma is running at ${BASE_URL}`);
  } catch {
    console.log(`❌ Alma is not running at ${BASE_URL}`);
    process.exit(1);
  }
  return;
}
if (cmd === 'status') {
        try {
            await fetch(`${BASE_URL}/api/settings`);
            console.log(`✅ Alma is running at ${BASE_URL}`);
        } catch {
            console.log(`❌ Alma is not running at ${BASE_URL}`);
            process.exit(1);
        }
        return;
    }


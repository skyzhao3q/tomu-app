async function apiRaw(method, path) {
  const opts = { method };
  try {
    const resp = await fetch(`${BASE_URL}${path}`, opts);
    if (!resp.ok) {
      console.error(`Error: HTTP ${resp.status} ${resp.statusText}`);
      process.exit(1);
    }
    return resp;
  } catch (err) {
    console.error(`Error: Cannot connect to Alma at ${BASE_URL}`);
    process.exit(1);
  }
}

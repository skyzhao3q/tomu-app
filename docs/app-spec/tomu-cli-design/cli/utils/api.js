async function api(method, path, body) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  try {
    const resp = await fetch(`${BASE_URL}${path}`, opts);
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      console.error(
        `Error: HTTP ${resp.status} ${resp.statusText}${text ? " — " + text : ""}`,
      );
      process.exit(1);
    }
    const ct = resp.headers.get("content-type") || "";
    if (ct.includes("application/json")) return await resp.json();
    return await resp.text();
  } catch (err) {
    console.error(`Error: Cannot connect to Alma at ${BASE_URL}`);
    console.error(
      "Is Alma running? Start it with: npm run dev (in the alma directory)",
    );
    process.exit(1);
  }
}

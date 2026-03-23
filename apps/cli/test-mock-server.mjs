#!/usr/bin/env node
/**
 * test-mock-server.mjs — Minimal HTTP mock server for tomu CLI integration tests.
 * Usage: node test-mock-server.mjs [port]
 * Prints "READY <port>" to stdout once listening.
 */

import { createServer } from "http";

const ROUTES = [
  // --- health / settings ---
  { method: "GET",    pat: "/api/health",                      res: { status: "ok", version: "1.0.0", uptime: 42 } },
  { method: "GET",    pat: "/api/settings",                    res: { chat: { defaultModel: "openai:gpt-4" } } },
  { method: "PUT",    pat: "/api/settings",                    res: {} },
  // --- providers ---
  { method: "POST",   pat: "/api/providers/*/models/fetch",    res: [{ id: "gpt-4", name: "GPT-4" }] },
  { method: "GET",    pat: "/api/providers/*/test",            res: { success: true } },
  { method: "POST",   pat: "/api/providers",                   res: { id: "p-new", name: "test" } },
  { method: "GET",    pat: "/api/providers",                   res: [{ id: "p1", name: "OpenAI", type: "openai" }] },
  { method: "DELETE", pat: "/api/providers/*",                 res: {} },
  // --- models ---
  { method: "GET",    pat: "/api/models",                      res: [{ id: "gpt-4", name: "GPT-4", provider: "openai" }] },
  // --- threads ---
  { method: "POST",   pat: "/api/threads/search",              res: { threads: [{ id: "t1", title: "Test", updatedAt: "2025-01-01" }] } },
  { method: "POST",   pat: "/api/threads/*/compact",           res: {} },
  { method: "POST",   pat: "/api/threads/*/switch",            res: {} },
  { method: "POST",   pat: "/api/threads",                     res: { id: "t-new", title: "New thread" } },
  { method: "GET",    pat: "/api/threads",                     res: { threads: [{ id: "t1", title: "Test", updatedAt: "2025-01-01" }] } },
  { method: "GET",    pat: "/api/threads/*",                   res: { messages: [{ role: "user", content: "Hello" }] } },
  { method: "DELETE", pat: "/api/threads/*",                   res: {} },
  // --- memories ---
  { method: "GET",    pat: "/api/memories/stats",              res: { total: 5, by_type: { note: 5 }, db_size_bytes: 10240 } },
  { method: "POST",   pat: "/api/memories/search",             res: [{ id: "m1", content: "test", type: "note", score: 0.9 }] },
  { method: "POST",   pat: "/api/memories/rebuild",            res: { status: "Rebuilt 5 embeddings" } },
  { method: "DELETE", pat: "/api/memories/cleanup",            res: { deleted: 0 } },
  { method: "POST",   pat: "/api/memories",                    res: { id: "m-new" } },
  { method: "GET",    pat: "/api/memories",                    res: { memories: [{ id: "m1", content: "test", type: "note", created_at: "2025-01-01" }] } },
  { method: "DELETE", pat: "/api/memories/*",                  res: {} },
  // --- voices ---
  { method: "GET",    pat: "/api/voices",                      res: [{ id: "v1", name: "Alloy", language: "en-US" }] },
  // --- image ---
  { method: "GET",    pat: "/api/image/models",                res: [{ id: "dall-e-3", name: "DALL-E 3", provider: "openai" }] },
  { method: "POST",   pat: "/api/image/generate",              res: { url: "https://example.com/image.png" } },
  { method: "POST",   pat: "/api/image/edit",                  res: { url: "https://example.com/edited.png" } },
  // --- skills ---
  { method: "GET",    pat: "/api/skills/search",               res: [{ id: "s1", name: "web-search", description: "Search the web" }] },
  { method: "PUT",    pat: "/api/skills/*/toggle",             res: { id: "s1", name: "web-search", enabled: false } },
  { method: "GET",    pat: "/api/skills",                      res: [{ id: "s1", name: "web-search", enabled: true }] },
  { method: "DELETE", pat: "/api/skills/*",                    res: {} },
  // --- heartbeat ---
  { method: "GET",    pat: "/api/heartbeat/config",            res: { interval: 30, patrol: false } },
  { method: "POST",   pat: "/api/heartbeat/enable",            res: {} },
  { method: "POST",   pat: "/api/heartbeat/disable",           res: {} },
  { method: "POST",   pat: "/api/heartbeat/interval",          res: {} },
  { method: "POST",   pat: "/api/heartbeat/patrol",            res: {} },
  { method: "GET",    pat: "/api/heartbeat",                   res: { enabled: true, interval: 30, status: "running" } },
  // --- cron ---
  { method: "GET",    pat: "/api/cron/*/history",              res: [{ run_at: "2025-01-01T02:00:00Z", status: "success" }] },
  { method: "POST",   pat: "/api/cron/*/run",                  res: {} },
  { method: "POST",   pat: "/api/cron/*/enable",               res: {} },
  { method: "POST",   pat: "/api/cron/*/disable",              res: {} },
  { method: "DELETE", pat: "/api/cron/*",                      res: {} },
  { method: "POST",   pat: "/api/cron",                        res: { id: "c-new", name: "test-job" } },
  { method: "GET",    pat: "/api/cron",                        res: [{ id: "c1", name: "daily", type: "cron", schedule: "0 2 * * *", enabled: true }] },
  // --- workspaces ---
  { method: "PUT",    pat: "/api/workspaces/*",                res: {} },
  { method: "GET",    pat: "/api/workspaces",                  res: [{ id: "w1", name: "default", path: "/tmp/workspace" }] },
  // --- update ---
  { method: "GET",    pat: "/api/update/check",                res: { current: "1.0.0", updateAvailable: false } },
  { method: "POST",   pat: "/api/update/download",             res: { status: "Downloaded v1.1.0" } },
  { method: "POST",   pat: "/api/update/install",              res: { status: "Installed v1.1.0 successfully" } },
  // --- dm / msg ---
  { method: "POST",   pat: "/api/dm",                          res: {} },
  { method: "DELETE", pat: "/api/messages/*/*",                res: {} },
  // --- sing ---
  { method: "POST",   pat: "/api/sing/generate",               res: { id: "song-1", url: "https://example.com/song.mp3" } },
  { method: "POST",   pat: "/api/sing/config",                 res: {} },
  // --- emotion ---
  { method: "POST",   pat: "/api/emotion/base",                res: {} },
  { method: "POST",   pat: "/api/emotion/context",             res: {} },
  { method: "GET",    pat: "/api/emotion/*",                   res: { mood: "playful", chatId: "chat1" } },
  { method: "GET",    pat: "/api/emotion",                     res: { mood: "happy", energy: 0.8, valence: 0.9 } },
  // --- browser ---
  { method: "GET",    pat: "/api/browser/status",              res: { connected: true, version: "120.0" } },
  { method: "POST",   pat: "/api/browser/tabs/open",           res: { id: "tab-new" } },
  { method: "POST",   pat: "/api/browser/tabs/*/screenshot",   res: { path: "/tmp/screenshot.png" } },
  { method: "GET",    pat: "/api/browser/tabs/*/read-dom",     res: [{ tag: "button", text: "Click" }] },
  { method: "GET",    pat: "/api/browser/tabs/*/read",         res: { content: "# Page Title\n\nSome content here" } },
  { method: "POST",   pat: "/api/browser/tabs/*/eval",         res: { result: "42" } },
  { method: "POST",   pat: "/api/browser/tabs/*/goto",         res: {} },
  { method: "POST",   pat: "/api/browser/tabs/*/click",        res: {} },
  { method: "POST",   pat: "/api/browser/tabs/*/type",         res: {} },
  { method: "POST",   pat: "/api/browser/tabs/*/scroll",       res: {} },
  { method: "POST",   pat: "/api/browser/tabs/*/back",         res: {} },
  { method: "POST",   pat: "/api/browser/tabs/*/forward",      res: {} },
  { method: "GET",    pat: "/api/browser/tabs",                res: [{ id: "tab1", title: "Google", url: "https://google.com" }] },
  // --- usage ---
  { method: "GET",    pat: "/api/usage/summary",               res: { total_requests: 10, total_input_tokens: 1000, total_output_tokens: 500 } },
  { method: "GET",    pat: "/api/usage",                       res: { total_requests: 10, total_input_tokens: 1000, total_output_tokens: 500, by_day: [], by_model: [] } },
  // --- export / import ---
  { method: "GET",    pat: "/api/export/threads",              res: { threads: [] } },
  { method: "GET",    pat: "/api/export/memories",             res: { memories: [] } },
  { method: "GET",    pat: "/api/export/settings",             res: {} },
  { method: "GET",    pat: "/api/export/*",                    res: {} },
  { method: "POST",   pat: "/api/import/bundle",               res: {} },
  { method: "POST",   pat: "/api/import/*",                    res: {} },
  // --- tasks (existing) ---
  { method: "GET",    pat: "/api/tasks",                       res: { tasks: [] } },
  // --- people (existing) ---
  { method: "GET",    pat: "/api/people",                      res: { people: [] } },
  // --- mcp (existing) ---
  { method: "GET",    pat: "/api/mcp/servers",                 res: [] },
  // --- plugins (existing) ---
  { method: "GET",    pat: "/api/plugins",                     res: [] },
  // --- chat (existing) ---
  { method: "POST",   pat: "/api/chat",                        res: { content: "Hello!" } },
];

// Convert route pattern (e.g. /api/foo/:star/bar) to regex — star segments match [^/]+
function patternToRegex(pat) {
  const escaped = pat.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]+");
  return new RegExp(`^${escaped}$`);
}

const compiledRoutes = ROUTES.map((r) => ({ ...r, regex: patternToRegex(r.pat) }));

function findRoute(method, url) {
  const path = url.split("?")[0];
  for (const route of compiledRoutes) {
    if (route.method === method && route.regex.test(path)) return route;
  }
  return null;
}

const port = parseInt(process.argv[2] ?? "0", 10);

const server = createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => { body += chunk; });
  req.on("end", () => {
    const route = findRoute(req.method, req.url ?? "/");
    const data = route ? route.res : {};
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  });
});

server.listen(port, "127.0.0.1", () => {
  const addr = server.address();
  const actualPort = typeof addr === "object" && addr ? addr.port : port;
  process.stdout.write(`READY ${actualPort}\n`);
});

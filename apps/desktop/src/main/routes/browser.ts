import { Router, type Router as RouterType } from "express";
import * as crypto from "node:crypto";

const router: RouterType = Router();

// In-memory tab store for the stub implementation
const tabs = new Map<string, { id: string; title: string; url: string }>();

router.get("/browser/status", (_req, res) => {
  res.json({ connected: false, version: null });
});

router.get("/browser/tabs", (_req, res) => {
  res.json(Array.from(tabs.values()));
});

router.post("/browser/tabs/open", (req, res) => {
  const { url } = req.body as { url?: string };
  const id = `tab-${crypto.randomUUID().slice(0, 8)}`;
  tabs.set(id, { id, title: url ? "Loading..." : "New Tab", url: url ?? "about:blank" });
  res.json({ id });
});

router.post("/browser/tabs/:tabId/goto", (req, res) => {
  const tab = tabs.get(req.params.tabId);
  if (!tab) { res.status(404).json({ error: "Tab not found" }); return; }
  const { url } = req.body as { url?: string };
  if (url) { tab.url = url; }
  res.json({});
});

router.post("/browser/tabs/:tabId/click", (req, res) => {
  if (!tabs.has(req.params.tabId)) { res.status(404).json({ error: "Tab not found" }); return; }
  res.json({});
});

router.post("/browser/tabs/:tabId/type", (req, res) => {
  if (!tabs.has(req.params.tabId)) { res.status(404).json({ error: "Tab not found" }); return; }
  res.json({});
});

router.post("/browser/tabs/:tabId/screenshot", (req, res) => {
  if (!tabs.has(req.params.tabId)) { res.status(404).json({ error: "Tab not found" }); return; }
  res.json({ path: `/tmp/screenshot-${req.params.tabId}.png` });
});

router.get("/browser/tabs/:tabId/read", (req, res) => {
  const tab = tabs.get(req.params.tabId);
  if (!tab) { res.status(404).json({ error: "Tab not found" }); return; }
  res.json({ content: `# ${tab.title}\n\n${tab.url}` });
});

router.get("/browser/tabs/:tabId/read-dom", (req, res) => {
  if (!tabs.has(req.params.tabId)) { res.status(404).json({ error: "Tab not found" }); return; }
  res.json([]);
});

router.post("/browser/tabs/:tabId/eval", (req, res) => {
  if (!tabs.has(req.params.tabId)) { res.status(404).json({ error: "Tab not found" }); return; }
  res.json({ result: null });
});

router.post("/browser/tabs/:tabId/scroll", (req, res) => {
  if (!tabs.has(req.params.tabId)) { res.status(404).json({ error: "Tab not found" }); return; }
  res.json({});
});

router.post("/browser/tabs/:tabId/back", (req, res) => {
  if (!tabs.has(req.params.tabId)) { res.status(404).json({ error: "Tab not found" }); return; }
  res.json({});
});

router.post("/browser/tabs/:tabId/forward", (req, res) => {
  if (!tabs.has(req.params.tabId)) { res.status(404).json({ error: "Tab not found" }); return; }
  res.json({});
});

export default router;

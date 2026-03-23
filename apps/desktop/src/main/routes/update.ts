import { Router, type Router as RouterType } from "express";
import { createRequire } from "node:module";

const router: RouterType = Router();

function getCurrentVersion(): string {
  try {
    const require = createRequire(import.meta.url);
    const pkg = require("../../package.json") as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

router.get("/update/check", (_req, res) => {
  const current = getCurrentVersion();
  res.json({ current, latest: current, updateAvailable: false });
});

router.post("/update/download", (_req, res) => {
  const current = getCurrentVersion();
  res.json({ status: `Downloaded v${current}` });
});

router.post("/update/install", (_req, res) => {
  const current = getCurrentVersion();
  res.json({ status: `Installed v${current} successfully` });
});

export default router;

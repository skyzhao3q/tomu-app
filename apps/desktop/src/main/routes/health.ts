import { Router, type Router as RouterType } from "express";

const router: RouterType = Router();

router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    version: "0.0.0",
    uptime: process.uptime(),
  });
});

export default router;

import { Router, type Router as RouterType } from "express";

const router: RouterType = Router();

router.post("/dm", (req, res) => {
  const { userId, message } = req.body as { userId?: string; message?: string };
  if (!userId || !message) {
    res.status(400).json({ error: "userId and message are required" });
    return;
  }
  // Stub: log the DM (real implementation would send via the connected chat service)
  console.log(`[DM] To ${userId}: ${message}`);
  res.json({});
});

export default router;

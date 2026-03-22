import { Router, type Router as RouterType } from "express";
import health from "./health.js";
import settings from "./settings.js";
import providers from "./providers.js";
import chat from "./chat.js";
import threads from "./threads.js";

const router: RouterType = Router();

router.use(health);
router.use(settings);
router.use(providers);
router.use(chat);
router.use(threads);

// TODO: mount /skills routes

export default router;

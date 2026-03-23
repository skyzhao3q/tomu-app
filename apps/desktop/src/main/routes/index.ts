import { Router, type Router as RouterType } from "express";
import health from "./health.js";
import settings from "./settings.js";
import providers from "./providers.js";
import chat from "./chat.js";
import threads from "./threads.js";
import skills from "./skills.js";
import memories from "./memories.js";
import people from "./people.js";
import tasks from "./tasks.js";

const router: RouterType = Router();

router.use(health);
router.use(settings);
router.use(providers);
router.use(chat);
router.use(threads);
router.use(skills);
router.use(memories);
router.use(people);
router.use(tasks);

export default router;

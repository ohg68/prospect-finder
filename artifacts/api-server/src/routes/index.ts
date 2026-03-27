import { Router , Request, Response} from "express";
import healthRouter from "./health.js";
import prospectsRouter from "./prospects.js";
import enrichmentRouter from "./enrichment.js";
import companiesRouter from "./companies.js";
import chatRouter from "./chat.js";
import generateRouter from "./generate.js";
import messagesRouter from "./messages.js";
import savedRouter from "./saved.js";
import whatsappRouter from "./whatsapp.js";
import settingsRouter from "./settings.js";

const router = Router();

router.use(healthRouter);
router.use(prospectsRouter);
router.use(enrichmentRouter);
router.use(companiesRouter);
router.use(chatRouter);
router.use(generateRouter);
router.use(messagesRouter);
router.use(savedRouter);
router.use("/whatsapp", whatsappRouter);
router.use("/settings", settingsRouter);

export default router;

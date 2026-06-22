import { Router } from "express";

import { getPublicFlashSale } from "../controllers/flashSale.controller.js";

const router = Router();

router.get("/", getPublicFlashSale);

export default router;

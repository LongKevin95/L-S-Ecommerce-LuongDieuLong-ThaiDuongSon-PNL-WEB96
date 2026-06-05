import { Router } from "express";

import { getMe, login, register } from "../controllers/auth.controller.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = Router();

router.post("/login", login);
router.post("/register", register);
router.get("/me", protect, getMe);

export default router;

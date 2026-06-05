import { Router } from "express";

import {
  getUserById,
  listUsers,
  updateProfile,
} from "../controllers/user.controller.js";
import { authorize, protect } from "../middlewares/authMiddleware.js";
import { USER_ROLES } from "../constants/roles.js";

const router = Router();

router.patch("/me", protect, updateProfile);
router.get("/", protect, authorize([USER_ROLES.ADMIN]), listUsers);
router.get("/:id", protect, authorize([USER_ROLES.ADMIN]), getUserById);

export default router;

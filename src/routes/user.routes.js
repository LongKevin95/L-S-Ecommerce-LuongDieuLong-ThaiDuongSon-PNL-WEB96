import { Router } from "express";

import {
  getUserById,
  listUsers,
  updateMyRole,
  updateProfile,
} from "../controllers/user.controller.js";
import { authorize, protect } from "../middlewares/authMiddleware.js";
import { uploadSingleImage } from "../middlewares/uploadMiddleware.js";
import { USER_ROLES } from "../constants/roles.js";

const router = Router();

router.patch("/me", protect, uploadSingleImage("avatar"), updateProfile);
router.patch("/me/role", protect, updateMyRole);
router.get("/", protect, authorize([USER_ROLES.ADMIN]), listUsers);
router.get("/:id", protect, authorize([USER_ROLES.ADMIN]), getUserById);

export default router;

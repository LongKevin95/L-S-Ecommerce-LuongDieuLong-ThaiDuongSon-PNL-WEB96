import { Router } from "express";

import {
  getMyShop,
  getShopById,
  listShops,
  upsertMyShop,
} from "../controllers/shop.controller.js";
import { authorize, protect } from "../middlewares/authMiddleware.js";
import { USER_ROLES } from "../constants/roles.js";

const router = Router();

router.get("/", listShops);
router.get("/me", protect, authorize([USER_ROLES.VENDOR]), getMyShop);
router.put("/me", protect, authorize([USER_ROLES.VENDOR]), upsertMyShop);
router.get("/:id", getShopById);

export default router;

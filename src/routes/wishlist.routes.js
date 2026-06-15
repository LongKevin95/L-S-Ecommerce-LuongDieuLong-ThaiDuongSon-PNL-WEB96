import { Router } from "express";

import {
  addWishlistItem,
  getMyWishlist,
  removeWishlistItem,
} from "../controllers/wishlist.controller.js";
import { USER_ROLES } from "../constants/roles.js";
import { authorize, protect } from "../middlewares/authMiddleware.js";

const router = Router();

router.use(protect, authorize([USER_ROLES.CUSTOMER]));

router.get("/", getMyWishlist);
router.post("/items", addWishlistItem);
router.delete("/items/:productId", removeWishlistItem);

export default router;

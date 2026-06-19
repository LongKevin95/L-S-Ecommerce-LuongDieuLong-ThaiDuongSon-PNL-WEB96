import { Router } from "express";

import {
  addProductReview,
  getProductById,
  listProducts,
  upsertVendorReply,
} from "../controllers/product.controller.js";
import { authorize, protect } from "../middlewares/authMiddleware.js";
import { USER_ROLES } from "../constants/roles.js";

const router = Router();

router.get("/", listProducts);
router.post("/:id/reviews", protect, authorize([USER_ROLES.CUSTOMER]), addProductReview);
router.patch(
  "/:id/reviews/reply",
  protect,
  authorize([USER_ROLES.VENDOR]),
  upsertVendorReply,
);
router.get("/:id", getProductById);

export default router;

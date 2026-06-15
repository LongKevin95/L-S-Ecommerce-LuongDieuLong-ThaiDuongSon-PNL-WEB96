import { Router } from "express";

import {
  addProductReview,
  getProductById,
  listProducts,
  upsertProductReviewReply,
} from "../controllers/product.controller.js";
import { USER_ROLES } from "../constants/roles.js";
import { authorize, protect } from "../middlewares/authMiddleware.js";

const router = Router();

router.get("/", listProducts);
router.post(
  "/:id/reviews",
  protect,
  authorize([USER_ROLES.CUSTOMER]),
  addProductReview,
);
router.patch(
  "/:id/reviews/reply",
  protect,
  authorize([USER_ROLES.VENDOR]),
  upsertProductReviewReply,
);
router.get("/:id", getProductById);

export default router;

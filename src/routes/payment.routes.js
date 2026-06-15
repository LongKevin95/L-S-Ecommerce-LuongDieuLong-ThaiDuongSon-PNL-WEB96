import { Router } from "express";

import {
  createCheckoutSession,
  getPaymentStatus,
  handlePaymentWebhook,
} from "../controllers/payment.controller.js";
import { USER_ROLES } from "../constants/roles.js";
import { authorize, protect } from "../middlewares/authMiddleware.js";

const router = Router();

router.post(
  "/checkout",
  protect,
  authorize([USER_ROLES.CUSTOMER, USER_ROLES.ADMIN]),
  createCheckoutSession,
);
router.get("/:orderId/status", protect, getPaymentStatus);
router.post("/webhook", handlePaymentWebhook);

export default router;

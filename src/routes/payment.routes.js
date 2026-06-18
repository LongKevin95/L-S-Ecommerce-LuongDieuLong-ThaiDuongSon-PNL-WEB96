import { Router } from "express";

import {
  getOrderPaymentStatus,
  handleSePayIpn,
  initSePayCheckout,
} from "../controllers/payment.controller.js";
import { authorize, protect } from "../middlewares/authMiddleware.js";
import { USER_ROLES } from "../constants/roles.js";

const router = Router();

router.post(
  "/sepay/init",
  protect,
  authorize([USER_ROLES.CUSTOMER, USER_ROLES.ADMIN]),
  initSePayCheckout,
);
router.post("/sepay/ipn", handleSePayIpn);
router.get(
  "/orders/:orderId/status",
  protect,
  authorize([USER_ROLES.CUSTOMER, USER_ROLES.ADMIN]),
  getOrderPaymentStatus,
);

export default router;

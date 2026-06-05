import { Router } from "express";

import { createOrder, getMyOrders } from "../controllers/order.controller.js";
import { authorize, protect } from "../middlewares/authMiddleware.js";
import { USER_ROLES } from "../constants/roles.js";

const router = Router();

router.post("/", protect, authorize([USER_ROLES.CUSTOMER]), createOrder);
router.get("/me", protect, authorize([USER_ROLES.CUSTOMER]), getMyOrders);

export default router;

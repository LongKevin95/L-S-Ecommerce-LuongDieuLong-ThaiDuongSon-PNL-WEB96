import { Router } from "express";

import {
  listOrders,
  listProducts,
  updateOrderStatus,
  updateProductStatus,
} from "../controllers/admin.controller.js";
import {
  deleteUserAccount,
  updateUserStatus,
} from "../controllers/user.controller.js";
import { authorize, protect } from "../middlewares/authMiddleware.js";
import { USER_ROLES } from "../constants/roles.js";

const router = Router();

router.use(protect, authorize([USER_ROLES.ADMIN]));

router.get("/products", listProducts);
router.patch("/products/:id/status", updateProductStatus);
router.get("/orders", listOrders);
router.patch("/orders/:id/status", updateOrderStatus);
router.patch("/users/:id/status", updateUserStatus);
router.delete("/users/:id", deleteUserAccount);

export default router;

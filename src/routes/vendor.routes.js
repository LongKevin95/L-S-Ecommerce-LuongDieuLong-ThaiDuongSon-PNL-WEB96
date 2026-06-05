import { Router } from "express";

import {
  createProduct,
  deleteProduct,
  listMyProducts,
  listOrders,
  updateOrderStatus,
  updateProduct,
  updateProductStatus,
} from "../controllers/vendor.controller.js";
import { authorize, protect } from "../middlewares/authMiddleware.js";
import { USER_ROLES } from "../constants/roles.js";

const router = Router();

router.use(protect, authorize([USER_ROLES.VENDOR]));

router.get("/products/me", listMyProducts);
router.post("/products", createProduct);
router.patch("/products/:id", updateProduct);
router.patch("/products/:id/status", updateProductStatus);
router.delete("/products/:id", deleteProduct);
router.get("/orders", listOrders);
router.patch("/orders/:id/status", updateOrderStatus);

export default router;

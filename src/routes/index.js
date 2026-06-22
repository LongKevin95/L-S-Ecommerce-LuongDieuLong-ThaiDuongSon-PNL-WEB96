import { Router } from "express";

import adminRoutes from "./admin.routes.js";
import authRoutes from "./auth.routes.js";
import flashSaleRoutes from "./flashSale.routes.js";
import healthRoutes from "./health.routes.js";
import orderRoutes from "./order.routes.js";
import paymentRoutes from "./payment.routes.js";
import productRoutes from "./product.routes.js";
import shopRoutes from "./shop.routes.js";
import userRoutes from "./user.routes.js";
import vendorRoutes from "./vendor.routes.js";
import wishlistRoutes from "./wishlist.routes.js";

const router = Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/products", productRoutes);
router.use("/flash-sale", flashSaleRoutes);
router.use("/wishlist", wishlistRoutes);
router.use("/shops", shopRoutes);
router.use("/orders", orderRoutes);
router.use("/payments", paymentRoutes);
router.use("/vendor", vendorRoutes);
router.use("/admin", adminRoutes);

export default router;

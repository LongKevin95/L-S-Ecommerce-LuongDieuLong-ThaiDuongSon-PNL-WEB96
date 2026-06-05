import { Router } from "express";

import {
  getProductById,
  listProducts,
} from "../controllers/product.controller.js";

const router = Router();

router.get("/", listProducts);
router.get("/:id", getProductById);

export default router;

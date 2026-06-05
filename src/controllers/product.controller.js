import Product from "../models/Product.js";
import {
  PRODUCT_STATUS,
  PRODUCT_STATUS_VALUES,
} from "../constants/productStatus.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ensureValidObjectId } from "../utils/mongoId.js";

export const listProducts = asyncHandler(async (req, res) => {
  const category = String(req.query?.category ?? "")
    .trim()
    .toLowerCase();
  const search = String(req.query?.search ?? "").trim();
  const vendorId = String(req.query?.vendorId ?? "").trim();
  const requestedStatus = String(req.query?.status ?? "")
    .trim()
    .toLowerCase();
  const filters = {
    status: PRODUCT_STATUS.ACTIVE,
  };

  if (requestedStatus) {
    if (
      !PRODUCT_STATUS_VALUES.includes(requestedStatus) ||
      requestedStatus !== PRODUCT_STATUS.ACTIVE
    ) {
      throw new ApiError(400, "Public products only support status=active.");
    }
  }

  if (category) {
    filters.category = category;
  }

  if (vendorId) {
    filters.vendorId = vendorId;
  }

  if (search) {
    filters.$or = [
      { title: { $regex: search, $options: "i" } },
      { category: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
      { shopName: { $regex: search, $options: "i" } },
    ];
  }

  const products = await Product.find(filters).sort({ createdAt: -1 });
  res.json(products);
});

export const getProductById = asyncHandler(async (req, res) => {
  const productId = ensureValidObjectId(req.params?.id, "Product id");
  const product = await Product.findById(productId);

  if (!product || product.status !== PRODUCT_STATUS.ACTIVE) {
    throw new ApiError(404, "Product was not found.");
  }

  res.json(product);
});

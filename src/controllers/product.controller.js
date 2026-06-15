import Product from "../models/Product.js";
import Order from "../models/Order.js";
import { ORDER_STATUS } from "../constants/orderStatus.js";
import {
  PRODUCT_STATUS,
  PRODUCT_STATUS_VALUES,
} from "../constants/productStatus.js";
import { USER_ROLES } from "../constants/roles.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ensureValidObjectId } from "../utils/mongoId.js";
import { buildProductDetailResponse } from "../utils/productVariant.js";

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

  res.json(await buildProductDetailResponse(product));
});

export const addProductReview = asyncHandler(async (req, res) => {
  const productId = ensureValidObjectId(req.params?.id, "Product id");
  const product = await Product.findById(productId);

  if (!product || product.status !== PRODUCT_STATUS.ACTIVE) {
    throw new ApiError(404, "Product was not found.");
  }

  if (!req.user?.roles?.includes(USER_ROLES.CUSTOMER)) {
    throw new ApiError(403, "Only customer accounts can review products.");
  }

  const customerId = String(req.user?.id ?? "").trim();
  const customerEmail = String(req.user?.email ?? "")
    .trim()
    .toLowerCase();
  const customerName =
    String(req.body?.customerName ?? req.user?.name ?? "Customer").trim() ||
    "Customer";
  const comment = String(req.body?.comment ?? "").trim();
  const stars = Number(req.body?.stars ?? 0);

  if (!customerId || !customerEmail) {
    throw new ApiError(400, "Authenticated customer information is invalid.");
  }

  if (!comment) {
    throw new ApiError(400, "Review comment is required.");
  }

  if (!Number.isFinite(stars) || stars < 1 || stars > 5) {
    throw new ApiError(400, "Review stars must be between 1 and 5.");
  }

  const completedOrder = await Order.findOne({
    customerId,
    status: ORDER_STATUS.COMPLETED,
    "items.productId": String(product.id),
  }).select("_id");

  if (!completedOrder) {
    throw new ApiError(
      403,
      "You can only review a product after completing an order for it.",
    );
  }

  const reviews = Array.isArray(product.reviewsData) ? product.reviewsData : [];
  const hasReviewed = reviews.some(
    (reviewItem) =>
      String(reviewItem?.customerEmail ?? "")
        .trim()
        .toLowerCase() === customerEmail,
  );

  if (hasReviewed) {
    throw new ApiError(409, "You have already reviewed this product.");
  }

  product.reviewsData = [
    ...reviews,
    {
      customerId,
      customerEmail,
      customerName,
      comment,
      stars,
      createdAt: new Date(),
      vendorReply: null,
    },
  ];
  await product.save();

  res.status(201).json(await buildProductDetailResponse(product));
});

export const upsertProductReviewReply = asyncHandler(async (req, res) => {
  const productId = ensureValidObjectId(req.params?.id, "Product id");
  const product = await Product.findById(productId);

  if (!product) {
    throw new ApiError(404, "Product was not found.");
  }

  if (!req.user?.roles?.includes(USER_ROLES.VENDOR)) {
    throw new ApiError(403, "Only vendors can reply to reviews.");
  }

  if (String(product.vendorId) !== String(req.user?.id ?? "")) {
    throw new ApiError(403, "You do not own this product.");
  }

  const customerEmail = String(req.body?.customerEmail ?? "")
    .trim()
    .toLowerCase();
  const reviewCreatedAt = String(req.body?.reviewCreatedAt ?? "").trim();
  const replyText = String(req.body?.replyText ?? "").trim();

  if (!customerEmail || !reviewCreatedAt || !replyText) {
    throw new ApiError(400, "Review reply is missing required fields.");
  }

  const reviews = Array.isArray(product.reviewsData) ? product.reviewsData : [];
  const reviewItem = reviews.find(
    (item) =>
      String(item?.customerEmail ?? "")
        .trim()
        .toLowerCase() === customerEmail &&
      new Date(item?.createdAt).toISOString() === reviewCreatedAt,
  );

  if (!reviewItem) {
    throw new ApiError(404, "Review was not found.");
  }

  reviewItem.vendorReply = {
    text: replyText,
    at: new Date(),
  };

  product.markModified("reviewsData");
  await product.save();

  res.json(await buildProductDetailResponse(product));
});

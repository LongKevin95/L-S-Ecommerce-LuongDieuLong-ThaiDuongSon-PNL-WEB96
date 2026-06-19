import Product from "../models/Product.js";
import Order from "../models/Order.js";
import {
  PRODUCT_STATUS,
  PRODUCT_STATUS_VALUES,
} from "../constants/productStatus.js";
import { ORDER_STATUS } from "../constants/orderStatus.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ensureValidObjectId } from "../utils/mongoId.js";
import {
  attachVariantsToProductList,
  buildProductDetailResponse,
} from "../utils/productVariant.js";

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
  res.json(await attachVariantsToProductList(products));
});

function normalizeReviewCustomerEmail(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function normalizeReviewDate(value) {
  const nextDate = new Date(value);
  return Number.isNaN(nextDate.getTime()) ? null : nextDate;
}

async function findActiveProductById(productId) {
  const normalizedProductId = ensureValidObjectId(productId, "Product id");
  const product = await Product.findById(normalizedProductId);

  if (!product || product.status !== PRODUCT_STATUS.ACTIVE) {
    throw new ApiError(404, "Product was not found.");
  }

  return product;
}

export const getProductById = asyncHandler(async (req, res) => {
  const product = await findActiveProductById(req.params?.id);
  res.json(await buildProductDetailResponse(product));
});

export const addProductReview = asyncHandler(async (req, res) => {
  const product = await findActiveProductById(req.params?.id);
  const customerEmail = normalizeReviewCustomerEmail(
    req.body?.customerEmail ?? req.user?.email,
  );
  const customerName =
    String(req.body?.customerName ?? req.user?.name ?? "Customer").trim() ||
    "Customer";
  const comment = String(req.body?.comment ?? "").trim();
  const stars = Math.min(5, Math.max(1, Number(req.body?.stars ?? 0)));

  if (!customerEmail || !comment) {
    throw new ApiError(400, "Review is missing required fields.");
  }

  if (customerEmail !== normalizeReviewCustomerEmail(req.user?.email)) {
    throw new ApiError(403, "You can only submit a review for your own account.");
  }

  const hasCompletedOrder = await Order.exists({
    customerId: String(req.user?.id ?? "").trim(),
    status: ORDER_STATUS.COMPLETED,
    "items.productId": String(product.id),
  });

  if (!hasCompletedOrder) {
    throw new ApiError(403, "You can only review products from completed orders.");
  }

  const existingReview = Array.isArray(product.reviewsData)
    ? product.reviewsData.find(
        (reviewItem) =>
          normalizeReviewCustomerEmail(reviewItem?.customerEmail) === customerEmail,
      )
    : null;

  if (existingReview) {
    throw new ApiError(409, "You have already reviewed this product.");
  }

  product.reviewsData = [
    ...(Array.isArray(product.reviewsData) ? product.reviewsData : []),
    {
      customerId: String(req.user?.id ?? "").trim(),
      customerEmail,
      customerName,
      comment,
      stars,
      createdAt: new Date(),
      vendorReply: null,
    },
  ];
  await product.save();

  res.json(await buildProductDetailResponse(product));
});

export const upsertVendorReply = asyncHandler(async (req, res) => {
  const product = await findActiveProductById(req.params?.id);
  const reviewCreatedAt = String(req.body?.reviewCreatedAt ?? "").trim();
  const customerEmail = normalizeReviewCustomerEmail(req.body?.customerEmail);
  const replyText = String(req.body?.replyText ?? "").trim();
  const normalizedReviewDate = normalizeReviewDate(reviewCreatedAt);
  const productVendorId = String(product?.vendorId ?? "").trim();
  const isOwner =
    productVendorId && productVendorId === String(req.user?.id ?? "").trim();

  if (!customerEmail || !replyText || !normalizedReviewDate) {
    throw new ApiError(400, "Vendor reply is missing required fields.");
  }

  if (!isOwner) {
    throw new ApiError(403, "You can only reply to reviews on your own products.");
  }

  const reviewIndex = Array.isArray(product.reviewsData)
    ? product.reviewsData.findIndex((reviewItem) => {
        const currentDate = normalizeReviewDate(reviewItem?.createdAt);
        return (
          normalizeReviewCustomerEmail(reviewItem?.customerEmail) === customerEmail &&
          currentDate &&
          currentDate.getTime() === normalizedReviewDate.getTime()
        );
      })
    : -1;

  if (reviewIndex < 0) {
    throw new ApiError(404, "Review was not found.");
  }

  product.reviewsData[reviewIndex].vendorReply = {
    text: replyText,
    at: new Date(),
  };
  await product.save();

  res.json(await buildProductDetailResponse(product));
});

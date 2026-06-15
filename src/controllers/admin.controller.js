import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Shop from "../models/Shop.js";
import User from "../models/User.js";
import Variant from "../models/Variant.js";
import { ORDER_STATUS_VALUES } from "../constants/orderStatus.js";
import {
  PRODUCT_STATUS,
  PRODUCT_STATUS_VALUES,
} from "../constants/productStatus.js";
import { USER_ROLES } from "../constants/roles.js";
import { USER_STATUS, USER_STATUS_VALUES } from "../constants/userStatus.js";
import { destroyCloudinaryAssets } from "../utils/media.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sanitizeUser } from "../utils/auth.js";
import { ensureValidObjectId } from "../utils/mongoId.js";
import { appendStatusHistory } from "../utils/orderWorkflow.js";

const ADMIN_ALLOWED_PRODUCT_STATUSES = [
  PRODUCT_STATUS.ACTIVE,
  PRODUCT_STATUS.INACTIVE,
  PRODUCT_STATUS.REJECTED,
];

export const listProducts = asyncHandler(async (req, res) => {
  const status = String(req.query?.status ?? "")
    .trim()
    .toLowerCase();
  const vendorId = String(req.query?.vendorId ?? "").trim();
  const search = String(req.query?.search ?? "").trim();
  const filters = {};

  if (status) {
    if (!PRODUCT_STATUS_VALUES.includes(status)) {
      throw new ApiError(400, "Product status filter is invalid.");
    }

    filters.status = status;
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

export const updateProductStatus = asyncHandler(async (req, res) => {
  const productId = ensureValidObjectId(req.params?.id, "Product id");
  const nextStatus = String(req.body?.status ?? "")
    .trim()
    .toLowerCase();
  const reason = String(req.body?.reason ?? "").trim();

  if (!ADMIN_ALLOWED_PRODUCT_STATUSES.includes(nextStatus)) {
    throw new ApiError(400, "Admin product status is invalid.");
  }

  if (nextStatus === PRODUCT_STATUS.REJECTED && !reason) {
    throw new ApiError(400, "Reject reason is required.");
  }

  const product = await Product.findById(productId);

  if (!product) {
    throw new ApiError(404, "Product was not found.");
  }

  product.status = nextStatus;
  product.reason = nextStatus === PRODUCT_STATUS.REJECTED ? reason : "";
  await product.save();

  res.json(product);
});

export const listOrders = asyncHandler(async (req, res) => {
  const status = String(req.query?.status ?? "")
    .trim()
    .toLowerCase();
  const customerId = String(req.query?.customerId ?? "").trim();
  const filters = {};

  if (status) {
    if (!ORDER_STATUS_VALUES.includes(status)) {
      throw new ApiError(400, "Order status filter is invalid.");
    }

    filters.status = status;
  }

  if (customerId) {
    filters.customerId = customerId;
  }

  const orders = await Order.find(filters).sort({ createdAt: -1 });
  res.json(orders);
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
  const orderId = ensureValidObjectId(req.params?.id, "Order id");
  const nextStatus = String(req.body?.status ?? "")
    .trim()
    .toLowerCase();

  if (!ORDER_STATUS_VALUES.includes(nextStatus)) {
    throw new ApiError(400, "Admin order status is invalid.");
  }

  const order = await Order.findById(orderId);

  if (!order) {
    throw new ApiError(404, "Order was not found.");
  }

  order.statusHistory = appendStatusHistory(order, nextStatus, "admin");
  order.status = nextStatus;
  await order.save();

  res.json(order);
});

export const updateUserStatus = asyncHandler(async (req, res) => {
  const userId = ensureValidObjectId(req.params?.id, "User id");
  const nextStatus = String(req.body?.status ?? "")
    .trim()
    .toLowerCase();

  if (!USER_STATUS_VALUES.includes(nextStatus)) {
    throw new ApiError(400, "User status is invalid.");
  }

  if (String(req.user.id) === userId && nextStatus !== USER_STATUS.ACTIVE) {
    throw new ApiError(400, "You cannot deactivate your current admin account.");
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, "User was not found.");
  }

  user.status = nextStatus;
  await user.save();

  res.json(sanitizeUser(user));
});

export const deleteUser = asyncHandler(async (req, res) => {
  const userId = ensureValidObjectId(req.params?.id, "User id");

  if (String(req.user.id) === userId) {
    throw new ApiError(400, "You cannot delete your current admin account.");
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, "User was not found.");
  }

  const userRoles = Array.isArray(user.roles) ? user.roles : [];
  const cloudinaryPublicIds = [];

  if (user.avatarPublicId) {
    cloudinaryPublicIds.push(user.avatarPublicId);
  }

  if (userRoles.includes(USER_ROLES.VENDOR)) {
    const shop = await Shop.findOne({ ownerId: String(user.id) });
    const products = await Product.find({ vendorId: String(user.id) });
    const productIds = products.map((product) => product._id);

    products.forEach((product) => {
      if (product.thumbnailPublicId) {
        cloudinaryPublicIds.push(product.thumbnailPublicId);
      }

      if (Array.isArray(product.galleryPublicIds)) {
        cloudinaryPublicIds.push(...product.galleryPublicIds);
      }
    });

    if (shop) {
      if (shop.logoPublicId) {
        cloudinaryPublicIds.push(shop.logoPublicId);
      }

      if (shop.bannerPublicId) {
        cloudinaryPublicIds.push(shop.bannerPublicId);
      }
    }

    if (productIds.length > 0) {
      await Variant.deleteMany({ productId: { $in: productIds } });
      await Product.deleteMany({ _id: { $in: productIds } });
    }

    if (shop) {
      await shop.deleteOne();
    }
  }

  await destroyCloudinaryAssets(cloudinaryPublicIds);
  await user.deleteOne();

  res.json({
    message: "User deleted successfully.",
    deletedUserId: userId,
  });
});

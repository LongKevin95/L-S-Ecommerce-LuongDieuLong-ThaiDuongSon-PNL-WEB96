import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Shop from "../models/Shop.js";
import { ORDER_STATUS } from "../constants/orderStatus.js";
import { PRODUCT_STATUS } from "../constants/productStatus.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ensureValidObjectId } from "../utils/mongoId.js";
import { attachVendorItemsToOrder } from "../utils/orderMapper.js";
import {
  buildShopSlug,
  buildUserShopSnapshot,
  resolvePreferredShopObjectId,
} from "../utils/shop.js";
import { slugify } from "../utils/slugify.js";

const VENDOR_ALLOWED_PRODUCT_STATUSES = [
  PRODUCT_STATUS.DRAFT,
  PRODUCT_STATUS.PENDING,
  PRODUCT_STATUS.INACTIVE,
];

const VENDOR_ALLOWED_ORDER_STATUSES = [
  ORDER_STATUS.PROCESSING,
  ORDER_STATUS.COMPLETED,
  ORDER_STATUS.CANCELLED,
];

function buildProductPayload(body = {}) {
  const payload = {};

  if (Object.prototype.hasOwnProperty.call(body, "title")) {
    const title = String(body.title ?? "").trim();

    if (!title) {
      throw new ApiError(400, "Product title is required.");
    }

    payload.title = title;
    payload.slug = slugify(title);
  }

  if (Object.prototype.hasOwnProperty.call(body, "category")) {
    const category = String(body.category ?? "")
      .trim()
      .toLowerCase();

    if (!category) {
      throw new ApiError(400, "Product category is required.");
    }

    payload.category = category;
  }

  if (Object.prototype.hasOwnProperty.call(body, "description")) {
    payload.description = String(body.description ?? "").trim();
  }

  if (Object.prototype.hasOwnProperty.call(body, "price")) {
    const price = Number(body.price ?? 0);

    if (Number.isNaN(price) || price < 0) {
      throw new ApiError(400, "Product price is invalid.");
    }

    payload.price = price;
  }

  if (Object.prototype.hasOwnProperty.call(body, "oldPrice")) {
    const oldPrice = Number(body.oldPrice ?? 0);

    if (Number.isNaN(oldPrice) || oldPrice < 0) {
      throw new ApiError(400, "Product oldPrice is invalid.");
    }

    payload.oldPrice = oldPrice;
  }

  if (Object.prototype.hasOwnProperty.call(body, "stock")) {
    const stock = Number(body.stock ?? 0);

    if (Number.isNaN(stock) || stock < 0) {
      throw new ApiError(400, "Product stock is invalid.");
    }

    payload.stock = stock;
  }

  if (Object.prototype.hasOwnProperty.call(body, "thumbnail")) {
    payload.thumbnail = String(body.thumbnail ?? "").trim();
  }

  if (Object.prototype.hasOwnProperty.call(body, "gallery")) {
    payload.gallery = Array.isArray(body.gallery)
      ? body.gallery.map((item) => String(item ?? "").trim()).filter(Boolean)
      : [];
  }

  return payload;
}

async function findOwnedProduct(productId, vendorId) {
  const product = await Product.findById(productId);

  if (!product) {
    throw new ApiError(404, "Product was not found.");
  }

  if (String(product.vendorId) !== String(vendorId)) {
    throw new ApiError(403, "You do not own this product.");
  }

  return product;
}

async function syncVendorShopSnapshot(user, shop) {
  const nextSnapshot = buildUserShopSnapshot(shop);
  const currentSnapshot = buildUserShopSnapshot(user?.shop);

  if (JSON.stringify(currentSnapshot) === JSON.stringify(nextSnapshot)) {
    return;
  }

  user.shop = nextSnapshot;
  await user.save();
}

async function ensureVendorShop(user) {
  const snapshotShopId = String(user?.shop?.id ?? "").trim();
  let shop = null;

  if (snapshotShopId) {
    shop = await Shop.findById(snapshotShopId);

    if (shop && String(shop.ownerId) !== String(user.id)) {
      throw new ApiError(
        403,
        "Authenticated vendor does not own the current shop.",
      );
    }
  }

  if (!shop) {
    shop = await Shop.findOne({ ownerId: String(user.id) });
  }

  if (!shop) {
    const legacyShopName = String(user?.shop?.name ?? "").trim();

    if (!legacyShopName) {
      throw new ApiError(400, "Create your shop before creating products.");
    }

    const preferredObjectId = resolvePreferredShopObjectId(user?.shop?.id);
    shop = await Shop.create({
      ...(preferredObjectId ? { _id: preferredObjectId } : {}),
      name: legacyShopName,
      slug: buildShopSlug(
        user?.shop?.slug || legacyShopName,
        user?.name || "shop",
      ),
      ownerId: String(user.id),
      contactEmail: String(user.email ?? "")
        .trim()
        .toLowerCase(),
      phone: String(user.phone ?? "").trim(),
    });
  }

  await syncVendorShopSnapshot(user, shop);
  return shop;
}

export const listMyProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({ vendorId: req.user.id }).sort({
    createdAt: -1,
  });
  res.json(products);
});

export const createProduct = asyncHandler(async (req, res) => {
  const payload = buildProductPayload(req.body);
  const shop = await ensureVendorShop(req.user);

  if (
    !payload.title ||
    !payload.category ||
    typeof payload.price !== "number"
  ) {
    throw new ApiError(400, "title, category, and price are required.");
  }

  const product = await Product.create({
    ...payload,
    oldPrice: payload.oldPrice ?? 0,
    stock: payload.stock ?? 0,
    thumbnail: payload.thumbnail ?? "",
    gallery: payload.gallery ?? (payload.thumbnail ? [payload.thumbnail] : []),
    status: PRODUCT_STATUS.DRAFT,
    vendorId: req.user.id,
    shopId: shop.id,
    shopName: shop.name,
  });

  res.status(201).json(product);
});

export const updateProduct = asyncHandler(async (req, res) => {
  const productId = ensureValidObjectId(req.params?.id, "Product id");
  const product = await findOwnedProduct(productId, req.user.id);
  const payload = buildProductPayload(req.body);
  const shop = await ensureVendorShop(req.user);

  delete payload.status;
  delete payload.vendorId;
  delete payload.shopId;
  delete payload.shopName;

  Object.assign(product, payload);

  if (payload.thumbnail && !payload.gallery) {
    product.gallery = [payload.thumbnail];
  }

  product.shopId = shop.id;
  product.shopName = shop.name;

  await product.save();
  res.json(product);
});

export const updateProductStatus = asyncHandler(async (req, res) => {
  const productId = ensureValidObjectId(req.params?.id, "Product id");
  const nextStatus = String(req.body?.status ?? "")
    .trim()
    .toLowerCase();

  if (!VENDOR_ALLOWED_PRODUCT_STATUSES.includes(nextStatus)) {
    throw new ApiError(400, "Vendor product status is invalid.");
  }

  const product = await findOwnedProduct(productId, req.user.id);
  product.status = nextStatus;
  await product.save();

  res.json(product);
});

export const deleteProduct = asyncHandler(async (req, res) => {
  const productId = ensureValidObjectId(req.params?.id, "Product id");
  const product = await findOwnedProduct(productId, req.user.id);

  await product.deleteOne();

  res.json({
    message: "Product deleted successfully",
  });
});

export const listOrders = asyncHandler(async (req, res) => {
  const vendorProducts = await Product.find({ vendorId: req.user.id }).select(
    "_id",
  );
  const vendorProductIds = vendorProducts.map((product) => String(product.id));
  const vendorProductIdSet = new Set(vendorProductIds);

  const orders = await Order.find({
    "items.productId": { $in: vendorProductIds },
  }).sort({ createdAt: -1 });

  res.json(
    orders.map((order) => attachVendorItemsToOrder(order, vendorProductIdSet)),
  );
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
  const orderId = ensureValidObjectId(req.params?.id, "Order id");
  const nextStatus = String(req.body?.status ?? "")
    .trim()
    .toLowerCase();

  if (!VENDOR_ALLOWED_ORDER_STATUSES.includes(nextStatus)) {
    throw new ApiError(400, "Vendor order status is invalid.");
  }

  const vendorProducts = await Product.find({ vendorId: req.user.id }).select(
    "_id",
  );
  const vendorProductIds = vendorProducts.map((product) => String(product.id));
  const vendorProductIdSet = new Set(vendorProductIds);
  const order = await Order.findById(orderId);

  if (!order) {
    throw new ApiError(404, "Order was not found.");
  }

  const hasVendorItem = order.items.some((item) =>
    vendorProductIdSet.has(String(item.productId)),
  );

  if (!hasVendorItem) {
    throw new ApiError(403, "You do not have permission to update this order.");
  }

  order.status = nextStatus;
  await order.save();

  res.json(attachVendorItemsToOrder(order, vendorProductIdSet));
});

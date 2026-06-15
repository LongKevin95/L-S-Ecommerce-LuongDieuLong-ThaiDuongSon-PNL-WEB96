import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Shop from "../models/Shop.js";
import Variant from "../models/Variant.js";
import { ORDER_STATUS } from "../constants/orderStatus.js";
import { PRODUCT_STATUS } from "../constants/productStatus.js";
import {
  destroyCloudinaryAssets,
  uploadImageFile,
  uploadManyImageFiles,
} from "../utils/media.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ensureValidObjectId } from "../utils/mongoId.js";
import { attachVendorItemsToOrder } from "../utils/orderMapper.js";
import {
  appendStatusHistory,
  buildCancellationPayload,
} from "../utils/orderWorkflow.js";
import {
  parseBooleanInput,
  parseObjectArrayInput,
  parseObjectInput,
  parseStringArrayInput,
} from "../utils/request.js";
import { ensureCategoryBySlug } from "../utils/category.js";
import {
  attachVariantsToProductList,
  buildProductDetailResponse,
  syncProductVariants,
} from "../utils/productVariant.js";
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

const VENDOR_ALLOWED_PRODUCT_FORM_STATUSES = [
  PRODUCT_STATUS.DRAFT,
  PRODUCT_STATUS.PENDING,
];

const VENDOR_ALLOWED_ORDER_STATUSES = [
  ORDER_STATUS.PROCESSING,
  ORDER_STATUS.COMPLETED,
  ORDER_STATUS.CANCELLED,
];

function hasOwnField(target, key) {
  return Object.prototype.hasOwnProperty.call(target ?? {}, key);
}

function resolveVendorFormStatus(status, fallback = PRODUCT_STATUS.DRAFT) {
  const normalizedStatus = String(status ?? "")
    .trim()
    .toLowerCase();

  if (!normalizedStatus) {
    return fallback;
  }

  if (!VENDOR_ALLOWED_PRODUCT_FORM_STATUSES.includes(normalizedStatus)) {
    throw new ApiError(400, "Vendor product form status is invalid.");
  }

  return normalizedStatus;
}

function resolvePayloadValue(payload, key, currentValue = "") {
  if (hasOwnField(payload, key)) {
    return payload[key];
  }

  return currentValue;
}

function validatePendingProductPayload(payload = {}, currentProduct = null) {
  const title = String(
    resolvePayloadValue(payload, "title", currentProduct?.title ?? ""),
  ).trim();
  const category = String(
    resolvePayloadValue(payload, "category", currentProduct?.category ?? ""),
  )
    .trim()
    .toLowerCase();
  const description = String(
    resolvePayloadValue(
      payload,
      "description",
      currentProduct?.description ?? "",
    ),
  ).trim();
  const price = Number(
    resolvePayloadValue(payload, "price", currentProduct?.price ?? 0),
  );
  const thumbnail = String(
    resolvePayloadValue(payload, "thumbnail", currentProduct?.thumbnail ?? ""),
  ).trim();

  if (!title || !category || !description) {
    throw new ApiError(
      400,
      "title, category, and description are required before submitting product.",
    );
  }

  if (!Number.isFinite(price) || price <= 0) {
    throw new ApiError(
      400,
      "Product price must be greater than 0 before submit.",
    );
  }

  if (!thumbnail) {
    throw new ApiError(400, "Product thumbnail is required before submit.");
  }
}

function buildProductPayload(body = {}) {
  const payload = {};

  if (hasOwnField(body, "title")) {
    const title = String(body.title ?? "").trim();

    payload.title = title;
    payload.slug = title ? slugify(title) : "";
  }

  if (hasOwnField(body, "category")) {
    const category = String(body.category ?? "")
      .trim()
      .toLowerCase();

    payload.category = category;
  }

  if (hasOwnField(body, "description")) {
    payload.description = String(body.description ?? "").trim();
  }

  if (hasOwnField(body, "attributes")) {
    payload.attributes = parseObjectInput(body.attributes);
  }

  if (hasOwnField(body, "colors")) {
    payload.colors = parseStringArrayInput(body.colors);
  }

  if (hasOwnField(body, "sizes")) {
    payload.sizes = parseStringArrayInput(body.sizes);
  }

  if (hasOwnField(body, "price")) {
    const price = Number(body.price ?? 0);

    if (Number.isNaN(price) || price < 0) {
      throw new ApiError(400, "Product price is invalid.");
    }

    payload.price = price;
  }

  if (hasOwnField(body, "oldPrice")) {
    const oldPrice = Number(body.oldPrice ?? 0);

    if (Number.isNaN(oldPrice) || oldPrice < 0) {
      throw new ApiError(400, "Product oldPrice is invalid.");
    }

    payload.oldPrice = oldPrice;
  }

  if (hasOwnField(body, "stock")) {
    const stock = Number(body.stock ?? 0);

    if (Number.isNaN(stock) || stock < 0) {
      throw new ApiError(400, "Product stock is invalid.");
    }

    payload.stock = stock;
  }

  if (hasOwnField(body, "thumbnail")) {
    payload.thumbnail = String(body.thumbnail ?? "").trim();
  }

  if (hasOwnField(body, "gallery")) {
    payload.gallery = parseStringArrayInput(body.gallery);
  }

  if (hasOwnField(body, "status")) {
    payload.status = resolveVendorFormStatus(body.status, PRODUCT_STATUS.DRAFT);
  }

  return payload;
}

async function applyProductImages(req, product, payload) {
  const files = req.files ?? {};
  const shouldRemoveThumbnail = parseBooleanInput(req.body?.removeThumbnail);
  const shouldReplaceGallery = parseBooleanInput(req.body?.replaceGallery);

  if (files.thumbnail?.[0]) {
    const uploadedThumbnail = await uploadImageFile(files.thumbnail[0], {
      folder: "ls-ecommerce/products/thumbnails",
    });

    if (product?.thumbnailPublicId) {
      await destroyCloudinaryAssets([product.thumbnailPublicId]);
    }

    payload.thumbnail = uploadedThumbnail?.url ?? "";
    payload.thumbnailPublicId = uploadedThumbnail?.publicId ?? "";
  } else if (shouldRemoveThumbnail) {
    if (product?.thumbnailPublicId) {
      await destroyCloudinaryAssets([product.thumbnailPublicId]);
    }

    payload.thumbnail = "";
    payload.thumbnailPublicId = "";
  } else if (
    Object.prototype.hasOwnProperty.call(req.body ?? {}, "thumbnail")
  ) {
    if (
      product?.thumbnailPublicId &&
      String(req.body?.thumbnail ?? "").trim() !==
        String(product.thumbnail ?? "")
    ) {
      await destroyCloudinaryAssets([product.thumbnailPublicId]);
      payload.thumbnailPublicId = "";
    }
  }

  if (files.gallery?.length) {
    const uploadedGallery = await uploadManyImageFiles(files.gallery, {
      folder: "ls-ecommerce/products/gallery",
    });

    if (
      Array.isArray(product?.galleryPublicIds) &&
      product.galleryPublicIds.length > 0
    ) {
      await destroyCloudinaryAssets(product.galleryPublicIds);
    }

    payload.gallery = uploadedGallery.map((item) => item.url);
    payload.galleryPublicIds = uploadedGallery.map((item) => item.publicId);
  } else if (shouldReplaceGallery) {
    if (
      Array.isArray(product?.galleryPublicIds) &&
      product.galleryPublicIds.length > 0
    ) {
      await destroyCloudinaryAssets(product.galleryPublicIds);
    }

    payload.gallery = [];
    payload.galleryPublicIds = [];
  } else if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "gallery")) {
    const nextGallery = parseStringArrayInput(req.body?.gallery);
    const currentGallery = Array.isArray(product?.gallery)
      ? product.gallery
      : [];

    if (
      Array.isArray(product?.galleryPublicIds) &&
      product.galleryPublicIds.length > 0 &&
      JSON.stringify(nextGallery) !== JSON.stringify(currentGallery)
    ) {
      await destroyCloudinaryAssets(product.galleryPublicIds);
      payload.galleryPublicIds = [];
    }

    payload.gallery = nextGallery;
  }
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
  res.json(await attachVariantsToProductList(products));
});

export const createProduct = asyncHandler(async (req, res) => {
  const payload = buildProductPayload(req.body);
  const shop = await ensureVendorShop(req.user);
  const variantsInput = parseObjectArrayInput(req.body?.variants);

  await applyProductImages(req, null, payload);

  payload.status = resolveVendorFormStatus(
    payload.status,
    PRODUCT_STATUS.DRAFT,
  );
  payload.category =
    String(payload.category ?? "")
      .trim()
      .toLowerCase() || "others";
  payload.price = typeof payload.price === "number" ? payload.price : 0;
  payload.oldPrice =
    typeof payload.oldPrice === "number" ? payload.oldPrice : 0;
  payload.stock = typeof payload.stock === "number" ? payload.stock : 0;

  if (payload.status === PRODUCT_STATUS.PENDING) {
    validatePendingProductPayload(payload);
  }

  const category = await ensureCategoryBySlug(payload.category);

  const product = await Product.create({
    ...payload,
    oldPrice: payload.oldPrice ?? 0,
    stock: payload.stock ?? 0,
    attributes: payload.attributes ?? {},
    colors: payload.colors ?? [],
    sizes: payload.sizes ?? [],
    thumbnail: payload.thumbnail ?? "",
    thumbnailPublicId: payload.thumbnailPublicId ?? "",
    gallery: payload.gallery ?? (payload.thumbnail ? [payload.thumbnail] : []),
    galleryPublicIds:
      payload.galleryPublicIds ??
      (payload.thumbnailPublicId ? [payload.thumbnailPublicId] : []),
    categoryId: category?._id ?? null,
    categoryName: category?.name ?? "",
    status: payload.status ?? PRODUCT_STATUS.DRAFT,
    vendorId: req.user.id,
    shopId: shop.id,
    shopName: shop.name,
  });

  await syncProductVariants(product, variantsInput, {
    category,
    fallbackPrice: payload.price,
    fallbackOldPrice: payload.oldPrice ?? 0,
    fallbackStock: payload.stock ?? 0,
    fallbackImage: payload.thumbnail ?? "",
    fallbackColors: payload.colors ?? [],
    fallbackSizes: payload.sizes ?? [],
  });

  await product.save();

  res.status(201).json(await buildProductDetailResponse(product));
});

export const updateProduct = asyncHandler(async (req, res) => {
  const productId = ensureValidObjectId(req.params?.id, "Product id");
  const product = await findOwnedProduct(productId, req.user.id);
  const payload = buildProductPayload(req.body);
  const shop = await ensureVendorShop(req.user);
  const hasVariantsInput = Object.prototype.hasOwnProperty.call(
    req.body ?? {},
    "variants",
  );
  const variantsInput = parseObjectArrayInput(req.body?.variants);

  await applyProductImages(req, product, payload);

  delete payload.vendorId;
  delete payload.shopId;
  delete payload.shopName;

  payload.status = resolveVendorFormStatus(payload.status, product.status);

  const resolvedCategorySlug = payload.category ?? product.category ?? "others";
  const category = await ensureCategoryBySlug(resolvedCategorySlug);
  payload.category = resolvedCategorySlug;
  payload.categoryId = category?._id ?? null;
  payload.categoryName = category?.name ?? "";

  if (payload.status === PRODUCT_STATUS.PENDING) {
    validatePendingProductPayload(payload, product);
  }

  Object.assign(product, payload);

  if (
    payload.thumbnail &&
    !Object.prototype.hasOwnProperty.call(payload, "gallery") &&
    (!Array.isArray(product.gallery) || product.gallery.length === 0)
  ) {
    product.gallery = [payload.thumbnail];

    if (payload.thumbnailPublicId) {
      product.galleryPublicIds = [payload.thumbnailPublicId];
    }
  }

  product.shopId = shop.id;
  product.shopName = shop.name;

  if (
    hasVariantsInput ||
    !product.defaultVariantId ||
    product.variantCount === 0
  ) {
    await syncProductVariants(product, variantsInput, {
      category,
      fallbackPrice: payload.price ?? product.price,
      fallbackOldPrice: payload.oldPrice ?? product.oldPrice,
      fallbackStock: payload.stock ?? product.stock,
      fallbackImage: payload.thumbnail ?? product.thumbnail,
      fallbackColors: payload.colors ?? product.colors ?? [],
      fallbackSizes: payload.sizes ?? product.sizes ?? [],
    });
  }

  await product.save();
  res.json(await buildProductDetailResponse(product));
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

  await destroyCloudinaryAssets([
    product.thumbnailPublicId,
    ...(Array.isArray(product.galleryPublicIds)
      ? product.galleryPublicIds
      : []),
  ]);

  await Variant.deleteMany({ productId: product._id });

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
  const cancellationReason = String(req.body?.reason ?? req.body?.cancellation?.reason ?? "").trim();

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

  if (nextStatus === ORDER_STATUS.CANCELLED && !cancellationReason) {
    throw new ApiError(400, "Cancellation reason is required.");
  }

  order.statusHistory = appendStatusHistory(order, nextStatus, "vendor");
  order.status = nextStatus;

  if (nextStatus === ORDER_STATUS.CANCELLED) {
    order.cancellation = buildCancellationPayload(cancellationReason, "vendor");
  }

  await order.save();

  res.json(attachVendorItemsToOrder(order, vendorProductIdSet));
});

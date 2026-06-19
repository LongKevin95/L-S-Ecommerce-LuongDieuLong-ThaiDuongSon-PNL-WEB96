import Product from "../models/Product.js";
import { PRODUCT_STATUS } from "../constants/productStatus.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { attachVariantsToProductList } from "../utils/productVariant.js";

async function buildWishlistItems(user) {
  const wishlistIds = Array.isArray(user?.wishlist)
    ? user.wishlist
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
    : [];

  if (wishlistIds.length === 0) {
    return [];
  }

  const products = await Product.find({
    _id: { $in: wishlistIds },
    status: PRODUCT_STATUS.ACTIVE,
  });
  const enrichedProducts = await attachVariantsToProductList(products);
  const productById = new Map(
    enrichedProducts.map((product) => [String(product?.id ?? product?._id ?? "").trim(), product]),
  );

  return wishlistIds
    .map((productId) => productById.get(productId))
    .filter(Boolean);
}

export const getMyWishlist = asyncHandler(async (req, res) => {
  res.json({
    items: await buildWishlistItems(req.user),
  });
});

export const addWishlistItem = asyncHandler(async (req, res) => {
  const productId = String(req.body?.productId ?? "").trim();

  if (!productId) {
    throw new ApiError(400, "Product id is required.");
  }

  const product = await Product.findById(productId);

  if (!product || product.status !== PRODUCT_STATUS.ACTIVE) {
    throw new ApiError(404, "Product was not found.");
  }

  const currentWishlist = Array.isArray(req.user?.wishlist)
    ? req.user.wishlist
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
    : [];

  req.user.wishlist = [
    productId,
    ...currentWishlist.filter((value) => value !== productId),
  ];
  await req.user.save();

  res.json({
    items: await buildWishlistItems(req.user),
  });
});

export const removeWishlistItem = asyncHandler(async (req, res) => {
  const productId = String(req.params?.productId ?? "").trim();

  if (!productId) {
    throw new ApiError(400, "Product id is required.");
  }

  req.user.wishlist = (Array.isArray(req.user?.wishlist) ? req.user.wishlist : [])
    .map((value) => String(value ?? "").trim())
    .filter((value) => value && value !== productId);
  await req.user.save();

  res.json({
    items: await buildWishlistItems(req.user),
  });
});

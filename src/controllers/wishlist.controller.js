import Product from "../models/Product.js";
import { PRODUCT_STATUS } from "../constants/productStatus.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ensureValidObjectId } from "../utils/mongoId.js";

function normalizeWishlistItems(wishlist = [], productById = new Map()) {
  return (Array.isArray(wishlist) ? wishlist : []).map((item) => {
    const productId = String(item?.productId ?? "").trim();

    return {
      productId,
      addedAt: item?.addedAt ?? null,
      product: productById.get(productId) ?? null,
    };
  });
}

async function buildWishlistResponse(user) {
  const wishlist = Array.isArray(user?.wishlist) ? user.wishlist : [];
  const productIds = [...new Set(
    wishlist.map((item) => String(item?.productId ?? "").trim()).filter(Boolean),
  )];
  const products =
    productIds.length > 0
      ? await Product.find({ _id: { $in: productIds } })
      : [];
  const productById = new Map(products.map((product) => [String(product.id), product]));

  return {
    items: normalizeWishlistItems(wishlist, productById),
  };
}

export const getMyWishlist = asyncHandler(async (req, res) => {
  res.json(await buildWishlistResponse(req.user));
});

export const addWishlistItem = asyncHandler(async (req, res) => {
  const productId = ensureValidObjectId(req.body?.productId, "Product id");
  const product = await Product.findById(productId);

  if (!product || String(product.status ?? "").toLowerCase() !== PRODUCT_STATUS.ACTIVE) {
    throw new ApiError(404, "Product was not found.");
  }

  const wishlist = Array.isArray(req.user.wishlist) ? req.user.wishlist : [];
  const hasItem = wishlist.some(
    (item) => String(item?.productId ?? "").trim() === productId,
  );

  if (!hasItem) {
    wishlist.push({
      productId,
      addedAt: new Date(),
    });
    req.user.wishlist = wishlist;
    await req.user.save();
  }

  res.status(hasItem ? 200 : 201).json(await buildWishlistResponse(req.user));
});

export const removeWishlistItem = asyncHandler(async (req, res) => {
  const productId = ensureValidObjectId(req.params?.productId, "Product id");
  const wishlist = Array.isArray(req.user.wishlist) ? req.user.wishlist : [];

  req.user.wishlist = wishlist.filter(
    (item) => String(item?.productId ?? "").trim() !== productId,
  );
  await req.user.save();

  res.json(await buildWishlistResponse(req.user));
});

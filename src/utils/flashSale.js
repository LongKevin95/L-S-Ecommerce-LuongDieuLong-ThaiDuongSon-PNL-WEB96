import mongoose from "mongoose";

import { ORDER_STATUS } from "../constants/orderStatus.js";
import FlashSaleConfig from "../models/FlashSaleConfig.js";
import Order from "../models/Order.js";

const FLASH_SALE_CONFIG_KEY = "global";
const COMPLETED_ORDER_STATUSES = [
  ORDER_STATUS.COMPLETED,
  "delivery",
  "delivered",
];

function normalizeDate(value) {
  if (!value) {
    return null;
  }

  const nextDate = new Date(value);
  return Number.isNaN(nextDate.getTime()) ? null : nextDate;
}

function normalizeNumber(value, fallback = 0) {
  const nextValue = Number(value ?? fallback);
  return Number.isFinite(nextValue) && nextValue >= 0 ? nextValue : fallback;
}

function roundCurrencyValue(value) {
  return Number(normalizeNumber(value).toFixed(2));
}

function buildCampaignState(config) {
  const startsAt = normalizeDate(config?.startsAt);
  const endsAt = normalizeDate(config?.endsAt);
  const now = new Date();
  const isWithinSchedule =
    startsAt &&
    endsAt &&
    startsAt.getTime() <= now.getTime() &&
    endsAt.getTime() > now.getTime();
  const isActive =
    Boolean(config?.isEnabled) &&
    Boolean(String(config?.currentCampaignId ?? "").trim()) &&
    isWithinSchedule;

  return {
    id: String(config?.id ?? config?._id ?? "").trim(),
    isEnabled: Boolean(config?.isEnabled),
    isActive,
    currentCampaignId: String(config?.currentCampaignId ?? "").trim(),
    startsAt: startsAt ? startsAt.toISOString() : null,
    endsAt: endsAt ? endsAt.toISOString() : null,
    updatedBy: String(config?.updatedBy ?? "").trim(),
  };
}

export async function getFlashSaleConfig() {
  const config = await FlashSaleConfig.findOne({ key: FLASH_SALE_CONFIG_KEY });

  if (config) {
    return config;
  }

  return FlashSaleConfig.create({ key: FLASH_SALE_CONFIG_KEY });
}

export async function getFlashSaleState() {
  const config = await getFlashSaleConfig();
  return buildCampaignState(config);
}

export function isProductFlashSaleActive(product, flashSaleState) {
  const campaignId = String(product?.flashSale?.campaignId ?? "").trim();
  const discountPercent = normalizeNumber(product?.flashSale?.discountPercent);

  return (
    Boolean(flashSaleState?.isActive) &&
    Boolean(campaignId) &&
    campaignId === String(flashSaleState?.currentCampaignId ?? "").trim() &&
    discountPercent > 0
  );
}

export function buildPriceSnapshot(
  price,
  oldPrice,
  flashDiscountPercent = 0,
  isFlashSaleActive = false,
) {
  const regularPrice = roundCurrencyValue(price);
  const candidateOldPrice = roundCurrencyValue(oldPrice);
  const regularOldPrice =
    candidateOldPrice > regularPrice ? candidateOldPrice : regularPrice;
  const regularDiscountPercentage =
    regularOldPrice > regularPrice && regularOldPrice > 0
      ? Math.round(((regularOldPrice - regularPrice) / regularOldPrice) * 100)
      : 0;

  if (!isFlashSaleActive) {
    return {
      regularPrice,
      regularOldPrice,
      regularDiscountPercentage,
      displayPrice: regularPrice,
      displayOldPrice: regularOldPrice,
      displayDiscountPercentage: regularDiscountPercentage,
      flashSaleDiscountPercent: 0,
      isFlashSaleActive: false,
    };
  }

  const normalizedFlashDiscount = Math.min(
    95,
    Math.max(1, Math.round(normalizeNumber(flashDiscountPercent))),
  );
  const displayOldPrice = regularOldPrice;
  const displayPrice = roundCurrencyValue(
    displayOldPrice * ((100 - normalizedFlashDiscount) / 100),
  );

  return {
    regularPrice,
    regularOldPrice,
    regularDiscountPercentage,
    displayPrice,
    displayOldPrice,
    displayDiscountPercentage:
      displayOldPrice > 0
        ? Math.round(((displayOldPrice - displayPrice) / displayOldPrice) * 100)
        : 0,
    flashSaleDiscountPercent: normalizedFlashDiscount,
    isFlashSaleActive: true,
  };
}

export function decorateVariantForCommerce(
  variant,
  product,
  flashSaleState,
) {
  const flashSaleActive = isProductFlashSaleActive(product, flashSaleState);
  const flashDiscountPercent = normalizeNumber(
    product?.flashSale?.discountPercent,
  );

  return {
    ...variant,
    ...buildPriceSnapshot(
      variant?.price,
      variant?.oldPrice,
      flashDiscountPercent,
      flashSaleActive,
    ),
  };
}

export function decorateProductForCommerce(
  product,
  flashSaleState,
  soldCount = 0,
) {
  const flashSaleActive = isProductFlashSaleActive(product, flashSaleState);
  const flashDiscountPercent = normalizeNumber(
    product?.flashSale?.discountPercent,
  );
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const decoratedVariants = variants.map((variant) =>
    decorateVariantForCommerce(variant, product, flashSaleState),
  );
  const priceSnapshot = buildPriceSnapshot(
    product?.price,
    product?.oldPrice,
    flashDiscountPercent,
    flashSaleActive,
  );

  return {
    ...product,
    ...priceSnapshot,
    soldCount: normalizeNumber(soldCount),
    flashSale: {
      campaignId: String(product?.flashSale?.campaignId ?? "").trim(),
      discountPercent: flashDiscountPercent,
      requestedAt: product?.flashSale?.requestedAt ?? null,
    },
    variants: decoratedVariants,
  };
}

export async function loadSoldCountsByProductIds(productIds = []) {
  const normalizedIds = [...new Set(
    (Array.isArray(productIds) ? productIds : [])
      .map((value) => String(value ?? "").trim())
      .filter(Boolean),
  )];

  if (normalizedIds.length === 0) {
    return new Map();
  }

  const aggregateResult = await Order.aggregate([
    {
      $match: {
        status: { $in: COMPLETED_ORDER_STATUSES },
        "items.productId": { $in: normalizedIds },
      },
    },
    { $unwind: "$items" },
    {
      $match: {
        "items.productId": { $in: normalizedIds },
      },
    },
    {
      $group: {
        _id: "$items.productId",
        soldCount: { $sum: "$items.quantity" },
      },
    },
  ]);

  return aggregateResult.reduce((result, item) => {
    result.set(String(item?._id ?? "").trim(), normalizeNumber(item?.soldCount));
    return result;
  }, new Map());
}

export function createNextCampaignId() {
  return new mongoose.Types.ObjectId().toString();
}

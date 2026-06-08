import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Variant from "../models/Variant.js";
import {
  ORDER_STATUS,
  PAYMENT_METHOD_VALUES,
} from "../constants/orderStatus.js";
import { PRODUCT_STATUS } from "../constants/productStatus.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

function normalizeShippingAddress(shippingAddress = {}) {
  return {
    fullName: String(shippingAddress?.fullName ?? "").trim(),
    phone: String(shippingAddress?.phone ?? "").trim(),
    address: String(shippingAddress?.address ?? "").trim(),
    city: String(shippingAddress?.city ?? "").trim(),
    state: String(shippingAddress?.state ?? "").trim(),
    zipCode: String(shippingAddress?.zipCode ?? "").trim(),
    country: String(shippingAddress?.country ?? "").trim(),
  };
}

function normalizeItems(items = []) {
  return Array.isArray(items)
    ? items
        .map((item) => ({
          productId: String(item?.productId ?? "").trim(),
          variantId: String(item?.variantId ?? "").trim(),
          variantLabel: String(item?.variantLabel ?? "").trim(),
          title: String(item?.title ?? "Product").trim() || "Product",
          image: String(item?.image ?? "/favicon.svg").trim() || "/favicon.svg",
          quantity: Math.max(1, Number(item?.quantity ?? 1)),
          price: Math.max(0, Number(item?.price ?? 0)),
          vendorEmail: String(item?.vendorEmail ?? "")
            .trim()
            .toLowerCase(),
          shopName: String(item?.shopName ?? "Shop").trim() || "Shop",
          sku: String(item?.sku ?? "").trim(),
          color: String(item?.color ?? "Default").trim() || "Default",
          size: String(item?.size ?? "Default").trim() || "Default",
        }))
        .filter((item) => item.productId)
    : [];
}

function buildVariantDisplayLabel(item, variant) {
  const explicitLabel = String(item?.variantLabel ?? "").trim();

  if (explicitLabel) {
    return explicitLabel;
  }

  const optionValues =
    variant?.optionValues && typeof variant.optionValues === "object"
      ? variant.optionValues
      : {};
  const optionParts = Object.values(optionValues)
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);

  if (optionParts.length > 0) {
    return optionParts.join(" / ");
  }

  const title = String(variant?.title ?? "").trim();
  return title || "Default variant";
}

function buildRequestedQuantityMap(items = []) {
  return items.reduce((quantityMap, item) => {
    quantityMap.set(
      item.productId,
      Number(quantityMap.get(item.productId) ?? 0) + Number(item.quantity ?? 0),
    );

    return quantityMap;
  }, new Map());
}

function buildRequestedStockQuantityMap(items = []) {
  return items.reduce((quantityMap, item) => {
    const stockKey = String(item?.variantId || item?.productId || "").trim();

    if (!stockKey) {
      return quantityMap;
    }

    quantityMap.set(
      stockKey,
      Number(quantityMap.get(stockKey) ?? 0) + Number(item.quantity ?? 0),
    );

    return quantityMap;
  }, new Map());
}

function buildOrderPayload({
  customerId,
  paymentMethod,
  shippingAddress,
  items,
  total,
}) {
  return {
    customerId,
    status: ORDER_STATUS.PENDING,
    paymentMethod,
    shippingAddress,
    items,
    total,
  };
}

function validateAndApplyStockChanges(products, variants, items) {
  const requestedQuantityMap = buildRequestedStockQuantityMap(items);
  const productMap = new Map(
    products.map((product) => [String(product.id), product]),
  );
  const variantMap = new Map(
    variants.map((variant) => [String(variant.id), variant]),
  );

  items.forEach((item) => {
    const product = productMap.get(item.productId);

    if (!product) {
      throw new ApiError(404, `Product ${item.productId} was not found.`);
    }

    if (product.status !== PRODUCT_STATUS.ACTIVE) {
      throw new ApiError(
        400,
        `Product ${product.title} is not available for checkout.`,
      );
    }

    if (!item.variantId) {
      return;
    }

    const variant = variantMap.get(item.variantId);

    if (!variant) {
      throw new ApiError(404, `Variant ${item.variantId} was not found.`);
    }

    if (String(variant.productId) !== String(product.id)) {
      throw new ApiError(
        400,
        `Variant ${item.variantId} does not belong to product ${product.title}.`,
      );
    }
  });

  for (const [stockKey, requestedQuantity] of requestedQuantityMap.entries()) {
    const variant = variantMap.get(stockKey);

    if (variant) {
      if (Number(variant.stock ?? 0) < requestedQuantity) {
        throw new ApiError(
          400,
          `Variant ${variant.title || stockKey} does not have enough stock.`,
        );
      }

      continue;
    }

    const product = productMap.get(stockKey);

    if (!product) {
      throw new ApiError(404, `Product ${stockKey} was not found.`);
    }

    if (Number(product.stock ?? 0) < requestedQuantity) {
      throw new ApiError(
        400,
        `Product ${product.title} does not have enough stock.`,
      );
    }
  }

  const touchedVariantProductIds = new Set();
  const total = items.reduce((sum, item) => {
    const product = productMap.get(item.productId);
    const variant = item.variantId ? variantMap.get(item.variantId) : null;

    if (variant) {
      variant.stock = Number(variant.stock ?? 0) - Number(item.quantity ?? 0);
      touchedVariantProductIds.add(String(product.id));
    } else {
      product.stock = Number(product.stock ?? 0) - Number(item.quantity ?? 0);
    }

    item.variantId = variant ? String(variant.id) : "";
    item.variantLabel = variant
      ? buildVariantDisplayLabel(item, variant)
      : String(item.variantLabel ?? "").trim();
    item.title =
      String(item.title ?? "").trim() ||
      String(product.title ?? "Product").trim();
    item.image =
      String(item.image ?? "").trim() ||
      String(
        variant?.image ??
          product.thumbnail ??
          product.gallery?.[0] ??
          "/favicon.svg",
      ).trim();
    item.price = Number(variant?.price ?? product.price ?? 0);
    item.shopName =
      String(item.shopName ?? "").trim() ||
      String(product.shopName ?? "Shop").trim();
    item.sku =
      String(item.sku ?? "").trim() || String(variant?.sku ?? "").trim();

    if (
      variant &&
      (!String(item.color ?? "").trim() || item.color === "Default")
    ) {
      item.color =
        String(
          variant?.optionValues?.color ?? item.color ?? "Default",
        ).trim() || "Default";
    }

    if (
      variant &&
      (!String(item.size ?? "").trim() || item.size === "Default")
    ) {
      item.size =
        String(variant?.optionValues?.size ?? item.size ?? "Default").trim() ||
        "Default";
    }

    return sum + Number(item.price ?? 0) * Number(item.quantity ?? 0);
  }, 0);

  touchedVariantProductIds.forEach((productId) => {
    const product = productMap.get(productId);

    if (!product) {
      return;
    }

    product.stock = variants
      .filter((variant) => String(variant.productId) === productId)
      .reduce((sum, variant) => sum + Number(variant.stock ?? 0), 0);
  });

  return {
    total,
    products,
    variants,
    items,
  };
}

function isTransactionUnsupportedError(error) {
  const message = String(error?.message ?? "");

  return (
    message.includes(
      "Transaction numbers are only allowed on a replica set member or mongos",
    ) ||
    message.includes("Transaction not supported") ||
    message.includes("Standalone servers do not support transactions")
  );
}

async function restoreStocks(
  products,
  variants,
  originalProductStocks,
  originalVariantStocks,
) {
  await Promise.all(
    products
      .map(async (product) => {
        const originalStock = originalProductStocks.get(String(product.id));

        if (typeof originalStock === "number") {
          product.stock = originalStock;
          await product.save();
        }
      })
      .concat(
        variants.map(async (variant) => {
          const originalStock = originalVariantStocks.get(String(variant.id));

          if (typeof originalStock === "number") {
            variant.stock = originalStock;
            await variant.save();
          }
        }),
      ),
  );
}

async function createOrderWithFallback(payload) {
  const productIds = [...buildRequestedQuantityMap(payload.items).keys()];
  const products = await Product.find({ _id: { $in: productIds } });
  const variants = await Variant.find({ productId: { $in: productIds } });
  const originalProductStocks = new Map(
    products.map((product) => [String(product.id), Number(product.stock ?? 0)]),
  );
  const originalVariantStocks = new Map(
    variants.map((variant) => [String(variant.id), Number(variant.stock ?? 0)]),
  );
  const { total, items } = validateAndApplyStockChanges(
    products,
    variants,
    payload.items,
  );

  try {
    await Promise.all(
      products
        .map((product) => product.save())
        .concat(variants.map((variant) => variant.save())),
    );

    const order = await Order.create(
      buildOrderPayload({
        ...payload,
        items,
        total,
      }),
    );

    return order;
  } catch (error) {
    await restoreStocks(
      products,
      variants,
      originalProductStocks,
      originalVariantStocks,
    );
    throw error;
  }
}

export const createOrder = asyncHandler(async (req, res) => {
  const customerId = String(req.body?.customerId ?? req.user?.id ?? "").trim();
  const paymentMethod = String(req.body?.paymentMethod ?? "cod")
    .trim()
    .toLowerCase();
  const shippingAddress = normalizeShippingAddress(req.body?.shippingAddress);
  const items = normalizeItems(req.body?.items);

  if (!customerId || customerId !== String(req.user.id)) {
    throw new ApiError(
      400,
      "customerId is invalid for the authenticated user.",
    );
  }

  if (!PAYMENT_METHOD_VALUES.includes(paymentMethod)) {
    throw new ApiError(400, "Payment method is invalid.");
  }

  if (
    !shippingAddress.fullName ||
    !shippingAddress.phone ||
    !shippingAddress.address ||
    !shippingAddress.city ||
    !shippingAddress.country
  ) {
    throw new ApiError(400, "Shipping address is incomplete.");
  }

  if (items.length === 0) {
    throw new ApiError(400, "Order items are required.");
  }

  const payload = {
    customerId,
    paymentMethod,
    shippingAddress,
    items,
  };

  let order;
  const session = await Order.startSession();

  try {
    await session.withTransaction(async () => {
      const productIds = [...buildRequestedQuantityMap(items).keys()];
      const products = await Product.find({ _id: { $in: productIds } }).session(
        session,
      );
      const variants = await Variant.find({
        productId: { $in: productIds },
      }).session(session);
      const { total, items: normalizedItems } = validateAndApplyStockChanges(
        products,
        variants,
        items,
      );

      await Promise.all(products.map((product) => product.save({ session })));
      await Promise.all(variants.map((variant) => variant.save({ session })));

      const createdOrders = await Order.create(
        [
          buildOrderPayload({
            ...payload,
            items: normalizedItems,
            total,
          }),
        ],
        { session },
      );

      [order] = createdOrders;
    });
  } catch (error) {
    if (isTransactionUnsupportedError(error)) {
      order = await createOrderWithFallback(payload);
    } else {
      throw error;
    }
  } finally {
    await session.endSession();
  }

  res.status(201).json(order);
});

export const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ customerId: req.user.id }).sort({
    createdAt: -1,
  });
  res.json(orders);
});

import Order from "../models/Order.js";
import Product from "../models/Product.js";
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
          quantity: Math.max(1, Number(item?.quantity ?? 1)),
          color: String(item?.color ?? "Default").trim() || "Default",
          size: String(item?.size ?? "Default").trim() || "Default",
        }))
        .filter((item) => item.productId)
    : [];
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

function validateAndApplyStockChanges(products, items) {
  const requestedQuantityMap = buildRequestedQuantityMap(items);
  const productMap = new Map(
    products.map((product) => [String(product.id), product]),
  );

  for (const [productId, requestedQuantity] of requestedQuantityMap.entries()) {
    const product = productMap.get(productId);

    if (!product) {
      throw new ApiError(404, `Product ${productId} was not found.`);
    }

    if (product.status !== PRODUCT_STATUS.ACTIVE) {
      throw new ApiError(
        400,
        `Product ${product.title} is not available for checkout.`,
      );
    }

    if (Number(product.stock ?? 0) < requestedQuantity) {
      throw new ApiError(
        400,
        `Product ${product.title} does not have enough stock.`,
      );
    }
  }

  const total = items.reduce((sum, item) => {
    const product = productMap.get(item.productId);

    product.stock = Number(product.stock ?? 0) - Number(item.quantity ?? 0);

    return sum + Number(product.price ?? 0) * Number(item.quantity ?? 0);
  }, 0);

  return {
    total,
    products,
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

async function restoreStocks(products, originalStocks) {
  await Promise.all(
    products.map(async (product) => {
      const originalStock = originalStocks.get(String(product.id));

      if (typeof originalStock === "number") {
        product.stock = originalStock;
        await product.save();
      }
    }),
  );
}

async function createOrderWithFallback(payload) {
  const productIds = [...buildRequestedQuantityMap(payload.items).keys()];
  const products = await Product.find({ _id: { $in: productIds } });
  const originalStocks = new Map(
    products.map((product) => [String(product.id), Number(product.stock ?? 0)]),
  );
  const { total } = validateAndApplyStockChanges(products, payload.items);

  try {
    await Promise.all(products.map((product) => product.save()));

    const order = await Order.create(
      buildOrderPayload({
        ...payload,
        total,
      }),
    );

    return order;
  } catch (error) {
    await restoreStocks(products, originalStocks);
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
      const { total } = validateAndApplyStockChanges(products, items);

      await Promise.all(products.map((product) => product.save({ session })));

      const createdOrders = await Order.create(
        [
          buildOrderPayload({
            ...payload,
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

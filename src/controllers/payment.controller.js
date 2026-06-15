import Order from "../models/Order.js";
import { USER_ROLES } from "../constants/roles.js";
import {
  ORDER_STATUS,
  PAYMENT_METHODS,
  PAYMENT_PROVIDERS,
  PAYMENT_PROVIDER_VALUES,
  PAYMENT_STATUS,
  PAYMENT_STATUS_VALUES,
} from "../constants/orderStatus.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ensureValidObjectId } from "../utils/mongoId.js";

function generatePaymentReference() {
  return `pay_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeUserRoles(user) {
  return Array.isArray(user?.roles) ? user.roles : [];
}

function canUserAccessOrder(user, order) {
  const roles = normalizeUserRoles(user);

  if (roles.includes(USER_ROLES.ADMIN)) {
    return true;
  }

  return String(order?.customerId ?? "") === String(user?.id ?? "");
}

function buildPaymentStatusPayload(order) {
  return {
    orderId: order.id,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus ?? PAYMENT_STATUS.PENDING,
    paymentProvider: order.paymentProvider ?? PAYMENT_PROVIDERS.COD,
    paymentReference: order.paymentReference ?? "",
    paidAt: order.paidAt ?? null,
  };
}

export const createCheckoutSession = asyncHandler(async (req, res) => {
  const orderId = ensureValidObjectId(req.body?.orderId, "Order id");
  const order = await Order.findById(orderId);

  if (!order) {
    throw new ApiError(404, "Order was not found.");
  }

  if (!canUserAccessOrder(req.user, order)) {
    throw new ApiError(403, "You do not have permission to pay this order.");
  }

  if (String(order.status ?? "").toLowerCase() === ORDER_STATUS.CANCELLED) {
    throw new ApiError(400, "Cancelled orders cannot be paid.");
  }

  if (order.paymentMethod === PAYMENT_METHODS.COD) {
    return res.json({
      ...buildPaymentStatusPayload(order),
      requiresOnlinePayment: false,
      message: "This order uses Cash on Delivery and does not need online checkout.",
    });
  }

  const provider = String(
    req.body?.provider ??
      (order.paymentMethod === PAYMENT_METHODS.CARD
        ? PAYMENT_PROVIDERS.MOCK_GATEWAY
        : PAYMENT_PROVIDERS.COD),
  )
    .trim()
    .toLowerCase();

  if (!PAYMENT_PROVIDER_VALUES.includes(provider)) {
    throw new ApiError(400, "Payment provider is invalid.");
  }

  if (order.paymentStatus === PAYMENT_STATUS.PAID) {
    return res.json({
      ...buildPaymentStatusPayload(order),
      requiresOnlinePayment: false,
      message: "This order has already been paid.",
    });
  }

  order.paymentProvider = provider || PAYMENT_PROVIDERS.MOCK_GATEWAY;
  order.paymentStatus = PAYMENT_STATUS.PROCESSING;
  order.paymentReference = order.paymentReference || generatePaymentReference();
  await order.save();

  res.json({
    ...buildPaymentStatusPayload(order),
    requiresOnlinePayment: true,
    checkoutUrl: `https://mock-pay.local/checkout/${order.paymentReference}`,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  });
});

export const getPaymentStatus = asyncHandler(async (req, res) => {
  const orderId = ensureValidObjectId(req.params?.orderId, "Order id");
  const order = await Order.findById(orderId);

  if (!order) {
    throw new ApiError(404, "Order was not found.");
  }

  if (!canUserAccessOrder(req.user, order)) {
    throw new ApiError(403, "You do not have permission to view this payment.");
  }

  res.json(buildPaymentStatusPayload(order));
});

export const handlePaymentWebhook = asyncHandler(async (req, res) => {
  const nextStatus = String(req.body?.status ?? "")
    .trim()
    .toLowerCase();
  const paymentReference = String(req.body?.paymentReference ?? "").trim();
  const orderId = String(req.body?.orderId ?? "").trim();

  if (!PAYMENT_STATUS_VALUES.includes(nextStatus)) {
    throw new ApiError(400, "Payment status is invalid.");
  }

  let order = null;

  if (paymentReference) {
    order = await Order.findOne({ paymentReference });
  } else if (orderId) {
    order = await Order.findById(ensureValidObjectId(orderId, "Order id"));
  }

  if (!order) {
    throw new ApiError(404, "Order was not found for this payment.");
  }

  order.paymentStatus = nextStatus;

  if (nextStatus === PAYMENT_STATUS.PAID) {
    order.paidAt = new Date();
  }

  if (nextStatus === PAYMENT_STATUS.FAILED) {
    order.paidAt = null;
  }

  if (!order.paymentReference) {
    order.paymentReference = paymentReference || generatePaymentReference();
  }

  if (!order.paymentProvider) {
    order.paymentProvider =
      order.paymentMethod === PAYMENT_METHODS.CARD
        ? PAYMENT_PROVIDERS.MOCK_GATEWAY
        : PAYMENT_PROVIDERS.COD;
  }

  await order.save();

  res.json({
    message: "Payment webhook processed successfully.",
    ...buildPaymentStatusPayload(order),
  });
});

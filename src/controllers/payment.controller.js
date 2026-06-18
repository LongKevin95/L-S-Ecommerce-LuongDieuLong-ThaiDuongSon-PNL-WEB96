import Order from "../models/Order.js";
import PaymentTransaction from "../models/PaymentTransaction.js";
import { USER_ROLES } from "../constants/roles.js";
import {
  PAYMENT_METHODS,
  PAYMENT_PROVIDERS,
  PAYMENT_STATUS,
} from "../constants/orderStatus.js";
import {
  buildSePayCheckoutForm,
  getSePayIpnSecret,
} from "../services/sepay.service.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

function normalizeTransactionAmount(payload) {
  return Number(
    payload?.transaction?.transaction_amount ?? payload?.order?.order_amount ?? 0,
  );
}

function maskSecret(value) {
  const normalizedValue = String(value ?? "").trim();

  if (!normalizedValue) {
    return "";
  }

  if (normalizedValue.length <= 8) {
    return "*".repeat(normalizedValue.length);
  }

  return `${normalizedValue.slice(0, 4)}***${normalizedValue.slice(-4)}`;
}

function isSuccessfulSePayNotification(payload) {
  const notificationType = String(payload?.notification_type ?? "")
    .trim()
    .toUpperCase();
  const orderStatus = String(payload?.order?.order_status ?? "")
    .trim()
    .toUpperCase();
  const transactionStatus = String(payload?.transaction?.transaction_status ?? "")
    .trim()
    .toUpperCase();

  return (
    notificationType === "ORDER_PAID" ||
    orderStatus === "CAPTURED" ||
    transactionStatus === "APPROVED"
  );
}

function isFailedSePayNotification(payload) {
  const notificationType = String(payload?.notification_type ?? "")
    .trim()
    .toUpperCase();
  const orderStatus = String(payload?.order?.order_status ?? "")
    .trim()
    .toUpperCase();
  const transactionStatus = String(payload?.transaction?.transaction_status ?? "")
    .trim()
    .toUpperCase();

  return (
    notificationType === "ORDER_FAILED" ||
    notificationType === "ORDER_CANCELLED" ||
    ["DECLINED", "FAILED", "CANCELLED", "VOIDED"].includes(transactionStatus) ||
    ["FAILED", "CANCELLED", "VOIDED"].includes(orderStatus)
  );
}

async function findOwnedOrder(orderId, user) {
  const normalizedOrderId = String(orderId ?? "").trim();

  if (!normalizedOrderId) {
    throw new ApiError(400, "Order id is required.");
  }

  const order = await Order.findById(normalizedOrderId);

  if (!order) {
    throw new ApiError(404, "Order was not found.");
  }

  const roles = Array.isArray(user?.roles) ? user.roles : [];
  const isPrivileged = roles.includes(USER_ROLES.ADMIN);

  if (!isPrivileged && String(order.customerId) !== String(user?.id ?? "")) {
    throw new ApiError(403, "You do not have access to this order.");
  }

  return order;
}

async function syncExpiredStatus(order) {
  if (
    order &&
    order.paymentMethod === PAYMENT_METHODS.SEPAY &&
    order.paymentStatus === PAYMENT_STATUS.PENDING &&
    order.paymentExpiresAt &&
    new Date(order.paymentExpiresAt).getTime() <= Date.now()
  ) {
    order.paymentStatus = PAYMENT_STATUS.EXPIRED;
    await order.save();
  }

  return order;
}

export const initSePayCheckout = asyncHandler(async (req, res) => {
  const order = await findOwnedOrder(req.body?.orderId, req.user);

  await syncExpiredStatus(order);

  if (order.paymentMethod !== PAYMENT_METHODS.SEPAY) {
    throw new ApiError(400, "This order is not configured for SePay payment.");
  }

  if (order.paymentStatus === PAYMENT_STATUS.PAID) {
    throw new ApiError(400, "This order has already been paid.");
  }

  if (order.paymentStatus === PAYMENT_STATUS.EXPIRED) {
    throw new ApiError(400, "This payment session has expired.");
  }

  const checkoutForm = buildSePayCheckoutForm(order);

  res.json({
    orderId: order.id,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    paymentProvider: order.paymentProvider,
    paymentCode: order.paymentCode,
    paymentInvoiceNumber: order.paymentInvoiceNumber,
    paymentExpiresAt: order.paymentExpiresAt,
    total: order.total,
    checkoutForm,
  });
});

export const getOrderPaymentStatus = asyncHandler(async (req, res) => {
  const order = await findOwnedOrder(req.params?.orderId, req.user);

  await syncExpiredStatus(order);

  res.json({
    orderId: order.id,
    orderStatus: order.status,
    paymentMethod: order.paymentMethod,
    paymentProvider: order.paymentProvider,
    paymentStatus: order.paymentStatus,
    paymentCode: order.paymentCode,
    paymentInvoiceNumber: order.paymentInvoiceNumber,
    paymentExpiresAt: order.paymentExpiresAt,
    paidAt: order.paidAt,
    total: order.total,
    updatedAt: order.updatedAt,
  });
});

export const handleSePayIpn = asyncHandler(async (req, res) => {
  const providedSecret = String(req.headers["x-secret-key"] ?? "").trim();
  const expectedSecret = getSePayIpnSecret();

  if (!providedSecret || providedSecret !== expectedSecret) {
    console.warn("[sepay-ipn] Secret validation failed.", {
      hasProvidedSecret: Boolean(providedSecret),
      providedSecretPreview: maskSecret(providedSecret),
      expectedSecretPreview: maskSecret(expectedSecret),
      headerKeys: Object.keys(req.headers ?? {}).sort(),
      contentType: String(req.headers["content-type"] ?? "").trim(),
      userAgent: String(req.headers["user-agent"] ?? "").trim(),
    });
    throw new ApiError(401, "SePay IPN secret is invalid.");
  }

  const payload = req.body && typeof req.body === "object" ? req.body : {};
  const paymentInvoiceNumber = String(payload?.order?.order_invoice_number ?? "").trim();
  const providerTransactionId = String(
    payload?.transaction?.transaction_id ?? payload?.transaction?.id ?? "",
  ).trim();
  const providerOrderId = String(payload?.order?.id ?? payload?.order?.order_id ?? "").trim();
  const amount = normalizeTransactionAmount(payload);
  const currency = String(
    payload?.transaction?.transaction_currency ?? payload?.order?.order_currency ?? "VND",
  )
    .trim()
    .toUpperCase();

  console.info("[sepay-ipn] Notification accepted.", {
    paymentInvoiceNumber,
    providerTransactionId,
    providerOrderId,
    notificationType: String(payload?.notification_type ?? "").trim(),
    orderStatus: String(payload?.order?.order_status ?? "").trim(),
    transactionStatus: String(payload?.transaction?.transaction_status ?? "").trim(),
    amount,
    currency,
  });

  let order = null;

  if (paymentInvoiceNumber) {
    order = await Order.findOne({ paymentInvoiceNumber });
  }

  try {
    await PaymentTransaction.create({
      provider: PAYMENT_PROVIDERS.SEPAY,
      orderId:
        String(order?.id ?? "").trim() ||
        paymentInvoiceNumber ||
        providerTransactionId ||
        providerOrderId ||
        `sepay-${Date.now()}`,
      paymentInvoiceNumber,
      providerTransactionId,
      providerOrderId,
      referenceCode: String(payload?.transaction?.id ?? "").trim(),
      amount,
      currency,
      status: isSuccessfulSePayNotification(payload)
        ? PAYMENT_STATUS.PAID
        : isFailedSePayNotification(payload)
          ? PAYMENT_STATUS.FAILED
          : PAYMENT_STATUS.PENDING,
      paymentChannel: String(payload?.transaction?.payment_method ?? "").trim(),
      rawPayload: payload,
    });
  } catch (error) {
    if (error?.code === 11000) {
      res.status(200).json({ success: true });
      return;
    }

    throw error;
  }

  if (!order) {
    console.warn("[sepay-ipn] Order not found for invoice number.", {
      paymentInvoiceNumber,
      providerTransactionId,
      providerOrderId,
    });
    res.status(200).json({ success: true });
    return;
  }

  const successfulPayment =
    isSuccessfulSePayNotification(payload) && amount >= Number(order.total ?? 0);

  if (successfulPayment) {
    if (order.paymentStatus !== PAYMENT_STATUS.PAID) {
      order.paymentStatus = PAYMENT_STATUS.PAID;
      order.paymentProvider = PAYMENT_PROVIDERS.SEPAY;
      order.paidAt = new Date();
    }
  } else if (
    isFailedSePayNotification(payload) &&
    order.paymentStatus !== PAYMENT_STATUS.PAID
  ) {
    order.paymentStatus = PAYMENT_STATUS.FAILED;
    order.paymentProvider = PAYMENT_PROVIDERS.SEPAY;
  }

  order.paymentMeta = {
    ...order.paymentMeta,
    sepayOrderId: providerOrderId,
    sepayTransactionId: String(payload?.transaction?.id ?? "").trim(),
    providerTransactionId,
    providerStatus: String(
      payload?.transaction?.transaction_status ?? payload?.order?.order_status ?? "",
    ).trim(),
    gateway: "SePay",
    referenceCode: String(payload?.transaction?.transaction_id ?? "").trim(),
    paymentChannel: String(payload?.transaction?.payment_method ?? "").trim(),
    cardBrand: String(payload?.transaction?.card_brand ?? "").trim(),
    cardNumberMasked: String(payload?.transaction?.card_number ?? "").trim(),
    lastWebhookAt: new Date(),
  };

  await order.save();

  console.info("[sepay-ipn] Order payment state updated.", {
    orderId: order.id,
    paymentInvoiceNumber: order.paymentInvoiceNumber,
    paymentStatus: order.paymentStatus,
    paidAt: order.paidAt,
  });

  res.status(200).json({ success: true });
});

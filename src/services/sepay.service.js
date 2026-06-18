import crypto from "crypto";

import env from "../config/env.js";
import { PAYMENT_PROVIDERS, PAYMENT_STATUS } from "../constants/orderStatus.js";
import { ApiError } from "../utils/ApiError.js";

const SEPAY_SIGNED_FIELDS = [
  "order_amount",
  "merchant",
  "currency",
  "operation",
  "order_description",
  "order_invoice_number",
  "customer_id",
  "payment_method",
  "success_url",
  "error_url",
  "cancel_url",
];

function normalizeCurrency(value) {
  const nextValue = String(value ?? "VND")
    .trim()
    .toUpperCase();

  return nextValue || "VND";
}

function normalizeBaseUrl(value) {
  return String(value ?? "")
    .trim()
    .replace(/\/+$/, "");
}

export function getSePayConfig() {
  const merchantId = String(env.sepayMerchantId ?? "").trim();
  const secretKey = String(env.sepaySecretKey ?? "").trim();
  const checkoutUrl = normalizeBaseUrl(env.sepayCheckoutUrl);
  const currency = normalizeCurrency(env.sepayCurrency);

  if (!merchantId || !secretKey) {
    throw new ApiError(
      500,
      "SePay merchant configuration is missing. Please provide MERCHANT ID and SECRET KEY.",
    );
  }

  if (!checkoutUrl) {
    throw new ApiError(500, "SePay checkout URL is missing.");
  }

  return {
    merchantId,
    secretKey,
    checkoutUrl,
    currency,
  };
}

export function buildSePayPaymentCode(orderId) {
  const normalizedOrderId = String(orderId ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
  const randomSuffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `ORD${normalizedOrderId.slice(-12)}${randomSuffix}`;
}

export function buildSePayInvoiceNumber(orderId) {
  const normalizedOrderId = String(orderId ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
  return `INV${normalizedOrderId}`;
}

export function buildSePayExpiryDate() {
  const paymentExpiryMinutes = Math.max(5, Number(env.sepayPaymentExpiryMinutes ?? 30));
  return new Date(Date.now() + paymentExpiryMinutes * 60 * 1000);
}

export function buildSePayPaymentState(orderId) {
  return {
    paymentProvider: PAYMENT_PROVIDERS.SEPAY,
    paymentStatus: PAYMENT_STATUS.PENDING,
    paymentCode: buildSePayPaymentCode(orderId),
    paymentInvoiceNumber: buildSePayInvoiceNumber(orderId),
    paymentExpiresAt: buildSePayExpiryDate(),
  };
}

export function signSePayFields(fields, secretKey) {
  const signedParts = [];

  SEPAY_SIGNED_FIELDS.forEach((fieldName) => {
    if (!Object.prototype.hasOwnProperty.call(fields, fieldName)) {
      return;
    }

    const fieldValue = String(fields[fieldName] ?? "");

    if (!fieldValue) {
      return;
    }

    signedParts.push(`${fieldName}=${fieldValue}`);
  });

  return crypto
    .createHmac("sha256", secretKey)
    .update(signedParts.join(","), "utf8")
    .digest("base64");
}

export function buildSePayReturnUrl(status, orderId) {
  const clientUrl = normalizeBaseUrl(env.clientUrl);

  if (!clientUrl) {
    throw new ApiError(500, "CLIENT_URL is missing for SePay redirect URLs.");
  }

  const params = new URLSearchParams({
    provider: "sepay",
    result: String(status ?? "pending").trim().toLowerCase(),
    orderId: String(orderId ?? "").trim(),
  });

  return `${clientUrl}/#/payment/result?${params.toString()}`;
}

export function buildSePayCheckoutForm(order) {
  const { merchantId, secretKey, checkoutUrl, currency } = getSePayConfig();
  const orderId = String(order?.id ?? "").trim();
  const orderInvoiceNumber = String(order?.paymentInvoiceNumber ?? "").trim();

  if (!orderId || !orderInvoiceNumber) {
    throw new ApiError(400, "Order is missing SePay payment metadata.");
  }

  const fields = {
    order_amount: String(Math.max(0, Math.round(Number(order?.total ?? 0)))),
    merchant: merchantId,
    currency,
    operation: "PURCHASE",
    order_description:
      String(order?.paymentCode ?? "").trim() || `Thanh toan don hang ${orderId}`,
    order_invoice_number: orderInvoiceNumber,
    customer_id: String(order?.customerId ?? "").trim(),
    success_url: buildSePayReturnUrl("success", orderId),
    error_url: buildSePayReturnUrl("error", orderId),
    cancel_url: buildSePayReturnUrl("cancel", orderId),
  };

  fields.signature = signSePayFields(fields, secretKey);

  return {
    actionUrl: checkoutUrl,
    method: "POST",
    fields,
  };
}

export function getSePayIpnSecret() {
  const secret = String(env.sepayIpnSecret || env.sepaySecretKey || "").trim();

  if (!secret) {
    throw new ApiError(
      500,
      "SePay IPN secret is missing. Please provide SECRET KEY or IPN SECRET.",
    );
  }

  return secret;
}

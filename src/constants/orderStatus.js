export const ORDER_STATUS = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  PROCESSING: "processing",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

export const PAYMENT_METHODS = {
  COD: "cod",
  SEPAY: "sepay",
  CARD: "card",
};

export const PAYMENT_PROVIDERS = {
  MANUAL: "manual",
  SEPAY: "sepay",
};

export const PAYMENT_STATUS = {
  UNPAID: "unpaid",
  PENDING: "pending",
  PAID: "paid",
  FAILED: "failed",
  EXPIRED: "expired",
  CANCELLED: "cancelled",
};

export const ORDER_STATUS_VALUES = Object.values(ORDER_STATUS);
export const PAYMENT_METHOD_VALUES = Object.values(PAYMENT_METHODS);
export const PAYMENT_PROVIDER_VALUES = Object.values(PAYMENT_PROVIDERS);
export const PAYMENT_STATUS_VALUES = Object.values(PAYMENT_STATUS);

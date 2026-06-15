export const ORDER_STATUS = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  PROCESSING: "processing",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

export const PAYMENT_METHODS = {
  COD: "cod",
  CARD: "card",
};

export const PAYMENT_STATUS = {
  PENDING: "pending",
  PROCESSING: "processing",
  PAID: "paid",
  FAILED: "failed",
  REFUNDED: "refunded",
};

export const PAYMENT_PROVIDERS = {
  COD: "cod",
  MOCK_GATEWAY: "mock_gateway",
};

export const ORDER_STATUS_VALUES = Object.values(ORDER_STATUS);
export const PAYMENT_METHOD_VALUES = Object.values(PAYMENT_METHODS);
export const PAYMENT_STATUS_VALUES = Object.values(PAYMENT_STATUS);
export const PAYMENT_PROVIDER_VALUES = Object.values(PAYMENT_PROVIDERS);

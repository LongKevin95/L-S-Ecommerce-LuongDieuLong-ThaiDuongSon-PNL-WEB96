import { ORDER_STATUS } from "../constants/orderStatus.js";

function normalizeActor(actor = "system") {
  return String(actor ?? "system").trim().toLowerCase() || "system";
}

export function createInitialStatusHistory(
  status = ORDER_STATUS.PENDING,
  actor = "customer",
  at = new Date(),
) {
  return [
    {
      fromStatus: null,
      toStatus: status,
      by: normalizeActor(actor),
      at,
    },
  ];
}

export function appendStatusHistory(
  order,
  nextStatus,
  actor = "system",
  at = new Date(),
) {
  const normalizedNextStatus = String(nextStatus ?? "").trim().toLowerCase();

  if (!normalizedNextStatus) {
    return Array.isArray(order?.statusHistory) ? order.statusHistory : [];
  }

  const currentStatus = String(order?.status ?? "").trim().toLowerCase();
  const history = Array.isArray(order?.statusHistory)
    ? [...order.statusHistory]
    : [];

  if (currentStatus === normalizedNextStatus) {
    return history;
  }

  history.push({
    fromStatus: currentStatus || null,
    toStatus: normalizedNextStatus,
    by: normalizeActor(actor),
    at,
  });

  return history;
}

export function buildCancellationPayload(
  reason,
  by = "customer",
  at = new Date(),
) {
  return {
    by: normalizeActor(by),
    reason: String(reason ?? "").trim(),
    at,
  };
}

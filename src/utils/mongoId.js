import mongoose from "mongoose";

import { ApiError } from "./ApiError.js";

export function ensureValidObjectId(id, label = "Resource id") {
  const normalizedId = String(id ?? "").trim();

  if (!mongoose.isValidObjectId(normalizedId)) {
    throw new ApiError(400, `${label} is invalid.`);
  }

  return normalizedId;
}

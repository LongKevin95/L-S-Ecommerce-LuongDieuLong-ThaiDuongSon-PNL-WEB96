import mongoose from "mongoose";

import { slugify } from "./slugify.js";

export function buildUserShopSnapshot(shop) {
  if (!shop) {
    return null;
  }

  return {
    id: String(shop.id ?? shop._id ?? ""),
    name: String(shop.name ?? "").trim(),
    slug: String(shop.slug ?? "").trim(),
  };
}

export function resolvePreferredShopObjectId(preferredId = "") {
  const normalizedPreferredId = String(preferredId ?? "").trim();

  if (!normalizedPreferredId || !mongoose.isValidObjectId(normalizedPreferredId)) {
    return null;
  }

  return new mongoose.Types.ObjectId(normalizedPreferredId);
}

export function buildShopSlug(name, fallback = "") {
  return slugify(String(name ?? "").trim() || String(fallback ?? "").trim());
}

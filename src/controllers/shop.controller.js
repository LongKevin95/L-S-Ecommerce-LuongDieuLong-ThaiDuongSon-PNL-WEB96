import Shop, { SHOP_STATUS, SHOP_STATUS_VALUES } from "../models/Shop.js";
import Product from "../models/Product.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ensureValidObjectId } from "../utils/mongoId.js";
import {
  buildShopSlug,
  buildUserShopSnapshot,
  resolvePreferredShopObjectId,
} from "../utils/shop.js";

function normalizeShopAddress(address = {}) {
  return {
    addressLine1: String(address?.addressLine1 ?? address?.address ?? "").trim(),
    city: String(address?.city ?? "").trim(),
    state: String(address?.state ?? "").trim(),
    zipCode: String(address?.zipCode ?? "").trim(),
    country: String(address?.country ?? "").trim(),
  };
}

function buildShopPayload(body = {}) {
  const payload = {};

  if (Object.prototype.hasOwnProperty.call(body, "name")) {
    const name = String(body.name ?? "").trim();

    if (!name) {
      throw new ApiError(400, "Shop name is required.");
    }

    payload.name = name;
    payload.slug = buildShopSlug(name);
  }

  if (Object.prototype.hasOwnProperty.call(body, "description")) {
    payload.description = String(body.description ?? "").trim();
  }

  if (Object.prototype.hasOwnProperty.call(body, "logo")) {
    payload.logo = String(body.logo ?? "").trim();
  }

  if (Object.prototype.hasOwnProperty.call(body, "banner")) {
    payload.banner = String(body.banner ?? "").trim();
  }

  if (Object.prototype.hasOwnProperty.call(body, "contactEmail")) {
    payload.contactEmail = String(body.contactEmail ?? "")
      .trim()
      .toLowerCase();
  }

  if (Object.prototype.hasOwnProperty.call(body, "phone")) {
    payload.phone = String(body.phone ?? "").trim();
  }

  if (Object.prototype.hasOwnProperty.call(body, "status")) {
    const status = String(body.status ?? "")
      .trim()
      .toLowerCase();

    if (!SHOP_STATUS_VALUES.includes(status)) {
      throw new ApiError(400, "Shop status is invalid.");
    }

    payload.status = status;
  }

  if (Object.prototype.hasOwnProperty.call(body, "address")) {
    payload.address = normalizeShopAddress(body.address);
  }

  return payload;
}

async function syncUserShopSnapshot(user, shop) {
  const nextSnapshot = buildUserShopSnapshot(shop);
  const currentSnapshot = buildUserShopSnapshot(user?.shop);

  if (JSON.stringify(currentSnapshot) === JSON.stringify(nextSnapshot)) {
    return;
  }

  user.shop = nextSnapshot;
  await user.save();
}

async function syncVendorProductsShopSnapshot(ownerId, shop) {
  await Product.updateMany(
    { vendorId: ownerId },
    {
      $set: {
        shopId: shop.id,
        shopName: shop.name,
      },
    },
  );
}

async function findMyShop(user) {
  const snapshotShopId = String(user?.shop?.id ?? "").trim();

  if (snapshotShopId) {
    const shopBySnapshotId = await Shop.findById(snapshotShopId);

    if (shopBySnapshotId && String(shopBySnapshotId.ownerId) === String(user.id)) {
      return shopBySnapshotId;
    }
  }

  return Shop.findOne({ ownerId: String(user.id) });
}

export const listShops = asyncHandler(async (req, res) => {
  const search = String(req.query?.search ?? "").trim();
  const filters = {
    status: SHOP_STATUS.ACTIVE,
  };

  if (search) {
    filters.$or = [
      { name: { $regex: search, $options: "i" } },
      { slug: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  const shops = await Shop.find(filters).sort({ createdAt: -1 });
  res.json(shops);
});

export const getShopById = asyncHandler(async (req, res) => {
  const shopId = ensureValidObjectId(req.params?.id, "Shop id");
  const shop = await Shop.findById(shopId);

  if (!shop || shop.status !== SHOP_STATUS.ACTIVE) {
    throw new ApiError(404, "Shop was not found.");
  }

  res.json(shop);
});

export const getMyShop = asyncHandler(async (req, res) => {
  const shop = await findMyShop(req.user);

  if (!shop) {
    return res.json(null);
  }

  await syncUserShopSnapshot(req.user, shop);
  return res.json(shop);
});

export const upsertMyShop = asyncHandler(async (req, res) => {
  const payload = buildShopPayload(req.body);
  const existingShop = await findMyShop(req.user);

  if (!existingShop && !payload.name) {
    throw new ApiError(400, "Shop name is required to create a shop.");
  }

  const fallbackName = String(req.user?.shop?.name ?? "").trim();
  const fallbackSlug = buildShopSlug(fallbackName || req.user?.name || "shop");
  let shop = existingShop;

  if (!shop) {
    const preferredObjectId = resolvePreferredShopObjectId(req.user?.shop?.id);
    shop = await Shop.create({
      ...(preferredObjectId ? { _id: preferredObjectId } : {}),
      name: payload.name,
      slug: payload.slug || fallbackSlug,
      ownerId: String(req.user.id),
      description: payload.description ?? "",
      logo: payload.logo ?? "",
      banner: payload.banner ?? "",
      contactEmail: payload.contactEmail ?? String(req.user.email ?? "").trim().toLowerCase(),
      phone: payload.phone ?? String(req.user.phone ?? "").trim(),
      address: payload.address ?? normalizeShopAddress(),
      status: payload.status ?? SHOP_STATUS.ACTIVE,
    });
  } else {
    Object.assign(shop, payload);

    if (!shop.slug) {
      shop.slug = buildShopSlug(shop.name, req.user?.name);
    }

    if (!shop.contactEmail) {
      shop.contactEmail = String(req.user.email ?? "").trim().toLowerCase();
    }

    await shop.save();
  }

  await syncUserShopSnapshot(req.user, shop);
  await syncVendorProductsShopSnapshot(req.user.id, shop);

  res.status(existingShop ? 200 : 201).json(shop);
});

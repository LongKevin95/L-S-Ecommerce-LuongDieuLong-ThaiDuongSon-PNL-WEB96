import Shop from "../models/Shop.js";
import User from "../models/User.js";
import { USER_ROLES, USER_ROLE_VALUES } from "../constants/roles.js";
import { USER_STATUS_VALUES } from "../constants/userStatus.js";
import { destroyCloudinaryAsset, uploadImageFile } from "../utils/media.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sanitizeUser, signAccessToken } from "../utils/auth.js";
import { ensureValidObjectId } from "../utils/mongoId.js";
import { parseBooleanInput } from "../utils/request.js";
import {
  buildShopSlug,
  buildUserShopSnapshot,
  resolvePreferredShopObjectId,
} from "../utils/shop.js";

async function findOwnedShop(user) {
  const snapshotShopId = String(user?.shop?.id ?? "").trim();

  if (snapshotShopId) {
    const shopBySnapshotId = await Shop.findById(snapshotShopId);

    if (
      shopBySnapshotId &&
      String(shopBySnapshotId.ownerId) === String(user.id)
    ) {
      return shopBySnapshotId;
    }
  }

  return Shop.findOne({ ownerId: String(user.id) });
}

function normalizeVendorShopInput(body = {}) {
  const source =
    body?.shop && typeof body.shop === "object" && !Array.isArray(body.shop)
      ? body.shop
      : body;

  return {
    name: String(source?.name ?? source?.shopName ?? "").trim(),
    contactEmail: String(source?.contactEmail ?? source?.email ?? "")
      .trim()
      .toLowerCase(),
    phone: String(source?.phone ?? "").trim(),
  };
}

async function resolveAvailableShopSlug(name, fallbackName, ownerId, currentShopId) {
  const baseSlug = buildShopSlug(name, fallbackName);

  if (!baseSlug) {
    throw new ApiError(400, "Shop slug is invalid.");
  }

  const normalizedCurrentShopId = String(currentShopId ?? "").trim();
  const normalizedOwnerId = String(ownerId ?? "")
    .trim()
    .toLowerCase();
  const ownerSuffix = normalizedOwnerId.slice(-6) || "shop";
  let candidateSlug = baseSlug;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const existingShop = await Shop.findOne({ slug: candidateSlug }).select("_id");

    if (!existingShop || String(existingShop.id) === normalizedCurrentShopId) {
      return candidateSlug;
    }

    candidateSlug =
      attempt === 0
        ? `${baseSlug}-${ownerSuffix}`
        : `${baseSlug}-${ownerSuffix}-${attempt}`;
  }

  throw new ApiError(409, "Shop name is already in use.");
}

async function upsertVendorOnboardingShop(user, shopInput) {
  const existingShop = await findOwnedShop(user);
  const shopName = String(
    shopInput?.name ?? existingShop?.name ?? user?.shop?.name ?? user?.name ?? "",
  ).trim();

  if (!shopName) {
    throw new ApiError(400, "Shop name is required to create a vendor shop.");
  }

  const shopEmail =
    String(shopInput?.contactEmail ?? "").trim().toLowerCase() ||
    String(existingShop?.contactEmail ?? "").trim().toLowerCase() ||
    String(user?.email ?? "").trim().toLowerCase();
  const shopPhone =
    String(shopInput?.phone ?? "").trim() ||
    String(existingShop?.phone ?? "").trim() ||
    String(user?.phone ?? "").trim();
  const nextSlug = await resolveAvailableShopSlug(
    shopName,
    user?.name || "shop",
    user?.id,
    existingShop?.id,
  );

  if (!existingShop) {
    const preferredObjectId = resolvePreferredShopObjectId(user?.shop?.id);

    return Shop.create({
      ...(preferredObjectId ? { _id: preferredObjectId } : {}),
      name: shopName,
      slug: nextSlug,
      ownerId: String(user.id),
      contactEmail: shopEmail,
      phone: shopPhone,
    });
  }

  existingShop.name = shopName;
  existingShop.slug = nextSlug;
  existingShop.contactEmail = shopEmail;
  existingShop.phone = shopPhone;
  await existingShop.save();

  return existingShop;
}

export const updateProfile = asyncHandler(async (req, res) => {
  const user = req.user;
  const updates = {};
  const shouldRemoveAvatar = parseBooleanInput(req.body?.removeAvatar);

  if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "name")) {
    const name = String(req.body?.name ?? "").trim();

    if (!name) {
      throw new ApiError(400, "Name cannot be empty.");
    }

    updates.name = name;
  }

  if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "phone")) {
    updates.phone = String(req.body?.phone ?? "").trim();
  }

  if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "avatarUrl")) {
    updates.avatarUrl = String(req.body?.avatarUrl ?? "").trim();
  }

  if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "address")) {
    updates.address = String(req.body?.address ?? "").trim();
  }

  if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "bio")) {
    updates.bio = String(req.body?.bio ?? "").trim();
  }

  if (req.file) {
    const uploadedAvatar = await uploadImageFile(req.file, {
      folder: "ls-ecommerce/users/avatars",
    });

    if (user.avatarPublicId) {
      await destroyCloudinaryAsset(user.avatarPublicId);
    }

    updates.avatarUrl = uploadedAvatar?.url ?? "";
    updates.avatarPublicId = uploadedAvatar?.publicId ?? "";
  } else if (shouldRemoveAvatar) {
    if (user.avatarPublicId) {
      await destroyCloudinaryAsset(user.avatarPublicId);
    }

    updates.avatarUrl = "";
    updates.avatarPublicId = "";
  } else if (
    Object.prototype.hasOwnProperty.call(req.body ?? {}, "avatarUrl")
  ) {
    if (
      user.avatarPublicId &&
      String(req.body?.avatarUrl ?? "").trim() !== user.avatarUrl
    ) {
      await destroyCloudinaryAsset(user.avatarPublicId);
      updates.avatarPublicId = "";
    }
  }

  Object.assign(user, updates);
  await user.save();

  res.json(sanitizeUser(user));
});

export const listUsers = asyncHandler(async (req, res) => {
  const role = String(req.query?.role ?? "")
    .trim()
    .toLowerCase();
  const status = String(req.query?.status ?? "")
    .trim()
    .toLowerCase();
  const search = String(req.query?.search ?? "").trim();
  const filters = {};

  if (role) {
    if (!USER_ROLE_VALUES.includes(role)) {
      throw new ApiError(400, "Role filter is invalid.");
    }

    filters.roles = { $in: [role] };
  }

  if (status) {
    if (!USER_STATUS_VALUES.includes(status)) {
      throw new ApiError(400, "Status filter is invalid.");
    }

    filters.status = status;
  }

  if (search) {
    filters.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  const users = await User.find(filters).sort({ createdAt: -1 });

  res.json(users.map((user) => sanitizeUser(user)));
});

export const updateMyRole = asyncHandler(async (req, res) => {
  const user = req.user;
  const nextRole = String(req.body?.role ?? "")
    .trim()
    .toLowerCase();

  if (nextRole !== USER_ROLES.VENDOR) {
    throw new ApiError(400, "Only vendor role onboarding is supported.");
  }

  const shopInput = normalizeVendorShopInput(req.body);
  const shop = await upsertVendorOnboardingShop(user, shopInput);
  const currentRoles = Array.isArray(user.roles) ? user.roles : [];
  const nextPhone = String(shopInput?.phone ?? "").trim();
  const nextShopSnapshot = buildUserShopSnapshot(shop);
  const currentShopSnapshot = buildUserShopSnapshot(user?.shop);
  let shouldSaveUser = false;

  if (!currentRoles.includes(USER_ROLES.VENDOR)) {
    user.roles = Array.from(new Set([...currentRoles, USER_ROLES.VENDOR]));
    shouldSaveUser = true;
  }

  if (nextPhone && nextPhone !== String(user?.phone ?? "").trim()) {
    user.phone = nextPhone;
    shouldSaveUser = true;
  }

  if (
    JSON.stringify(currentShopSnapshot) !== JSON.stringify(nextShopSnapshot)
  ) {
    user.shop = nextShopSnapshot;
    shouldSaveUser = true;
  }

  if (shouldSaveUser) {
    await user.save();
  }

  const sanitizedUser = sanitizeUser(user);

  res.json({
    accessToken: signAccessToken(sanitizedUser),
    user: sanitizedUser,
  });
});

export const getUserById = asyncHandler(async (req, res) => {
  const userId = ensureValidObjectId(req.params?.id, "User id");
  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, "User was not found.");
  }

  res.json(sanitizeUser(user));
});

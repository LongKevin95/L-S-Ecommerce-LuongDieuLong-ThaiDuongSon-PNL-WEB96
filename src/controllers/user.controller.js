import User from "../models/User.js";
import { USER_ROLE_VALUES } from "../constants/roles.js";
import { USER_STATUS_VALUES } from "../constants/userStatus.js";
import { destroyCloudinaryAsset, uploadImageFile } from "../utils/media.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sanitizeUser } from "../utils/auth.js";
import { ensureValidObjectId } from "../utils/mongoId.js";
import { parseBooleanInput } from "../utils/request.js";

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

export const getUserById = asyncHandler(async (req, res) => {
  const userId = ensureValidObjectId(req.params?.id, "User id");
  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, "User was not found.");
  }

  res.json(sanitizeUser(user));
});

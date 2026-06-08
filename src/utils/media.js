import cloudinary from "../config/cloudinary.js";
import env from "../config/env.js";
import { ApiError } from "./ApiError.js";

function ensureCloudinaryConfig() {
  if (
    !env.cloudinaryCloudName ||
    !env.cloudinaryApiKey ||
    !env.cloudinaryApiSecret
  ) {
    throw new ApiError(
      500,
      "Cloudinary is not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to the server environment.",
    );
  }
}

function normalizeFolder(folder = "") {
  return String(folder ?? "")
    .trim()
    .replace(/^\/+|\/+$/g, "");
}

function buildDataUri(file) {
  const mimeType = String(file?.mimetype ?? "application/octet-stream").trim();
  const base64Content = Buffer.from(file?.buffer ?? "").toString("base64");
  return `data:${mimeType};base64,${base64Content}`;
}

export async function uploadImageFile(file, { folder } = {}) {
  if (!file) {
    return null;
  }

  ensureCloudinaryConfig();

  const response = await cloudinary.uploader.upload(buildDataUri(file), {
    folder: normalizeFolder(folder) || undefined,
    resource_type: "image",
  });

  return {
    url: String(response?.secure_url ?? response?.url ?? "").trim(),
    publicId: String(response?.public_id ?? "").trim(),
  };
}

export async function uploadManyImageFiles(files = [], { folder } = {}) {
  const uploads = await Promise.all(
    (Array.isArray(files) ? files : []).map((file) => uploadImageFile(file, { folder })),
  );

  return uploads.filter(Boolean);
}

export async function destroyCloudinaryAsset(publicId) {
  const normalizedPublicId = String(publicId ?? "").trim();

  if (!normalizedPublicId) {
    return;
  }

  if (
    !env.cloudinaryCloudName ||
    !env.cloudinaryApiKey ||
    !env.cloudinaryApiSecret
  ) {
    return;
  }

  await cloudinary.uploader.destroy(normalizedPublicId, {
    resource_type: "image",
  });
}

export async function destroyCloudinaryAssets(publicIds = []) {
  const uniquePublicIds = [...new Set(
    (Array.isArray(publicIds) ? publicIds : [])
      .map((publicId) => String(publicId ?? "").trim())
      .filter(Boolean),
  )];

  await Promise.all(uniquePublicIds.map((publicId) => destroyCloudinaryAsset(publicId)));
}

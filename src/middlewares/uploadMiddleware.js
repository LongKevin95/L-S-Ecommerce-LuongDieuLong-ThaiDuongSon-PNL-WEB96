import multer from "multer";

import { ApiError } from "../utils/ApiError.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 10,
  },
  fileFilter(_req, file, callback) {
    if (String(file?.mimetype ?? "").startsWith("image/")) {
      return callback(null, true);
    }

    return callback(new ApiError(400, "Only image files are allowed."));
  },
});

export function uploadSingleImage(fieldName) {
  return upload.single(fieldName);
}

export function uploadImageFields(fields) {
  return upload.fields(fields);
}

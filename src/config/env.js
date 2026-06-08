import dotenv from "dotenv";

dotenv.config();

function parseAllowedOrigins(rawValue) {
  return String(rawValue ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 5000),
  mongoUri: String(process.env.MONGODB_URI || "").trim(),
  jwtSecret: String(process.env.JWT_SECRET || "").trim(),
  cloudinaryCloudName: String(process.env.CLOUDINARY_CLOUD_NAME || "").trim(),
  cloudinaryApiKey: String(process.env.CLOUDINARY_API_KEY || "").trim(),
  cloudinaryApiSecret: String(process.env.CLOUDINARY_API_SECRET || "").trim(),
  clientUrl: String(process.env.CLIENT_URL || "http://localhost:5173").trim(),
  allowedOrigins: parseAllowedOrigins(
    process.env.CLIENT_URL || "http://localhost:5173",
  ),
};

export default env;

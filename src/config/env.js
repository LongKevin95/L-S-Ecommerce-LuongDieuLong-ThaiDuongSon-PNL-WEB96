import dotenv from "dotenv";

dotenv.config();

function normalizeOrigin(value) {
  return String(value ?? "")
    .trim()
    .replace(/\/+$/, "");
}

function parseAllowedOrigins(rawValue) {
  return String(rawValue ?? "")
    .split(",")
    .map((value) => normalizeOrigin(value))
    .filter(Boolean);
}

const defaultAllowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

const configuredClientOrigins = parseAllowedOrigins(process.env.CLIENT_URL);
const allowedOrigins =
  configuredClientOrigins.length > 0
    ? configuredClientOrigins
    : defaultAllowedOrigins;

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 8080),
  mongoUri: String(process.env.MONGODB_URI || "").trim(),
  jwtSecret: String(process.env.JWT_SECRET || "").trim(),
  cloudinaryCloudName: String(process.env.CLOUDINARY_CLOUD_NAME || "").trim(),
  cloudinaryApiKey: String(process.env.CLOUDINARY_API_KEY || "").trim(),
  cloudinaryApiSecret: String(process.env.CLOUDINARY_API_SECRET || "").trim(),
  clientUrl: allowedOrigins[0],
  allowedOrigins,
  sepayMerchantId: String(process.env.SEPAY_MERCHANT_ID || "").trim(),
  sepaySecretKey: String(process.env.SEPAY_SECRET_KEY || "").trim(),
  sepayIpnSecret: String(process.env.SEPAY_IPN_SECRET || "").trim(),
  sepayCurrency: String(process.env.SEPAY_CURRENCY || "VND").trim(),
  sepayCheckoutUrl: String(
    process.env.SEPAY_CHECKOUT_URL || "https://pay-sandbox.sepay.vn/v1/checkout/init",
  ).trim(),
  sepayPaymentExpiryMinutes: Number(process.env.SEPAY_PAYMENT_EXPIRY_MINUTES || 30),
};

export default env;

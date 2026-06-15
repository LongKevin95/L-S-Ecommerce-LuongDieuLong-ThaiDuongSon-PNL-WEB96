import dns from "node:dns/promises";
import mongoose from "mongoose";

import env from "./env.js";

const MONGODB_SERVER_SELECTION_TIMEOUT_MS = 8000;
const MONGODB_CONNECT_TIMEOUT_MS = 8000;
const MONGODB_DNS_TIMEOUT_MS = 5000;

function getMongoHost(mongoUri) {
  try {
    const parsedUrl = new URL(mongoUri);
    return String(parsedUrl.hostname ?? "").trim();
  } catch {
    return "";
  }
}

function isSrvMongoUri(mongoUri) {
  return String(mongoUri ?? "").trim().startsWith("mongodb+srv://");
}

async function verifyMongoDns(mongoUri) {
  const mongoHost = getMongoHost(mongoUri);

  if (!mongoHost) {
    return;
  }

  if (isSrvMongoUri(mongoUri)) {
    await dns.resolveSrv(`_mongodb._tcp.${mongoHost}`);
    return;
  }

  await dns.lookup(mongoHost);
}

async function withTimeout(task, timeoutMs, label) {
  let timerId;

  try {
    return await Promise.race([
      task,
      new Promise((_, reject) => {
        timerId = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms.`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timerId);
  }
}

function buildMongoStartupHelp(mongoUri, error) {
  const mongoHost = getMongoHost(mongoUri) || "unknown-host";
  const errorMessage = String(error?.message ?? error ?? "Unknown error");
  const normalizedMessage = errorMessage.toLowerCase();
  const hints = [];

  if (
    normalizedMessage.includes("enotfound") ||
    normalizedMessage.includes("querysrv") ||
    normalizedMessage.includes("dns")
  ) {
    hints.push(`- DNS không resolve được host MongoDB: ${mongoHost}.`);
    hints.push("- Kiểm tra lại Internet/VPN/Proxy hoặc DNS của máy.");
  }

  if (
    normalizedMessage.includes("authentication failed") ||
    normalizedMessage.includes("bad auth")
  ) {
    hints.push("- Sai username/password trong `MONGODB_URI`.");
  }

  if (
    normalizedMessage.includes("timed out") ||
    normalizedMessage.includes("econnrefused") ||
    normalizedMessage.includes("server selection")
  ) {
    hints.push("- Không thể kết nối tới MongoDB trong thời gian cho phép.");
    hints.push("- Nếu dùng MongoDB Atlas, hãy kiểm tra mục Network Access/IP Allowlist.");
  }

  if (hints.length === 0) {
    hints.push("- Kiểm tra lại `MONGODB_URI` trong file `.env`.");
    hints.push("- Nếu dùng MongoDB Atlas, hãy kiểm tra DNS, Network Access, và user database.");
  }

  hints.push(
    "- Muốn chạy local nhanh: cài MongoDB local và đổi `MONGODB_URI=mongodb://127.0.0.1:27017/final-project-ls-ecommerce`.",
  );

  return [
    "[db] Failed to connect to MongoDB.",
    `[db] Target host: ${mongoHost}`,
    `[db] Reason: ${errorMessage}`,
    "[db] What to check:",
    ...hints,
  ].join("\n");
}

export async function connectDatabase() {
  if (!env.mongoUri) {
    throw new Error(
      "MONGODB_URI is missing. Create a .env file in the backend root and add your MongoDB Atlas connection string before starting the server or running the seed script.",
    );
  }

  const mongoHost = getMongoHost(env.mongoUri) || "unknown-host";
  console.info(`[db] Connecting to MongoDB at ${mongoHost}...`);

  try {
    await withTimeout(
      verifyMongoDns(env.mongoUri),
      MONGODB_DNS_TIMEOUT_MS,
      "MongoDB DNS lookup",
    );
  } catch (error) {
    throw new Error(buildMongoStartupHelp(env.mongoUri, error), {
      cause: error,
    });
  }

  try {
    await mongoose.connect(env.mongoUri, {
      serverSelectionTimeoutMS: MONGODB_SERVER_SELECTION_TIMEOUT_MS,
      connectTimeoutMS: MONGODB_CONNECT_TIMEOUT_MS,
    });
  } catch (error) {
    throw new Error(buildMongoStartupHelp(env.mongoUri, error), {
      cause: error,
    });
  }

  console.info("[db] MongoDB connected.");
}

export function getDatabaseStatus() {
  switch (mongoose.connection.readyState) {
    case 1:
      return "connected";
    case 2:
      return "connecting";
    case 3:
      return "disconnecting";
    default:
      return "disconnected";
  }
}

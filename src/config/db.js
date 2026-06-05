import mongoose from "mongoose";

import env from "./env.js";

export async function connectDatabase() {
  if (!env.mongoUri) {
    throw new Error(
      "MONGODB_URI is missing. Create a .env file in the backend root and add your MongoDB Atlas connection string before starting the server or running the seed script.",
    );
  }

  await mongoose.connect(env.mongoUri);
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

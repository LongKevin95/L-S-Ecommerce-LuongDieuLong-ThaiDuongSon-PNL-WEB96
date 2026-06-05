import jwt from "jsonwebtoken";

import env from "../config/env.js";
import { ApiError } from "./ApiError.js";

export function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  const plainUser = typeof user.toJSON === "function" ? user.toJSON() : { ...user };
  delete plainUser.password;
  return plainUser;
}

export function signAccessToken(user) {
  if (!env.jwtSecret) {
    throw new ApiError(500, "JWT_SECRET is missing on the server.");
  }

  return jwt.sign(
    {
      sub: user.id,
      roles: Array.isArray(user.roles) ? user.roles : [],
      email: user.email,
    },
    env.jwtSecret,
    {
      expiresIn: "7d",
    },
  );
}

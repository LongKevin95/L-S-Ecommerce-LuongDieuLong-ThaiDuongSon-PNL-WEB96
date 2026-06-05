import jwt from "jsonwebtoken";

import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import env from "../config/env.js";
import User from "../models/User.js";
import { USER_STATUS } from "../constants/userStatus.js";

export const protect = asyncHandler(async (req, _res, next) => {
  const authorization = String(req.headers.authorization || "").trim();

  if (!authorization.startsWith("Bearer ")) {
    throw new ApiError(401, "Authorization token is required.");
  }

  if (!env.jwtSecret) {
    throw new ApiError(500, "JWT_SECRET is missing on the server.");
  }

  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  const decoded = jwt.verify(token, env.jwtSecret);
  const user = await User.findById(decoded?.sub);

  if (!user) {
    throw new ApiError(401, "Authenticated user was not found.");
  }

  if (String(user.status ?? "").toLowerCase() !== USER_STATUS.ACTIVE) {
    throw new ApiError(
      403,
      "Your account is not allowed to access this resource.",
    );
  }

  req.auth = decoded;
  req.user = user;
  next();
});

export function authorize(allowedRoles = []) {
  return (req, _res, next) => {
    const userRoles = Array.isArray(req.user?.roles)
      ? req.user.roles
      : Array.isArray(req.auth?.roles)
        ? req.auth.roles
        : [];
    const isAllowed = allowedRoles.some((role) => userRoles.includes(role));

    if (!isAllowed) {
      return next(
        new ApiError(
          403,
          "You do not have permission to access this resource.",
        ),
      );
    }

    return next();
  };
}

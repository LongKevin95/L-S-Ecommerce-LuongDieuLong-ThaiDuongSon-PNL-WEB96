import bcrypt from "bcryptjs";

import User from "../models/User.js";
import { USER_ROLES } from "../constants/roles.js";
import { USER_STATUS } from "../constants/userStatus.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sanitizeUser, signAccessToken } from "../utils/auth.js";

export const login = asyncHandler(async (req, res) => {
  const email = String(req.body?.email ?? "")
    .trim()
    .toLowerCase();
  const password = String(req.body?.password ?? "");

  if (!email || !password) {
    throw new ApiError(400, "Email and password are required.");
  }

  const user = await User.findOne({ email }).select("+password");

  if (!user) {
    throw new ApiError(401, "Invalid email or password.");
  }

  const isPasswordMatched = await bcrypt.compare(password, user.password);

  if (!isPasswordMatched) {
    throw new ApiError(401, "Invalid email or password.");
  }

  if (String(user.status ?? "").toLowerCase() !== USER_STATUS.ACTIVE) {
    throw new ApiError(403, "Your account is not allowed to log in.");
  }

  const publicUser = sanitizeUser(user);

  res.json({
    accessToken: signAccessToken(publicUser),
    user: publicUser,
  });
});

export const register = asyncHandler(async (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  const email = String(req.body?.email ?? "")
    .trim()
    .toLowerCase();
  const password = String(req.body?.password ?? "");

  if (!name || !email || !password) {
    throw new ApiError(400, "Name, email, and password are required.");
  }

  if (password.length < 6) {
    throw new ApiError(400, "Password must be at least 6 characters long.");
  }

  const existingUser = await User.findOne({ email });

  if (existingUser) {
    throw new ApiError(409, "This email is already registered.");
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    roles: [USER_ROLES.CUSTOMER],
    status: USER_STATUS.ACTIVE,
  });

  const publicUser = sanitizeUser(user);

  res.status(201).json({
    accessToken: signAccessToken(publicUser),
    user: publicUser,
  });
});

export const getMe = asyncHandler(async (req, res) => {
  res.json({
    user: sanitizeUser(req.user),
  });
});

import mongoose from "mongoose";

import { USER_ROLE_VALUES } from "../constants/roles.js";
import { USER_STATUS, USER_STATUS_VALUES } from "../constants/userStatus.js";
import { applySchemaTransform } from "../utils/schemaTransform.js";

const shopSchema = new mongoose.Schema(
  {
    id: { type: String, trim: true, default: "" },
    name: { type: String, trim: true, default: "" },
    slug: { type: String, trim: true, default: "" },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },
    roles: {
      type: [String],
      enum: USER_ROLE_VALUES,
      default: [],
    },
    status: {
      type: String,
      enum: USER_STATUS_VALUES,
      default: USER_STATUS.ACTIVE,
    },
    avatarUrl: {
      type: String,
      trim: true,
      default: "",
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    address: {
      type: String,
      trim: true,
      default: "",
    },
    bio: {
      type: String,
      trim: true,
      default: "",
    },
    shop: {
      type: shopSchema,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

applySchemaTransform(userSchema);

const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;

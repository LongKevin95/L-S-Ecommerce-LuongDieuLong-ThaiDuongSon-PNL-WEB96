import mongoose from "mongoose";

import { applySchemaTransform } from "../utils/schemaTransform.js";

export const SHOP_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
};

export const SHOP_STATUS_VALUES = Object.values(SHOP_STATUS);

const shopAddressSchema = new mongoose.Schema(
  {
    addressLine1: {
      type: String,
      trim: true,
      default: "",
    },
    city: {
      type: String,
      trim: true,
      default: "",
    },
    state: {
      type: String,
      trim: true,
      default: "",
    },
    zipCode: {
      type: String,
      trim: true,
      default: "",
    },
    country: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { _id: false },
);

const shopSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    ownerId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    logo: {
      type: String,
      trim: true,
      default: "",
    },
    logoPublicId: {
      type: String,
      trim: true,
      default: "",
    },
    banner: {
      type: String,
      trim: true,
      default: "",
    },
    bannerPublicId: {
      type: String,
      trim: true,
      default: "",
    },
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    address: {
      type: shopAddressSchema,
      default: () => ({}),
    },
    status: {
      type: String,
      enum: SHOP_STATUS_VALUES,
      default: SHOP_STATUS.ACTIVE,
    },
  },
  {
    timestamps: true,
  },
);

applySchemaTransform(shopSchema);

const Shop = mongoose.models.Shop || mongoose.model("Shop", shopSchema);

export default Shop;

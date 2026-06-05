import mongoose from "mongoose";

import { PRODUCT_STATUS, PRODUCT_STATUS_VALUES } from "../constants/productStatus.js";
import { applySchemaTransform } from "../utils/schemaTransform.js";

const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    oldPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    stock: {
      type: Number,
      default: 0,
      min: 0,
    },
    thumbnail: {
      type: String,
      trim: true,
      default: "",
    },
    gallery: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: PRODUCT_STATUS_VALUES,
      default: PRODUCT_STATUS.DRAFT,
    },
    vendorId: {
      type: String,
      required: true,
      trim: true,
    },
    shopId: {
      type: String,
      trim: true,
      default: "",
    },
    shopName: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

applySchemaTransform(productSchema);

const Product = mongoose.models.Product || mongoose.model("Product", productSchema);

export default Product;

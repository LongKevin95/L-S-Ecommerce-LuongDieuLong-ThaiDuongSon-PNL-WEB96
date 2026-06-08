import mongoose from "mongoose";

import { applySchemaTransform } from "../utils/schemaTransform.js";

const variantSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
      index: true,
    },
    sku: {
      type: String,
      trim: true,
      default: "",
    },
    title: {
      type: String,
      trim: true,
      default: "",
    },
    price: {
      type: Number,
      default: 0,
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
    image: {
      type: String,
      trim: true,
      default: "",
    },
    optionValues: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    attributes: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

variantSchema.index({ productId: 1, isDefault: -1, sortOrder: 1, createdAt: 1 });

applySchemaTransform(variantSchema);

const Variant = mongoose.models.Variant || mongoose.model("Variant", variantSchema);

export default Variant;

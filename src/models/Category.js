import mongoose from "mongoose";

import { applySchemaTransform } from "../utils/schemaTransform.js";

const categoryFieldSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    inputType: {
      type: String,
      trim: true,
      default: "text",
    },
  },
  {
    _id: false,
  },
);

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    productAttributeFields: {
      type: [categoryFieldSchema],
      default: [],
    },
    variantOptionFields: {
      type: [categoryFieldSchema],
      default: [],
    },
    variantAttributeFields: {
      type: [categoryFieldSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

applySchemaTransform(categorySchema);

const Category =
  mongoose.models.Category || mongoose.model("Category", categorySchema);

export default Category;

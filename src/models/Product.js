import mongoose from "mongoose";

import {
  PRODUCT_STATUS,
  PRODUCT_STATUS_VALUES,
} from "../constants/productStatus.js";
import { applySchemaTransform } from "../utils/schemaTransform.js";

const productReviewReplySchema = new mongoose.Schema(
  {
    text: {
      type: String,
      trim: true,
      default: "",
    },
    at: {
      type: Date,
      default: null,
    },
  },
  { _id: false },
);

const productReviewSchema = new mongoose.Schema(
  {
    customerId: {
      type: String,
      trim: true,
      default: "",
    },
    customerEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    customerName: {
      type: String,
      trim: true,
      default: "Customer",
    },
    comment: {
      type: String,
      trim: true,
      default: "",
    },
    stars: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    vendorReply: {
      type: productReviewReplySchema,
      default: null,
    },
  },
  { _id: false },
);

const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
      default: "",
    },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    category: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    categoryName: {
      type: String,
      trim: true,
      default: "",
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    attributes: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    colors: {
      type: [String],
      default: [],
    },
    sizes: {
      type: [String],
      default: [],
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
    thumbnailPublicId: {
      type: String,
      trim: true,
      default: "",
    },
    gallery: {
      type: [String],
      default: [],
    },
    galleryPublicIds: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: PRODUCT_STATUS_VALUES,
      default: PRODUCT_STATUS.DRAFT,
    },
    reason: {
      type: String,
      trim: true,
      default: "",
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
    defaultVariantId: {
      type: String,
      trim: true,
      default: "",
    },
    variantCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    reviewsData: {
      type: [productReviewSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

productSchema.index({ status: 1, category: 1, createdAt: -1 });
productSchema.index({ vendorId: 1, createdAt: -1 });

applySchemaTransform(productSchema);

const Product =
  mongoose.models.Product || mongoose.model("Product", productSchema);

export default Product;

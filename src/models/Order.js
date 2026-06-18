import mongoose from "mongoose";

import {
  ORDER_STATUS,
  ORDER_STATUS_VALUES,
  PAYMENT_PROVIDERS,
  PAYMENT_PROVIDER_VALUES,
  PAYMENT_STATUS,
  PAYMENT_STATUS_VALUES,
  PAYMENT_METHOD_VALUES,
} from "../constants/orderStatus.js";
import { applySchemaTransform } from "../utils/schemaTransform.js";

const shippingAddressSchema = new mongoose.Schema(
  {
    fullName: { type: String, trim: true, required: true },
    phone: { type: String, trim: true, required: true },
    address: { type: String, trim: true, required: true },
    city: { type: String, trim: true, required: true },
    state: { type: String, trim: true, default: "" },
    zipCode: { type: String, trim: true, default: "" },
    country: { type: String, trim: true, required: true },
  },
  { _id: false },
);

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: String, trim: true, required: true },
    variantId: { type: String, trim: true, default: "" },
    variantLabel: { type: String, trim: true, default: "" },
    title: { type: String, trim: true, default: "Product" },
    image: { type: String, trim: true, default: "/favicon.svg" },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, default: 0, min: 0 },
    vendorEmail: { type: String, trim: true, default: "" },
    shopName: { type: String, trim: true, default: "Shop" },
    sku: { type: String, trim: true, default: "" },
    color: { type: String, trim: true, default: "Default" },
    size: { type: String, trim: true, default: "Default" },
  },
  { _id: false },
);

const paymentMetaSchema = new mongoose.Schema(
  {
    sepayOrderId: { type: String, trim: true, default: "" },
    sepayTransactionId: { type: String, trim: true, default: "" },
    providerTransactionId: { type: String, trim: true, default: "" },
    providerStatus: { type: String, trim: true, default: "" },
    gateway: { type: String, trim: true, default: "" },
    referenceCode: { type: String, trim: true, default: "" },
    paymentChannel: { type: String, trim: true, default: "" },
    cardBrand: { type: String, trim: true, default: "" },
    cardNumberMasked: { type: String, trim: true, default: "" },
    lastWebhookAt: { type: Date, default: null },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    customerId: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ORDER_STATUS_VALUES,
      default: ORDER_STATUS.PENDING,
    },
    paymentMethod: {
      type: String,
      enum: PAYMENT_METHOD_VALUES,
      default: "cod",
    },
    paymentProvider: {
      type: String,
      enum: PAYMENT_PROVIDER_VALUES,
      default: PAYMENT_PROVIDERS.MANUAL,
    },
    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUS_VALUES,
      default: PAYMENT_STATUS.UNPAID,
    },
    paymentCode: {
      type: String,
      trim: true,
      default: "",
    },
    paymentInvoiceNumber: {
      type: String,
      trim: true,
      default: "",
    },
    paymentExpiresAt: {
      type: Date,
      default: null,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    paymentMeta: {
      type: paymentMetaSchema,
      default: () => ({}),
    },
    shippingAddress: {
      type: shippingAddressSchema,
      required: true,
    },
    items: {
      type: [orderItemSchema],
      default: [],
    },
    total: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  },
);

orderSchema.index(
  { paymentInvoiceNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { paymentInvoiceNumber: { $type: "string", $ne: "" } },
  },
);

orderSchema.index(
  { paymentCode: 1 },
  {
    unique: true,
    partialFilterExpression: { paymentCode: { $type: "string", $ne: "" } },
  },
);

applySchemaTransform(orderSchema);

const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);

export default Order;

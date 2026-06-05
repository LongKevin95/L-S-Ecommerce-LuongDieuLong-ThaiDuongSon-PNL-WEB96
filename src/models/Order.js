import mongoose from "mongoose";

import {
  ORDER_STATUS,
  ORDER_STATUS_VALUES,
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
    quantity: { type: Number, required: true, min: 1 },
    color: { type: String, trim: true, default: "Default" },
    size: { type: String, trim: true, default: "Default" },
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

applySchemaTransform(orderSchema);

const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);

export default Order;

import mongoose from "mongoose";

import { applySchemaTransform } from "../utils/schemaTransform.js";

const paymentTransactionSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      required: true,
      trim: true,
      default: "sepay",
    },
    orderId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    paymentInvoiceNumber: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    providerTransactionId: {
      type: String,
      trim: true,
      default: "",
    },
    providerOrderId: {
      type: String,
      trim: true,
      default: "",
    },
    referenceCode: {
      type: String,
      trim: true,
      default: "",
    },
    amount: {
      type: Number,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      trim: true,
      default: "VND",
    },
    status: {
      type: String,
      trim: true,
      default: "received",
    },
    paymentChannel: {
      type: String,
      trim: true,
      default: "",
    },
    rawPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

paymentTransactionSchema.index(
  { provider: 1, providerTransactionId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      providerTransactionId: { $type: "string", $ne: "" },
    },
  },
);

applySchemaTransform(paymentTransactionSchema);

const PaymentTransaction =
  mongoose.models.PaymentTransaction ||
  mongoose.model("PaymentTransaction", paymentTransactionSchema);

export default PaymentTransaction;

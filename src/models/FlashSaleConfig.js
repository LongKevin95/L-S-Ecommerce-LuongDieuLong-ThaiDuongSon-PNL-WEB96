import mongoose from "mongoose";

import { applySchemaTransform } from "../utils/schemaTransform.js";

const flashSaleConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      trim: true,
      default: "global",
      unique: true,
    },
    isEnabled: {
      type: Boolean,
      default: false,
    },
    currentCampaignId: {
      type: String,
      trim: true,
      default: "",
    },
    startsAt: {
      type: Date,
      default: null,
    },
    endsAt: {
      type: Date,
      default: null,
    },
    updatedBy: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

applySchemaTransform(flashSaleConfigSchema);

const FlashSaleConfig =
  mongoose.models.FlashSaleConfig ||
  mongoose.model("FlashSaleConfig", flashSaleConfigSchema);

export default FlashSaleConfig;

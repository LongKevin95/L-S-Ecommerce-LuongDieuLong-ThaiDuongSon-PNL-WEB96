import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  createNextCampaignId,
  getFlashSaleConfig,
  getFlashSaleState,
} from "../utils/flashSale.js";

function normalizeDate(value) {
  const nextDate = new Date(value);
  return Number.isNaN(nextDate.getTime()) ? null : nextDate;
}

export const getPublicFlashSale = asyncHandler(async (_req, res) => {
  res.json(await getFlashSaleState());
});

export const updateFlashSaleConfig = asyncHandler(async (req, res) => {
  const config = await getFlashSaleConfig();
  const nextEnabled = Boolean(req.body?.isEnabled);

  if (!nextEnabled) {
    config.isEnabled = false;
    await config.save();
    res.json(await getFlashSaleState());
    return;
  }

  const startsAt = normalizeDate(req.body?.startsAt);
  const endsAt = normalizeDate(req.body?.endsAt);

  if (!startsAt || !endsAt) {
    throw new ApiError(400, "Flash sale start and end time are required.");
  }

  if (endsAt.getTime() <= startsAt.getTime()) {
    throw new ApiError(400, "Flash sale end time must be after start time.");
  }

  if (endsAt.getTime() <= Date.now()) {
    throw new ApiError(400, "Flash sale end time must be in the future.");
  }

  config.isEnabled = true;
  config.currentCampaignId = createNextCampaignId();
  config.startsAt = startsAt;
  config.endsAt = endsAt;
  config.updatedBy = String(req.user?.email ?? req.user?.id ?? "").trim();
  await config.save();

  res.json(await getFlashSaleState());
});

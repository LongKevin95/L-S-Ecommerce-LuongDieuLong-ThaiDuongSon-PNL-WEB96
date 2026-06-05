import { getDatabaseStatus } from "../config/db.js";
import env from "../config/env.js";

export function getHealth(_req, res) {
  res.json({
    message: "Backend is healthy.",
    environment: env.nodeEnv,
    database: getDatabaseStatus(),
    timestamp: new Date().toISOString(),
  });
}

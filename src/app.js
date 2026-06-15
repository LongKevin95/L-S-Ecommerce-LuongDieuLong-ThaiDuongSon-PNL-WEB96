import cors from "cors";
import express from "express";
import morgan from "morgan";

import env from "./config/env.js";
import apiRouter from "./routes/index.js";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler.js";

const app = express();
const LOCAL_DEV_ORIGIN_PATTERN = /^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/i;

app.use(
  cors({
    origin(origin, callback) {
      const normalizedOrigin = String(origin ?? "").trim();
      const isKnownOrigin = env.allowedOrigins.includes(normalizedOrigin);
      const isLocalDevOrigin =
        env.nodeEnv !== "production" &&
        LOCAL_DEV_ORIGIN_PATTERN.test(normalizedOrigin);

      if (
        !origin ||
        env.allowedOrigins.length === 0 ||
        isKnownOrigin ||
        isLocalDevOrigin
      ) {
        return callback(null, true);
      }

      return callback(
        new Error(`CORS origin is not allowed: ${normalizedOrigin || "unknown"}`),
      );
    },
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));

app.get("/", (_req, res) => {
  res.json({
    message: "L&S Ecommerce backend skeleton is running.",
  });
});

app.use(apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;

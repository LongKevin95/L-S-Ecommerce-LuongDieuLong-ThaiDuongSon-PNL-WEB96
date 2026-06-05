import cors from "cors";
import express from "express";
import morgan from "morgan";

import env from "./config/env.js";
import apiRouter from "./routes/index.js";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler.js";

const app = express();

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.allowedOrigins.length === 0 || env.allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("CORS origin is not allowed."));
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

import cors from "cors";
import express from "express";
import morgan from "morgan";

import env from "./config/env.js";
import apiRouter from "./routes/index.js";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler.js";

const app = express();

const corsOptions = {
  origin(_origin, callback) {
    return callback(null, true);
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-Secret-Key"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
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

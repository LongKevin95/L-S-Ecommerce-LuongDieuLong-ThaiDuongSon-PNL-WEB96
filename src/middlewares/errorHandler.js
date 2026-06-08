export function notFoundHandler(req, res) {
  res.status(404).json({
    message: `Route ${req.method} ${req.originalUrl} was not found.`,
  });
}

export function errorHandler(error, _req, res, _next) {
  let statusCode = Number(error?.statusCode || 500);
  let message = error?.message || "Internal server error.";

  if (
    error?.name === "JsonWebTokenError" ||
    error?.name === "TokenExpiredError"
  ) {
    statusCode = 401;
    message = "Authorization token is invalid or expired.";
  }

  if (error?.name === "CastError") {
    statusCode = 400;
    message = `${error?.path || "Resource"} is invalid.`;
  }

  if (error?.name === "ValidationError") {
    statusCode = 400;
    message =
      Object.values(error.errors || {})[0]?.message || "Validation failed.";
  }

  if (error?.name === "MulterError") {
    statusCode = 400;
    message = error?.message || "Uploaded file is invalid.";
  }

  if (error?.code === 11000) {
    statusCode = 409;
    message = "A unique field already exists.";
  }

  if (process.env.NODE_ENV !== "test") {
    console.error(error);
  }

  res.status(statusCode).json({
    message,
  });
}

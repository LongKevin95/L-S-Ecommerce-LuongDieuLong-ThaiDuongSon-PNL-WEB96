export function notImplemented(res, featureName) {
  return res.status(501).json({
    message: `${featureName} is not implemented yet.`,
  });
}

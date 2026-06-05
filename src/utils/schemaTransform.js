export function applySchemaTransform(schema) {
  schema.set("toJSON", {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret) => {
      ret.id = String(ret._id);
      delete ret._id;
      return ret;
    },
  });
}

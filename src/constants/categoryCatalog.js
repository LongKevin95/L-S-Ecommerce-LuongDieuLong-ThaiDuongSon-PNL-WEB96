export const DEFAULT_CATEGORY_DEFINITIONS = [
  {
    slug: "fashion-nam",
    name: "Men Fashion",
    productAttributeFields: [
      { key: "brand", label: "Brand", inputType: "text" },
      { key: "material", label: "Material", inputType: "text" },
    ],
    variantOptionFields: [
      { key: "color", label: "Color", inputType: "text" },
      { key: "size", label: "Size", inputType: "text" },
    ],
    variantAttributeFields: [],
  },
  {
    slug: "fashion-nu",
    name: "Women Fashion",
    productAttributeFields: [
      { key: "brand", label: "Brand", inputType: "text" },
      { key: "material", label: "Material", inputType: "text" },
    ],
    variantOptionFields: [
      { key: "color", label: "Color", inputType: "text" },
      { key: "size", label: "Size", inputType: "text" },
    ],
    variantAttributeFields: [],
  },
  {
    slug: "do-gia-dung",
    name: "Furniture",
    productAttributeFields: [
      { key: "brand", label: "Brand", inputType: "text" },
    ],
    variantOptionFields: [
      { key: "color", label: "Color", inputType: "text" },
      { key: "sizeValues", label: "Size values", inputType: "text" },
      { key: "material", label: "Material", inputType: "text" },
    ],
    variantAttributeFields: [],
  },
  {
    slug: "dien-tu",
    name: "Electronics",
    productAttributeFields: [
      { key: "brand", label: "Brand", inputType: "text" },
      { key: "model", label: "Model", inputType: "text" },
      {
        key: "warrantyMonths",
        label: "Warranty (months)",
        inputType: "number",
      },
    ],
    variantOptionFields: [
      { key: "storage", label: "Storage", inputType: "text" },
      { key: "color", label: "Color", inputType: "text" },
    ],
    variantAttributeFields: [],
  },
  {
    slug: "thuc-pham",
    name: "Food",
    productAttributeFields: [
      { key: "brand", label: "Brand", inputType: "text" },
      { key: "expiryDate", label: "Expiry date", inputType: "date" },
      { key: "weight", label: "Weight", inputType: "text" },
    ],
    variantOptionFields: [
      { key: "packSize", label: "Pack size", inputType: "text" },
    ],
    variantAttributeFields: [],
  },
  {
    slug: "others",
    name: "Others",
    productAttributeFields: [
      { key: "brand", label: "Brand", inputType: "text" },
    ],
    variantOptionFields: [
      { key: "optionName", label: "Option", inputType: "text" },
    ],
    variantAttributeFields: [],
  },
];

export function normalizeCategorySlug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("_", "-")
    .replace(/\s+/g, "-");
}

export function getDefaultCategoryDefinitionBySlug(categoryValue) {
  const normalizedSlug = normalizeCategorySlug(categoryValue);

  return (
    DEFAULT_CATEGORY_DEFINITIONS.find(
      (definition) => definition.slug === normalizedSlug,
    ) ?? DEFAULT_CATEGORY_DEFINITIONS[DEFAULT_CATEGORY_DEFINITIONS.length - 1]
  );
}

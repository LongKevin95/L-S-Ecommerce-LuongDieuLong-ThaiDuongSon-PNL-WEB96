import Category from "../models/Category.js";
import {
  getDefaultCategoryDefinitionBySlug,
  normalizeCategorySlug,
} from "../constants/categoryCatalog.js";

function toCategoryPayload(definition) {
  return {
    name: definition.name,
    slug: definition.slug,
    productAttributeFields: definition.productAttributeFields,
    variantOptionFields: definition.variantOptionFields,
    variantAttributeFields: definition.variantAttributeFields,
  };
}

export async function ensureCategoryBySlug(categoryValue) {
  const definition = getDefaultCategoryDefinitionBySlug(categoryValue);

  return Category.findOneAndUpdate(
    { slug: definition.slug },
    {
      $setOnInsert: toCategoryPayload(definition),
    },
    {
      new: true,
      upsert: true,
    },
  );
}

export function buildCategoryConfigPayload(categoryLike) {
  const definition = categoryLike?.slug
    ? {
        ...getDefaultCategoryDefinitionBySlug(categoryLike.slug),
        ...categoryLike,
      }
    : getDefaultCategoryDefinitionBySlug(categoryLike);

  return {
    id: String(categoryLike?.id ?? categoryLike?._id ?? "").trim(),
    name: String(definition?.name ?? "Others").trim(),
    slug: normalizeCategorySlug(definition?.slug),
    productAttributeFields: Array.isArray(definition?.productAttributeFields)
      ? definition.productAttributeFields
      : [],
    variantOptionFields: Array.isArray(definition?.variantOptionFields)
      ? definition.variantOptionFields
      : [],
    variantAttributeFields: Array.isArray(definition?.variantAttributeFields)
      ? definition.variantAttributeFields
      : [],
  };
}

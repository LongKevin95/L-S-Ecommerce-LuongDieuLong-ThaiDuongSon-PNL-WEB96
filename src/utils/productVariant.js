import Variant from "../models/Variant.js";
import {
  buildCategoryConfigPayload,
  ensureCategoryBySlug,
} from "./category.js";
import {
  decorateProductForCommerce,
  getFlashSaleState,
  loadSoldCountsByProductIds,
} from "./flashSale.js";

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeNumber(value, fallback = 0) {
  const nextValue = Number(value ?? fallback);

  return Number.isFinite(nextValue) && nextValue >= 0 ? nextValue : fallback;
}

function normalizeObjectValues(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value).reduce((result, [key, itemValue]) => {
    const normalizedKey = normalizeText(key);
    const normalizedValue = normalizeText(itemValue);

    if (normalizedKey && normalizedValue) {
      result[normalizedKey] = normalizedValue;
    }

    return result;
  }, {});
}

function buildVariantLabel(variant, categoryConfig) {
  const optionValues = normalizeObjectValues(variant?.optionValues);
  const optionKeys = Array.isArray(categoryConfig?.variantOptionFields)
    ? categoryConfig.variantOptionFields.map((field) => field.key)
    : [];
  const optionLabels = optionKeys
    .map((key) => optionValues[key])
    .filter(Boolean);

  if (optionLabels.length > 0) {
    return optionLabels.join(" / ");
  }

  if (normalizeText(variant?.title)) {
    return normalizeText(variant.title);
  }

  return "Default variant";
}

function serializeVariantDocument(variantDocument, categoryConfig) {
  const variant =
    typeof variantDocument?.toJSON === "function"
      ? variantDocument.toJSON()
      : variantDocument;

  return {
    ...variant,
    optionValues: normalizeObjectValues(variant?.optionValues),
    attributes: normalizeObjectValues(variant?.attributes),
    price: normalizeNumber(variant?.price),
    oldPrice: normalizeNumber(variant?.oldPrice),
    stock: normalizeNumber(variant?.stock),
    label: buildVariantLabel(variant, categoryConfig),
  };
}

export async function attachVariantsToProductList(products = []) {
  const productList = Array.isArray(products) ? products : [];

  if (productList.length === 0) {
    return [];
  }

  const productIds = productList.map((product) => product?._id).filter(Boolean);
  const normalizedProductIds = productList
    .map((product) =>
      String(product?._id ?? product?.id ?? "").trim(),
    )
    .filter(Boolean);

  const [variantDocuments, flashSaleState, soldCountsByProductId] =
    await Promise.all([
      Variant.find({
        productId: { $in: productIds },
      }).sort({ isDefault: -1, sortOrder: 1, createdAt: 1 }),
      getFlashSaleState(),
      loadSoldCountsByProductIds(normalizedProductIds),
    ]);

  const variantsByProductId = variantDocuments.reduce(
    (result, variantDocument) => {
      const productId = String(variantDocument?.productId ?? "").trim();

      if (!productId) {
        return result;
      }

      if (!result.has(productId)) {
        result.set(productId, []);
      }

      result
        .get(productId)
        .push(serializeVariantDocument(variantDocument, null));
      return result;
    },
    new Map(),
  );

  return productList.map((productDocument) => {
    const product =
      typeof productDocument?.toJSON === "function"
        ? productDocument.toJSON()
        : productDocument;
    const productId = String(productDocument?._id ?? product?.id ?? "").trim();
    const categoryConfig = buildCategoryConfigPayload(product?.category);
    const productVariants = (variantsByProductId.get(productId) ?? []).map((variant) =>
      serializeVariantDocument(variant, categoryConfig),
    );

    return decorateProductForCommerce(
      {
      ...product,
      categoryConfig,
      variants: productVariants,
      },
      flashSaleState,
      soldCountsByProductId.get(productId) ?? 0,
    );
  });
}

export async function buildProductDetailResponse(productDocument) {
  const product =
    typeof productDocument?.toJSON === "function"
      ? productDocument.toJSON()
      : productDocument;
  const [category, flashSaleState, soldCountsByProductId, variantDocuments] =
    await Promise.all([
      ensureCategoryBySlug(product?.category),
      getFlashSaleState(),
      loadSoldCountsByProductIds([
        String(productDocument?._id ?? product?._id ?? product?.id ?? "").trim(),
      ]),
      Variant.find({
        productId: productDocument?._id ?? product?._id ?? product?.id,
      }).sort({ isDefault: -1, sortOrder: 1, createdAt: 1 }),
    ]);
  const categoryConfig = buildCategoryConfigPayload(category);
  const normalizedProductId = String(
    productDocument?._id ?? product?._id ?? product?.id ?? "",
  ).trim();

  return decorateProductForCommerce(
    {
      ...product,
      categoryConfig,
      variants: variantDocuments.map((variantDocument) =>
        serializeVariantDocument(variantDocument, categoryConfig),
      ),
    },
    flashSaleState,
    soldCountsByProductId.get(normalizedProductId) ?? 0,
  );
}

export async function syncProductVariants(
  product,
  variantsInput,
  {
    category,
    fallbackPrice,
    fallbackOldPrice,
    fallbackStock,
    fallbackImage,
    fallbackColors = [],
    fallbackSizes = [],
  } = {},
) {
  const categoryConfig = buildCategoryConfigPayload(
    category ?? product?.category,
  );
  const rawVariants = Array.isArray(variantsInput) ? variantsInput : [];

  await Variant.deleteMany({ productId: product._id });

  const normalizedVariants = rawVariants
    .map((variant, index) => {
      const optionValues = normalizeObjectValues(variant?.optionValues);
      const attributes = normalizeObjectValues(variant?.attributes);
      const title = normalizeText(variant?.title);
      const sku = normalizeText(variant?.sku);
      const price = normalizeNumber(
        variant?.price,
        normalizeNumber(fallbackPrice),
      );
      const oldPrice = normalizeNumber(
        variant?.oldPrice,
        normalizeNumber(fallbackOldPrice),
      );
      const stock = normalizeNumber(
        variant?.stock,
        normalizeNumber(fallbackStock),
      );
      const image =
        normalizeText(variant?.image) || normalizeText(fallbackImage);
      const sortOrder = normalizeNumber(variant?.sortOrder, index);
      const hasMeaningfulContent =
        title ||
        sku ||
        Object.keys(optionValues).length > 0 ||
        Object.keys(attributes).length > 0 ||
        stock > 0;

      if (!hasMeaningfulContent) {
        return null;
      }

      return {
        productId: product._id,
        categoryId: category?._id ?? null,
        sku,
        title,
        price,
        oldPrice,
        stock,
        image,
        optionValues,
        attributes,
        isDefault: Boolean(variant?.isDefault),
        sortOrder,
      };
    })
    .filter(Boolean);

  const resolvedNormalizedVariants =
    normalizedVariants.length > 0
      ? (() => {
          const preferredDefaultIndex = normalizedVariants.findIndex(
            (variant) => variant.isDefault,
          );

          return normalizedVariants.map((variant, index) => ({
            ...variant,
            isDefault:
              preferredDefaultIndex >= 0
                ? index === preferredDefaultIndex
                : index === 0,
          }));
        })()
      : [];

  const variantsToInsert =
    resolvedNormalizedVariants.length > 0
      ? resolvedNormalizedVariants
      : [
          {
            productId: product._id,
            categoryId: category?._id ?? null,
            sku: "",
            title: "Default variant",
            price: normalizeNumber(
              fallbackPrice,
              normalizeNumber(product?.price),
            ),
            oldPrice: normalizeNumber(
              fallbackOldPrice,
              normalizeNumber(product?.oldPrice),
            ),
            stock: normalizeNumber(
              fallbackStock,
              normalizeNumber(product?.stock),
            ),
            image:
              normalizeText(fallbackImage) || normalizeText(product?.thumbnail),
            optionValues: {},
            attributes: {},
            isDefault: true,
            sortOrder: 0,
          },
        ];

  const insertedVariants = await Variant.insertMany(variantsToInsert);
  const serializedVariants = insertedVariants.map((variantDocument) =>
    serializeVariantDocument(variantDocument, categoryConfig),
  );
  const defaultVariant =
    serializedVariants.find((variant) => variant.isDefault) ??
    serializedVariants[0];
  const productStock = serializedVariants.reduce(
    (sum, variant) => sum + normalizeNumber(variant?.stock),
    0,
  );
  const variantPrices = serializedVariants.map((variant) =>
    normalizeNumber(variant?.price),
  );
  const variantOldPrices = serializedVariants
    .map((variant) => normalizeNumber(variant?.oldPrice))
    .filter((value) => value > 0);
  const colors = [
    ...new Set(
      [
        ...serializedVariants.map((variant) =>
          normalizeText(variant?.optionValues?.color),
        ),
        ...fallbackColors.map((value) => normalizeText(value)),
      ].filter(Boolean),
    ),
  ];
  const sizes = [
    ...new Set(
      [
        ...serializedVariants.map((variant) =>
          normalizeText(variant?.optionValues?.size),
        ),
        ...fallbackSizes.map((value) => normalizeText(value)),
      ].filter(Boolean),
    ),
  ];

  product.variantCount = serializedVariants.length;
  product.defaultVariantId = normalizeText(defaultVariant?.id);
  product.stock = productStock;
  product.price = variantPrices.length > 0 ? Math.min(...variantPrices) : 0;
  product.oldPrice =
    variantOldPrices.length > 0
      ? Math.max(...variantOldPrices)
      : normalizeNumber(fallbackOldPrice, normalizeNumber(product?.oldPrice));
  product.colors = colors;
  product.sizes = sizes;

  if (
    !normalizeText(product?.thumbnail) &&
    normalizeText(defaultVariant?.image)
  ) {
    product.thumbnail = defaultVariant.image;
  }

  return serializedVariants;
}

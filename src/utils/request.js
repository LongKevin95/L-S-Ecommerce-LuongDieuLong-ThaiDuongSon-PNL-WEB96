export function parseBooleanInput(value) {
  if (typeof value === "boolean") {
    return value;
  }

  const normalizedValue = String(value ?? "")
    .trim()
    .toLowerCase();

  return ["true", "1", "yes", "on"].includes(normalizedValue);
}

export function parseObjectInput(value, fallback = {}) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }

  const rawValue = String(value ?? "").trim();

  if (!rawValue) {
    return fallback;
  }

  try {
    const parsedValue = JSON.parse(rawValue);

    return parsedValue &&
      typeof parsedValue === "object" &&
      !Array.isArray(parsedValue)
      ? parsedValue
      : fallback;
  } catch {
    return fallback;
  }
}

export function parseStringArrayInput(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  }

  const rawValue = String(value ?? "").trim();

  if (!rawValue) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(rawValue);

    if (Array.isArray(parsedValue)) {
      return parsedValue
        .map((item) => String(item ?? "").trim())
        .filter(Boolean);
    }
  } catch {}

  return rawValue
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseObjectArrayInput(value, fallback = []) {
  if (Array.isArray(value)) {
    return value.filter(
      (item) => item && typeof item === "object" && !Array.isArray(item),
    );
  }

  const rawValue = String(value ?? "").trim();

  if (!rawValue) {
    return fallback;
  }

  try {
    const parsedValue = JSON.parse(rawValue);

    if (Array.isArray(parsedValue)) {
      return parsedValue.filter(
        (item) => item && typeof item === "object" && !Array.isArray(item),
      );
    }
  } catch {
    return fallback;
  }

  return fallback;
}

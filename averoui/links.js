export function safeHttpsUrl(value) {
  if (typeof value !== "string") {
    throw new TypeError("URL must be a string.");
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new TypeError("URL must be an absolute HTTPS URL.");
  }

  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    throw new TypeError("Only HTTPS URLs without embedded credentials are allowed.");
  }

  return parsed.toString();
}

export function formatHyperlink(value) {
  return "<" + safeHttpsUrl(value) + ">";
}

const MARKDOWN_SPECIALS = /([*_{}[\]()#+\-.!|~>])/g;

export function escapeMarkdown(value) {
  if (typeof value !== "string") {
    throw new TypeError("Text must be a string.");
  }

  return value
    .replaceAll(String.fromCharCode(96), "\\" + String.fromCharCode(96))
    .replace(MARKDOWN_SPECIALS, "\\$1");
}

export function truncateText(value, maxLength, suffix = "…") {
  if (typeof value !== "string") {
    throw new TypeError("Text must be a string.");
  }
  if (!Number.isInteger(maxLength) || maxLength < 0) {
    throw new RangeError("maxLength must be a non-negative integer.");
  }
  if (value.length <= maxLength) return value;
  if (maxLength === 0) return "";
  if (suffix.length >= maxLength) return suffix.slice(0, maxLength);
  return value.slice(0, maxLength - suffix.length) + suffix;
}

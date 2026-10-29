import { THEME } from "./theme.js";
import { safeHttpsUrl } from "./links.js";

const LIMITS = Object.freeze({
  title: 256,
  description: 4096,
  footer: 2048,
  fields: 25,
  fieldName: 256,
  fieldValue: 1024,
  totalText: 6000
});

function safeAttachmentUrl(value, name) {
  if (typeof value !== "string" || !/^attachment:\/\/[a-zA-Z0-9._-]+$/.test(value)) {
    throw new TypeError(name + " must be a local attachment:// filename.");
  }
  return value;
}

function optionalString(value, name, maxLength) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength) {
    throw new RangeError(name + " must be a non-empty string no longer than " + maxLength + " characters.");
  }
  return value;
}

export function createEmbed(options = {}) {
  const {
    title,
    description,
    color = THEME.colors.primary,
    url,
    footer,
    timestamp,
    thumbnail,
    image,
    fields = []
  } = options;

  if (!Number.isInteger(color) || color < 0 || color > 0xFFFFFF) {
    throw new RangeError("Embed color must be an integer between 0 and 0xFFFFFF.");
  }
  if (!Array.isArray(fields) || fields.length > LIMITS.fields) {
    throw new RangeError("Embed fields must be an array with at most " + LIMITS.fields + " entries.");
  }

  const embed = { color };
  const safeTitle = optionalString(title, "title", LIMITS.title);
  const safeDescription = optionalString(description, "description", LIMITS.description);
  const safeFooter = optionalString(footer, "footer", LIMITS.footer);

  if (safeTitle !== undefined) embed.title = safeTitle;
  if (safeDescription !== undefined) embed.description = safeDescription;
  if (url !== undefined) embed.url = safeHttpsUrl(url);
  if (safeFooter !== undefined) embed.footer = { text: safeFooter };
  if (thumbnail !== undefined) embed.thumbnail = { url: safeAttachmentUrl(thumbnail, "thumbnail") };
  if (image !== undefined) embed.image = { url: safeAttachmentUrl(image, "image") };

  if (timestamp !== undefined) {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    if (Number.isNaN(date.getTime())) throw new TypeError("Embed timestamp must be a valid date.");
    embed.timestamp = date.toISOString();
  }

  if (fields.length > 0) {
    embed.fields = fields.map((field, index) => {
      if (!field || typeof field !== "object") {
        throw new TypeError("Embed field " + (index + 1) + " must be an object.");
      }
      const name = optionalString(field.name, "field " + (index + 1) + " name", LIMITS.fieldName);
      const value = optionalString(field.value, "field " + (index + 1) + " value", LIMITS.fieldValue);
      if (name === undefined || value === undefined) {
        throw new TypeError("Embed field " + (index + 1) + " requires a name and value.");
      }
      return { name, value, ...(field.inline === true ? { inline: true } : {}) };
    });
  }

  const textLength =
    (embed.title?.length ?? 0) +
    (embed.description?.length ?? 0) +
    (embed.footer?.text.length ?? 0) +
    (embed.fields ?? []).reduce((sum, field) => sum + field.name.length + field.value.length, 0);

  if (textLength > LIMITS.totalText) {
    throw new RangeError("Combined embed text cannot exceed " + LIMITS.totalText + " characters.");
  }

  return embed;
}

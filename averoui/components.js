import {
  ContainerBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder
} from "discord.js";
import { THEME } from "./theme.js";

const TEXT_LIMIT = 4000;
const MAX_SECTIONS = 6;

function validateText(value, label, { optional = false } = {}) {
  if (optional && value === undefined) return undefined;
  if (typeof value !== "string" || value.trim().length === 0 || value.length > TEXT_LIMIT) {
    throw new RangeError(label + " must be a non-empty string up to " + TEXT_LIMIT + " characters.");
  }
  return value;
}

/**
 * Compact Components V2 panel. Content stays in one text block by default;
 * separators are opt-in so short responses do not become tall stacks.
 */
export function createPanel({
  eyebrow,
  title,
  description,
  sections = [],
  footer,
  accentColor = THEME.colors.primary,
  separators = false
} = {}) {
  if (!Number.isInteger(accentColor) || accentColor < 0 || accentColor > 0xFFFFFF) {
    throw new RangeError("Panel accentColor must be an integer between 0 and 0xFFFFFF.");
  }
  if (!Array.isArray(sections) || sections.length > MAX_SECTIONS) {
    throw new RangeError("Panel sections must be an array with at most " + MAX_SECTIONS + " entries.");
  }

  const safeEyebrow = validateText(eyebrow, "eyebrow", { optional: true });
  const safeTitle = validateText(title, "title", { optional: true });
  const safeDescription = validateText(description, "description", { optional: true });
  const safeFooter = validateText(footer, "footer", { optional: true });
  const safeSections = sections.map((section, index) => validateText(section, "section " + (index + 1)));

  if (!safeEyebrow && !safeTitle && !safeDescription && safeSections.length === 0 && !safeFooter) {
    throw new TypeError("A panel must contain at least one text block.");
  }

  const container = new ContainerBuilder().setAccentColor(accentColor);
  const blocks = [];
  if (safeEyebrow) blocks.push("-# " + safeEyebrow);
  if (safeTitle) blocks.push("## " + safeTitle);
  if (safeDescription) blocks.push(safeDescription);
  blocks.push(...safeSections);
  if (safeFooter) blocks.push("-# " + safeFooter);

  // One compact text display unless the caller explicitly asks for separators.
  if (!separators) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(blocks.join("\n")));
    return container;
  }

  blocks.forEach((block, index) => {
    if (index > 0) {
      container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
      );
    }
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(block));
  });
  return container;
}

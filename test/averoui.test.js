import test from "node:test";
import assert from "node:assert/strict";
import {
  THEME,
  ICONS,
  discordTimestamp,
  escapeMarkdown,
  truncateText,
  userMention,
  roleMention,
  channelMention,
  safeHttpsUrl,
  formatHyperlink,
  createEmbed,
  createPanel
} from "../averoui/index.js";

test("AveroUI exports a shared theme and Unicode-only semantic icons", () => {
  assert.equal(typeof THEME.colors.primary, "number");
  assert.equal(ICONS.success, "✓");
  assert.equal(ICONS.brand, "◈");
  assert.equal(Object.values(ICONS).some((icon) => /[\u{1F300}-\u{1FAFF}]/u.test(icon)), false);
});

test("Components V2 panel uses the shared accent color, text displays, and separators", () => {
  const panel = createPanel({
    eyebrow: "AVERO / STATUS",
    title: "◈ Ready",
    description: "All systems operational.",
    sections: ["**LATENCY**\n`42 ms`", "**GATEWAY**\n`CONNECTED`"],
    footer: "AVEROUI / COMPONENTS V2",
    accentColor: THEME.colors.success
  });
  const payload = panel.toJSON();

  assert.equal(payload.type, 17);
  assert.equal(payload.accent_color, THEME.colors.success);
  assert.ok(payload.components.some((component) => component.type === 10));
  assert.ok(payload.components.some((component) => component.type === 14));
  assert.throws(() => createPanel({ accentColor: -1, title: "Invalid" }), /accentColor/);
  assert.throws(() => createPanel({ sections: Array.from({ length: 9 }, () => "section") }), /at most 8/);
  assert.throws(() => createPanel(), /at least one text block/);
});

test("Discord timestamps support valid styles and reject invalid values", () => {
  assert.equal(discordTimestamp(0, "R"), "<t:0:R>");
  assert.equal(discordTimestamp(new Date(0), "d"), "<t:0:d>");
  assert.throws(() => discordTimestamp(1, "bad"), /Unsupported/);
  assert.throws(() => discordTimestamp("123"), /valid Date or integer/);
});

test("Markdown escaping and truncation validate inputs", () => {
  assert.equal(escapeMarkdown("*hello*"), "\\*hello\\*");
  assert.equal(truncateText("abcdefgh", 5), "abcd…");
  assert.equal(truncateText("abc", 5), "abc");
  assert.throws(() => escapeMarkdown(12), /string/);
  assert.throws(() => truncateText("abc", -1), /maxLength/);
});

test("mention helpers validate Discord snowflake IDs", () => {
  const id = "123456789012345678";
  assert.equal(userMention(id), "<@" + id + ">");
  assert.equal(roleMention(id), "<@&" + id + ">");
  assert.equal(channelMention(id), "<#" + id + ">");
  assert.throws(() => userMention("not-an-id"), /snowflake/);
});

test("link helpers allow HTTPS and reject unsafe protocols or credentials", () => {
  assert.equal(safeHttpsUrl("https://example.com"), "https://example.com/");
  assert.equal(formatHyperlink("https://example.com"), "<https://example.com/>");
  assert.throws(() => safeHttpsUrl("javascript:alert(1)"), /HTTPS/);
  assert.throws(() => safeHttpsUrl("https://user:pass@example.com"), /credentials/);
});

test("embed builder creates a Discord-compatible payload", () => {
  const embed = createEmbed({
    title: "Avero",
    description: "Welcome",
    footer: "Avero",
    timestamp: new Date("2026-01-01T00:00:00.000Z"),
    fields: [{ name: "Level", value: "5", inline: true }]
  });

  assert.equal(embed.color, THEME.colors.primary);
  assert.equal(embed.title, "Avero");
  assert.equal(embed.timestamp, "2026-01-01T00:00:00.000Z");
  assert.deepEqual(embed.fields, [{ name: "Level", value: "5", inline: true }]);
});

test("embed builder rejects Discord limit violations and invalid URLs", () => {
  assert.throws(() => createEmbed({ title: "x".repeat(257) }), /title/);
  assert.throws(() => createEmbed({ fields: Array.from({ length: 26 }, () => ({ name: "x", value: "y" })) }), /at most 25/);
  assert.throws(() => createEmbed({ url: "http://example.com" }), /HTTPS/);
  assert.throws(() => createEmbed({ color: -1 }), /color/);
  assert.throws(() => createEmbed({ fields: [{ name: "x", value: "" }] }), /field 1 value/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { getDatabaseTargetFingerprint } from "../src/db/client.js";

test("database target fingerprint ignores credentials but changes with database or schema", () => {
  const first = getDatabaseTargetFingerprint("postgresql://alice:secret@db.example:5432/avero?schema=public");
  const sameTarget = getDatabaseTargetFingerprint("postgresql://other:password@db.example:5432/avero?schema=public");
  const otherDatabase = getDatabaseTargetFingerprint("postgresql://alice:secret@db.example:5432/avero_preview?schema=public");
  const otherSchema = getDatabaseTargetFingerprint("postgresql://alice:secret@db.example:5432/avero?schema=testing");
  assert.equal(first, sameTarget);
  assert.notEqual(first, otherDatabase);
  assert.notEqual(first, otherSchema);
  assert.match(first, /^[a-f0-9]{12}$/);
});

test("database target fingerprint rejects missing or malformed URLs", () => {
  assert.throws(() => getDatabaseTargetFingerprint(""), /required/);
  assert.throws(() => getDatabaseTargetFingerprint("not a URL"), /valid URL/);
});

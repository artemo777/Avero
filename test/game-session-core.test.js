import test from "node:test";
import assert from "node:assert/strict";
import { validateGameSession, markSessionCompleted } from "../src/bot/game-session-core.js";

const base = { id:"s1", guildId:"g1", userId:"u1", createdAt:1000, completed:false };
test("session accepts matching owner and fresh session", () => {
 assert.deepEqual(validateGameSession(base,{guildId:"g1",userId:"u1",now:2000}),{valid:true,reason:null});
});
test("session rejects mismatched owner and stale session", () => {
 assert.equal(validateGameSession(base,{guildId:"g2",userId:"u1",now:2000}).reason,"owner");
 assert.equal(validateGameSession(base,{guildId:"g1",userId:"u1",now:1000+16*60*1000}).reason,"expired");
});
test("completed sessions cannot be replayed", () => {
 const done=markSessionCompleted(base);
 assert.equal(done.completed,true);
 assert.equal(validateGameSession(done,{guildId:"g1",userId:"u1",now:2000}).reason,"completed");
 assert.throws(()=>markSessionCompleted(done),/already completed/);
});
test("invalid session timestamps are rejected", () => {
 assert.equal(validateGameSession({...base,createdAt:3000},{guildId:"g1",userId:"u1",now:2000}).reason,"expired");
 assert.throws(()=>validateGameSession(base,{guildId:"g1",userId:"u1",now:2000,maxAgeMs:0}),RangeError);
});

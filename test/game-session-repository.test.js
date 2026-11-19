import test from "node:test";
import assert from "node:assert/strict";
import { createGameSession, getActiveGameSession, completeGameSession, expireGameSessions } from "../src/db/game-session-repository.js";

function fakePrisma(){
 const calls=[];
 return {calls,gameSession:{
  create:async(args)=>{calls.push(["create",args]);return args.data;},
  findFirst:async(args)=>{calls.push(["findFirst",args]);return {id:args.where.id};},
  updateMany:async(args)=>{calls.push(["updateMany",args]);return {count:1};}
 }};
}
test("create session validates and stores bounded session",async()=>{
 const p=fakePrisma(), now=new Date("2026-01-01T00:00:00Z");
 const s=await createGameSession(p,"g","u","fishing",{stage:1},{now,expiresInMs:5000});
 assert.equal(s.guildId,"g");assert.equal(s.userId,"u");assert.equal(s.gameId,"fishing");assert.equal(s.expiresAt.getTime(),now.getTime()+5000);
 assert.throws(()=>createGameSession(p,"g","u","Bad Game",{}),TypeError);
});
test("lookup is scoped to ownership and expiry",async()=>{
 const p=fakePrisma();const now=new Date();
 await getActiveGameSession(p,"g","u","s",now);
 const q=p.calls[0][1].where;assert.equal(q.guildId,"g");assert.equal(q.userId,"u");assert.equal(q.status,"active");assert.ok(q.expiresAt.gt);
});
test("completion and expiry operate only on eligible active sessions",async()=>{
 const p=fakePrisma(),now=new Date();
 await completeGameSession(p,"g","u","s",{now});
 assert.equal(p.calls[0][1].where.status,"active");assert.equal(p.calls[0][1].where.userId,"u");assert.equal(p.calls[0][1].data.status,"completed");
 await expireGameSessions(p,now);
 assert.equal(p.calls[1][1].where.status,"active");assert.equal(p.calls[1][1].where.expiresAt.lte,now);
});

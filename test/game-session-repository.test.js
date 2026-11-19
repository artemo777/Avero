import test from "node:test";
import assert from "node:assert/strict";
import { createGameSession, getActiveGameSession, completeGameSession, expireGameSessions, claimGameSession, settleGameSessionReward } from "../src/db/game-session-repository.js";

function fakePrisma(){
 const calls=[];
 const gameSession={
  create:async(args)=>{calls.push(["create",args]);return args.data;},
  findFirst:async(args)=>{calls.push(["findFirst",args]);return {id:args.where.id};},
  updateMany:async(args)=>{calls.push(["updateMany",args]);return {count:1};}
 };
 const prisma={calls,gameSession,$transaction:async(fn)=>fn(prisma)};
 return prisma;
}
test("creation supersedes existing active sessions of same game",async()=>{
 const p=fakePrisma(),now=new Date("2026-01-01T00:00:00Z");
 const s=await createGameSession(p,"g","u","fishing",{stage:1},{now,expiresInMs:5000});
 assert.equal(s.guildId,"g");assert.equal(s.userId,"u");assert.equal(s.gameId,"fishing");assert.equal(s.expiresAt.getTime(),now.getTime()+5000);
 assert.equal(p.calls[0][0],"updateMany");assert.equal(p.calls[0][1].where.status,"active");assert.equal(p.calls[0][1].where.gameId,"fishing");
 assert.equal(p.calls[1][0],"create");
 await assert.rejects(()=>createGameSession(p,"g","u","Bad Game",{}),TypeError);
});
test("lookup is scoped to owner and expiry",async()=>{
 const p=fakePrisma();const now=new Date();
 await getActiveGameSession(p,"g","u","s",now);
 const q=p.calls[0][1].where;assert.equal(q.guildId,"g");assert.equal(q.userId,"u");assert.equal(q.status,"active");assert.ok(q.expiresAt.gt);
});
test("claim is an atomic conditional transition",async()=>{
 const p=fakePrisma(),now=new Date();
 const result=await claimGameSession(p,"g","u","s",{now});
 assert.equal(result.count,1);const q=p.calls[0][1].where;
 assert.equal(q.status,"active");assert.equal(q.userId,"u");assert.equal(q.id,"s");assert.ok(q.expiresAt.gt);
 assert.equal(p.calls[0][1].data.status,"claimed");
});
test("completion and expiry operate on eligible active sessions",async()=>{
 const p=fakePrisma(),now=new Date();
 await completeGameSession(p,"g","u","s",{now});
 assert.equal(p.calls[0][1].where.status,"active");assert.equal(p.calls[0][1].where.userId,"u");assert.equal(p.calls[0][1].data.status,"completed");
 await expireGameSessions(p,now);
 assert.equal(p.calls[1][1].where.status,"active");assert.equal(p.calls[1][1].where.expiresAt.lte,now);
});

function fixture({ sessionClaim = 1, accountClaim = 1 } = {}) {
 const calls=[];
 const tx={
  currencyAccount:{
   upsert:async(args)=>calls.push(["upsert",args]),
   updateMany:async(args)=>{calls.push(["accountUpdate",args]);return {count:accountClaim};},
   findUnique:async(args)=>({balance:42,...args.where})
  },
  gameSession:{updateMany:async(args)=>{calls.push(["sessionUpdate",args]);return {count:sessionClaim};}},
  currencyTransaction:{create:async(args)=>calls.push(["ledger",args])}
 };
 return {calls,prisma:{$transaction:async(fn)=>fn(tx)}};
}
test("settlement atomically claims session, cooldown and ledger reward",async()=>{
 const f=fixture(),now=new Date("2026-11-19T12:00:00Z");
 const result=await settleGameSessionReward(f.prisma,"g","u","s",25,{type:"fishing_reward",now});
 assert.equal(result.awarded,true);assert.equal(result.amount,25);
 assert.equal(f.calls.filter(x=>x[0]==="sessionUpdate").length,1);
 assert.equal(f.calls[2][1].data.balance.increment,25);
 assert.equal(f.calls[3][1].data.amount,25);assert.equal(f.calls[3][1].data.type,"fishing_reward");
});
test("settlement rejects a session that cannot be claimed",async()=>{
 const f=fixture({sessionClaim:0});
 const result=await settleGameSessionReward(f.prisma,"g","u","s",25);
 assert.deepEqual(result,{awarded:false,reason:"session_unavailable"});
 assert.equal(f.calls.some(x=>x[0]==="ledger"),false);
 assert.equal(f.calls.some(x=>x[0]==="accountUpdate"),false);
});
test("cooldown denial doesn't produce a ledger reward",async()=>{
 const f=fixture({accountClaim:0});
 const result=await settleGameSessionReward(f.prisma,"g","u","s",25);
 assert.deepEqual(result,{awarded:false,reason:"cooldown"});
 assert.equal(f.calls.some(x=>x[0]==="ledger"),false);
 const resets=f.calls.filter(x=>x[0]==="sessionUpdate");
 assert.equal(resets.length,2);assert.equal(resets[1][1].data.status,"active");
});
test("invalid reward amount/type/cooldown are rejected",async()=>{
 const f=fixture();
 await assert.rejects(()=>settleGameSessionReward(f.prisma,"g","u","s",0),TypeError);
 await assert.rejects(()=>settleGameSessionReward(f.prisma,"g","u","s",1,{type:"Bad Type"}),TypeError);
 await assert.rejects(()=>settleGameSessionReward(f.prisma,"g","u","s",1,{cooldownMs:0}),TypeError);
});

test("settlement writes account and ledger to the global wallet scope",async()=>{
 const f=fixture(),now=new Date("2026-11-19T12:00:00Z");
 await settleGameSessionReward(f.prisma,"server-a","member","session-a",10,{now});
 await settleGameSessionReward(f.prisma,"server-b","member","session-b",10,{now});
 const upserts=f.calls.filter(x=>x[0]==="upsert");
 const updates=f.calls.filter(x=>x[0]==="accountUpdate");
 const ledgers=f.calls.filter(x=>x[0]==="ledger");
 assert.equal(upserts.length,2);assert.equal(updates.length,2);assert.equal(ledgers.length,2);
 for(const call of [...upserts,...updates,...ledgers]){
  const args=call[1];
  const key=call[0]==="upsert"?(args.where?.guildId_userId??args.create):args.where;
  assert.equal(key.guildId,"__avero_global__");assert.equal(key.userId,"member");
 }
 const sessionCalls=f.calls.filter(x=>x[0]==="sessionUpdate");
 assert.equal(sessionCalls[0][1].where.guildId,"server-a");
 assert.equal(sessionCalls[1][1].where.guildId,"server-b");
});

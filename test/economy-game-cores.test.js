import test from "node:test";
import assert from "node:assert/strict";
import { resolveMineTurn } from "../src/bot/mine-core.js";
import { evaluateReaction } from "../src/bot/reaction-core.js";
import { checkpointForFloor, chooseTowerPath } from "../src/bot/tower-core.js";
import { cropStatus } from "../src/bot/farm-core.js";

test("mine tile is resolved once and value is bounded by ore table",()=>{
 const revealed=Array(25).fill(false), ore=Array(25).fill(null); ore[2]="gold";
 const r=resolveMineTurn({tile:2,revealed,oreByTile:ore}); assert.equal(r.value,10); assert.equal(r.revealed[2],true);
 assert.throws(()=>resolveMineTurn({tile:2,revealed:r.revealed,oreByTile:ore}),/already/);
 assert.throws(()=>resolveMineTurn({tile:25,revealed,oreByTile:ore}),RangeError);
});
test("reaction scores valid timings and rejects invalid inputs",()=>{
 assert.equal(evaluateReaction({elapsedMs:0,windowMs:500}).score,100);
 assert.equal(evaluateReaction({elapsedMs:500,windowMs:500}).success,true);
 assert.equal(evaluateReaction({elapsedMs:501,windowMs:500}).success,false);
 assert.throws(()=>evaluateReaction({elapsedMs:-1,windowMs:500}),RangeError);
 assert.throws(()=>evaluateReaction({elapsedMs:5001,windowMs:500}),RangeError);
 assert.throws(()=>evaluateReaction({elapsedMs:100,windowMs:99}),RangeError);
 assert.throws(()=>evaluateReaction({elapsedMs:100,windowMs:1501}),RangeError);
 assert.equal(evaluateReaction({elapsedMs:250,windowMs:500}).score,50);
 assert.equal(evaluateReaction({elapsedMs:500,windowMs:500}).score,0);
});
test("tower checkpoints and paths validate",()=>{
 assert.equal(checkpointForFloor(6),6); assert.equal(checkpointForFloor(10),6);
 assert.equal(chooseTowerPath(["a","b"],1),"b");
 assert.equal(checkpointForFloor(100),96);
 assert.throws(()=>checkpointForFloor(0),RangeError);
 assert.throws(()=>checkpointForFloor(101),RangeError);
 assert.throws(()=>chooseTowerPath(["a"],0),TypeError);
 assert.throws(()=>chooseTowerPath(["a",null],0),TypeError);
 assert.throws(()=>chooseTowerPath(["a"," "],0),TypeError);
 assert.throws(()=>chooseTowerPath(["a","b"],2),TypeError);
});
test("farm growth is time-based and validated",()=>{
 const plantedAt=new Date("2025-01-01T00:00:00Z");
 assert.equal(cropStatus({cropId:"turnip",plantedAt,now:new Date(plantedAt.getTime()+60000)}).ready,true);
 assert.equal(cropStatus({cropId:"berry",plantedAt,now:new Date(plantedAt.getTime()+60000)}).ready,false);
});


test("mine state rejects malformed revealed and ore arrays",()=>{
 const revealed=Array(25).fill(false),ore=Array(25).fill(null);
 revealed[3]="false";assert.throws(()=>resolveMineTurn({tile:0,revealed,oreByTile:ore}),TypeError);
 revealed[3]=false;ore[4]="bogus";assert.throws(()=>resolveMineTurn({tile:0,revealed,oreByTile:ore}),TypeError);
});

test("mine core rejects inherited object keys as ore types",()=>{
 const revealed=Array(25).fill(false),ore=Array(25).fill(null);
 for(const invalid of ["constructor","toString","__proto__"]){ore[0]=invalid;assert.throws(()=>resolveMineTurn({tile:0,revealed,oreByTile:ore}),TypeError);}
});

test("farm rejects inherited crop identifiers",()=>{
 const plantedAt=new Date("2025-01-01T00:00:00Z"),now=new Date(plantedAt.getTime()+60000);
 for(const cropId of ["constructor","toString","__proto__"])assert.throws(()=>cropStatus({cropId,plantedAt,now}),TypeError);
});

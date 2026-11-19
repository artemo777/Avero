import { randomUUID } from "node:crypto";

const SESSION_MAX_AGE_MS = 15 * 60 * 1000;
const validGameId = (id) => typeof id === "string" && /^[a-z][a-z0-9_]{0,39}$/.test(id);
function required(value,name){if(typeof value!=="string"||!value.trim())throw new TypeError(name+" is required.");return value.trim();}

export async function createGameSession(prisma,guildId,userId,gameId,payload,{now=new Date(),expiresInMs=SESSION_MAX_AGE_MS}={}) {
  guildId=required(guildId,"guildId");userId=required(userId,"userId");
  if(!validGameId(gameId))throw new TypeError("Invalid gameId.");
  if(!(now instanceof Date)||Number.isNaN(now.getTime())||!Number.isSafeInteger(expiresInMs)||expiresInMs<=0)throw new TypeError("Invalid session timing.");
  return prisma.gameSession.create({data:{id:randomUUID(),guildId,userId,gameId,status:"active",payload,createdAt:now,expiresAt:new Date(now.getTime()+expiresInMs)}});
}

export async function getActiveGameSession(prisma,guildId,userId,sessionId,now=new Date()) {
  required(guildId,"guildId");required(userId,"userId");required(sessionId,"sessionId");
  if(!(now instanceof Date)||Number.isNaN(now.getTime()))throw new TypeError("Invalid now.");
  return prisma.gameSession.findFirst({where:{id:sessionId,guildId,userId,status:"active",expiresAt:{gt:now}}});
}

export async function completeGameSession(prisma,guildId,userId,sessionId,{now=new Date()}={}) {
  required(guildId,"guildId");required(userId,"userId");required(sessionId);
  if(!(now instanceof Date)||Number.isNaN(now.getTime()))throw new TypeError("Invalid now.");
  return prisma.gameSession.updateMany({where:{id:sessionId,guildId,userId,status:"active",expiresAt:{gt:now}},data:{status:"completed",completedAt:now}});
}

export async function expireGameSessions(prisma,now=new Date()) {
  if(!(now instanceof Date)||Number.isNaN(now.getTime()))throw new TypeError("Invalid now.");
  return prisma.gameSession.updateMany({where:{status:"active",expiresAt:{lte:now}},data:{status:"expired"}});
}

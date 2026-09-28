import fs from "node:fs";
import path from "node:path";
import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {COOKIE_NAME,validSession,type OwnerConfig} from "./auth-core";
export function ownerPath(){return path.join(process.env.LAKA_DATA_DIR||path.resolve("data"),"owner.json");}
export function readOwner():OwnerConfig|null{
 const file=ownerPath();if(!fs.existsSync(file))return null;
 const c=JSON.parse(fs.readFileSync(file,"utf8"));
 if(c.version!==1||typeof c.id!=="string"||typeof c.username!=="string"||typeof c.displayName!=="string"||! /^[a-f0-9]{48}$/.test(c.salt)||! /^[a-f0-9]{128}$/.test(c.passwordHash)||typeof c.sessionSecret!=="string"||c.sessionSecret.length<40)throw new Error("Owner configuration is invalid");return c;
}
export async function getWarehouseUser(){const config=readOwner();if(!config)return null;const token=(await cookies()).get(COOKIE_NAME)?.value;if(!validSession(config,token))return null;return {userId:config.id,displayName:config.displayName};}
export async function requireWarehouseUser(){const user=await getWarehouseUser();if(!user)redirect("/login");return user;}
export function publicOrigin(request:Request){
 const configured=process.env.LAKA_PUBLIC_ORIGIN;
 if(configured)return new URL(configured).origin;
 if(process.env.NODE_ENV==="production")throw new Error("LAKA_PUBLIC_ORIGIN is required");
 const origin=new URL(request.url);if(!["localhost","127.0.0.1","[::1]"].includes(origin.hostname))throw new Error("Local origin required");return origin.origin;
}
export function trustedMutation(request:Request){try{return request.headers.get("origin")===publicOrigin(request);}catch{return false;}}
type Attempt={count:number;expires:number};
const attempts=new Map<string,Attempt>();
let inFlight=0;
export function loginPermit(request:Request){
 const now=Date.now();for(const [key,value] of attempts)if(value.expires<=now)attempts.delete(key);
 const key=(request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"local").slice(0,100);
 const entry=attempts.get(key)??{count:0,expires:now+15*60*1000};
 if(entry.count>=8||inFlight>=1||!attempts.has(key)&&attempts.size>=512)return null;
 entry.count++;attempts.set(key,entry);inFlight++;
 let finished=false;return (success:boolean)=>{if(finished)return;finished=true;inFlight--;if(success)attempts.delete(key);};
}

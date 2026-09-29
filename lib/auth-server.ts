import fs from "node:fs";
import path from "node:path";
import {randomUUID} from "node:crypto";
import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {COOKIE_NAME,createOwner,validSession,type OwnerConfig} from "./auth-core";
export function ownerPath(){return path.join(process.env.LAKA_DATA_DIR||path.resolve("data"),"owner.json");}
export function readOwner():OwnerConfig|null{
 const file=ownerPath();if(!fs.existsSync(file))return null;
 const c=JSON.parse(fs.readFileSync(file,"utf8"));
 if(c.version!==1||typeof c.id!=="string"||typeof c.username!=="string"||typeof c.displayName!=="string"||! /^[a-f0-9]{48}$/.test(c.salt)||! /^[a-f0-9]{128}$/.test(c.passwordHash)||typeof c.sessionSecret!=="string"||c.sessionSecret.length<40)throw new Error("Owner configuration is invalid");return c;
}
export type WarehouseUser={userId:string;displayName:string;role:"owner"|"viewer"};
export function viewersPath(){return path.join(process.env.LAKA_DATA_DIR||path.resolve("data"),"viewers.json");}
export function readViewers():OwnerConfig[]{
 const file=viewersPath();if(!fs.existsSync(file))return [];
 const rows=JSON.parse(fs.readFileSync(file,"utf8"));
 if(!Array.isArray(rows)||rows.length>20||rows.some(v=>v.version!==1||typeof v.id!=="string"||!v.id.startsWith("viewer-")||typeof v.username!=="string"||typeof v.displayName!=="string"||! /^[a-f0-9]{48}$/.test(v.salt)||! /^[a-f0-9]{128}$/.test(v.passwordHash)||typeof v.sessionSecret!=="string"||v.sessionSecret.length<40))throw new Error("Viewer configuration is invalid");
 return rows;
}
export async function createViewer(username:string,displayName:string,password:string){
 let rows=readViewers();const owner=readOwner();
 if(rows.length>=20)throw new Error("Đã đạt giới hạn 20 tài khoản xem.");
 if(username===owner?.username||rows.some(v=>v.username===username))throw new Error("Tên đăng nhập đã được sử dụng.");
 if(!displayName.trim()||displayName.length>100)throw new Error("Nhập tên người xem, tối đa 100 ký tự.");
 const viewer=await createOwner(username,password,displayName);viewer.id="viewer-"+randomUUID();
 rows=readViewers();if(rows.length>=20||rows.some(v=>v.username===username))throw new Error("Tài khoản vừa thay đổi. Vui lòng thử lại.");
 writeViewers([...rows,viewer]);return {id:viewer.id,username:viewer.username,displayName:viewer.displayName};
}
function writeViewers(rows:OwnerConfig[]){
 const file=viewersPath();fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
 const temp=file+".tmp-"+process.pid+"-"+randomUUID();
 try{fs.writeFileSync(temp,JSON.stringify(rows,null,2)+"\n",{mode:0o600,flag:"wx"});fs.renameSync(temp,file);fs.chmodSync(file,0o600);}catch(e){try{fs.unlinkSync(temp);}catch{}throw e;}
}
export function revokeViewer(id:string){const rows=readViewers();if(!rows.some(v=>v.id===id))throw new Error("Không tìm thấy tài khoản xem.");writeViewers(rows.filter(v=>v.id!==id));}
export async function getWarehouseUser():Promise<WarehouseUser|null>{const token=(await cookies()).get(COOKIE_NAME)?.value;if(!token)return null;const owner=readOwner();if(!owner)return null;if(validSession(owner,token))return {userId:owner.id,displayName:owner.displayName,role:"owner"};for(const viewer of readViewers())if(validSession(viewer,token))return {userId:viewer.id,displayName:viewer.displayName,role:"viewer"};return null;}
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

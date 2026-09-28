import {randomBytes,randomUUID,scrypt,timingSafeEqual,createHmac} from "node:crypto";
export type OwnerConfig={version:1;id:string;username:string;displayName:string;salt:string;passwordHash:string;sessionSecret:string;createdAt:string};
export const COOKIE_NAME="laka_session";
export const SESSION_SECONDS=12*60*60;
async function derive(password:string,salt:string){return new Promise<Buffer>((resolve,reject)=>scrypt(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024},(e,key)=>e?reject(e):resolve(key)));}
export async function createOwner(username:string,password:string,displayName="Quản lý kho"):Promise<OwnerConfig>{
 if(!/^[A-Za-z0-9_.-]{3,64}$/.test(username))throw new Error("Tên đăng nhập cần 3–64 ký tự, gồm chữ, số, dấu chấm/gạch.");
 if(password.length<12||password.length>256)throw new Error("Mật khẩu cần từ 12 đến 256 ký tự.");
 const salt=randomBytes(24).toString("hex");return {version:1,id:"owner-"+randomUUID(),username,displayName:displayName.trim().slice(0,100)||"Quản lý kho",salt,passwordHash:(await derive(password,salt)).toString("hex"),sessionSecret:randomBytes(48).toString("base64url"),createdAt:new Date().toISOString()};
}
export async function verifyPassword(config:OwnerConfig,username:unknown,password:unknown){
 if(typeof username!=="string"||typeof password!=="string"||password.length>256||password.length<1)return false;
 const hash=await derive(password,config.salt),expected=Buffer.from(config.passwordHash,"hex");
 return expected.length===hash.length&&timingSafeEqual(hash,expected)&&username===config.username;
}
export function issueSession(config:OwnerConfig,now=Date.now()){
 const payload=Buffer.from(JSON.stringify({sub:config.id,iat:Math.floor(now/1000),exp:Math.floor(now/1000)+SESSION_SECONDS,nonce:randomBytes(12).toString("base64url")})).toString("base64url");
 return payload+"."+createHmac("sha256",config.sessionSecret).update(payload).digest("base64url");
}
export function validSession(config:OwnerConfig,token:string|undefined,now=Date.now()){
 if(!token||token.length>1500)return false;const [payload,signature,...extra]=token.split(".");if(!payload||!signature||extra.length)return false;
 try{const expected=createHmac("sha256",config.sessionSecret).update(payload).digest(),actual=Buffer.from(signature,"base64url");if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return false;
 const claims=JSON.parse(Buffer.from(payload,"base64url").toString("utf8")),seconds=Math.floor(now/1000);return claims.sub===config.id&&Number.isInteger(claims.exp)&&Number.isInteger(claims.iat)&&claims.iat<=seconds+30&&claims.exp>seconds&&claims.exp-claims.iat===SESSION_SECONDS;
 }catch{return false;}
}

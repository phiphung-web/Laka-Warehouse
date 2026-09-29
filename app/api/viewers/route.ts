import {randomBytes} from "node:crypto";
import {createViewer,getWarehouseUser,readViewers,revokeViewer,trustedMutation} from "@/lib/auth-server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
async function owner(){const user=await getWarehouseUser();return user?.role==="owner";}
export async function GET(){if(!await owner())return reply({error:"Chỉ quản lý kho được xem tài khoản."},403);return reply({viewers:readViewers().map(v=>({id:v.id,username:v.username,displayName:v.displayName,createdAt:v.createdAt}))});}
export async function POST(request:Request){
 if(!trustedMutation(request))return reply({error:"Nguồn yêu cầu không hợp lệ."},403);
 if(!await owner())return reply({error:"Chỉ quản lý kho được cấp tài khoản."},403);
 try{const text=await request.text();if(text.length>1000)return reply({error:"Yêu cầu quá lớn."},413);const data=JSON.parse(text);
  if(data.action==="create"){
   const password=randomBytes(18).toString("base64url"),username="xem_"+randomBytes(5).toString("hex");
   if(typeof data.displayName!=="string")return reply({error:"Nhập tên người xem."},400);
   const viewer=await createViewer(username,data.displayName.trim(),password);
   return reply({viewer,password});
  }
  if(data.action==="revoke"&&typeof data.id==="string"&&/^viewer-[a-f0-9-]{36}$/.test(data.id)){revokeViewer(data.id);return reply({ok:true});}
  return reply({error:"Thao tác không hợp lệ."},400);
 }catch(e){return reply({error:e instanceof Error?e.message:"Không thể cập nhật tài khoản."},400);}
}

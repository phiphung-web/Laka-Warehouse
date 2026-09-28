import {NextResponse} from "next/server";
import {readOwner,loginPermit,trustedMutation,publicOrigin} from "@/lib/auth-server";
import {COOKIE_NAME,SESSION_SECONDS,issueSession,verifyPassword} from "@/lib/auth-core";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const reply=(error:string,status:number)=>NextResponse.json({error},{status,headers:{"Cache-Control":"no-store"}});
export async function POST(request:Request){
 if(!trustedMutation(request))return reply("Nguồn yêu cầu không hợp lệ.",403);
 const done=loginPermit(request);if(!done)return reply("Đã thử đăng nhập nhiều lần. Vui lòng thử lại sau 15 phút.",429);
 let success=false;
 try{
  if(!request.headers.get("content-type")?.includes("application/json"))return reply("Định dạng không hợp lệ.",415);
  const text=await request.text();if(text.length>3000)return reply("Yêu cầu quá lớn.",413);
  const body=JSON.parse(text),config=readOwner();if(!config)return reply("Chưa khởi tạo tài khoản quản lý trên server.",503);
  if(!await verifyPassword(config,body.username,body.password))return reply("Tên đăng nhập hoặc mật khẩu chưa đúng.",401);
  const response=NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
  response.cookies.set(COOKIE_NAME,issueSession(config),{httpOnly:true,secure:publicOrigin(request).startsWith("https://"),sameSite:"strict",path:"/",maxAge:SESSION_SECONDS});success=true;return response;
 }catch{return reply("Không thể đăng nhập. Kiểm tra dữ liệu và thử lại.",400);}finally{done(success);}
}

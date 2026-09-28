import {NextResponse} from "next/server";
import {COOKIE_NAME} from "@/lib/auth-core";
import {trustedMutation,publicOrigin} from "@/lib/auth-server";
export const runtime="nodejs";
export async function POST(request:Request){
 if(!trustedMutation(request))return NextResponse.json({error:"Nguồn yêu cầu không hợp lệ."},{status:403});
 const response=NextResponse.redirect(new URL("/login",publicOrigin(request)),303);
 response.cookies.set(COOKIE_NAME,"",{httpOnly:true,secure:publicOrigin(request).startsWith("https://"),sameSite:"strict",path:"/",maxAge:0});response.headers.set("Cache-Control","no-store");return response;
}

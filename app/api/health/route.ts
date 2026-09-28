import {getDatabase} from "@/lib/sqlite";
import {readOwner} from "@/lib/auth-server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(){try{await getDatabase().prepare("SELECT id FROM settings LIMIT 1").first();if(!readOwner())throw Error("Unconfigured");return Response.json({ok:true,release:process.env.LAKA_RELEASE||"local"},{headers:{"Cache-Control":"no-store"}});}catch{return Response.json({ok:false},{status:503,headers:{"Cache-Control":"no-store"}});}}

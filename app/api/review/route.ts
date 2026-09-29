import {getWarehouseUser,readOwner} from "@/lib/auth-server";
import {db} from "@/lib/server";
import {reviewReport} from "@/lib/review-server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(){
 try{const user=await getWarehouseUser();if(!user)return Response.json({error:"Vui lòng đăng nhập."},{status:401});
  const owner=readOwner(),settings=await db().prepare("SELECT owner,seeded FROM settings WHERE id=1").first<{owner:string;seeded:number}>();
  if(!owner||settings?.owner!==owner.id||!settings.seeded)return Response.json({error:"Kho chưa sẵn sàng."},{status:503});
  return Response.json(await reviewReport(),{headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
 }catch(e){console.error(e);return Response.json({error:"Không thể tải báo cáo đối chiếu."},{status:503});}
}

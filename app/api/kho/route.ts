import { identity,state,mutate,backup,stockFlowReport } from "@/lib/server";
import {trustedMutation} from "@/lib/auth-server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
function response(data:any,status=200){return Response.json(data,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});}
function error(e:any){
 const text=String(e?.message??e);
 if(text==="AUTH_REQUIRED")return response({error:"Vui lòng đăng nhập lại."},401);
 if(text==="FORBIDDEN")return response({error:"Tài khoản này chưa được cấp quyền quản lý kho."},403);
 if(/STALE_REVISION/.test(text))return response({error:"Dữ liệu vừa thay đổi ở một cửa sổ khác. Tải lại và kiểm tra phiếu trước khi xác nhận."},409);
 if(/quantity_nonnegative|NEGATIVE_STOCK/.test(text))return response({error:"Số tồn đã thay đổi hoặc không đủ để thực hiện. Phiếu chưa được ghi."},409);
 if(/UNIQUE constraint/.test(text))return response({error:"Dữ liệu hoặc phiếu bị trùng. Tải lại để kiểm tra."},409);
 if(/COMMERCE_/.test(text))return response({error:"Chứng từ hoặc khoản thanh toán vừa thay đổi hoặc bị trùng. Tải lại và kiểm tra trước khi ghi."},409);
 if(/D1_|SQLITE_|no such table|binding/.test(text)){console.error(text);return response({error:"Kho dữ liệu tạm thời chưa sẵn sàng. Nội dung bạn nhập vẫn được giữ; thử lại sau."},503);}
 return response({error:text.slice(0,400)},400);
}
export async function GET(request:Request){
 try{
  const user=await identity();
  const url=new URL(request.url);
  if(url.searchParams.get("report")==="flow")return response(await stockFlowReport(url.searchParams));
  return response(url.searchParams.get("export")==="all"?await backup():await state(user));
 }catch(e){return error(e);}
}
export async function POST(request:Request){try{
 if(!trustedMutation(request))return response({error:"Nguồn yêu cầu không hợp lệ."},403);
 if(!request.headers.get("content-type")?.includes("application/json"))return response({error:"Định dạng yêu cầu không hợp lệ."},415);
 const user=await identity(),text=await request.text();if(text.length>180000)return response({error:"Phiếu quá lớn; chia thành các phiếu nhỏ hơn."},413);
 return response(await mutate(JSON.parse(text),user));
 }catch(e){return error(e);}}

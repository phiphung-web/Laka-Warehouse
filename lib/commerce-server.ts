import {prepareSupplier,prepareInvoice,validatePayment,recordId,textValue,documentDate,type Invoice} from "./commerce.ts";

// The storage interface is deliberately limited to parameterized statements and atomic batches.
export interface Statement {bind(...values:any[]):Statement;first<T=any>():Promise<T|null>;all<T=any>():Promise<{results:T[]}>;run():Promise<any>}
export interface Database {prepare(sql:string):Statement;batch(statements:Statement[]):Promise<any[]>}
export const COMMERCE_ACTIONS=["supplier","invoice","payment","reversePayment","voidInvoice","linkReceipt"];
export const COMMERCE_TABLES=["suppliers","purchase_invoices","supplier_payments","invoice_voids","invoice_receipts","commerce_requests"];
const invoiceQuery=`SELECT i.*,COALESCE((SELECT SUM(p.amount) FROM supplier_payments p WHERE p.invoice_id=i.id),0) AS paid,v.id AS void_id,v.reason AS void_reason FROM purchase_invoices i LEFT JOIN invoice_voids v ON v.invoice_id=i.id`;
function decode(b:any):Invoice{return {...b,lines:JSON.parse(b.lines),supplier_snapshot:JSON.parse(b.supplier_snapshot)};}
export async function commerceState(d:Database){
 const out=await d.batch([
  d.prepare("SELECT * FROM suppliers ORDER BY name"),d.prepare(invoiceQuery+" ORDER BY i.date DESC,i.created_at DESC"),
  d.prepare("SELECT * FROM supplier_payments ORDER BY date DESC,created_at DESC"),
  d.prepare("SELECT r.invoice_id,r.tx_id,t.number,t.date,t.partner,t.total,EXISTS(SELECT 1 FROM transactions x WHERE x.reversal_of=t.id) AS reversed FROM invoice_receipts r JOIN transactions t ON t.id=r.tx_id")
 ]);
 return {suppliers:out[0].results,invoices:out[1].results.map(decode),payments:out[2].results,receiptLinks:out[3].results};
}
async function bill(d:Database,id:string){const row=await d.prepare(invoiceQuery+" WHERE i.id=?").bind(recordId(id)).first();if(!row)throw new Error("Không tìm thấy chứng từ mua.");return decode(row);}
async function receipt(d:Database,id:string){
 const row=await d.prepare("SELECT t.* FROM transactions t WHERE t.id=? AND t.type='RECEIPT' AND NOT EXISTS(SELECT 1 FROM transactions r WHERE r.reversal_of=t.id)").bind(recordId(id)).first();
 if(!row)throw new Error("Chọn phiếu nhập mua đã ghi sổ và chưa bị đảo.");
 const linked=await d.prepare("SELECT r.invoice_id FROM invoice_receipts r WHERE r.tx_id=? AND NOT EXISTS(SELECT 1 FROM invoice_voids v WHERE v.invoice_id=r.invoice_id)").bind(id).first();
 if(linked)throw new Error("Phiếu nhập này đã gắn với một chứng từ mua còn hiệu lực.");return row;
}
export async function mutateCommerce(d:Database,body:any,user:{displayName:string}){
 const action=body.action,id=recordId(body.id),p=body.payload??{},now=new Date().toISOString(),actor=user.displayName;
 const request=JSON.stringify({action,payload:p});
 const previous=await d.prepare("SELECT request,result FROM commerce_requests WHERE id=?").bind(id).first();
 if(previous){if(previous.request!==request)throw new Error("Mã yêu cầu đã được dùng cho nội dung khác.");return {...JSON.parse(previous.result),replayed:true};}
 if(!Number.isSafeInteger(body.revision)||body.revision<0)throw new Error("Cần tải lại dữ liệu trước khi ghi.");
 const statements=[d.prepare("INSERT INTO events(id,kind,detail,actor,created_at,expected_revision) VALUES(?,?,?,?,?,?)").bind(id,action,JSON.stringify(p),actor,now,body.revision)];
 let result:any={id};
 if(action==="supplier"){
  const supplier=prepareSupplier(p),keys=Object.keys(supplier);
  statements.push(d.prepare(`INSERT INTO suppliers(${keys.join(",")}) VALUES(${keys.map(()=>"?").join(",")}) ON CONFLICT(id) DO UPDATE SET ${keys.filter(k=>k!=="id").map(k=>k+"=excluded."+k).join(",")}`).bind(...keys.map(k=>(supplier as any)[k])));
  result={id:supplier.id};
 }else if(action==="invoice"){
  const prepared=prepareInvoice(p),supplier=await d.prepare("SELECT * FROM suppliers WHERE id=? AND active=1").bind(prepared.supplier_id).first();
  if(!supplier)throw new Error("Chọn nhà cung cấp đang hoạt động.");
  if(prepared.reference){const duplicate=await d.prepare("SELECT i.id FROM purchase_invoices i WHERE i.supplier_id=? AND i.reference=? AND NOT EXISTS(SELECT 1 FROM invoice_voids v WHERE v.invoice_id=i.id)").bind(prepared.supplier_id,prepared.reference).first();if(duplicate)throw new Error("Số chứng từ NCC đã tồn tại. Kiểm tra để tránh ghi nợ trùng.");}
  const number="MH-"+prepared.date.replaceAll("-","")+"-"+id.slice(0,8).toUpperCase();
  const values={id,number,...prepared,lines:JSON.stringify(prepared.lines),supplier_snapshot:JSON.stringify(supplier),created_at:now,actor},keys=Object.keys(values);
  statements.push(d.prepare(`INSERT INTO purchase_invoices(${keys.join(",")}) VALUES(${keys.map(()=>"?").join(",")})`).bind(...keys.map(k=>(values as any)[k])));
  const receiptIds=p.receipt_ids??[];if(!Array.isArray(receiptIds)||receiptIds.length>100||new Set(receiptIds).size!==receiptIds.length)throw new Error("Danh sách phiếu nhập không hợp lệ.");
  for(const tx of receiptIds){await receipt(d,tx);statements.push(d.prepare("INSERT INTO invoice_receipts(invoice_id,tx_id,event_id) VALUES(?,?,?)").bind(id,tx,id));}
  result={id,number};
 }else if(action==="payment"){
  const b=await bill(d,p.invoice_id),payment=validatePayment(b,p);
  statements.push(d.prepare("INSERT INTO supplier_payments(id,invoice_id,date,amount,method,reference,note,reversal_of,created_at,actor) VALUES(?,?,?,?,?,?,?,NULL,?,?)").bind(id,b.id,payment.date,payment.amount,payment.method,payment.reference,payment.note,now,actor));
 }else if(action==="reversePayment"){
  const original=await d.prepare("SELECT * FROM supplier_payments WHERE id=? AND reversal_of IS NULL").bind(recordId(p.payment_id)).first();
  if(!original)throw new Error("Không tìm thấy lần thanh toán gốc.");
  const date=documentDate(p.date),note=textValue(p.note,1000);if(!note||date<original.date)throw new Error("Nhập lý do và ngày đảo không trước ngày trả tiền gốc.");
  if(await d.prepare("SELECT id FROM supplier_payments WHERE reversal_of=?").bind(original.id).first())throw new Error("Lần thanh toán đã được đảo.");
  statements.push(d.prepare("INSERT INTO supplier_payments(id,invoice_id,date,amount,method,reference,note,reversal_of,created_at,actor) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(id,original.invoice_id,date,-original.amount,original.method,"Đảo "+original.id,note,original.id,now,actor));
 }else if(action==="voidInvoice"){
  const b=await bill(d,p.invoice_id),reason=textValue(p.reason,1000),date=documentDate(p.date);
  if(b.void_id)throw new Error("Chứng từ đã được hủy.");if(b.paid!==0)throw new Error("Còn thanh toán trên chứng từ. Đối soát và đảo các khoản trả trước khi hủy.");
  if(!reason||date<b.date)throw new Error("Nhập lý do và ngày hủy không trước ngày chứng từ.");
  const lastPayment=await d.prepare("SELECT MAX(date) AS date FROM supplier_payments WHERE invoice_id=?").bind(b.id).first();if(lastPayment?.date&&date<lastPayment.date)throw new Error("Ngày hủy không được trước lần xử lý thanh toán cuối.");
  statements.push(d.prepare("INSERT INTO invoice_voids(id,invoice_id,date,reason,actor,created_at) VALUES(?,?,?,?,?,?)").bind(id,b.id,date,reason,actor,now));
 }else if(action==="linkReceipt"){
  const b=await bill(d,p.invoice_id);if(b.void_id)throw new Error("Không gắn phiếu nhập vào chứng từ đã hủy.");await receipt(d,p.tx_id);
  statements.push(d.prepare("INSERT INTO invoice_receipts(invoice_id,tx_id,event_id) VALUES(?,?,?)").bind(b.id,p.tx_id,id));
 }else throw new Error("Thao tác mua hàng không được hỗ trợ.");
 statements.push(d.prepare("INSERT INTO commerce_requests(id,request,result) VALUES(?,?,?)").bind(id,request,JSON.stringify(result)));
 await d.batch(statements);return result;
}

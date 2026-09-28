import {scaled,today,validDate} from "./inventory.ts";

export type Supplier={id:string;code:string;name:string;contact:string;phone:string;email:string;address:string;tax_id:string;bank_name:string;bank_account:string;bank_holder:string;categories:string;terms_days:number;note:string;active:number;updated_at:string};
export type BillLine={item?:string;name:string;unit:string;quantity:number;price:number;amount:number};
export type Invoice={id:string;number:string;supplier_id:string;supplier_snapshot:Supplier;date:string;due_date:string;reference:string;buyer_name:string;buyer_address:string;lines:BillLine[];subtotal:number;discount:number;shipping:number;total:number;note:string;created_at:string;actor:string;paid:number;void_id:string|null;void_reason:string|null};
export type Payment={id:string;invoice_id:string;date:string;amount:number;method:string;reference:string;note:string;reversal_of:string|null;created_at:string;actor:string};
export type ReceiptLink={invoice_id:string;tx_id:string;number:string;date:string;partner:string;total:number;reversed:number};
export const PAYMENT_STATUS={unpaid:"Chưa thanh toán",partial:"Trả một phần",paid:"Đã thanh toán",void:"Đã hủy"};
export const METHODS={cash:"Tiền mặt",bank:"Chuyển khoản",other:"Khác"};
export function textValue(v:unknown,max=500){if(v==null)return "";if(typeof v!=="string"||v.length>max)throw new Error("Nội dung không hợp lệ hoặc quá dài.");return v.trim();}
export function moneyValue(v:unknown,zero=true){if(typeof v!=="number"||!Number.isSafeInteger(v)||v<(zero?0:1)||v>1e12)throw new Error("Số tiền phải là số nguyên VND hợp lệ.");return v;}
export function documentDate(v:unknown){if(typeof v!=="string"||!validDate(v)||v>today())throw new Error("Ngày chứng từ phải hợp lệ và không ở tương lai.");return v;}
export function recordId(v:unknown){if(typeof v!=="string"||! /^[a-zA-Z0-9-]{12,80}$/.test(v))throw new Error("Mã yêu cầu không hợp lệ.");return v;}
export function prepareSupplier(raw:any):Supplier{
 const p=raw??{},id=recordId(p.id),code=textValue(p.code,40).toUpperCase(),name=textValue(p.name,200);
 if(!/^[A-Z0-9_-]+$/.test(code)||!name)throw new Error("Điền mã và tên nhà cung cấp.");
 const terms_days=p.terms_days??0;if(!Number.isInteger(terms_days)||terms_days<0||terms_days>3650)throw new Error("Số ngày được nợ phải từ 0 đến 3650.");
 const email=textValue(p.email,200);if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error("Email nhà cung cấp chưa hợp lệ.");
 return {id,code,name,contact:textValue(p.contact,200),phone:textValue(p.phone,100),email,address:textValue(p.address,500),tax_id:textValue(p.tax_id,60),bank_name:textValue(p.bank_name,100),bank_account:textValue(p.bank_account,100),bank_holder:textValue(p.bank_holder,200),categories:textValue(p.categories,300),terms_days,note:textValue(p.note,2000),active:p.active===0||p.active===false?0:1,updated_at:new Date().toISOString()};
}
export function prepareInvoice(raw:any){
 const p=raw??{},date=documentDate(p.date),due_date=textValue(p.due_date,10);
 if(due_date&&(!validDate(due_date)||due_date<date))throw new Error("Hạn thanh toán không được trước ngày chứng từ.");
 if(!Array.isArray(p.lines)||!p.lines.length||p.lines.length>100)throw new Error("Chứng từ cần từ 1 đến 100 dòng hàng.");
 let subtotal=0;
 const lines:BillLine[]=p.lines.map((r:any)=>{
  const name=textValue(r.name,300),unit=textValue(r.unit,40),item=textValue(r.item,40),quantity=scaled(r.quantity)/1000,price=moneyValue(r.price);
  if(!name||!unit)throw new Error("Điền tên hàng và đơn vị cho từng dòng.");
  const amount=Math.round(quantity*price);moneyValue(amount);subtotal+=amount;
  return {item,name,unit,quantity,price,amount};
 });
 moneyValue(subtotal);const discount=moneyValue(p.discount??0),shipping=moneyValue(p.shipping??0);
 if(discount>subtotal)throw new Error("Giảm giá không được lớn hơn tiền hàng.");
 const total=moneyValue(subtotal-discount+shipping),buyer_name=textValue(p.buyer_name,200);
 if(!buyer_name)throw new Error("Nhập tên bên mua.");
 return {supplier_id:recordId(p.supplier_id),date,due_date,reference:textValue(p.reference,120),buyer_name,buyer_address:textValue(p.buyer_address,500),lines,subtotal,discount,shipping,total,note:textValue(p.note,2000)};
}
export function billStatus(b:Pick<Invoice,"void_id"|"total"|"paid"|"due_date">,asOf=today()){
 const outstanding=b.void_id?0:b.total-b.paid;
 const status:keyof typeof PAYMENT_STATUS=b.void_id?"void":outstanding===0?"paid":b.paid>0?"partial":"unpaid";
 return {status,outstanding,overdue:!b.void_id&&outstanding>0&&!!b.due_date&&b.due_date<asOf};
}
export function validatePayment(b:Invoice,p:any){
 if(b.void_id)throw new Error("Chứng từ đã hủy, không thể thanh toán.");
 const date=documentDate(p.date),amount=moneyValue(p.amount,false),method=textValue(p.method,20);
 if(date<b.date)throw new Error("Ngày trả tiền không được trước ngày chứng từ. Với đặt cọc, lập chứng từ từ ngày đặt mua.");
 if(!Object.hasOwn(METHODS,method))throw new Error("Chọn phương thức thanh toán.");
 if(amount>b.total-b.paid)throw new Error("Số trả vượt khoản còn nợ. Kiểm tra lại trước khi ghi.");
 return {date,amount,method,reference:textValue(p.reference,200),note:textValue(p.note,1000)};
}
export function supplierTotals(invoices:Invoice[],asOf=today()){
 const totals=new Map<string,{supplier_id:string;count:number;total:number;paid:number;outstanding:number;overdue:number}>();
 for(const b of invoices){if(b.void_id)continue;const s=billStatus(b,asOf),r=totals.get(b.supplier_id)??{supplier_id:b.supplier_id,count:0,total:0,paid:0,outstanding:0,overdue:0};r.count++;r.total+=b.total;r.paid+=b.paid;r.outstanding+=s.outstanding;if(s.overdue)r.overdue+=s.outstanding;totals.set(b.supplier_id,r);}
 return [...totals.values()];
}

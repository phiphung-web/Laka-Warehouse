export const KINDS = {unclassified:"Chưa phân loại",consumable:"Tiêu hao",reusable:"Tái sử dụng",equipment:"Dụng cụ / thiết bị"};
export const TYPES = {RECEIPT:"Nhập mua",TRANSFER:"Cấp / chuyển khu",RETURN:"Khu trả hàng",CONSUME:"Tiêu hao",DAMAGE:"Chuyển sang hàng hỏng",LOSS:"Mất / hủy hàng",SUPPLIER_RETURN:"Trả nhà cung cấp",COUNT:"Kiểm kê / số dư đầu",REVERSAL:"Đảo phiếu"};
export type TxType=keyof typeof TYPES;
export type Item={code:string;name:string;unit:string;category:string;kind:keyof typeof KINDS;note:string;active:number;pack_unit:string;pack_size:number};
export type Location={id:string;name:string;active:number};
export type Balance={item:string;location:string;condition:string;lot:string;expiry:string;quantity:number;verified_at:string|null};
export type Line={item:string;quantity:number;unitMode?:string;price?:number;lot?:string;expiry?:string;condition?:string};
export type TxInput={id:string;revision:number;type:TxType;date:string;from?:string;to?:string;partner?:string;person?:string;note?:string;reference?:string;lines:Line[];reversalOf?:string};
export type Posting=Balance;
export type State={items:Item[];locations:Location[];balances:Balance[];minimums:{item:string;location:string;quantity:number}[];transactions:any[];drafts:any[];events:any[];revision:number;user:string;source:any;suppliers:import("./commerce").Supplier[];invoices:import("./commerce").Invoice[];payments:import("./commerce").Payment[];receiptLinks:import("./commerce").ReceiptLink[]};
export function today(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}
export function normalize(s:string){return s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").replace(/Đ/g,"D").toLowerCase();}
export function scaled(n:unknown,allowZero=false){
 if(typeof n!=="number"||!Number.isFinite(n)||n<0||(!allowZero&&n===0)||n>1e9||Math.abs(n*1000-Math.round(n*1000))>1e-5)throw new Error("Số lượng phải hợp lệ, tối đa 3 chữ số thập phân.");
 return Math.round(n*1000);
}
export function validDate(s:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+"T00:00:00Z");return !Number.isNaN(+d)&&d.toISOString().slice(0,10)===s;}
export function key(b:Pick<Balance,"item"|"location"|"condition"|"lot"|"expiry">){return [b.item,b.location,b.condition,b.lot,b.expiry].join("\u001f");}
export function prepareTransaction(input:TxInput,items:Item[],locations:Location[],balances:Balance[],now:string){
 if(!input||!Object.hasOwn(TYPES,input.type)||input.type==="REVERSAL")throw new Error("Loại phiếu không hợp lệ.");
 if(!validDate(input.date)||input.date>today())throw new Error("Ngày ghi nhận phải hợp lệ và không ở tương lai.");
 if(!Array.isArray(input.lines)||!input.lines.length||input.lines.length>100)throw new Error("Phiếu cần từ 1 đến 100 dòng hàng.");
 const loc=(id:string|undefined)=>{if(!locations.some(l=>l.id===id&&l.active))throw new Error("Chọn khu đang hoạt động.");return id!;};
 const transfer=["TRANSFER","RETURN"].includes(input.type);
 const outgoing=["TRANSFER","RETURN","CONSUME","DAMAGE","LOSS","SUPPLIER_RETURN"].includes(input.type);
 const from=outgoing?loc(input.from):null,to=transfer||input.type==="RECEIPT"||input.type==="COUNT"?loc(input.to):null;
 if(transfer&&from===to)throw new Error("Nơi xuất và nơi nhận phải khác nhau.");
 if((transfer||input.type==="RECEIPT")&&!input.person?.trim())throw new Error("Nhập người nhận / kiểm hàng.");
 if(["RECEIPT","SUPPLIER_RETURN"].includes(input.type)&&!input.partner?.trim())throw new Error("Nhập nhà cung cấp.");
 if(["CONSUME","DAMAGE","LOSS","SUPPLIER_RETURN","COUNT"].includes(input.type)&&!input.note?.trim())throw new Error("Ghi lý do hoặc nội dung kiểm kê.");
 const stock=new Map(balances.map(b=>[key(b),b]));const seen=new Set<string>();const postings:Posting[]=[];let total=0;
 const lines=input.lines.map(line=>{
  const item=items.find(i=>i.code===line.item&&i.active);if(!item)throw new Error("Mặt hàng không tồn tại hoặc đã ngừng dùng.");
  if(!["base","pack",undefined].includes(line.unitMode))throw new Error("Đơn vị nhập không hợp lệ.");
  if(line.unitMode==="pack"&&!item.pack_unit)throw new Error("Mặt hàng chưa có quy đổi đơn vị.");
  let qty=scaled(line.quantity,input.type==="COUNT");if(line.unitMode==="pack"){const converted=qty*item.pack_size/1000;if(!Number.isSafeInteger(converted))throw new Error("Quy đổi vượt độ chính xác 0,001 đơn vị.");qty=converted;}
  if(!Number.isSafeInteger(qty)||qty>1e12)throw new Error("Số lượng vượt giới hạn.");
  const condition=line.condition??"usable";if(!["usable","damaged"].includes(condition))throw new Error("Tình trạng hàng không hợp lệ.");
  if(["CONSUME","DAMAGE"].includes(input.type)&&condition!=="usable")throw new Error("Chọn hàng đang dùng được.");
  if(input.type==="CONSUME"&&item.kind!=="consumable")throw new Error(item.name+": cần phân loại là hàng tiêu hao. Đồ dùng nhiều lần dùng phiếu chuyển khu.");
  const lot=(line.lot??"").trim(),expiry=line.expiry??"";if(lot.length>80||expiry&&!validDate(expiry))throw new Error("Lô / hạn dùng không hợp lệ.");
  const base={item:item.code,location:from??to!,condition,lot,expiry};const k=key(base);
  if(seen.has(k))throw new Error("Một mặt hàng / lô / tình trạng đang lặp trong phiếu. Gộp số lượng vào một dòng.");seen.add(k);
  const current=stock.get(k);if(outgoing&&!current?.verified_at)throw new Error(item.name+": cần kiểm kê xác nhận số dư tại nơi xuất trước.");
  if(outgoing&&(current?.quantity??0)<qty)throw new Error(item.name+": số xuất vượt tồn của lô đã chọn.");
  const push=(location:string,quantity:number,cond=condition,verified_at:string|null=null)=>postings.push({...base,location,quantity,condition:cond,verified_at});
  if(input.type==="COUNT")push(to!,qty-(current?.quantity??0),condition,now);
  else if(input.type==="RECEIPT")push(to!,qty);
  else if(transfer){push(from!,-qty);push(to!,qty);}
  else if(input.type==="DAMAGE"){push(from!,-qty);push(from!,qty,"damaged");}
  else push(from!,-qty);
  const priceMissing=line.price===undefined;const price=line.price??0;if(typeof price!=="number"||!Number.isSafeInteger(price)||price<0||price>1e12)throw new Error("Đơn giá VND phải là số nguyên không âm.");
  const amount=input.type==="RECEIPT"?Math.round(line.quantity*price):0;total+=amount;
  if(!Number.isSafeInteger(total)||total>1e15)throw new Error("Giá trị phiếu vượt giới hạn.");
  return {...line,lot,expiry,condition,itemName:item.name,baseUnit:item.unit,enteredUnit:line.unitMode==="pack"?item.pack_unit:item.unit,baseQuantity:qty/1000,price,priceMissing,amount,before:(current?.quantity??0)/1000,difference:input.type==="COUNT"?(qty-(current?.quantity??0))/1000:undefined};
 });
 return {from,to,lines,postings,total};
}

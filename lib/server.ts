import {getDatabase, SQLiteStore} from "./sqlite";
import {readSource} from "./source";
import { getWarehouseUser } from "./auth-server";
import {COMMERCE_ACTIONS,COMMERCE_TABLES,commerceState,mutateCommerce} from "./commerce-server";
import { prepareTransaction, scaled, KINDS, today, validDate, type TxInput, type Item, type Location, type Balance, sanitizeAreaPrefix, KIND_PREFIX_MAP } from "./inventory";
import { canonicalJson } from "./auto-code";
export function db(){return getDatabase();}
const initialLocations=[["KHO_TONG","Kho tổng"],["BUONG_PHONG","Buồng phòng"],["HOMESTAY","Homestay / Lễ tân"],["BEP","Bếp"],["NHA_HANG","Nhà hàng bên ngoài"],["CAFE","Cafe"],["DUNG_CHUNG","Dùng chung"]];
export async function identity(){
 const user=await getWarehouseUser();if(!user)throw new Error("AUTH_REQUIRED");
 const d=db(),now=new Date().toISOString();
 await d.prepare("INSERT OR IGNORE INTO settings (id,owner,revision,seeded,created_at) VALUES (1,?,0,0,?)").bind(user.userId,now).run();
 const config=await d.prepare("SELECT * FROM settings WHERE id=1").first<any>();
 if(config.owner!==user.userId)throw new Error("FORBIDDEN");
 if(!config.seeded){
  const source=readSource();
  const stmts=source.items.map(i=>d.prepare("INSERT OR IGNORE INTO items (code,name,unit,category,kind,note,active,pack_unit,pack_size,updated_at) VALUES (?,?,?,?,'unclassified',?,1,'',1000,?)").bind(i.code,i.name,i.unit,i.category,i.note,now));
  stmts.push(...initialLocations.map(([id,name])=>d.prepare("INSERT OR IGNORE INTO locations(id,name,active) VALUES (?,?,1)").bind(id,name)));
  for(let i=0;i<stmts.length;i+=60)await d.batch(stmts.slice(i,i+60));
  await d.prepare("UPDATE settings SET seeded=1 WHERE id=1").run();
 }
 return user;
}
export async function state(user:any){
 const source=readSource();
 const d=db();const out=await d.batch([
  d.prepare("SELECT * FROM items ORDER BY code"),
  d.prepare("SELECT * FROM locations ORDER BY CASE WHEN id='KHO_TONG' THEN 0 ELSE 1 END,name"),
  d.prepare("SELECT * FROM balances"),
  d.prepare("SELECT * FROM minimums"),
  d.prepare("SELECT id,number,type,date,from_location,to_location,partner,person,note,reference,lines,total,created_at,actor,reversal_of FROM transactions ORDER BY created_at DESC,id DESC LIMIT 500"),
  d.prepare("SELECT * FROM drafts ORDER BY updated_at DESC"),
  d.prepare("SELECT id,kind,detail,actor,created_at FROM events ORDER BY created_at DESC,id DESC LIMIT 300"),
  d.prepare("SELECT revision FROM settings WHERE id=1"),
  d.prepare("SELECT COUNT(*) as n FROM transactions WHERE date=?").bind(today()),
 ]);
 return {...await commerceState(d),items:out[0].results,locations:out[1].results,balances:out[2].results,minimums:out[3].results,
 transactions:out[4].results.map((t:any)=>({...t,lines:JSON.parse(t.lines)})),drafts:out[5].results.map((t:any)=>({...t,payload:JSON.parse(t.payload)})),
 events:out[6].results,revision:(out[7].results[0] as any).revision,todayTxCount:(out[8].results[0] as any)?.n??0,user:user.displayName,
 source:{title:source.sourceTitle,id:source.sourceId,date:source.importedAt,items:source.items.length,history:source.history}};
}
function clean(v:unknown,max=500){if(v===undefined||v===null)return "";if(typeof v!=="string"||v.length>max)throw new Error("Nội dung không hợp lệ hoặc quá dài.");return v.trim();}
function uuid(v:unknown){if(typeof v!=="string"||! /^[a-zA-Z0-9-]{12,80}$/.test(v))throw new Error("Mã yêu cầu không hợp lệ.");return v;}
function event(id:string,kind:string,detail:string,actor:string,revision:number,now:string){
 if(!Number.isSafeInteger(revision)||revision<0)throw new Error("Cần tải lại dữ liệu trước khi ghi.");
 return db().prepare("INSERT INTO events (id,kind,detail,actor,created_at,expected_revision) VALUES (?,?,?,?,?,?)").bind(id,kind,detail,actor,now,revision);
}
export async function postTransaction(raw:TxInput,user:any){
 const d=db(),id=uuid(raw.id),request=JSON.stringify(raw),now=new Date().toISOString();
 const existing=await d.prepare("SELECT id,number,request FROM transactions WHERE id=?").bind(id).first<any>();
 if(existing){if(existing.request!==request)throw new Error("Mã yêu cầu đã được dùng cho một phiếu khác.");return {id,number:existing.number,replayed:true};}
 const note=clean(raw.note,2000),partner=clean(raw.partner,200),person=clean(raw.person,200),reference=clean(raw.reference,200);
 let prepared:any,reversal:string|null=null;
 if(raw.type==="REVERSAL"){
  if(!note)throw new Error("Nhập lý do đảo phiếu.");if(!validDate(raw.date)||raw.date>today())throw new Error("Ngày đảo phiếu không hợp lệ.");
  const original=await d.prepare("SELECT * FROM transactions WHERE id=?").bind(uuid(raw.reversalOf)).first<any>();
  if(!original||["COUNT","REVERSAL"].includes(original.type))throw new Error("Phiếu này không thể đảo. Với kiểm kê, lập phiếu kiểm kê mới.");
  const already=await d.prepare("SELECT id FROM transactions WHERE reversal_of=?").bind(original.id).first();
  if(already)throw new Error("Phiếu đã được đảo trước đó.");
  const posts=await d.prepare("SELECT item,location,condition,lot,expiry,quantity FROM ledger WHERE tx=?").bind(original.id).all<any>();
  prepared={from:original.to_location,to:original.from_location,lines:JSON.parse(original.lines),total:-original.total,postings:posts.results.map(p=>({...p,quantity:-p.quantity,verified_at:null}))};reversal=original.id;
 }else{
  const out=await d.batch([d.prepare("SELECT * FROM items"),d.prepare("SELECT * FROM locations"),d.prepare("SELECT * FROM balances")]);
  prepared=prepareTransaction({...raw,note,person,partner},out[0].results as Item[],out[1].results as Location[],out[2].results as Balance[],now);
 }
 const number=(raw.type==="COUNT"?"KK":raw.type==="RECEIPT"?"NK":raw.type==="REVERSAL"?"DP":"PX")+"-"+now.slice(0,10).replaceAll("-","")+"-"+id.slice(0,8).toUpperCase();
 const stmts=[event(id,raw.type,number+" · "+note,user.displayName,raw.revision,now),
 d.prepare("INSERT INTO transactions (id,number,type,date,from_location,to_location,partner,person,note,reference,lines,request,total,created_at,actor,reversal_of) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(id,number,raw.type,raw.date,prepared.from,prepared.to,partner,person,note,reference,JSON.stringify(prepared.lines),request,prepared.total,now,user.displayName,reversal)];
 for(const p of prepared.postings)stmts.push(d.prepare("INSERT INTO ledger (tx,item,location,condition,lot,expiry,quantity,verified_at) VALUES (?,?,?,?,?,?,?,?)").bind(id,p.item,p.location,p.condition,p.lot,p.expiry,p.quantity,p.verified_at));
 stmts.push(d.prepare("DELETE FROM drafts WHERE id=?").bind(id));await d.batch(stmts);return {id,number};
}
export async function allocateNextItemCode(d:SQLiteStore,prefix:string):Promise<string>{
 const existing=(await d.prepare("SELECT code FROM items WHERE code LIKE ?").bind(`${prefix}%`).all<{code:string}>()).results;
 const usedNums=new Set<number>();
 const escapedPrefix=prefix.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
 const re=new RegExp(`^${escapedPrefix}(\\d+)$`);
 for(const r of existing){
  const m=r.code.match(re);
  if(m)usedNums.add(parseInt(m[1],10));
 }
 let seq=1;
 while(usedNums.has(seq))seq++;
 return `${prefix}${String(seq).padStart(4,"0")}`;
}
export async function mutate(body:any,user:any){
 const d=db(),now=new Date().toISOString(),id=uuid(body.id),action=body.action;
 if(COMMERCE_ACTIONS.includes(action))return mutateCommerce(d,body,user);
 if(action==="transaction")return postTransaction(body.payload,user);
 if(action==="draft"){
  if(JSON.stringify(body.payload).length>100000||body.payload?.id!==id)throw new Error("Phiếu nháp không hợp lệ.");
  const committed=await d.prepare("SELECT id FROM transactions WHERE id=?").bind(id).first();if(committed)throw new Error("Phiếu đã ghi sổ.");
  await d.prepare("INSERT INTO drafts (id,payload,updated_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at").bind(id,JSON.stringify(body.payload),now).run();return {id};
 }
 if(action==="deleteDraft"){await d.prepare("DELETE FROM drafts WHERE id=?").bind(id).run();return {id};}
 const p=body.payload??{};
 if(action==="item"){
  const request=canonicalJson({action:"item",payload:p,create:body.create});
  const previous=await d.prepare("SELECT request,result FROM catalog_requests WHERE id=?").bind(id).first<any>();
  if(previous){
   if(previous.request!==request)throw new Error("Mã yêu cầu đã được dùng cho nội dung khác.");
   return {...JSON.parse(previous.result),replayed:true};
  }
  const usedEvent=await d.prepare("SELECT id FROM events WHERE id=?").bind(id).first();
  if(usedEvent)throw new Error("Mã yêu cầu đã được dùng cho nội dung khác.");

  let code=clean(p.code,40);
  let old:any=null;
  if(code){
   if(!/^[\p{L}\p{N}_-]+$/u.test(code))throw new Error("Mã hàng chỉ gồm chữ, số, dấu gạch.");
   old=await d.prepare("SELECT * FROM items WHERE code=?").bind(code).first<any>();
  }

  let isCreate:boolean;
  if(body.create===true){
   isCreate=true;
   if(old)throw new Error("Mã hàng đã tồn tại.");
  }else if(body.create===false){
   isCreate=false;
   if(!code)throw new Error("Thiếu mã hàng khi cập nhật.");
   if(!old)throw new Error("Mặt hàng không tồn tại.");
  }else{
   if(!code)throw new Error("Thiếu mã hàng khi cập nhật.");
   if(old){
    isCreate=false;
   }else{
    isCreate=true;
   }
  }

  if(!code){
   const areaPrefix=sanitizeAreaPrefix(p.usage_location);
   const kindPrefix=KIND_PREFIX_MAP[p.kind||"unclassified"]||"CL";
   const prefix=`${areaPrefix}-${kindPrefix}-`;
   code=await allocateNextItemCode(d,prefix);
  }

  const name=clean(p.name,300);
  const unit=clean(p.unit||"Cái",40);
  const category=clean(p.category||"Chung",100);
  const kind=clean(p.kind||"unclassified",30);
  const usageLocation=p.usage_location!==undefined?(p.usage_location?clean(p.usage_location,80):null):(old?old.usage_location:null);
  const packUnit=clean(p.pack_unit,40);
  const size=packUnit?scaled(p.packSize):1000;
  const note=clean(p.note,2000);
  const active=p.active===false||p.active===0?0:1;
  if(!name)throw new Error("Điền tên mặt hàng.");
  if(!unit)throw new Error("Điền đơn vị tính.");
  if(!Object.hasOwn(KINDS,kind))throw new Error("Loại quản lý không hợp lệ.");
  if(usageLocation){
   const loc=await d.prepare("SELECT id FROM locations WHERE id=? AND active=1").bind(usageLocation).first();
   if(!loc)throw new Error("Khu dự kiến không hợp lệ hoặc đã ngừng dùng.");
  }
  if(old&&old.unit!==unit){
   const used=await d.prepare("SELECT id FROM ledger WHERE item=? LIMIT 1").bind(code).first();
   if(used)throw new Error("Hàng đã phát sinh. Giữ đơn vị gốc; dùng quy đổi hoặc tạo mã mới.");
  }
  const hasInitialStock=isCreate&&p.initial_quantity!==undefined&&p.initial_quantity!==null&&String(p.initial_quantity).trim()!=="";
  let initialQty=0,initialLocation="KHO_TONG",initialDate=today(),initialLot="",initialExpiry="",initialCondition="usable";
  if(hasInitialStock){
   const rawNum=Number(p.initial_quantity);
   if(Number.isNaN(rawNum))throw new Error("Số lượng ban đầu đã xác nhận không hợp lệ.");
   initialQty=scaled(rawNum,true);
   if(initialQty<0)throw new Error("Số lượng ban đầu không được âm.");
   initialLocation=clean(p.initial_location||"KHO_TONG",80);
   const loc=await d.prepare("SELECT id FROM locations WHERE id=? AND active=1").bind(initialLocation).first();
   if(!loc)throw new Error("Chọn khu nhận hàng đang hoạt động.");
   initialDate=clean(p.initial_date||today(),10);
   if(!validDate(initialDate)||initialDate>today())throw new Error("Ngày ghi nhận phải hợp lệ và không ở tương lai.");
   initialLot=clean(p.initial_lot||"",80);
   initialExpiry=clean(p.initial_expiry||"",10);
   if(initialExpiry&&!validDate(initialExpiry))throw new Error("Hạn dùng không hợp lệ.");
   initialCondition=clean(p.initial_condition||"usable",20);
   if(!["usable","damaged"].includes(initialCondition))throw new Error("Tình trạng hàng không hợp lệ.");
  }
  const statements:any[]=[];
  statements.push(event(id,"item",JSON.stringify(p),user.displayName,body.revision,now));
  if(isCreate){
   statements.push(d.prepare("INSERT INTO items (code,name,unit,category,kind,note,active,pack_unit,pack_size,usage_location,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)").bind(code,name,unit,category,kind,note,active,packUnit,size,usageLocation,now));
  }else{
   statements.push(d.prepare("UPDATE items SET name=?,unit=?,category=?,kind=?,note=?,active=?,pack_unit=?,pack_size=?,usage_location=?,updated_at=? WHERE code=?").bind(name,unit,category,kind,note,active,packUnit,size,usageLocation,now,code));
  }
  let countNumber:string|undefined=undefined;
  if(hasInitialStock){
   const txId=id+"-init";
   countNumber="KK-"+initialDate.replaceAll("-","")+"-"+id.slice(0,8).toUpperCase();
   const countQty=initialQty/1000;
   const txLine={item:code,quantity:countQty,unitMode:"base",price:0,lot:initialLot,expiry:initialExpiry,condition:initialCondition,itemName:name,baseUnit:unit,enteredUnit:unit,baseQuantity:countQty,priceMissing:true,amount:0,before:0,difference:countQty};
   const txRequest=JSON.stringify({id:txId,type:"COUNT",date:initialDate,to:initialLocation,lines:[txLine]});
   statements.push(event(txId,"COUNT",countNumber+" · Số dư ban đầu đã xác nhận",user.displayName,body.revision+1,now));
   statements.push(d.prepare("INSERT INTO transactions (id,number,type,date,from_location,to_location,partner,person,note,reference,lines,request,total,created_at,actor,reversal_of) VALUES (?,?,?,?,NULL,?,?,?,?,?,?,?,?,?,?,NULL)").bind(txId,countNumber,"COUNT",initialDate,initialLocation,"",user.displayName,"Số lượng ban đầu đã xác nhận","Mốc ban đầu khi tạo mã",JSON.stringify([txLine]),txRequest,0,now,user.displayName));
   statements.push(d.prepare("INSERT INTO ledger (tx,item,location,condition,lot,expiry,quantity,verified_at) VALUES (?,?,?,?,?,?,?,?)").bind(txId,code,initialLocation,initialCondition,initialLot,initialExpiry,initialQty,now));
  }
  const resultObj={id,code,...(countNumber?{countNumber,countRef:countNumber}:{})};
  statements.push(d.prepare("INSERT INTO catalog_requests (id,request,result) VALUES (?,?,?)").bind(id,request,JSON.stringify(resultObj)));
  await d.batch(statements);
  return resultObj;
 }else if(action==="location"){
  const name=clean(p.name,100),locId=p.id?clean(p.id,80):"loc-"+crypto.randomUUID();if(!name||!/^[A-Za-z0-9_-]+$/.test(locId))throw new Error("Tên / mã khu không hợp lệ.");
  const active=p.active===false||p.active===0?0:1;
  if(!active){const balance=await d.prepare("SELECT item FROM balances WHERE location=? AND quantity<>0 LIMIT 1").bind(locId).first();if(balance)throw new Error("Khu vẫn còn hàng. Chuyển hết hàng trước khi ngừng dùng.");}
  const audit=event(id,"location",JSON.stringify({id:locId,name,active}),user.displayName,body.revision,now);
  await d.batch([audit,d.prepare("INSERT INTO locations(id,name,active) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,active=excluded.active").bind(locId,name,active)]);
 }else if(action==="minimum"){
  const minItem=clean(p.item,40),minLoc=clean(p.location,80),minQty=scaled(p.quantity,true);
  const audit=event(id,"minimum",JSON.stringify({item:minItem,location:minLoc,quantity:minQty}),user.displayName,body.revision,now);
  await d.batch([audit,d.prepare("INSERT INTO minimums(item,location,quantity) VALUES (?,?,?) ON CONFLICT(item,location) DO UPDATE SET quantity=excluded.quantity").bind(minItem,minLoc,minQty)]);
 }else throw new Error("Thao tác không được hỗ trợ.");return {id};
}
export async function stockFlowReport(params:URLSearchParams){
 const d=db();
 const to=clean(params.get("to")||today(),10);
 if(!validDate(to))throw new Error("Ngày 'Đến ngày' không hợp lệ.");
 const from=clean(params.get("from")||to.slice(0,7)+"-01",10);
 if(!validDate(from))throw new Error("Ngày 'Từ ngày' không hợp lệ.");
 if(from>to)throw new Error("Khoảng ngày không hợp lệ: 'Từ ngày' phải trước hoặc bằng 'Đến ngày'.");
 const location=clean(params.get("location")||"",80);
 const item=clean(params.get("item")||"",80);
 const usage=clean(params.get("usage")||"",80);
 if(location&&location!=="all"){
  const loc=await d.prepare("SELECT id FROM locations WHERE id=?").bind(location).first();
  if(!loc)throw new Error("Khu thực tế không tồn tại.");
 }
 if(item&&item!=="all"){
  const it=await d.prepare("SELECT code FROM items WHERE code=?").bind(item).first();
  if(!it)throw new Error("Mặt hàng không tồn tại.");
 }
 if(usage&&usage!=="all"&&usage!=="unassigned"){
  const uLoc=await d.prepare("SELECT id FROM locations WHERE id=?").bind(usage).first();
  if(!uLoc)throw new Error("Khu dự kiến không tồn tại.");
 }
 const filters={from,to,location:location||"all",item:item||"all",usage:usage||"all"};
 const whereClauses:string[]=["t.date <= ?"];
 const whereBindings:any[]=[to];
 if(location&&location!=="all"){whereClauses.push("l.location = ?");whereBindings.push(location);}
 if(item&&item!=="all"){whereClauses.push("l.item = ?");whereBindings.push(item);}
 if(usage&&usage!=="all"){
  if(usage==="unassigned")whereClauses.push("i.usage_location IS NULL");
  else{whereClauses.push("i.usage_location = ?");whereBindings.push(usage);}
 }
 const sql=`
 SELECT
  l.item,i.name as item_name,i.unit,i.category,i.kind,i.usage_location,u.name as usage_location_name,
  l.location,loc.name as location_name,l.condition,
  SUM(CASE WHEN t.date < ? THEN l.quantity ELSE 0 END) as opening,
  SUM(CASE WHEN t.date >= ? AND t.date <= ? AND t.type = 'RECEIPT' THEN l.quantity ELSE 0 END) as receipt,
  SUM(CASE WHEN t.date >= ? AND t.date <= ? AND t.type = 'TRANSFER' AND l.quantity > 0 THEN l.quantity ELSE 0 END) as transfer_in,
  SUM(CASE WHEN t.date >= ? AND t.date <= ? AND t.type = 'TRANSFER' AND l.quantity < 0 THEN -l.quantity ELSE 0 END) as transfer_out,
  SUM(CASE WHEN t.date >= ? AND t.date <= ? AND t.type = 'RETURN' AND l.quantity > 0 THEN l.quantity ELSE 0 END) as return_in,
  SUM(CASE WHEN t.date >= ? AND t.date <= ? AND t.type = 'RETURN' AND l.quantity < 0 THEN -l.quantity ELSE 0 END) as return_out,
  SUM(CASE WHEN t.date >= ? AND t.date <= ? AND t.type = 'CONSUME' THEN -l.quantity ELSE 0 END) as consumption,
  SUM(CASE WHEN t.date >= ? AND t.date <= ? AND t.type = 'DAMAGE' AND l.quantity > 0 THEN l.quantity ELSE 0 END) as damage_in,
  SUM(CASE WHEN t.date >= ? AND t.date <= ? AND t.type = 'DAMAGE' AND l.quantity < 0 THEN -l.quantity ELSE 0 END) as damage_out,
  SUM(CASE WHEN t.date >= ? AND t.date <= ? AND t.type = 'LOSS' THEN -l.quantity ELSE 0 END) as loss,
  SUM(CASE WHEN t.date >= ? AND t.date <= ? AND t.type = 'SUPPLIER_RETURN' THEN -l.quantity ELSE 0 END) as supplier_return,
  SUM(CASE WHEN t.date >= ? AND t.date <= ? AND t.type = 'COUNT' THEN l.quantity ELSE 0 END) as count_adjustment,
  SUM(CASE WHEN t.date >= ? AND t.date <= ? AND t.type = 'REVERSAL' THEN l.quantity ELSE 0 END) as reversal,
  SUM(CASE WHEN t.date >= ? AND t.date <= ? THEN l.quantity ELSE 0 END) as period_net,
  SUM(CASE WHEN t.date <= ? THEN l.quantity ELSE 0 END) as closing,
  SUM(CASE WHEN t.date >= ? AND t.date <= ? THEN 1 ELSE 0 END) as in_range_count
 FROM ledger l
 JOIN transactions t ON t.id = l.tx
 JOIN items i ON i.code = l.item
 LEFT JOIN locations u ON u.id = i.usage_location
 JOIN locations loc ON loc.id = l.location
 WHERE ${whereClauses.join(" AND ")}
 GROUP BY l.item, l.location, l.condition
 HAVING opening <> 0 OR in_range_count > 0 OR closing <> 0
 ORDER BY i.name ASC, loc.name ASC, l.condition ASC`;
 const selectBindings=[from,from,to,from,to,from,to,from,to,from,to,from,to,from,to,from,to,from,to,from,to,from,to,from,to,from,to,to,from,to];
 const rawRows=(await d.prepare(sql).bind(...selectBindings,...whereBindings).all<any>()).results;
  const rows=rawRows.map(r=>({
   item:r.item,itemName:r.item_name,unit:r.unit,category:r.category,kind:r.kind,
   usageLocation:r.usage_location,usageLocationName:r.usage_location_name||"Chưa gán",
   location:r.location,locationName:r.location_name,condition:r.condition,
   opening:r.opening/1000,receipt:r.receipt/1000,
   transferIn:r.transfer_in/1000,transferOut:r.transfer_out/1000,
   returnIn:r.return_in/1000,returnOut:r.return_out/1000,
   consumption:r.consumption/1000,damageIn:r.damage_in/1000,damageOut:r.damage_out/1000,
   damageNet:(r.damage_in-r.damage_out)/1000,loss:r.loss/1000,supplierReturn:r.supplier_return/1000,
   countAdjustment:r.count_adjustment/1000,reversal:r.reversal/1000,
   periodNet:r.period_net/1000,closing:r.closing/1000
  }));
  const unitMap=new Map<string,any>();
  for(const r of rows){
   if(!unitMap.has(r.unit)){
    unitMap.set(r.unit,{unit:r.unit,opening:0,receipt:0,transferIn:0,transferOut:0,returnIn:0,returnOut:0,consumption:0,damageIn:0,damageOut:0,damageNet:0,loss:0,supplierReturn:0,countAdjustment:0,reversal:0,periodNet:0,closing:0,itemCount:new Set<string>()});
   }
   const u=unitMap.get(r.unit);
   u.opening+=r.opening;u.receipt+=r.receipt;u.transferIn+=r.transferIn;u.transferOut+=r.transferOut;
   u.returnIn+=r.returnIn;u.returnOut+=r.returnOut;u.consumption+=r.consumption;u.damageIn+=r.damageIn;
   u.damageOut+=r.damageOut;u.damageNet+=r.damageNet;u.loss+=r.loss;u.supplierReturn+=r.supplierReturn;
   u.countAdjustment+=r.countAdjustment;u.reversal+=r.reversal;u.periodNet+=r.periodNet;u.closing+=r.closing;
   u.itemCount.add(r.item);
  }
  const summaryByUnit=Array.from(unitMap.values()).map(u=>({
   ...u,itemCount:u.itemCount.size,
   opening:Math.round(u.opening*1000)/1000,receipt:Math.round(u.receipt*1000)/1000,
   transferIn:Math.round(u.transferIn*1000)/1000,transferOut:Math.round(u.transferOut*1000)/1000,
   returnIn:Math.round(u.returnIn*1000)/1000,returnOut:Math.round(u.returnOut*1000)/1000,
   consumption:Math.round(u.consumption*1000)/1000,damageIn:Math.round(u.damageIn*1000)/1000,
   damageOut:Math.round(u.damageOut*1000)/1000,damageNet:Math.round(u.damageNet*1000)/1000,
   loss:Math.round(u.loss*1000)/1000,supplierReturn:Math.round(u.supplierReturn*1000)/1000,
   countAdjustment:Math.round(u.countAdjustment*1000)/1000,reversal:Math.round(u.reversal*1000)/1000,
   periodNet:Math.round(u.periodNet*1000)/1000,closing:Math.round(u.closing*1000)/1000
  }));
  const edgeWhere:string[]=["t.date >= ?","t.date <= ?","t.type IN ('TRANSFER','RETURN')","l.quantity > 0"];
  const edgeBindings:any[]=[from,to];
  if(location&&location!=="all"){edgeWhere.push("(t.from_location = ? OR t.to_location = ?)");edgeBindings.push(location,location);}
  if(item&&item!=="all"){edgeWhere.push("l.item = ?");edgeBindings.push(item);}
  if(usage&&usage!=="all"){
   if(usage==="unassigned")edgeWhere.push("i.usage_location IS NULL");
   else{edgeWhere.push("i.usage_location = ?");edgeBindings.push(usage);}
  }
  const edgeSql=`SELECT t.from_location as from_id,COALESCE(fl.name,t.from_location,'Bên ngoài') as from_name,t.to_location as to_id,COALESCE(tl.name,t.to_location,'Bên ngoài') as to_name,l.item,i.name as item_name,i.unit,COUNT(DISTINCT t.id) as tx_count,SUM(l.quantity) as quantity FROM ledger l JOIN transactions t ON t.id=l.tx JOIN items i ON i.code=l.item LEFT JOIN locations fl ON fl.id=t.from_location LEFT JOIN locations tl ON tl.id=t.to_location WHERE ${edgeWhere.join(" AND ")} GROUP BY t.from_location,t.to_location,l.item ORDER BY quantity DESC`;
  const rawEdges=(await d.prepare(edgeSql).bind(...edgeBindings).all<any>()).results;
  const transferEdges=rawEdges.map(e=>({fromId:e.from_id,fromName:e.from_name,toId:e.to_id,toName:e.to_name,item:e.item,itemName:e.item_name,unit:e.unit,txCount:e.tx_count,quantity:e.quantity/1000}));
  const dailyWhere=["t.date >= ?","t.date <= ?"];
  const dailyBindings=[from,to];
  if(location&&location!=="all"){dailyWhere.push("l.location = ?");dailyBindings.push(location);}
  if(item&&item!=="all"){dailyWhere.push("l.item = ?");dailyBindings.push(item);}
  if(usage&&usage!=="all"){
   if(usage==="unassigned")dailyWhere.push("i.usage_location IS NULL");
   else{dailyWhere.push("i.usage_location = ?");dailyBindings.push(usage);}
  }
  const dailySql=`SELECT t.date,i.unit,SUM(CASE WHEN t.type = 'RECEIPT' THEN l.quantity ELSE 0 END) as receipt,SUM(CASE WHEN t.type = 'TRANSFER' AND l.quantity > 0 THEN l.quantity ELSE 0 END) as transfer_in,SUM(CASE WHEN t.type = 'TRANSFER' AND l.quantity < 0 THEN -l.quantity ELSE 0 END) as transfer_out,SUM(CASE WHEN t.type = 'RETURN' AND l.quantity > 0 THEN l.quantity ELSE 0 END) as return_in,SUM(CASE WHEN t.type = 'RETURN' AND l.quantity < 0 THEN -l.quantity ELSE 0 END) as return_out,SUM(CASE WHEN t.type = 'CONSUME' THEN -l.quantity ELSE 0 END) as consumption,SUM(CASE WHEN t.type = 'DAMAGE' AND l.quantity > 0 THEN l.quantity ELSE 0 END) as damage_in,SUM(CASE WHEN t.type = 'DAMAGE' AND l.quantity < 0 THEN -l.quantity ELSE 0 END) as damage_out,SUM(CASE WHEN t.type = 'LOSS' THEN -l.quantity ELSE 0 END) as loss,SUM(CASE WHEN t.type = 'SUPPLIER_RETURN' THEN -l.quantity ELSE 0 END) as supplier_return,SUM(CASE WHEN t.type = 'COUNT' THEN l.quantity ELSE 0 END) as count_adjustment,SUM(CASE WHEN t.type = 'REVERSAL' THEN l.quantity ELSE 0 END) as reversal,SUM(l.quantity) as period_net FROM ledger l JOIN transactions t ON t.id=l.tx JOIN items i ON i.code=l.item WHERE ${dailyWhere.join(" AND ")} GROUP BY t.date,i.unit ORDER BY t.date ASC,i.unit ASC`;
  const rawDaily=(await d.prepare(dailySql).bind(...dailyBindings).all<any>()).results;
  const daily=rawDaily.map(d=>({date:d.date,unit:d.unit,receipt:d.receipt/1000,transferIn:d.transfer_in/1000,transferOut:d.transfer_out/1000,returnIn:d.return_in/1000,returnOut:d.return_out/1000,consumption:d.consumption/1000,damageNet:(d.damage_in-d.damage_out)/1000,loss:d.loss/1000,supplierReturn:d.supplier_return/1000,countAdjustment:d.count_adjustment/1000,reversal:d.reversal/1000,periodNet:d.period_net/1000}));
  return {filters,summaryByUnit,rows,transferEdges,daily,rowCount:rows.length};
 }
export async function backup(){
 const source=readSource();
 const names=["items","locations","balances","minimums","transactions","ledger","events","drafts","catalog_requests","import_provenance",...COMMERCE_TABLES];
 const rows=await db().batch(names.map(n=>db().prepare("SELECT * FROM "+n)));
 return {format:"laka-kho-backup-v2",exportedAt:new Date().toISOString(),quantityScale:1000,source,tables:Object.fromEntries(names.map((n,i)=>[n,rows[i].results]))};
}

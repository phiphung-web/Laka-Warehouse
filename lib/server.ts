import {getDatabase} from "./sqlite";
import {readSource} from "./source";
import { getWarehouseUser } from "./auth-server";
import {COMMERCE_ACTIONS,COMMERCE_TABLES,commerceState,mutateCommerce} from "./commerce-server";
import { prepareTransaction, scaled, KINDS, today, validDate, type TxInput, type Item, type Location, type Balance } from "./inventory";
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
 ]);
 return {...await commerceState(d),items:out[0].results,locations:out[1].results,balances:out[2].results,minimums:out[3].results,
 transactions:out[4].results.map((t:any)=>({...t,lines:JSON.parse(t.lines)})),drafts:out[5].results.map((t:any)=>({...t,payload:JSON.parse(t.payload)})),
 events:out[6].results,revision:(out[7].results[0] as any).revision,user:user.displayName,
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
 const audit=event(id,action,JSON.stringify(body.payload),user.displayName,body.revision,now),p=body.payload??{};
 if(action==="item"){
  const code=clean(p.code,40);if(!/^[\p{L}\p{N}_-]+$/u.test(code))throw new Error("Mã hàng chỉ gồm chữ, số, dấu gạch.");
  const name=clean(p.name,300),unit=clean(p.unit,40),category=clean(p.category,100),kind=clean(p.kind,30),packUnit=clean(p.pack_unit,40),size=packUnit?scaled(p.packSize):1000;
  if(!name||!unit||!category||!Object.hasOwn(KINDS,kind))throw new Error("Điền tên, đơn vị, nhóm và loại quản lý.");
  const old=await d.prepare("SELECT * FROM items WHERE code=?").bind(code).first<any>();
  if(body.create&&old)throw new Error("Mã hàng đã tồn tại.");
  if(old&&old.unit!==unit){const used=await d.prepare("SELECT id FROM ledger WHERE item=? LIMIT 1").bind(code).first();if(used)throw new Error("Hàng đã phát sinh. Giữ đơn vị gốc; dùng quy đổi hoặc tạo mã mới.");}
  await d.batch([audit,d.prepare("INSERT INTO items (code,name,unit,category,kind,note,active,pack_unit,pack_size,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(code) DO UPDATE SET name=excluded.name,unit=excluded.unit,category=excluded.category,kind=excluded.kind,note=excluded.note,active=excluded.active,pack_unit=excluded.pack_unit,pack_size=excluded.pack_size,updated_at=excluded.updated_at").bind(code,name,unit,category,kind,clean(p.note,2000),p.active===false||p.active===0?0:1,packUnit,size,now)]);
 }else if(action==="location"){
  const name=clean(p.name,100),locId=p.id?clean(p.id,80):"loc-"+crypto.randomUUID();if(!name||!/^[A-Za-z0-9_-]+$/.test(locId))throw new Error("Tên / mã khu không hợp lệ.");
  const active=p.active===false||p.active===0?0:1;
  if(!active){const balance=await d.prepare("SELECT item FROM balances WHERE location=? AND quantity<>0 LIMIT 1").bind(locId).first();if(balance)throw new Error("Khu vẫn còn hàng. Chuyển hết hàng trước khi ngừng dùng.");}
  await d.batch([audit,d.prepare("INSERT INTO locations(id,name,active) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,active=excluded.active").bind(locId,name,active)]);
 }else if(action==="minimum"){
  await d.batch([audit,d.prepare("INSERT INTO minimums(item,location,quantity) VALUES (?,?,?) ON CONFLICT(item,location) DO UPDATE SET quantity=excluded.quantity").bind(clean(p.item,40),clean(p.location,80),scaled(p.quantity,true))]);
 }else throw new Error("Thao tác không được hỗ trợ.");return {id};
}
export async function backup(){
 const source=readSource();
 const names=["items","locations","balances","minimums","transactions","ledger","events","drafts",...COMMERCE_TABLES];
 const rows=await db().batch(names.map(n=>db().prepare("SELECT * FROM "+n)));
 return {format:"laka-kho-backup-v2",exportedAt:new Date().toISOString(),quantityScale:1000,source,tables:Object.fromEntries(names.map((n,i)=>[n,rows[i].results]))};
}

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {prepareInvoice,prepareSupplier,billStatus,supplierTotals} from "../lib/commerce.ts";
import {commerceState,mutateCommerce} from "../lib/commerce-server.ts";

const uid=()=>crypto.randomUUID(),user={displayName:"Kiểm thử"};
const invoiceInput=(supplier_id,extra={})=>({supplier_id,date:"2026-01-01",due_date:"2026-01-05",buyer_name:"LAKA",lines:[{name:"Khăn",unit:"Cái",quantity:10,price:20000}],discount:10000,shipping:10000,...extra});
test("Automatic supplier codes are unique, replay safely and preserve existing codes",async()=>{
 const f=fixture();try{
  const id=uid(),requestId=uid(),payload={id,code:"",name:"Automatic supplier",terms_days:7};
  const revision=f.revision(),first=await f.send("supplier",payload,{id:requestId,revision});
  assert.equal(first.code,"NCC-0001");
  const second=await f.send("supplier",{id:uid(),name:"Second supplier"});assert.equal(second.code,"NCC-0002");
  const replay=await f.send("supplier",payload,{id:requestId,revision});assert.equal(replay.code,first.code);assert.equal(replay.replayed,true);
  await assert.rejects(f.send("supplier",{...payload,name:"Changed"},{id:requestId}),/nội dung khác/);
  const edited=await f.send("supplier",{...payload,name:"Renamed supplier"});assert.equal(edited.code,first.code);
  assert.equal((await f.state()).suppliers.length,2);
  const stale=f.revision();await f.send("supplier",{id:uid(),name:"Third supplier"});
  await assert.rejects(f.send("supplier",{id:uid(),name:"Stale supplier"},{revision:stale}),/STALE/);
 }finally{f.sqlite.close();}
});
function fixture(){
 const sqlite=new DatabaseSync(":memory:");sqlite.exec("PRAGMA foreign_keys=ON");
 for(const file of fs.readdirSync(new URL("../drizzle/",import.meta.url)).filter(f=>f.endsWith(".sql")).sort())sqlite.exec(fs.readFileSync(new URL("../drizzle/"+file,import.meta.url),"utf8"));
 sqlite.exec("INSERT INTO settings VALUES(1,'owner',0,1,'2026-01-01')");
 class Statement{constructor(sql,args=[]){this.sql=sql;this.args=args;}bind(...args){return new Statement(this.sql,args);}async first(){return sqlite.prepare(this.sql).get(...this.args)??null;}async all(){return {results:sqlite.prepare(this.sql).all(...this.args)};}async run(){return sqlite.prepare(this.sql).run(...this.args);}}
 const db={prepare:sql=>new Statement(sql),batch:async statements=>{sqlite.exec("BEGIN IMMEDIATE");try{const out=statements.map(s=>({results:sqlite.prepare(s.sql).all(...s.args)}));sqlite.exec("COMMIT");return out;}catch(e){sqlite.exec("ROLLBACK");throw e;}}};
 const revision=()=>sqlite.prepare("SELECT revision FROM settings").get().revision;
 const send=(action,payload,extra={})=>mutateCommerce(db,{id:uid(),revision:revision(),action,payload,...extra},user);
 const supplier=async(extra={})=>{const id=uid();await send("supplier",{id,code:"NCC-"+id,name:"Cửa hàng nhỏ",terms_days:7,...extra});return id;};
 const invoice=async(extra={})=>{const sid=await supplier(),out=await send("invoice",invoiceInput(sid,extra));return {sid,...out};};
 const payment=(invoice_id,amount,extra={})=>send("payment",{invoice_id,amount,date:"2026-01-02",method:"cash",...extra});
 const state=()=>commerceState(db);
 return {sqlite,db,revision,send,supplier,invoice,payment,state};
}
test("NCC nhỏ lẻ không cần MST; giữ đủ liên hệ và ngân hàng",()=>{const s=prepareSupplier({id:uid(),code:"ncc1",name:"Cô Lan",phone:"0901234567",bank_account:"00123",terms_days:7});assert.equal(s.tax_id,"");assert.equal(s.bank_account,"00123");assert.equal(s.code,"NCC1");assert.throws(()=>prepareSupplier({...s,terms_days:-1}));});
test("Tiền VND, giảm giá và quy tắc ngày được kiểm tra",()=>{const p=invoiceInput(uid(),{lines:[{name:"Gạo",unit:"Kg",quantity:1.25,price:15500}],discount:100,shipping:500});assert.equal(prepareInvoice(p).total,19775);for(const extra of [{discount:999999},{due_date:"2025-12-31"},{lines:[{name:"Gạo",unit:"Kg",quantity:1,price:""}]},{lines:[{name:"Gạo",unit:"Kg",quantity:1.0001,price:100}]}])assert.throws(()=>prepareInvoice({...p,...extra}));});
test("Trạng thái tự tính: chưa trả, một phần, đủ, quá hạn, đã hủy",()=>{let b={total:200000,paid:0,due_date:"2026-01-05",void_id:null};assert.deepEqual(billStatus(b,"2026-01-06"),{status:"unpaid",outstanding:200000,overdue:true});assert.equal(billStatus({...b,paid:50000}).status,"partial");assert.equal(billStatus({...b,paid:200000}).status,"paid");assert.equal(billStatus({...b,void_id:uid()}).outstanding,0);assert.equal(billStatus({...b,due_date:""}).overdue,false);});
test("Tạo chứng từ giữ snapshot NCC và không tăng tồn kho",async()=>{const f=fixture(),sid=await f.supplier();await f.send("invoice",invoiceInput(sid));await f.send("supplier",{id:sid,code:"NCC-"+sid,name:"Tên đã sửa",terms_days:0});const s=await f.state();assert.equal(s.invoices[0].supplier_snapshot.name,"Cửa hàng nhỏ");assert.equal(s.suppliers[0].name,"Tên đã sửa");assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM ledger").get().n,0);});
test("Đặt cọc rồi trả đủ cập nhật công nợ từ các lần trả",async()=>{const f=fixture(),b=await f.invoice();await f.payment(b.id,50000);let s=await f.state();assert.equal(billStatus(s.invoices[0]).outstanding,150000);await f.payment(b.id,150000);s=await f.state();assert.equal(billStatus(s.invoices[0]).status,"paid");assert.equal(supplierTotals(s.invoices)[0].outstanding,0);});
test("Chặn trả vượt nợ, số tiền âm và ngày trước chứng từ",async()=>{const f=fixture(),b=await f.invoice();for(const [amount,extra] of [[200001,{}],[-1,{}],[0,{}],[1,{date:"2025-12-31"}]])await assert.rejects(f.payment(b.id,amount,extra));assert.equal((await f.state()).payments.length,0);});
test("Retry cùng yêu cầu chỉ tạo một khoản trả, thay nội dung bị chặn",async()=>{const f=fixture(),b=await f.invoice(),id=uid(),payload={invoice_id:b.id,amount:50000,date:"2026-01-02",method:"cash"};await f.send("payment",payload,{id});assert.equal((await f.send("payment",payload,{id,revision:0})).replayed,true);await assert.rejects(f.send("payment",{...payload,amount:40000},{id}));assert.equal((await f.state()).payments.length,1);});
test("Hai cửa sổ: revision cũ bị từ chối, batch không ghi dở",async()=>{const f=fixture(),b=await f.invoice(),revision=f.revision();await f.payment(b.id,50000);const count=f.sqlite.prepare("SELECT COUNT(*) n FROM events").get().n;await assert.rejects(f.send("payment",{invoice_id:b.id,amount:10000,date:"2026-01-02",method:"cash"},{revision}),/STALE_REVISION/);assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM events").get().n,count);assert.equal((await f.state()).invoices[0].paid,50000);});
test("Đảo thanh toán giữ dòng gốc, phục hồi nợ, không đảo hai lần",async()=>{const f=fixture(),b=await f.invoice(),p=await f.payment(b.id,50000);await f.send("reversePayment",{payment_id:p.id,date:"2026-01-03",note:"Ghi nhầm"});const s=await f.state();assert.equal(s.payments.length,2);assert.equal(s.invoices[0].paid,0);await assert.rejects(f.send("reversePayment",{payment_id:p.id,date:"2026-01-03",note:"Lặp"}));});
test("Hủy chứng từ có tiền phải xử lý thanh toán; chứng từ hủy không cộng tổng",async()=>{const f=fixture(),b=await f.invoice(),p=await f.payment(b.id,50000);await assert.rejects(f.send("voidInvoice",{invoice_id:b.id,date:"2026-01-04",reason:"Sai"}));await f.send("reversePayment",{payment_id:p.id,date:"2026-01-03",note:"Sai"});await f.send("voidInvoice",{invoice_id:b.id,date:"2026-01-04",reason:"Lập lại"});assert.equal(supplierTotals((await f.state()).invoices).length,0);await assert.rejects(f.payment(b.id,1));});
test("Trùng số chứng từ cùng NCC bị chặn; sau hủy được lập lại",async()=>{const f=fixture(),b=await f.invoice({reference:"PGH-01"}),p=invoiceInput(b.sid,{reference:"PGH-01"});await assert.rejects(f.send("invoice",p),/đã tồn tại/);await f.send("voidInvoice",{invoice_id:b.id,date:"2026-01-04",reason:"Sai"});await f.send("invoice",p);assert.equal((await f.state()).invoices.length,2);});
test("Gắn phiếu nhập không đổi tồn và không gắn trùng",async()=>{const f=fixture(),b=await f.invoice(),tx=uid(),rev=f.revision();f.sqlite.prepare("INSERT INTO events VALUES(?,?,?,?,?,?)").run(tx,"RECEIPT","","tester","2026-01-01",rev);f.sqlite.prepare("INSERT INTO transactions(id,number,type,date,lines,request,total,created_at,actor) VALUES(?,?,?,?,?,?,?,?,?)").run(tx,"NK-TEST","RECEIPT","2026-01-01","[]","{}",200000,"2026-01-01","tester");await f.send("linkReceipt",{invoice_id:b.id,tx_id:tx});const b2=await f.send("invoice",invoiceInput(b.sid));await assert.rejects(f.send("linkReceipt",{invoice_id:b2.id,tx_id:tx}));assert.equal((await f.state()).receiptLinks.length,1);assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM ledger").get().n,0);});
test("Chứng từ, khoản trả và audit không được xóa hoặc sửa",async()=>{const f=fixture(),b=await f.invoice();await f.payment(b.id,10000);for(const table of ["purchase_invoices","supplier_payments","events","commerce_requests"]){assert.throws(()=>f.sqlite.exec("DELETE FROM "+table),/IMMUTABLE/);}assert.throws(()=>f.sqlite.exec("UPDATE purchase_invoices SET total=0"),/IMMUTABLE/);});
test("NCC ngừng dùng không tạo chứng từ mới, vẫn đối soát và trả nợ cũ",async()=>{const f=fixture(),b=await f.invoice();await f.send("supplier",{id:b.sid,code:"NCC-"+b.sid,name:"NCC cũ",active:0});await assert.rejects(f.send("invoice",invoiceInput(b.sid)));await f.payment(b.id,200000);assert.equal((await f.state()).invoices[0].paid,200000);});
test("Ràng buộc DB từ chối vượt tiền ngay cả khi bỏ qua kiểm tra ứng dụng",async()=>{const f=fixture(),b=await f.invoice(),id=uid(),rev=f.revision();await assert.rejects(f.db.batch([f.db.prepare("INSERT INTO events VALUES(?,?,?,?,?,?)").bind(id,"payment","","tester","2026-01-01",rev),f.db.prepare("INSERT INTO supplier_payments VALUES(?,?,?,?,?,?,?,NULL,?,?)").bind(id,b.id,"2026-01-02",200001,"cash","","","2026-01-02","tester")]),/COMMERCE_OVERPAY/);assert.equal(f.revision(),rev);assert.equal((await f.state()).payments.length,0);});

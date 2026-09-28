// Runs only against the local preview. Leaves clearly labelled QA records for auditability.
import assert from "node:assert/strict";
import {today} from "../lib/inventory.ts";
import {origin,localAuth} from "./api-auth.mjs";
const cookie=await localAuth();assert.ok(cookie,"Local sign-in required");
const state=async()=>{const r=await fetch(origin+"/api/kho",{headers:{cookie}});assert.equal(r.status,200);return r.json();};
const uid=()=>crypto.randomUUID();let passed=0;
async function send(action,payload,id=uid()){const s=await state(),r=await fetch(origin+"/api/kho",{method:"POST",headers:{cookie,origin,"content-type":"application/json"},body:JSON.stringify({id,revision:s.revision,action,payload})});return {status:r.status,body:await r.json()};}
async function ok(action,payload,id){const r=await send(action,payload,id);assert.equal(r.status,200,JSON.stringify(r.body));passed++;return r.body;}
const supplierId=uid();await ok("supplier",{id:supplierId,code:"QA-"+Date.now(),name:"QA - NCC kiểm thử cục bộ",phone:"",terms_days:7,note:"Dữ liệu thử chức năng, không dùng đối soát thật"});
const before=JSON.stringify((await state()).balances),invoice=await ok("invoice",{supplier_id:supplierId,date:today(),due_date:"",buyer_name:"QA - LAKA",lines:[{name:"Hàng kiểm thử",unit:"Cái",quantity:2,price:50000}],discount:0,shipping:0,note:"Kiểm thử cục bộ"});
const paymentId=uid(),payload={invoice_id:invoice.id,date:today(),amount:25000,method:"cash",note:"Trả thử"};await ok("payment",payload,paymentId);assert.equal((await ok("payment",payload,paymentId)).replayed,true);
let s=await state();assert.equal(s.invoices.find(i=>i.id===invoice.id).paid,25000);assert.equal(JSON.stringify(s.balances),before);passed++;
assert.equal((await send("payment",{...payload,amount:100000})).status,400);passed++;
const p2=await ok("payment",{...payload,amount:75000});assert.equal((await state()).invoices.find(i=>i.id===invoice.id).paid,100000);
await ok("reversePayment",{payment_id:p2.id,date:today(),note:"Hoàn tất thử nghiệm"});await ok("reversePayment",{payment_id:paymentId,date:today(),note:"Hoàn tất thử nghiệm"});await ok("voidInvoice",{invoice_id:invoice.id,date:today(),reason:"Chứng từ QA, kết thúc kiểm tra"});
assert.equal((await send("payment",payload)).status,400);passed++;
const backupResponse=await fetch(origin+"/api/kho?export=all",{headers:{cookie}}),backup=await backupResponse.json();assert.equal(backup.format,"laka-kho-backup-v2");assert.ok(backup.tables.suppliers.some(s=>s.id===supplierId));assert.ok(backup.tables.invoice_voids.some(v=>v.invoice_id===invoice.id));passed++;
console.log(JSON.stringify({passed,scope:"NCC, chứng từ, thanh toán, retry, đảo/hủy, tồn không đổi, backup v2",invoiceVoided:true}));

import assert from "node:assert/strict";
import {today} from "../lib/inventory.ts";
const origin="http://localhost:5173";
const auth=await fetch(origin+"/signin-with-chatgpt?return_to=/",{redirect:"manual"});
const cookie=auth.headers.getSetCookie().map(c=>c.split(";")[0]).join("; ");
assert.ok(cookie,"Local sign-in cookie required");
let passed=0;
async function state(){const r=await fetch(origin+"/api/kho",{headers:{cookie}});assert.equal(r.status,200);return r.json();}
async function send(body){const r=await fetch(origin+"/api/kho",{method:"POST",headers:{cookie,origin,"content-type":"application/json"},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};}
async function mutate(action,payload,extra={}){const s=await state();return send({id:crypto.randomUUID(),revision:s.revision,action,payload,...extra});}
const code="QA_"+Date.now();
let r=await mutate("item",{code,name:"KIỂM THỬ CỤC BỘ - Nước",unit:"Chai",category:"Kiểm thử",kind:"consumable",pack_unit:"Thùng",packSize:24,active:1},{create:true});assert.equal(r.status,200,JSON.stringify(r));passed++;
async function tx(type,extra={}){
 const s=await state(),payload={id:crypto.randomUUID(),revision:s.revision,type,date:today(),from:"KHO_TONG",to:"BUONG_PHONG",person:"Kiểm thử cục bộ",partner:"NCC KIỂM THỬ",note:"Dữ liệu thử nghiệm cục bộ",lines:[{item:code,quantity:10,price:2000}],...extra};
 const res=await send({id:payload.id,action:"transaction",payload});return {...res,payload};
}
r=await tx("COUNT",{to:"KHO_TONG",lines:[{item:code,quantity:100}]});assert.equal(r.status,200,JSON.stringify(r));passed++;
r=await tx("COUNT",{to:"BUONG_PHONG",lines:[{item:code,quantity:0}]});assert.equal(r.status,200,JSON.stringify(r));passed++;
r=await tx("RECEIPT",{to:"BUONG_PHONG",lines:[{item:code,quantity:2,unitMode:"pack",price:57000}]});assert.equal(r.status,200,JSON.stringify(r));passed++;
let s=await state();const balance=(location,condition="usable")=>s.balances.find(b=>b.item===code&&b.location===location&&b.condition===condition)?.quantity??0;
assert.equal(balance("KHO_TONG"),100000);assert.equal(balance("BUONG_PHONG"),48000);
r=await tx("TRANSFER",{lines:[{item:code,quantity:24}]});assert.equal(r.status,200,JSON.stringify(r));const transfer=r;passed++;
s=await state();assert.equal(balance("KHO_TONG"),76000);assert.equal(balance("BUONG_PHONG"),72000);
r=await send({id:transfer.payload.id,action:"transaction",payload:transfer.payload});assert.equal(r.status,200);assert.equal(r.body.replayed,true);passed++;
r=await send({id:transfer.payload.id,action:"transaction",payload:{...transfer.payload,note:"Different"}});assert.equal(r.status,400);passed++;
r=await tx("TRANSFER",{lines:[{item:code,quantity:999}]});assert.equal(r.status,400);s=await state();assert.equal(balance("KHO_TONG"),76000);passed++;
r=await tx("DAMAGE",{from:"BUONG_PHONG",lines:[{item:code,quantity:2}]});assert.equal(r.status,200,JSON.stringify(r));s=await state();assert.equal(balance("BUONG_PHONG"),70000);assert.equal(balance("BUONG_PHONG","damaged"),2000);passed++;
r=await tx("CONSUME",{from:"BUONG_PHONG",lines:[{item:code,quantity:5}]});assert.equal(r.status,200,JSON.stringify(r));passed++;
r=await tx("REVERSAL",{reversalOf:transfer.body.id,lines:[]});assert.equal(r.status,200,JSON.stringify(r));s=await state();assert.equal(balance("KHO_TONG"),100000);assert.equal(balance("BUONG_PHONG"),41000);passed++;
r=await tx("REVERSAL",{reversalOf:transfer.body.id,lines:[]});assert.equal(r.status,400);passed++;
const stale=s.revision;
r=await mutate("minimum",{item:code,location:"KHO_TONG",quantity:20});assert.equal(r.status,200);passed++;
r=await tx("COUNT",{revision:stale,to:"KHO_TONG",lines:[{item:code,quantity:1}]});assert.equal(r.status,409);s=await state();assert.equal(balance("KHO_TONG"),100000);passed++;
const draft={id:crypto.randomUUID(),type:"RECEIPT",lines:[{item:code,quantity:1}],note:"Nháp thử nghiệm"};
r=await send({id:draft.id,action:"draft",payload:draft});assert.equal(r.status,200);s=await state();assert.ok(s.drafts.some(d=>d.id===draft.id));passed++;
const backup=await fetch(origin+"/api/kho?export=all",{headers:{cookie}}).then(r=>r.json());assert.equal(backup.quantityScale,1000);assert.ok(backup.tables.ledger.length>0);assert.equal(backup.source.items.length,140);passed++;
const unauthorized=await fetch(origin+"/api/kho");assert.equal(unauthorized.status,401);passed++;
const badOrigin=await fetch(origin+"/api/kho",{method:"POST",headers:{cookie,origin:"https://unrelated.invalid","content-type":"application/json"},body:"{}"});assert.equal(badOrigin.status,403);passed++;
console.log(JSON.stringify({checksPassed:passed,scope:"Local preview database only",testItem:code,finalMain:balance("KHO_TONG")/1000,finalHousekeeping:balance("BUONG_PHONG")/1000,damaged:balance("BUONG_PHONG","damaged")/1000}));

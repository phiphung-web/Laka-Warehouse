import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import fs from "node:fs";
import {prepareTransaction,scaled,today} from "../lib/inventory.ts";
const item={code:"WATER",name:"Nước",unit:"Chai",category:"Đồ uống",kind:"consumable",active:1,pack_unit:"Thùng",pack_size:24000};
const towel={...item,code:"TOWEL",name:"Khăn",kind:"reusable"};
const locations=[{id:"MAIN",name:"Kho",active:1},{id:"ROOM",name:"Buồng",active:1}];
const b={item:"WATER",location:"MAIN",condition:"usable",lot:"",expiry:"",quantity:100000,verified_at:"2026-09-27"};
const input={id:"test-transaction",revision:0,type:"TRANSFER",date:today(),from:"MAIN",to:"ROOM",person:"Người nhận",note:"Kiểm thử",lines:[{item:"WATER",quantity:24}]};
const prep=(p={},balances=[b],items=[item,towel])=>prepareTransaction({...input,...p},items,locations,balances,new Date().toISOString());
test("Transfer preserves system quantity and records both locations",()=>{const p=prep();assert.equal(p.postings.reduce((n,p)=>n+p.quantity,0),0);assert.deepEqual(p.postings.map(p=>[p.location,p.quantity]),[["MAIN",-24000],["ROOM",24000]]);});
test("Direct delivery adds only the actual receiving area",()=>{const p=prep({type:"RECEIPT",to:"ROOM",partner:"NCC"});assert.equal(p.postings.length,1);assert.equal(p.postings[0].location,"ROOM");});
test("A pack conversion uses the configured factor and records base unit",()=>{const p=prep({lines:[{item:"WATER",quantity:2,unitMode:"pack"}]});assert.equal(p.lines[0].baseQuantity,48);assert.equal(p.postings[0].quantity,-48000);});
test("Insufficient or unverified stock is rejected",()=>{assert.throws(()=>prep({lines:[{item:"WATER",quantity:101}]}),/vượt tồn/);assert.throws(()=>prep({},[{...b,verified_at:null}]),/kiểm kê/);});
test("Counting is absolute and allows confirmed zero",()=>{const p=prep({type:"COUNT",to:"MAIN",lines:[{item:"WATER",quantity:0}]});assert.equal(p.postings[0].quantity,-100000);assert.ok(p.postings[0].verified_at);});
test("Damage changes condition while retaining total assets",()=>{const p=prep({type:"DAMAGE"});assert.equal(p.postings.reduce((n,p)=>n+p.quantity,0),0);assert.deepEqual(p.postings.map(p=>p.condition),["usable","damaged"]);});
test("Reusable goods cannot be consumed",()=>assert.throws(()=>prep({type:"CONSUME",lines:[{item:"TOWEL",quantity:1}]}),/tiêu hao/));
test("Duplicate lines and same-location transfers are rejected",()=>{assert.throws(()=>prep({lines:[...input.lines,...input.lines]}),/lặp/);assert.throws(()=>prep({to:"MAIN"}),/khác nhau/);});
test("Lot identity is exact and cannot consume another batch",()=>assert.throws(()=>prep({lines:[{item:"WATER",quantity:1,lot:"Other"}]}),/kiểm kê/));
test("Dates, precision and missing quantities cannot silently become valid",()=>{assert.throws(()=>prep({date:"2026-02-30"}),/Ngày/);assert.throws(()=>scaled(NaN));assert.throws(()=>scaled(.0001));assert.equal(scaled(.125),125);});
test("Receipt snapshots preserve selected units and price",()=>{const p=prep({type:"RECEIPT",partner:"NCC",lines:[{item:"WATER",quantity:2,unitMode:"pack",price:57000}]});assert.equal(p.total,114000);assert.equal(p.lines[0].enteredUnit,"Thùng");assert.equal(p.lines[0].baseQuantity,48);});
function database(){
 const d=new DatabaseSync(":memory:");d.exec("PRAGMA foreign_keys=ON");d.exec(fs.readFileSync(new URL("../drizzle/0000_strange_steve_rogers.sql",import.meta.url),"utf8"));
 d.prepare("INSERT INTO settings VALUES (1,'owner',0,1,'now')").run();d.prepare("INSERT INTO items VALUES ('WATER','Nước','Chai','Đồ uống','consumable','',1,'',1000,'now')").run();d.prepare("INSERT INTO locations VALUES ('MAIN','Kho',1)").run();return d;
}
function transaction(d,id,revision,postings){
 d.exec("BEGIN");try{
  d.prepare("INSERT INTO events VALUES (?,'TEST','test','owner','now',?)").run(id,revision);
  d.prepare("INSERT INTO transactions VALUES (?,?,'RECEIPT','2026-09-27',NULL,'MAIN','','','','','[]','{}',0,'now','owner',NULL)").run(id,id);
  for(const quantity of postings)d.prepare("INSERT INTO ledger(tx,item,location,condition,lot,expiry,quantity) VALUES (?,'WATER','MAIN','usable','','',?)").run(id,quantity);
  d.exec("COMMIT");
 }catch(e){d.exec("ROLLBACK");throw e;}
}
test("Database rejects a stale concurrent write and rolls back the entire operation",()=>{
 const d=database();transaction(d,"a",0,[100000]);assert.throws(()=>transaction(d,"b",0,[-10000]),/STALE_REVISION/);assert.equal(d.prepare("SELECT quantity FROM balances").get().quantity,100000);assert.equal(d.prepare("SELECT count(*) n FROM transactions").get().n,1);d.close();
});
test("Multi-line operation is atomic when a later line would make stock negative",()=>{
 const d=database();transaction(d,"a",0,[100000]);assert.throws(()=>transaction(d,"b",1,[-10000,-100000]),/quantity_nonnegative/);assert.equal(d.prepare("SELECT quantity FROM balances").get().quantity,100000);assert.equal(d.prepare("SELECT revision FROM settings").get().revision,1);d.close();
});
test("Posting updates an existing balance correctly and audit/ledger cannot be erased",()=>{
 const d=database();transaction(d,"a",0,[100000]);transaction(d,"b",1,[-24000]);assert.equal(d.prepare("SELECT quantity FROM balances").get().quantity,76000);
 assert.throws(()=>d.exec("DELETE FROM ledger"),/IMMUTABLE/);assert.throws(()=>d.exec("UPDATE transactions SET note='changed'"),/IMMUTABLE/);assert.throws(()=>d.exec("DELETE FROM events"),/IMMUTABLE/);d.close();
});

import assert from "node:assert/strict";
import { today } from "../lib/inventory.ts";
import { origin, localAuth } from "./api-auth.mjs";

const cookie = await localAuth();
assert.ok(cookie, "Local sign-in cookie required");
let passed = 0;

async function state() {
 const r = await fetch(origin + "/api/kho", { headers: { cookie } });
 assert.equal(r.status, 200);
 return r.json();
}

async function send(body) {
 const r = await fetch(origin + "/api/kho", {
  method: "POST",
  headers: { cookie, origin, "content-type": "application/json" },
  body: JSON.stringify(body)
 });
 return { status: r.status, body: await r.json() };
}

async function getFlow(params = {}) {
 const sp = new URLSearchParams({ report: "flow", ...params });
 const r = await fetch(origin + "/api/kho?" + sp.toString(), { headers: { cookie } });
 return { status: r.status, body: await r.json() };
}

// 1. Catalog Auto-code creation (prefix generated based on usage_location and kind)
const s0 = await state();
const autoId = crypto.randomUUID();
let r = await send({
 id: autoId,
 action: "item",
 revision: s0.revision,
 create: true,
 payload: {
  name: "Gối lông vũ",
  unit: "Cái",
  category: "Buồng phòng",
  kind: "reusable",
  usage_location: "BUONG_PHONG",
  active: 1
 }
});
assert.equal(r.status, 200, JSON.stringify(r));
assert.ok(r.body.code.startsWith("BP-TD-"), "Auto code should start with BP-TD-: " + r.body.code);
passed++;

// 2. Catalog Manual code creation
const s1 = await state();
const manualCode = "MANUAL_" + Date.now();
const manId = crypto.randomUUID();
r = await send({
 id: manId,
 action: "item",
 revision: s1.revision,
 create: true,
 payload: {
  code: manualCode,
  name: "Dép đi trong phòng",
  unit: "Đôi",
  category: "Buồng phòng",
  kind: "consumable",
  usage_location: "BUONG_PHONG",
  active: 1
 }
});
assert.equal(r.status, 200);
assert.equal(r.body.code, manualCode);
passed++;

// 3. Collision: duplicate manual code on create rejected
const s2 = await state();
r = await send({
 id: crypto.randomUUID(),
 action: "item",
 revision: s2.revision,
 create: true,
 payload: {
  code: manualCode,
  name: "Dép đi trong phòng trùng",
  unit: "Đôi",
  category: "Buồng phòng",
  kind: "consumable"
 }
});
assert.equal(r.status, 400);
assert.match(r.body.error, /đã tồn tại/);
passed++;

// 4. Legacy catalog create: action=item without create creates if not existing
const s3 = await state();
const legacyCode = "LEGACY_" + Date.now();
const legId = crypto.randomUUID();
r = await send({
 id: legId,
 action: "item",
 revision: s3.revision,
 payload: {
  code: legacyCode,
  name: "Khăn tắm lớn",
  unit: "Cái",
  category: "Buồng phòng",
  kind: "reusable",
  usage_location: "BUONG_PHONG",
  active: 1
 }
});
assert.equal(r.status, 200);
assert.equal(r.body.code, legacyCode);
passed++;

// 5. Legacy catalog edit: omit usage_location preserves existing usage_location
const s4 = await state();
const editId = crypto.randomUUID();
r = await send({
 id: editId,
 action: "item",
 revision: s4.revision,
 payload: {
  code: legacyCode,
  name: "Khăn tắm lớn cao cấp",
  unit: "Cái",
  category: "Buồng phòng",
  kind: "reusable"
  // usage_location intentionally omitted
 }
});
assert.equal(r.status, 200);
const s4b = await state();
const editedItem = s4b.items.find(i => i.code === legacyCode);
assert.equal(editedItem.usage_location, "BUONG_PHONG", "Existing usage_location should be preserved when omitted");
passed++;

// 6. Never return success for UPDATE nonexistent
const s5 = await state();
r = await send({
 id: crypto.randomUUID(),
 action: "item",
 revision: s5.revision,
 create: false,
 payload: {
  code: "NONEXISTENT_ITEM_CODE",
  name: "Hàng ảo",
  unit: "Cái"
 }
});
assert.equal(r.status, 400);
assert.match(r.body.error, /không tồn tại/);
passed++;

// 7. Atomic invalid opening rollback: invalid opening quantity rolls back item creation
const s6 = await state();
const invalidCode = "FAIL_" + Date.now();
r = await send({
 id: crypto.randomUUID(),
 action: "item",
 revision: s6.revision,
 create: true,
 payload: {
  code: invalidCode,
  name: "Mặt hàng lỗi số dư",
  unit: "Cái",
  category: "Kiểm thử",
  initial_quantity: -50, // invalid negative
  initial_location: "KHO_TONG"
 }
});
assert.equal(r.status, 400);
const s6b = await state();
assert.ok(!s6b.items.some(i => i.code === invalidCode), "Item must not be created if opening is invalid");
passed++;

// 8. Opening blank: no count transaction created
const s7 = await state();
const blankCode = "BLANK_" + Date.now();
r = await send({
 id: crypto.randomUUID(),
 action: "item",
 revision: s7.revision,
 create: true,
 payload: {
  code: blankCode,
  name: "Hàng chưa kiểm đếm",
  unit: "Cái",
  category: "Kiểm thử",
  initial_quantity: "" // blank
 }
});
assert.equal(r.status, 200);
assert.equal(r.body.countRef, undefined);
const s7b = await state();
const blankBal = s7b.balances.find(b => b.item === blankCode);
assert.equal(blankBal, undefined);
passed++;

// 9. Opening zero: creates confirmed verified 0 count transaction
const s8 = await state();
const zeroCode = "ZERO_" + Date.now();
r = await send({
 id: crypto.randomUUID(),
 action: "item",
 revision: s8.revision,
 create: true,
 payload: {
  code: zeroCode,
  name: "Hàng hết tồn ban đầu",
  unit: "Cái",
  category: "Kiểm thử",
  initial_quantity: 0,
  initial_location: "KHO_TONG"
 }
});
assert.equal(r.status, 200);
assert.ok(r.body.countRef, "Count ref must be present for zero initial stock");
const s8b = await state();
const zeroBal = s8b.balances.find(b => b.item === zeroCode && b.location === "KHO_TONG");
assert.ok(zeroBal);
assert.equal(zeroBal.quantity, 0);
assert.ok(zeroBal.verified_at, "Zero count must be verified");
passed++;

// 10. Retry same UUID same payload returns existing result despite stale revision
const replayId = crypto.randomUUID();
const replayPayload = {
 code: "REPLAY_" + Date.now(),
 name: "Hàng thử replay",
 unit: "Cái",
 category: "Kiểm thử",
 kind: "consumable"
};
const s9 = await state();
const firstRes = await send({ id: replayId, action: "item", revision: s9.revision, create: true, payload: replayPayload });
assert.equal(firstRes.status, 200);

// Bump revision with a different mutation
const s10 = await state();
await send({ id: crypto.randomUUID(), action: "minimum", revision: s10.revision, payload: { item: firstRes.body.code, location: "KHO_TONG", quantity: 5 } });

// Replay with stale revision s9.revision
const retryRes = await send({ id: replayId, action: "item", revision: s9.revision, create: true, payload: replayPayload });
assert.equal(retryRes.status, 200);
assert.equal(retryRes.body.replayed, true);
assert.equal(retryRes.body.code, firstRes.body.code);
passed++;

// 11. Retry same UUID different payload rejects
const badRetry = await send({ id: replayId, action: "item", revision: s9.revision, create: true, payload: { ...replayPayload, name: "Tên đã sửa" } });
assert.equal(badRetry.status, 400);
passed++;

// 12. Flow Report Filter Validation: rejects non-existent location/item/usage
let flowCheck = await getFlow({ location: "NON_EXISTENT_LOCATION" });
assert.equal(flowCheck.status, 400);
assert.match(flowCheck.body.error, /Khu thực tế không tồn tại/);

flowCheck = await getFlow({ item: "NON_EXISTENT_ITEM" });
assert.equal(flowCheck.status, 400);
assert.match(flowCheck.body.error, /Mặt hàng không tồn tại/);

flowCheck = await getFlow({ usage: "NON_EXISTENT_USAGE" });
assert.equal(flowCheck.status, 400);
assert.match(flowCheck.body.error, /Khu dự kiến không tồn tại/);
passed++;

// 13. Zero-net activity ending zero included in Flow Report!
// Create item, receipt 10, consume 10 in same period -> closing = 0, period_net = 0, opening = 0.
const flowItem = "FLOW_NET0_" + Date.now();
const s11 = await state();
await send({ id: crypto.randomUUID(), action: "item", revision: s11.revision, create: true, payload: { code: flowItem, name: "Hàng phát sinh thuần 0", unit: "Chai", category: "Test", kind: "consumable", usage_location: "KHO_TONG" } });

const s12 = await state();
// Receipt 10
await send({
 id: crypto.randomUUID(),
 action: "transaction",
 payload: {
  id: crypto.randomUUID(),
  revision: s12.revision,
  type: "RECEIPT",
  date: today(),
  to: "KHO_TONG",
  partner: "NCC Flow",
  person: "Thử nghiệm",
  lines: [{ item: flowItem, quantity: 10, price: 1000 }]
 }
});

const s13 = await state();
// Verify stock first with count then consume
await send({
 id: crypto.randomUUID(),
 action: "transaction",
 payload: {
  id: crypto.randomUUID(),
  revision: s13.revision,
  type: "COUNT",
  date: today(),
  to: "KHO_TONG",
  note: "Xác nhận để xuất",
  lines: [{ item: flowItem, quantity: 10 }]
 }
});

const s14 = await state();
// Consume 10
await send({
 id: crypto.randomUUID(),
 action: "transaction",
 payload: {
  id: crypto.randomUUID(),
  revision: s14.revision,
  type: "CONSUME",
  date: today(),
  from: "KHO_TONG",
  note: "Dùng hết trong kỳ",
  lines: [{ item: flowItem, quantity: 10 }]
 }
});

const flowRes = await getFlow({ item: flowItem, from: today(), to: today() });
assert.equal(flowRes.status, 200);
assert.equal(flowRes.body.rows.length, 1, "Zero-net activity row must be included in flow report");
const flowRow = flowRes.body.rows[0];
assert.equal(flowRow.opening, 0);
assert.equal(flowRow.receipt, 10);
assert.equal(flowRow.consumption, 10);
assert.equal(flowRow.periodNet, 0);
assert.equal(flowRow.closing, 0);
passed++;

// 14. Stress test: Flow report handles queries correctly over transactions
const fullFlow = await getFlow({ from: "2026-01-01", to: today() });
assert.equal(fullFlow.status, 200);
assert.ok(fullFlow.body.summaryByUnit.length >= 1);
assert.ok(fullFlow.body.rows.length >= 1);
passed++;

async function postTx(payload){
 const current=await state(), id=crypto.randomUUID();
 const out=await send({id,action:"transaction",payload:{id,revision:current.revision,date:today(),person:"QA",...payload}});
 assert.equal(out.status,200,JSON.stringify(out));return out.body;
}
const mixed=await state(), mixedCode="FLOW_MIXED";
r=await send({id:crypto.randomUUID(),action:"item",revision:mixed.revision,create:true,payload:{code:mixedCode,name:"Mixed flow fixture",unit:"Kg",kind:"consumable",usage_location:"BUONG_PHONG",initial_quantity:20,initial_location:"BUONG_PHONG",initial_date:"2026-01-01"}});
assert.equal(r.status,200,JSON.stringify(r));
await postTx({type:"TRANSFER",from:"BUONG_PHONG",to:"CAFE",lines:[{item:mixedCode,quantity:5}]});
await postTx({type:"DAMAGE",from:"BUONG_PHONG",lines:[{item:mixedCode,quantity:2}],note:"QA damage"});
const consumed=await postTx({type:"CONSUME",from:"BUONG_PHONG",lines:[{item:mixedCode,quantity:1}],note:"QA consume"});
await postTx({type:"REVERSAL",reversalOf:consumed.id,lines:[],note:"QA reversal"});
const mixedReport=await getFlow({item:mixedCode,from:today(),to:today()});
assert.equal(mixedReport.status,200,JSON.stringify(mixedReport));
const summary=mixedReport.body.summaryByUnit[0];
assert.equal(summary.unit,"Kg");assert.equal(summary.opening,20);assert.equal(summary.closing,20);
assert.equal(summary.transferIn,5);assert.equal(summary.transferOut,5);assert.equal(summary.receipt,0);
assert.equal(summary.damageNet,0);assert.equal(summary.consumption,1);assert.equal(summary.reversal,1);
for(const row of mixedReport.body.rows)assert.equal(row.opening+row.periodNet,row.closing);
passed++;
// Opening-only entries remain visible, independent of current-period movements.
const openingReport=await getFlow({item:mixedCode,from:"2026-01-02",to:"2026-01-02"});
assert.equal(openingReport.body.rows[0].opening,20);assert.equal(openingReport.body.rows[0].periodNet,0);passed++;
// 501 committed transactions move the earlier receipt beyond state.transactions LIMIT 500.
let stressState=await state(), revision=stressState.revision;
for(let n=0;n<501;n++){
 const id=crypto.randomUUID();
 const out=await send({id,action:"transaction",payload:{id,revision:revision++,type:"COUNT",date:today(),to:"KHO_TONG",note:"QA history boundary",lines:[{item:flowItem,quantity:0}]}});
 assert.equal(out.status,200,JSON.stringify(out));
}
stressState=await state();assert.equal(stressState.transactions.length,500);assert.ok(stressState.todayTxCount>500);
assert.ok(stressState.choices.people.includes("Thử nghiệm"),"Recipient choices must retain people outside latest 500 transactions");
assert.ok(stressState.choices.partners.includes("NCC Flow"),"Supplier choices must retain older receipts");
const fullHistory=await getFlow({item:flowItem,from:today(),to:today()});
assert.equal(fullHistory.body.rows[0].receipt,10);assert.equal(fullHistory.body.rows[0].consumption,10);
assert.equal(fullHistory.body.rows[0].closing,0);passed++;
const categoryReport=await getFlow({category:"Test",from:today(),to:today()});
assert.equal(categoryReport.status,200);assert.ok(categoryReport.body.rows.length>0);
assert.ok(categoryReport.body.rows.every(r=>r.category==="Test"));assert.equal(categoryReport.body.filters.category,"Test");
assert.equal((await getFlow({category:"MissingCategory"})).status,400);passed++;
console.log(JSON.stringify({ catalogFlowChecksPassed: passed }));

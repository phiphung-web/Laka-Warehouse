import assert from "node:assert/strict";
import {buildReviewReport} from "../lib/review.ts";
const item={code:"A",name:"Khăn",unit:"Cái",pack_unit:"Thùng",pack_size:2000,category:"Buồng phòng",kind:"reusable",active:1,note:""};
const line=(quantity,before=0)=>({item:"A",itemName:"Khăn",baseUnit:"Cái",baseQuantity:quantity,condition:"usable",lot:"",expiry:"",before,difference:quantity-before});
const transactions=[
 {id:"import",number:"KK-OLD",type:"COUNT",date:"2026-09-01",to_location:"BUONG",created_at:"2026-09-01T00:00:00Z",lines:[line(2)],reversal_of:null},
 {id:"count",number:"KK-REAL",type:"COUNT",date:"2026-09-20",to_location:"BUONG",created_at:"2026-09-20T00:00:00Z",lines:[line(3,2)],reversal_of:null},
 {id:"receipt",number:"NK-1",type:"RECEIPT",date:"2026-09-21",to_location:"BUONG",partner:"NCC A",created_at:"2026-09-21T00:00:00Z",lines:[{...line(3),quantity:1.5,enteredUnit:"Thùng"}],reversal_of:null},
 {id:"orphan",number:"NK-2",type:"RECEIPT",date:"2026-09-22",to_location:"BUONG",partner:"NCC A",created_at:"2026-09-22T00:00:00Z",lines:[line(1)],reversal_of:null}
];
const input={items:[item],locations:[{id:"BUONG",name:"Buồng phòng"}],balances:[{item:"A",location:"BUONG",condition:"usable",lot:"",expiry:"",quantity:4000,verified_at:"2026-09-20T00:00:00Z"}],transactions,
 invoices:[{id:"bill",number:"MH-1",date:"2026-09-21",supplier_snapshot:{name:"NCC A",phone:"PRIVATE_PHONE",bank_account:"PRIVATE_BANK"},reference:"HD-1",lines:[{item:"A",name:"Khăn",unit:"Thùng",quantity:2}],void_id:null}],links:[{invoice_id:"bill",tx_id:"receipt"}],provenance:[{tx_id:"import",item_code:"A",location:"BUONG",quantity:2000}]};
let report=buildReviewReport(input);
assert.equal(report.stock[0].openingSource,2);
assert.equal(report.stock[0].count.number,"KK-REAL");
assert.equal(report.stock[0].count.difference,1);
assert.equal(report.stock[0].count.movementSince,1);
assert.equal(report.stock[0].status,"variance");
assert.equal(report.invoices[0].billed,2);
assert.equal(report.invoices[0].received,1.5);
assert.equal(report.invoices[0].difference,-0.5);
assert.equal(report.invoices[0].status,"variance");
assert.equal(report.invoices[0].supplierWarning,false);
assert.ok(!JSON.stringify(report).includes("PRIVATE_PHONE"));
assert.ok(!JSON.stringify(report).includes("PRIVATE_BANK"));
assert.equal(report.unlinkedReceipts[0].number,"NK-2");
report=buildReviewReport({...input,transactions:transactions.map(t=>t.id==="receipt"?{...t,partner:"NCC khác"}:t)});
assert.equal(report.invoices[0].supplierWarning,true);
report=buildReviewReport({...input,invoices:[{...input.invoices[0],lines:[{item:"A",name:"Khăn",unit:"Cái",quantity:4}]}]});
assert.equal(report.invoices[0].received,3);
assert.equal(report.invoices[0].difference,-1);
report=buildReviewReport({...input,balances:[...input.balances,{...input.balances[0],lot:"L2",quantity:1000}]});
assert.equal(report.stock.filter(r=>r.openingSource!==null).length,1);
report=buildReviewReport({...input,links:[]});
assert.equal(report.invoices[0].status,"no_receipt");
assert.equal(report.invoices[0].received,null);
assert.equal(report.unlinkedReceipts.length,2);
report=buildReviewReport({...input,invoices:[{...input.invoices[0],void_id:"voided"}]});
assert.equal(report.invoices.length,0);
assert.equal(report.unlinkedReceipts.length,2);
report=buildReviewReport({...input,transactions:transactions.map(t=>t.id==="receipt"?{...t,lines:[{...line(3),quantity:3,enteredUnit:"Cái"}]}:t)});
assert.equal(report.invoices[0].status,"unknown");
assert.equal(report.invoices[0].received,null);
report=buildReviewReport({...input,transactions:[...transactions,{id:"reverse",type:"REVERSAL",reversal_of:"receipt",lines:[],created_at:"2026-09-23T00:00:00Z"}]});
assert.equal(report.invoices[0].status,"reversed");
assert.equal(report.invoices[0].received,null);
console.log("Review reconciliation tests passed.");

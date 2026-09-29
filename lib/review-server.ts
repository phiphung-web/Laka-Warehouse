import {db} from "./server";
import {buildReviewReport} from "./review";
export async function reviewReport(){
 const d=db(),rows=await d.batch([
  d.prepare("SELECT * FROM items"),d.prepare("SELECT * FROM locations"),d.prepare("SELECT * FROM balances"),
  d.prepare("SELECT id,number,type,date,to_location,partner,reference,note,lines,created_at,reversal_of FROM transactions WHERE type IN ('COUNT','RECEIPT','REVERSAL') ORDER BY created_at,id"),
  d.prepare("SELECT tx_id,item_code,location,quantity FROM import_provenance"),
  d.prepare("SELECT i.id,i.number,i.date,i.reference,i.lines,i.supplier_snapshot,v.id AS void_id FROM purchase_invoices i LEFT JOIN invoice_voids v ON v.invoice_id=i.id"),
  d.prepare("SELECT invoice_id,tx_id FROM invoice_receipts")
 ]);
 return buildReviewReport({items:rows[0].results,locations:rows[1].results,balances:rows[2].results,transactions:rows[3].results.map(t=>({...t,lines:JSON.parse(t.lines)})),invoices:rows[5].results.map(i=>({...i,lines:JSON.parse(i.lines),supplier_snapshot:JSON.parse(i.supplier_snapshot)})),links:rows[6].results,provenance:rows[4].results});
}

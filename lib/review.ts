import {normalize,type Item} from "./inventory.ts";

// The reconciliation combines persisted rows from several SQL tables.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row=Record<string,any>;
const balanceKey=(item:string,location:string,condition:string,lot:string,expiry:string)=>[item,location,condition,lot,expiry].join("\u001f");
const round=(n:number)=>Math.round(n*1000)/1000;
export function buildReviewReport(input:{items:Item[];locations:Row[];balances:Row[];transactions:Row[];invoices:Row[];links:Row[];provenance:Row[]},generatedAt=new Date().toISOString()){
 const items=new Map(input.items.map(i=>[i.code,i])),locations=new Map(input.locations.map(l=>[l.id,l.name]));
 const imported=new Set(input.provenance.map(p=>p.tx_id));
 const opening=new Map<string,number>();
 for(const p of input.provenance){const key=[p.item_code,p.location].join("\u001f");opening.set(key,(opening.get(key)||0)+p.quantity/1000);}
 const counts=new Map<string,Row>();
 const receipts=new Map<string,Row>();
 const reversed=new Set(input.transactions.map(t=>t.reversal_of).filter(Boolean));
 for(const t of input.transactions){
  if(t.type==="RECEIPT")receipts.set(t.id,t);
  if(t.type!=="COUNT"||imported.has(t.id)||t.reference==="Mốc ban đầu khi tạo mã")continue;
  for(const l of t.lines){const key=balanceKey(l.item,t.to_location,l.condition||"usable",l.lot||"",l.expiry||"");const previous=counts.get(key);
   if(!previous||t.created_at>=previous.createdAt)counts.set(key,{number:t.number,date:t.date,createdAt:t.created_at,quantity:l.baseQuantity,before:l.before,difference:l.difference,note:t.note});}
 }
 const stock=input.balances.map(b=>{const item=items.get(b.item),count=counts.get(balanceKey(b.item,b.location,b.condition,b.lot,b.expiry));return {
  item:b.item,itemName:item?.name||b.item,unit:item?.unit||"",location:b.location,locationName:locations.get(b.location)||b.location,
  condition:b.condition,lot:b.lot,expiry:b.expiry,quantity:b.quantity/1000,openingSource:null as number|null,
  count:count?{...count,movementSince:round(b.quantity/1000-count.quantity)}:null,
  status:!count?"not_counted":count.difference===0?"matched":"variance"
 };}).sort((a,b)=>a.locationName.localeCompare(b.locationName,"vi")||a.itemName.localeCompare(b.itemName,"vi"));
 const shownOpening=new Set<string>();for(const row of stock){const key=[row.item,row.location].join("\u001f");if(!shownOpening.has(key)){row.openingSource=opening.get(key)??null;shownOpening.add(key);}}
 const linksByInvoice=new Map<string,string[]>(),linkedReceipts=new Set<string>(),activeInvoiceIds=new Set(input.invoices.filter(i=>!i.void_id).map(i=>i.id));
 for(const link of input.links){if(!activeInvoiceIds.has(link.invoice_id))continue;const list=linksByInvoice.get(link.invoice_id)||[];list.push(link.tx_id);linksByInvoice.set(link.invoice_id,list);linkedReceipts.add(link.tx_id);}
 const invoices:Row[]=[];
 for(const invoice of input.invoices){
  if(invoice.void_id)continue;
  const linkIds=linksByInvoice.get(invoice.id)||[],activeReceipts=linkIds.map(id=>receipts.get(id)).filter(Boolean) as Row[],hasReversed=activeReceipts.some(t=>reversed.has(t.id));
  const supplierWarning=activeReceipts.some(t=>!t.partner||normalize(t.partner)!==normalize(invoice.supplier_snapshot?.name||""));
  const delivered=new Map<string,Row[]>();for(const t of activeReceipts)if(!reversed.has(t.id))for(const l of t.lines){const list=delivered.get(l.item)||[];list.push(l);delivered.set(l.item,list);}
  const billed=new Map<string,{name:string;unit:string;quantity:number;comparable:boolean}>();
  for(const l of invoice.lines){const item=items.get(l.item),key=l.item||"unmapped:"+l.name+":"+l.unit,old=billed.get(key);
   billed.set(key,{name:item?.name||l.name,unit:l.unit,quantity:round((old?.quantity||0)+l.quantity),comparable:!!item&&(!old||old.unit===l.unit)});}
  const keys=new Set([...billed.keys(),...delivered.keys()]);
  for(const key of keys){const line=billed.get(key),receivedLines=delivered.get(key)||[],item=items.get(key);
   let received:number|null=null;
   if(linkIds.length&&!hasReversed){
    if(!line)received=round(receivedLines.reduce((sum,l)=>sum+l.baseQuantity,0));
    else if(line.comparable){
     if(!receivedLines.length)received=0;
     else if(line.unit===item?.unit)received=round(receivedLines.reduce((sum,l)=>sum+l.baseQuantity,0));
     else if(receivedLines.every(l=>l.enteredUnit===line.unit&&typeof l.quantity==="number"))received=round(receivedLines.reduce((sum,l)=>sum+l.quantity,0));
    }
   }
   const comparable=!!line?.comparable&&received!==null;
   const status=hasReversed?"reversed":!linkIds.length?"no_receipt":!line?"extra_receipt":!comparable?"unknown":Math.abs(line.quantity-received!)<0.0005?"matched":"variance";
   const itemReceipts=activeReceipts.filter(t=>t.lines.some((l:Row)=>l.item===key));
   invoices.push({invoiceId:invoice.id,invoiceNumber:invoice.number,invoiceDate:invoice.date,supplier:invoice.supplier_snapshot?.name||"",supplierWarning,reference:invoice.reference,receiptNumbers:itemReceipts.map(t=>t.number),locationIds:[...new Set(itemReceipts.map(t=>t.to_location))],locationNames:[...new Set(itemReceipts.map(t=>locations.get(t.to_location)||t.to_location))],item:key.startsWith("unmapped:")?"":key,itemName:line?.name||items.get(key)?.name||key,unit:line?.unit||item?.unit||"",billed:line?.quantity??null,received,status,difference:comparable?round(received!-line.quantity):null});
  }
 }
 const unlinkedReceipts=[...receipts.values()].filter(t=>!reversed.has(t.id)&&!linkedReceipts.has(t.id)).flatMap(t=>t.lines.map((l:Row)=>({number:t.number,date:t.date,supplier:t.partner||"Chưa rõ NCC",location:t.to_location,locationName:locations.get(t.to_location)||t.to_location,item:l.item,itemName:l.itemName,quantity:l.baseQuantity,unit:l.baseUnit}))).sort((a,b)=>b.date.localeCompare(a.date));
 const itemsWithoutBalance=input.items.filter(i=>i.active&&!stock.some(s=>s.item===i.code)).length;
 return {generatedAt,locations:input.locations.map(l=>({id:l.id,name:l.name})),stock,invoices,unlinkedReceipts,summary:{stockLines:stock.length,itemsWithoutBalance,uncounted:stock.filter(x=>x.status==="not_counted").length,countVariances:stock.filter(x=>x.status==="variance").length,invoiceIssues:invoices.filter(x=>x.status!=="matched"||x.supplierWarning).length,unlinkedReceipts:unlinkedReceipts.length}};
}

"use client";
import {useState} from "react";
import {Plus,Trash2,Save,Check,ArrowRight,Info} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter} from "@/components/ui/dialog";
import {Table,TableHeader,TableRow,TableHead,TableBody,TableCell} from "@/components/ui/table";
import {Field,Pick,ItemPicker,qty,money,Heading} from "./kho-ui";
import {TYPES,prepareTransaction,key,today,type State,type TxType} from "@/lib/inventory";
import {ChoiceField,NoteField} from "./choice-fields";
import {mergeOptions} from "@/lib/form-options";
export function newVoucher(type:TxType="RECEIPT",revision=0,user=""){return {id:crypto.randomUUID(),revision,type,date:today(),from:"KHO_TONG",to:type==="TRANSFER"?"BUONG_PHONG":"KHO_TONG",partner:"",person:user,note:"",reference:"",lines:[{item:"",quantity:"",price:"",unitMode:"base",lot:"",expiry:"",condition:"usable"}]};}
export default function VoucherForm({data,form,setForm,execute,busy,onDone}:{data:State;form:any;setForm:(v:any)=>void;execute:any;busy:boolean;onDone:any}){
 const [review,setReview]=useState<any>(null),[error,setError]=useState("");
 const type=form.type as TxType,count=type==="COUNT",transfer=["TRANSFER","RETURN"].includes(type),outgoing=["TRANSFER","RETURN","CONSUME","DAMAGE","LOSS","SUPPLIER_RETURN"].includes(type);
 const set=(k:string,v:any)=>setForm({...form,[k]:v});const row=(i:number,k:string,v:any)=>set("lines",form.lines.map((l:any,j:number)=>i===j?{...l,[k]:v}:l));
 const options=data.locations.filter(l=>l.active).map(l=>({value:l.id,label:l.name}));
 const label=(id:string)=>data.locations.find(l=>l.id===id)?.name??id;
 async function draft(){setError("");try{await execute("draft",form,{id:form.id});}catch(e:any){setError(e.message);}}
 function preview(){
  try{const payload={...form,revision:data.revision,lines:form.lines.map((l:any)=>({...l,quantity:l.quantity===""?NaN:Number(l.quantity),price:l.price===""?undefined:Number(l.price)}))};
  const p=prepareTransaction(payload,data.items,data.locations,data.balances,new Date().toISOString());setReview({payload,...p});setError("");
  }catch(e:any){setError(e.message);}
 }
 async function commit(){try{const res=await execute("transaction",review.payload,{id:review.payload.id});setReview(null);setError("");onDone(res);}catch(e:any){setError(e.message);}}
 return <div><Heading title={count?"Kiểm kê & xác nhận số dư":"Lập phiếu kho"} detail={count?"Nhập số đếm thực tế theo từng mặt hàng, lô và tình trạng. Chỉ các dòng trong phiếu được điều chỉnh.":"Ghi nhận khi hàng đã được nhận hoặc bàn giao thực tế."}/><div className="panel mb-5"><div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
 <Field label="Loại phiếu"><Pick label="Loại phiếu" value={type} onChange={v=>{setForm({...newVoucher(v as TxType,data.revision,data.user),lines:form.lines});setError("");}} options={Object.entries(TYPES).filter(([k])=>k!=="REVERSAL").map(([value,label])=>({value,label}))}/></Field>
 <Field label="Ngày thực tế"><Input aria-label="Ngày thực tế" type="date" max={today()} value={form.date} onChange={e=>set("date",e.target.value)}/></Field>
 {outgoing&&<Field label="Xuất từ khu"><Pick label="Xuất từ khu" value={form.from} onChange={v=>set("from",v)} options={options}/></Field>}
 {(transfer||type==="RECEIPT"||count)&&<Field label={count?"Khu đang kiểm kê":"Nơi nhận thực tế"} hint={type==="RECEIPT"?"Chọn khu trực tiếp nhận hàng, kể cả khi hàng không qua kho tổng.":undefined}><Pick label="Nơi nhận thực tế" value={form.to} onChange={v=>set("to",v)} options={options}/></Field>}
 {["RECEIPT","SUPPLIER_RETURN"].includes(type)&&<Field label="Nhà cung cấp *"><ChoiceField label="Nhà cung cấp" value={form.partner} onChange={v=>set("partner",v)} options={mergeOptions(data.suppliers.filter(s=>s.active).map(s=>s.name),data.choices?.partners??[])} maxLength={200}/></Field>}
 <Field label={transfer||type==="RECEIPT"?"Người nhận / kiểm hàng *":"Người thực hiện"}><ChoiceField label="Người nhận / thực hiện" value={form.person} onChange={v=>set("person",v)} options={mergeOptions([data.user],data.choices?.people??[])} maxLength={200}/></Field>
 <Field label="Hóa đơn / chứng từ liên quan"><Input value={form.reference} onChange={e=>set("reference",e.target.value)} placeholder="Số hóa đơn, phiếu giao hàng…"/></Field>
 </div></div>
 <div className="flex justify-between items-center mb-4 gap-3"><h2 className="text-lg font-semibold">Hàng hóa <span className="subtle">({form.lines.length} dòng)</span></h2><Button variant="outline" onClick={()=>set("lines",[...form.lines,{item:"",quantity:"",price:"",unitMode:"base",lot:"",expiry:"",condition:"usable"}])} disabled={form.lines.length>=100}><Plus/> Thêm hàng</Button></div>
 <div className="space-y-3">{form.lines.map((l:any,i:number)=>{
 const item=data.items.find(it=>it.code===l.item);const available=data.balances.filter(b=>b.item===l.item&&b.location===form.from&&b.quantity>0);
 const b=data.balances.find(b=>key(b)===key({item:l.item,location:outgoing?form.from:form.to,condition:l.condition,lot:l.lot.trim(),expiry:l.expiry}));
 return <section className="line-card" key={i}><div className={"grid gap-4 items-end "+(type==="RECEIPT"?"md:grid-cols-2 xl:grid-cols-[minmax(180px,1fr)_100px_130px_130px_44px]":"md:grid-cols-[1fr_130px_150px_44px]")}>
 <Field label={"Mặt hàng "+(i+1)}><ItemPicker items={data.items} value={l.item} onChange={code=>{const list=data.balances.filter(b=>b.item===code&&b.location===form.from&&b.quantity>0);const chosen=outgoing&&list.length===1?list[0]:null;set("lines",form.lines.map((x:any,j:number)=>i===j?{...x,item:code,unitMode:"base",lot:chosen?.lot??"",expiry:chosen?.expiry??"",condition:chosen?.condition??"usable"}:x));}}/></Field>
 <Field label={count?"Số đếm thực tế *":"Số lượng *"}><Input aria-label={"Số lượng dòng "+(i+1)} type="number" min={count?0:.001} step=".001" value={l.quantity} onChange={e=>row(i,"quantity",e.target.value)} placeholder="0"/></Field>
 <Field label="Đơn vị"><Pick label={"Đơn vị dòng "+(i+1)} value={l.unitMode} onChange={v=>row(i,"unitMode",v)} options={[{value:"base",label:item?.unit??"Chọn hàng"},...(item?.pack_unit?[{value:"pack",label:item.pack_unit+" (×"+qty(item.pack_size/1000)+")"}]:[])]}/></Field>
 {type==="RECEIPT"&&<Field label="Đơn giá (đ)"><Input aria-label={"Đơn giá dòng "+(i+1)} type="number" min="0" step="1" value={l.price} onChange={e=>row(i,"price",e.target.value)} placeholder="Chưa có"/></Field>}<Button variant="ghost" size="icon" aria-label={"Bỏ dòng "+(i+1)} disabled={form.lines.length===1} onClick={()=>set("lines",form.lines.filter((_:any,j:number)=>j!==i))}><Trash2 size={18}/></Button></div>
 {item&&<div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm"><span className="text-muted-foreground">{item.code} · {item.category}</span><span className={b?.verified_at?"text-primary":"text-amber-700"}>{b?.verified_at?"Tồn đã xác nhận: "+qty(b.quantity/1000)+" "+item.unit:"Chưa xác nhận số dư tại khu này"+(b?" · Đã ghi nhận "+qty(b.quantity/1000)+" "+item.unit:"")}</span></div>}
 <details className="mt-3"><summary className="text-sm text-primary cursor-pointer">Lô, hạn dùng, tình trạng{type==="RECEIPT"?" và giá nhập":""}</summary><div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-3">
 {outgoing&&available.length>0&&<Field label="Chọn lô đang có"><Pick label={"Lô đang có dòng "+(i+1)} value={available.some(x=>x.lot===l.lot&&x.expiry===l.expiry&&x.condition===l.condition)?String(available.findIndex(x=>x.lot===l.lot&&x.expiry===l.expiry&&x.condition===l.condition)+1):""} onChange={v=>{const selected=available[Number(v)-1];set("lines",form.lines.map((x:any,j:number)=>i===j?{...x,lot:selected.lot,expiry:selected.expiry,condition:selected.condition}:x));}} options={available.map((b,j)=>({value:String(j+1),label:(b.lot||"Không chia lô")+" · "+qty(b.quantity/1000)+" "+item?.unit+(b.expiry?" · HSD "+b.expiry:"")+(b.condition==="damaged"?" · Hỏng":"")}))}/></Field>}
 <Field label="Mã lô (nếu có)"><Input value={l.lot} onChange={e=>row(i,"lot",e.target.value)} placeholder="Không chia lô"/></Field>
 <Field label="Hạn dùng (nếu có)"><Input type="date" value={l.expiry} onChange={e=>row(i,"expiry",e.target.value)}/></Field>
 <Field label="Tình trạng"><Pick label={"Tình trạng dòng "+(i+1)} value={l.condition} onChange={v=>row(i,"condition",v)} options={[{value:"usable",label:"Dùng được"},{value:"damaged",label:"Hỏng / chờ xử lý"}]}/></Field>

 </div></details></section>;})}</div>
 <div className="panel my-5"><Field label={["CONSUME","DAMAGE","LOSS","SUPPLIER_RETURN","COUNT"].includes(type)?"Lý do / nội dung *":"Ghi chú"}><NoteField kind={type} label="Lý do / nội dung" value={form.note} onChange={v=>set("note",v)}/></Field>{count&&<p className="subtle mt-3 flex gap-2"><Info size={18} className="shrink-0"/>Nhập số 0 nếu đã kiểm tra và không còn hàng. Các hàng chưa đưa vào phiếu vẫn giữ nguyên.</p>}</div>
 {error&&<p className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl mb-4" role="alert">{error}</p>}
 <div className="sticky-actions flex flex-wrap justify-between items-center gap-3"><span className="subtle">{form.lines.length} dòng · Chưa ghi vào tồn kho</span><div className="flex gap-2"><Button variant="outline" disabled={busy} onClick={draft}><Save/> Lưu nháp</Button><Button disabled={busy} onClick={preview}>Xem lại phiếu <ArrowRight/></Button></div></div>
 <Dialog open={!!review} onOpenChange={v=>!v&&!busy&&setReview(null)}><DialogContent className="sm:max-w-3xl max-h-[88vh] overflow-y-auto"><DialogHeader><DialogTitle>Xác nhận {TYPES[type].toLowerCase()}</DialogTitle><DialogDescription>{review?.from?label(review.from)+" → ":""}{review?.to?label(review.to):"Ghi giảm tại nơi xuất"} · {form.date}</DialogDescription></DialogHeader>
 {review&&<><Table><TableHeader><TableRow><TableHead>Hàng hóa</TableHead><TableHead className="text-right">{count?"Số thực đếm":"Số lượng"}</TableHead>{count&&<TableHead className="text-right">Chênh lệch</TableHead>}</TableRow></TableHeader><TableBody>{review.lines.map((l:any,i:number)=><TableRow key={i}><TableCell className="table-cell-name">{l.itemName}<p className="subtle">{l.lot||"Không chia lô"}{l.expiry?" · "+l.expiry:""} · {l.condition==="damaged"?"Hỏng":"Dùng được"}</p></TableCell><TableCell className="text-right">{qty(l.baseQuantity)} {l.baseUnit}</TableCell>{count&&<TableCell className="text-right">{l.difference>0?"+":""}{qty(l.difference)}</TableCell>}</TableRow>)}</TableBody></Table>
 {type==="RECEIPT"&&<p className="text-right font-semibold">{review.lines.some((l:any)=>l.priceMissing)?"Giá trị đã nhập (còn dòng chưa có giá)":"Tổng tiền"}: {money(review.total)}</p>}
 <p className="text-sm"><b>Người nhận / thực hiện:</b> {form.person||data.user}</p><p className="text-sm">{form.note}</p>
 {error&&<p role="alert" className="text-red-700">{error}</p>}<DialogFooter><Button variant="outline" disabled={busy} onClick={()=>setReview(null)}>Quay lại sửa</Button><Button disabled={busy} onClick={commit}><Check/> {busy?"Đang ghi…":"Xác nhận & ghi sổ"}</Button></DialogFooter></>}
 </DialogContent></Dialog></div>;
}

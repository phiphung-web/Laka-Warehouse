"use client";
import {type ReactNode} from "react";
import {Search,PackageOpen} from "lucide-react";
import {Input} from "@/components/ui/input";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "@/components/ui/select";
import {Combobox,ComboboxInput,ComboboxContent,ComboboxList,ComboboxItem,ComboboxEmpty} from "@/components/ui/combobox";
import {normalize,type Item} from "@/lib/inventory";
export const nf=new Intl.NumberFormat("vi-VN",{maximumFractionDigits:3});
export const money=(n:number)=>nf.format(n)+" đ";
export const qty=(n:number)=>nf.format(n);
export const dt=(s:string)=>s?new Date(s.length===10?s+"T00:00:00+07:00":s).toLocaleDateString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"}):"—";
export function Field({label,children,hint}:{label:string;children:ReactNode;hint?:string}){return <label className="field"><span>{label}</span>{children}{hint&&<small className="subtle">{hint}</small>}</label>;}
export function Pick({value,onChange,options,label,placeholder="Chọn…"}:{value:string;onChange:(v:string)=>void;options:{value:string;label:string}[];label:string;placeholder?:string}){if(options.length>12)return <Combobox items={options} value={options.find(i=>i.value===value)??null} onValueChange={(v:any)=>{if(v)onChange(v.value);}} itemToStringLabel={(i:any)=>i.label} itemToStringValue={(i:any)=>i.value} filter={(i:any,q:string)=>normalize(i.label).includes(normalize(q))}><ComboboxInput aria-label={label} placeholder={placeholder} className="w-full"/><ComboboxContent><ComboboxEmpty>Không tìm thấy lựa chọn.</ComboboxEmpty><ComboboxList>{(i:any)=><ComboboxItem key={i.value} value={i}>{i.label}</ComboboxItem>}</ComboboxList></ComboboxContent></Combobox>;return <Select value={value||undefined} onValueChange={onChange}><SelectTrigger className="w-full" aria-label={label}><SelectValue placeholder={placeholder}/></SelectTrigger><SelectContent position="popper">{options.map(o=><SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>;}
export function ItemPicker({items,value,onChange}:{items:Item[];value:string;onChange:(v:string)=>void}){
 const options=items.filter(i=>i.active).map(i=>({value:i.code,label:i.name+" · "+i.code}));
 return <Combobox items={options} value={options.find(i=>i.value===value)??null} onValueChange={(v:any)=>onChange(v?.value??"")} itemToStringLabel={(i:any)=>i.label} itemToStringValue={(i:any)=>i.value} filter={(i:any,q:string)=>normalize(i.label).includes(normalize(q))}>
 <ComboboxInput aria-label="Tìm mặt hàng theo tên hoặc mã" placeholder="Tìm tên hàng hoặc mã…" className="w-full"/>
 <ComboboxContent><ComboboxEmpty>Không tìm thấy mặt hàng.</ComboboxEmpty><ComboboxList>{(i:any)=><ComboboxItem key={i.value} value={i}>{i.label}</ComboboxItem>}</ComboboxList></ComboboxContent></Combobox>;
}
export function SearchBox({value,onChange,placeholder="Tìm tên hoặc mã hàng…"}:{value:string;onChange:(v:string)=>void;placeholder?:string}){return <div className="relative min-w-0"><Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground"/><Input className="pl-10" aria-label={placeholder} placeholder={placeholder} value={value} onChange={e=>onChange(e.target.value)}/></div>;}
export function Empty({title,detail,children}:{title:string;detail?:string;children?:ReactNode}){return <div className="empty-state"><PackageOpen size={32} className="mx-auto mb-3 opacity-60"/><p className="font-semibold text-foreground">{title}</p>{detail&&<p className="text-sm mt-1">{detail}</p>}<div className="mt-4">{children}</div></div>;}
export function Heading({title,detail,children}:{title:string;detail?:string;children?:ReactNode}){return <div className="flex flex-wrap justify-between items-start gap-4 mb-7"><div><h1 className="page-title">{title}</h1>{detail&&<p className="subtle mt-2">{detail}</p>}</div>{children}</div>;}
export function download(name:string,content:string,type:string){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function csv(rows:any[][]){return "\ufeff"+rows.map(row=>row.map(v=>{let s=String(v??"");if(typeof v==="string"&&/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}).join(",")).join("\r\n");}

"use client";
import {useState} from "react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {Combobox,ComboboxInput,ComboboxContent,ComboboxList,ComboboxItem,ComboboxEmpty} from "@/components/ui/combobox";
import {normalize} from "@/lib/inventory";
import {mergeOptions,optionKey,splitCategories,REASONS} from "@/lib/form-options";

export function ChoiceField({value,onChange,options,label,allowNew=true,maxLength=100,disabled=false}:{value:string;onChange:(v:string)=>void;options:string[];label:string;allowNew?:boolean;maxLength?:number;disabled?:boolean}){
 const [adding,setAdding]=useState(false),[draft,setDraft]=useState("");
 const labels=mergeOptions(value?[value]:[],options),items=labels.map(label=>({label,value:label}));
 function add(){const clean=draft.trim().replace(/\s+/g," ");if(!clean||clean.length>maxLength)return;onChange(labels.find(v=>optionKey(v)===optionKey(clean))||clean);setAdding(false);setDraft("");}
 return <div className="space-y-1 min-w-0">
 <Combobox disabled={disabled} items={items} value={items.find(i=>i.value===value)??null} onValueChange={(i:any)=>onChange(i?.value??"")} itemToStringLabel={(i:any)=>i.label} itemToStringValue={(i:any)=>i.value} filter={(i:any,q:string)=>normalize(i.label).includes(normalize(q))}>
 <ComboboxInput aria-label={label} placeholder="Chọn hoặc tìm trong danh sách…" showClear className="w-full" disabled={disabled}/>
 <ComboboxContent><ComboboxEmpty>Chưa có lựa chọn phù hợp.</ComboboxEmpty><ComboboxList>{(i:any)=><ComboboxItem key={i.value} value={i}>{i.label}</ComboboxItem>}</ComboboxList></ComboboxContent>
 </Combobox>
 {allowNew&&!disabled&&!adding&&<Button type="button" size="sm" variant="ghost" onClick={()=>{setDraft("");setAdding(true);}}>+ Thêm lựa chọn mới</Button>}
 {adding&&<div className="flex gap-1 flex-wrap"><Input aria-label={"Giá trị mới: "+label} maxLength={maxLength} value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();add();}}} placeholder="Nhập một lần, dùng lại sau khi lưu"/><Button type="button" size="sm" disabled={!draft.trim()} onClick={add}>Dùng giá trị này</Button><Button type="button" size="sm" variant="ghost" onClick={()=>setAdding(false)}>Hủy</Button></div>}
 </div>;
}
export function MultiChoiceField({value,onChange,options,label}:{value:string;onChange:(v:string)=>void;options:string[];label:string}){
 const selected=splitCategories(value);
 return <div className="space-y-2"><div className="flex gap-1 flex-wrap">{selected.map(v=><Button key={v} type="button" size="sm" variant="secondary" aria-label={"Bỏ "+v} onClick={()=>onChange(selected.filter(x=>x!==v).join("; "))}>{v} ×</Button>)}</div><ChoiceField value="" label={label} options={options.filter(v=>!selected.some(s=>optionKey(s)===optionKey(v)))} onChange={v=>{if(v)onChange(mergeOptions(selected,[v]).join("; "));}}/></div>;
}
export function NoteField({value,onChange,kind,label="Ghi chú",maxLength=2000}:{value:string;onChange:(v:string)=>void;kind:string;label?:string;maxLength?:number}){
 return <div className="space-y-2">{!!REASONS[kind]?.length&&<ChoiceField label={"Chọn mẫu: "+label} value="" options={REASONS[kind]} allowNew={false} onChange={v=>{if(v&&!value.split("\n").includes(v))onChange((value?value+"\n":"")+v);}}/>}<Textarea aria-label={label} value={value} maxLength={maxLength} onChange={e=>onChange(e.target.value)} placeholder="Chọn nội dung có sẵn; bổ sung chi tiết thực tế nếu cần." rows={3}/></div>;
}

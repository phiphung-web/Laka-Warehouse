"use client";
import {useState,useEffect,useCallback,useRef} from "react";
import {Download,RefreshCw,TrendingUp,ArrowRightLeft,Calendar,Filter,Search} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Table,TableHeader,TableRow,TableHead,TableBody,TableCell} from "@/components/ui/table";
import {KINDS,normalize,today,type State} from "@/lib/inventory";
import {Heading,Pick,SearchBox,Empty,qty,dt,download,csv} from "./kho-ui";

export interface FlowReportResponse {
 filters: { from: string; to: string; location: string; item: string; usage: string; category: string };
 summaryByUnit: {
  unit: string; itemCount: number; opening: number; receipt: number; transferIn: number; transferOut: number;
  returnIn: number; returnOut: number; consumption: number; damageIn: number; damageOut: number; damageNet: number;
  loss: number; supplierReturn: number; countAdjustment: number; reversal: number; periodNet: number; closing: number;
 }[];
 rows: {
  item: string; itemName: string; unit: string; category: string; kind: string;
  usageLocation: string | null; usageLocationName: string; location: string; locationName: string; condition: string;
  opening: number; receipt: number; transferIn: number; transferOut: number; returnIn: number; returnOut: number;
  consumption: number; damageIn: number; damageOut: number; damageNet: number; loss: number; supplierReturn: number;
  countAdjustment: number; reversal: number; periodNet: number; closing: number;
 }[];
 transferEdges: { fromId: string; fromName: string; toId: string; toName: string; item: string; itemName: string; unit: string; txCount: number; quantity: number }[];
 daily: { date: string; unit: string; receipt: number; transferIn: number; transferOut: number; returnIn: number; returnOut: number; consumption: number; damageNet: number; loss: number; supplierReturn: number; countAdjustment: number; reversal: number; periodNet: number }[];
 rowCount: number;
}

export function AnalyticsView({data,go}:{data:State;go?:(t:string)=>void}){
 const [from,setFrom]=useState(today().slice(0,7)+"-01");
 const [to,setTo]=useState(today());
 const [location,setLocation]=useState("all");
 const [usage,setUsage]=useState("all");
 const [item,setItem]=useState("all");
 const [category,setCategory]=useState("all");
 const [report,setReport]=useState<FlowReportResponse|null>(null);
 const reqIdRef=useRef(0);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState("");
 const [search,setSearch]=useState("");
 const [page,setPage]=useState(0);
 const [tab,setTab]=useState<"breakdown"|"edges"|"daily">("breakdown");

 const fetchReport=useCallback(async()=>{
  const curReqId=++reqIdRef.current;
  setLoading(true);
  setError("");
  try{
   const params=new URLSearchParams({report:"flow",from,to});
   if(location!=="all")params.set("location",location);
   if(usage!=="all")params.set("usage",usage);
   if(item!=="all")params.set("item",item);
   if(category!=="all")params.set("category",category);
   const res=await fetch("/api/kho?"+params.toString());
   const raw:unknown=await res.json();
   if(curReqId!==reqIdRef.current)return;
   const out=raw as {error?:string}&Partial<FlowReportResponse>;
   if(!res.ok||out.error)throw new Error(out.error||"Không thể tải báo cáo luồng hàng.");
   if(!out.rows||!out.summaryByUnit||!out.filters)throw new Error("Dữ liệu báo cáo không đúng định dạng.");
   setReport(out as FlowReportResponse);
   setPage(0);
  }catch(e:any){
   if(curReqId===reqIdRef.current){
    setError(e.message);
   }
  }finally{
   if(curReqId===reqIdRef.current){
    setLoading(false);
   }
  }
 },[from,to,location,usage,item,category]);

 useEffect(()=>{fetchReport();return ()=>{reqIdRef.current++;};},[fetchReport]);

 function exportCsv(){
  if(!report?.rows||loading||error)return;
  const headers=[
   "Mã hàng","Tên hàng","Đơn vị","Nhóm hàng","Loại quản lý","Khu dự kiến","Khu thực tế","Tình trạng",
   "Tồn đầu kỳ","Nhập mua","Chuyển đến","Chuyển đi","Trả về","Trả đi","Tiêu hao","Hỏng tăng","Hỏng giảm","Hỏng thuần",
   "Mất/hủy","Trả NCC","Chênh lệch kiểm kê","Đảo phiếu","Biến động thuần","Tồn cuối kỳ"
  ];
  const rows=report.rows.map(r=>[
   r.item,r.itemName,r.unit,r.category,KINDS[r.kind as keyof typeof KINDS]||r.kind,r.usageLocationName,r.locationName,
   r.condition==="usable"?"Dùng được":"Hỏng",r.opening,r.receipt,r.transferIn,r.transferOut,r.returnIn,r.returnOut,
   r.consumption,r.damageIn,r.damageOut,r.damageNet,r.loss,r.supplierReturn,r.countAdjustment,r.reversal,r.periodNet,r.closing
  ]);
  const rf=report.filters;
  const suffix=[rf.location!=="all"?rf.location:"",rf.usage!=="all"?"usage-"+rf.usage:"",rf.item!=="all"?rf.item:"",rf.category!=="all"?rf.category:""].filter(Boolean).join("-");
  const filename=`luong-hang-${rf.from}-${rf.to}${suffix?"-"+suffix:""}.csv`;
  download(filename,csv([headers,...rows]),"text/csv;charset=utf-8");
 }

 const filteredRows=(report?.rows??[]).filter((r:any)=>
  normalize(r.itemName+" "+r.item+" "+r.category+" "+r.locationName+" "+r.usageLocationName).includes(normalize(search))
 );
 const visibleRows=filteredRows.slice(page*30,page*30+30);

 return (
  <>
   <Heading title="Phân tích luồng hàng" detail="Báo cáo luồng hàng từ toàn bộ sổ phát sinh. Tồn đầu kỳ, biến động nghiệp vụ và tồn cuối kỳ đối soát chuẩn xác theo đơn vị.">
    <div className="flex gap-2">
     <Button variant="outline" onClick={()=>fetchReport()} disabled={loading}>
      <RefreshCw size={16} className={loading?"animate-spin":""}/> Làm mới
     </Button>
     <Button variant="outline" onClick={exportCsv} disabled={loading||!!error||!report?.rows?.length}>
      <Download size={16}/> Xuất CSV toàn bộ
     </Button>
    </div>
   </Heading>

   <div className="panel mb-6 p-4">
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
     <div>
      <label className="text-xs font-semibold subtle mb-1 block">Từ ngày</label>
      <Input type="date" value={from} onChange={e=>setFrom(e.target.value)}/>
     </div>
     <div>
      <label className="text-xs font-semibold subtle mb-1 block">Đến ngày</label>
      <Input type="date" value={to} onChange={e=>setTo(e.target.value)}/>
     </div>
     <div>
      <label className="text-xs font-semibold subtle mb-1 block">Khu thực tế</label>
      <Pick label="Khu thực tế" value={location} onChange={setLocation} options={[{value:"all",label:"Tất cả khu thực tế"},...data.locations.map(l=>({value:l.id,label:l.name}))]}/>
     </div>
     <div>
      <label className="text-xs font-semibold subtle mb-1 block">Khu dự kiến</label>
      <Pick label="Khu dự kiến" value={usage} onChange={setUsage} options={[{value:"all",label:"Tất cả khu dự kiến"},{value:"unassigned",label:"Chưa gán khu dự kiến"},...data.locations.map(l=>({value:l.id,label:l.name}))]}/>
     </div>
     <div>
      <label className="text-xs font-semibold subtle mb-1 block">Nhóm hàng</label><Pick label="Nhóm hàng báo cáo" value={category} onChange={setCategory} options={[{value:"all",label:"Tất cả nhóm hàng"},...Array.from(new Set(data.items.map(i=>i.category))).filter(Boolean).map(value=>({value,label:value}))]}/></div><div><label className="text-xs font-semibold subtle mb-1 block">Mặt hàng</label>
      <Pick label="Mặt hàng" value={item} onChange={setItem} options={[{value:"all",label:"Tất cả mặt hàng"},...data.items.filter(i=>i.active).map(i=>({value:i.code,label:i.name+" ("+i.code+")"}))]}/>
     </div>
    </div>
   </div>

   {error&&<div className="bg-red-50 text-red-800 border border-red-200 rounded-xl p-4 mb-5" role="alert">{error}</div>}

   {report&&report.summaryByUnit.length>0&&(
    <section className="mb-6">
     <h2 className="text-sm font-semibold mb-3">Tổng hợp luồng hàng theo đơn vị tính ({report.summaryByUnit.length} đơn vị)</h2>
     <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {report.summaryByUnit.map((u:any)=>(
       <div key={u.unit} className="panel p-4 space-y-2 border">
        <div className="flex justify-between items-baseline border-b pb-2">
         <span className="font-bold text-base text-foreground">Đơn vị: {u.unit}</span>
         <span className="subtle text-xs">{u.itemCount} mặt hàng</span>
        </div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
         <span className="subtle">Đầu kỳ:</span>
         <span className="text-right font-medium">{qty(u.opening)}</span>
         <span className="subtle text-emerald-700">Nhập mua:</span>
         <span className="text-right text-emerald-700 font-medium">+{qty(u.receipt)}</span>
         <span className="subtle text-blue-700">Chuyển đến:</span>
         <span className="text-right text-blue-700 font-medium">+{qty(u.transferIn)}</span>
         <span className="subtle text-amber-700">Chuyển đi:</span>
         <span className="text-right text-amber-700 font-medium">-{qty(u.transferOut)}</span>
         <span className="subtle text-rose-700">Tiêu hao / xuất:</span>
         <span className="text-right text-rose-700 font-medium">-{qty(u.consumption+u.loss+u.supplierReturn)}</span>
         <span className="subtle">Kiểm kê / đảo:</span>
         <span className="text-right font-medium">{u.countAdjustment+u.reversal>0?"+":""}{qty(u.countAdjustment+u.reversal)}</span>
         <div className="col-span-2 border-t pt-1 flex justify-between font-bold text-sm">
          <span>Cuối kỳ:</span>
          <span>{qty(u.closing)} {u.unit}</span>
         </div>
        </div>
       </div>
      ))}
     </div>
    </section>
   )}

   <div className="flex gap-2 border-b mb-4">
    <button type="button" className={`pb-2 px-3 text-sm font-semibold border-b-2 ${tab==="breakdown"?"border-primary text-primary":"border-transparent text-muted-foreground"}`} onClick={()=>setTab("breakdown")}>
     Bảng kê chi tiết ({report?.rows?.length??0})
    </button>
    <button type="button" className={`pb-2 px-3 text-sm font-semibold border-b-2 ${tab==="edges"?"border-primary text-primary":"border-transparent text-muted-foreground"}`} onClick={()=>setTab("edges")}>
     Luồng chuyển khu ({report?.transferEdges?.length??0})
    </button>
    <button type="button" className={`pb-2 px-3 text-sm font-semibold border-b-2 ${tab==="daily"?"border-primary text-primary":"border-transparent text-muted-foreground"}`} onClick={()=>setTab("daily")}>
     Biến động theo ngày ({report?.daily?.length??0})
    </button>
   </div>

   {tab==="breakdown"&&(
    <div className="space-y-4">
     <div className="max-w-md">
      <SearchBox value={search} onChange={v=>{setSearch(v);setPage(0);}} placeholder="Lọc theo tên, mã hàng, khu…"/>
     </div>
     <div className="panel p-0 overflow-x-auto">
      <Table>
       <TableHeader>
        <TableRow>
         <TableHead className="pl-5 min-w-[200px]">Mặt hàng</TableHead>
         <TableHead>Khu thực tế</TableHead>
         <TableHead>Khu dự kiến</TableHead>
         <TableHead className="text-right">Đầu kỳ</TableHead>
         <TableHead className="text-right text-emerald-700">Nhập mua</TableHead>
         <TableHead className="text-right text-blue-700">Chuyển đến</TableHead>
         <TableHead className="text-right text-amber-700">Chuyển đi</TableHead>
         <TableHead className="text-right text-rose-700">Tiêu hao</TableHead>
         <TableHead className="text-right">Kiểm kê / Đảo</TableHead>
         <TableHead className="text-right font-bold">Biến động</TableHead>
         <TableHead className="text-right font-bold pr-5">Cuối kỳ</TableHead>
        </TableRow>
       </TableHeader>
       <TableBody>
        {visibleRows.map((r:any,idx:number)=>(
         <TableRow key={idx}>
          <TableCell className="pl-5 table-cell-name">
           <b>{r.itemName}</b>
           <p className="subtle">{r.item} · {r.category} {r.condition==="damaged"?"· (Hỏng)":""}</p>
          </TableCell>
          <TableCell className="text-sm font-medium">{r.locationName}</TableCell>
          <TableCell className="text-sm subtle">{r.usageLocationName}</TableCell>
          <TableCell className="text-right whitespace-nowrap">{qty(r.opening)} <small className="subtle">{r.unit}</small></TableCell>
          <TableCell className="text-right whitespace-nowrap text-emerald-700">{r.receipt>0?"+"+qty(r.receipt):"—"}</TableCell>
          <TableCell className="text-right whitespace-nowrap text-blue-700">{r.transferIn>0?"+"+qty(r.transferIn):"—"}</TableCell>
          <TableCell className="text-right whitespace-nowrap text-amber-700">{r.transferOut>0?"-"+qty(r.transferOut):"—"}</TableCell>
          <TableCell className="text-right whitespace-nowrap text-rose-700">{r.consumption>0?"-"+qty(r.consumption):"—"}</TableCell>
          <TableCell className="text-right whitespace-nowrap">{r.countAdjustment+r.reversal!==0?(r.countAdjustment+r.reversal>0?"+":"")+qty(r.countAdjustment+r.reversal):"—"}</TableCell>
          <TableCell className="text-right whitespace-nowrap font-semibold">{r.periodNet>0?"+":""}{qty(r.periodNet)}</TableCell>
          <TableCell className="text-right whitespace-nowrap font-bold pr-5">{qty(r.closing)} <small className="subtle">{r.unit}</small></TableCell>
         </TableRow>
        ))}
       </TableBody>
      </Table>
      {!filteredRows.length&&!loading&&<Empty title="Không có luồng hàng trong khoảng thời gian đã chọn" detail="Thử chọn khoảng ngày rộng hơn hoặc bỏ bớt bộ lọc."/>}
      <div className="p-4 border-t flex justify-between items-center">
       <span className="subtle">{filteredRows.length} dòng hiển thị</span>
       <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={!page} onClick={()=>setPage(page-1)}>Trước</Button>
        <Button size="sm" variant="outline" disabled={(page+1)*30>=filteredRows.length} onClick={()=>setPage(page+1)}>Sau</Button>
       </div>
      </div>
     </div>
    </div>
   )}

   {tab==="edges"&&(
    <div className="panel p-0 overflow-x-auto">
     <Table>
      <TableHeader>
       <TableRow>
        <TableHead className="pl-5">Từ khu</TableHead>
        <TableHead>Đến khu</TableHead>
        <TableHead>Mặt hàng</TableHead>
        <TableHead className="text-right">Số lượng chuyển</TableHead>
        <TableHead className="text-right pr-5">Số lượt phiếu</TableHead>
       </TableRow>
      </TableHeader>
      <TableBody>
       {report?.transferEdges?.map((e:any,idx:number)=>(
        <TableRow key={idx}>
         <TableCell className="pl-5 font-medium">{e.fromName}</TableCell>
         <TableCell className="font-medium">{e.toName}</TableCell>
         <TableCell><b>{e.itemName}</b> <span className="subtle text-xs">({e.item})</span></TableCell>
         <TableCell className="text-right font-bold">{qty(e.quantity)} {e.unit}</TableCell>
         <TableCell className="text-right pr-5">{e.txCount} lượt</TableCell>
        </TableRow>
       ))}
      </TableBody>
     </Table>
     {!report?.transferEdges?.length&&<Empty title="Chưa có luân chuyển nội bộ trong kỳ" detail="Chuyển khu hoặc trả hàng giữa các vị trí sẽ hiển thị tại đây."/>}
    </div>
   )}

   {tab==="daily"&&(
    <div className="panel p-0 overflow-x-auto">
     <Table>
      <TableHeader>
       <TableRow>
        <TableHead className="pl-5">Ngày</TableHead>
        <TableHead>Đơn vị</TableHead>
        <TableHead className="text-right text-emerald-700">Nhập mua</TableHead>
        <TableHead className="text-right text-blue-700">Chuyển đến</TableHead>
        <TableHead className="text-right text-amber-700">Chuyển đi</TableHead>
        <TableHead className="text-right text-rose-700">Tiêu hao</TableHead>
        <TableHead className="text-right pr-5">Thay đổi thuần</TableHead>
       </TableRow>
      </TableHeader>
      <TableBody>
       {report?.daily?.map((d:any,idx:number)=>(
        <TableRow key={idx}>
         <TableCell className="pl-5 font-medium">{dt(d.date)}</TableCell>
         <TableCell>{d.unit}</TableCell>
         <TableCell className="text-right text-emerald-700">{d.receipt>0?"+"+qty(d.receipt):"—"}</TableCell>
         <TableCell className="text-right text-blue-700">{d.transferIn>0?"+"+qty(d.transferIn):"—"}</TableCell>
         <TableCell className="text-right text-amber-700">{d.transferOut>0?"-"+qty(d.transferOut):"—"}</TableCell>
         <TableCell className="text-right text-rose-700">{d.consumption>0?"-"+qty(d.consumption):"—"}</TableCell>
         <TableCell className="text-right font-bold pr-5">{d.periodNet>0?"+":""}{qty(d.periodNet)} {d.unit}</TableCell>
        </TableRow>
       ))}
      </TableBody>
     </Table>
     {!report?.daily?.length&&<Empty title="Chưa có phát sinh trong kỳ"/>}
    </div>
   )}
  </>
 );
}

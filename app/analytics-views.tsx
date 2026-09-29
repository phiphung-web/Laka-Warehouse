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
 rows: {
  item: string; itemName: string; unit: string; category: string; kind: string;
  usageLocation: string | null; usageLocationName: string; location: string; locationName: string; condition: string;
  opening: number; receipt: number; transferIn: number; transferOut: number; returnIn: number; returnOut: number;
  consumption: number; damageIn: number; damageOut: number; damageNet: number; loss: number; supplierReturn: number;
  countAdjustment: number; reversal: number; periodNet: number; closing: number;
 }[];
 receiptRoutes: { partner: string; toId: string; toName: string; item: string; itemName: string; unit: string; txCount: number; quantity: number; firstDate: string; lastDate: string }[];
 transferEdges: { type: "TRANSFER"|"RETURN"; fromId: string; fromName: string; toId: string; toName: string; item: string; itemName: string; unit: string; txCount: number; quantity: number; firstDate: string; lastDate: string }[];
 outboundRoutes: { type: "CONSUME"|"LOSS"|"SUPPLIER_RETURN"; partner: string; fromId: string; fromName: string; item: string; itemName: string; unit: string; txCount: number; quantity: number; firstDate: string; lastDate: string }[];
 daily: { date: string; location: string; locationName: string; item: string; itemName: string; unit: string; receipt: number; transferIn: number; transferOut: number; returnIn: number; returnOut: number; consumption: number; damageNet: number; loss: number; supplierReturn: number; countAdjustment: number; reversal: number; periodNet: number }[];
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
   if(!out.rows||!out.receiptRoutes||!out.transferEdges||!out.outboundRoutes||!out.daily||!out.filters)throw new Error("Dữ liệu báo cáo không đúng định dạng.");
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

 function exportRoutesCsv(){
  if(!report||loading||error)return;
  const headers=["Loại luồng","Từ","Nơi nhận / xử lý","Mã hàng","Tên hàng","Số lượng","Đơn vị","Số phiếu","Ngày đầu","Ngày cuối"];
  const rows=routes.map(r=>[r.type,r.from,r.toName,r.item,r.itemName,r.quantity,r.unit,r.txCount,r.firstDate,r.lastDate]);
  download(`tuyen-hang-${report.filters.from}-${report.filters.to}.csv`,csv([headers,...rows]),"text/csv;charset=utf-8");
 }

 const routes=report?[
  ...report.receiptRoutes.map(r=>({...r,type:"Nhập từ NCC",from:r.partner})),
  ...report.transferEdges.map(e=>({...e,type:e.type==="RETURN"?"Khu trả hàng":"Chuyển khu",from:e.fromName})),
  ...report.outboundRoutes.map(o=>({...o,type:o.type==="SUPPLIER_RETURN"?"Trả nhà cung cấp":o.type==="CONSUME"?"Tiêu hao":"Mất / hủy",from:o.fromName,toName:o.type==="SUPPLIER_RETURN"?o.partner:o.type==="CONSUME"?"Tiêu hao tại khu":"Mất / hủy tại khu"}))
 ].sort((a,b)=>b.lastDate.localeCompare(a.lastDate)||a.toName.localeCompare(b.toName)||a.itemName.localeCompare(b.itemName)):[];
 const areas=data.locations.filter(l=>location==="all"||l.id===location).map(l=>{
  const lines=(report?.rows??[]).filter(r=>r.location===l.id);
  const count=(test:(r:FlowReportResponse["rows"][number])=>boolean)=>new Set(lines.filter(test).map(r=>r.item)).size;
  return {id:l.id,name:l.name,items:count(()=>true),available:count(r=>r.closing>0),received:new Set((report?.receiptRoutes??[]).filter(r=>r.toId===l.id).map(r=>r.item)).size,transferred:new Set((report?.transferEdges??[]).filter(r=>r.toId===l.id).map(r=>r.item)).size,counted:count(r=>r.countAdjustment!==0)};
 });

 const filteredRows=(report?.rows??[]).filter((r:any)=>
  normalize(r.itemName+" "+r.item+" "+r.category+" "+r.locationName+" "+r.usageLocationName).includes(normalize(search))
 );
 const visibleRows=filteredRows.slice(page*30,page*30+30);

 return (
  <>
   <Heading title="Phân tích luồng hàng theo khu" detail="Xem từng khu nhận hàng từ nhà cung cấp nào, nhận chuyển từ khu nào, đã xuất đi đâu và hiện còn những mặt hàng gì.">
    <div className="flex gap-2">
     <Button variant="outline" onClick={()=>fetchReport()} disabled={loading}>
      <RefreshCw size={16} className={loading?"animate-spin":""}/> Làm mới
     </Button>
     <Button variant="outline" onClick={exportCsv} disabled={loading||!!error||!report?.rows?.length}>
      <Download size={16}/> Xuất CSV tồn và biến động
     </Button>
     <Button variant="outline" onClick={exportRoutesCsv} disabled={loading||!!error||!routes.length}><Download size={16}/> Xuất CSV tuyến hàng</Button>
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
      <label className="text-xs font-semibold subtle mb-1 block">Khu nhận / đang giữ hàng</label>
      <Pick label="Khu nhận / đang giữ hàng" value={location} onChange={setLocation} options={[{value:"all",label:"Tất cả khu"},...data.locations.map(l=>({value:l.id,label:l.name}))]}/>
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

   {report&&<section className="mb-6">
    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
     <h2 className="text-sm font-semibold">Các khu nhận và giữ hàng</h2>
     {location!=="all"&&<Button size="sm" variant="outline" onClick={()=>setLocation("all")}>Xem tất cả khu</Button>}
    </div>
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
     {areas.map(a=><button key={a.id} type="button" onClick={()=>{setLocation(a.id);setTab("breakdown");}} className="panel p-4 text-left space-y-2 border hover:border-primary focus-visible:outline-2 focus-visible:outline-primary" aria-label={"Xem chi tiết khu "+a.name}>
      <div className="flex justify-between gap-2"><b>{a.name}</b><span className="subtle text-xs">{a.items} mã có số liệu</span></div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
       <span>Nhập từ NCC</span><b className="text-right">{a.received} mã</b>
       <span>Chuyển / trả đến</span><b className="text-right">{a.transferred} mã</b>
       <span>Kiểm kê thay đổi</span><b className="text-right">{a.counted} mã</b>
       <span>Còn cuối kỳ</span><b className="text-right">{a.available} mã</b>
      </div>
     </button>)}
    </div>
    <p className="subtle text-xs mt-2">Số trên thẻ là số mã hàng, không cộng số lượng của các mặt hàng hoặc đơn vị khác nhau. Số dư đầu từ file cũ nằm ở kiểm kê, không tính là nhập mua từ NCC.</p>
   </section>}

   <div className="flex flex-wrap gap-2 border-b mb-4">
    <button type="button" className={`pb-2 px-3 text-sm font-semibold border-b-2 ${tab==="breakdown"?"border-primary text-primary":"border-transparent text-muted-foreground"}`} onClick={()=>setTab("breakdown")}>
     Hàng theo khu ({report?.rows?.length??0})
    </button>
    <button type="button" className={`pb-2 px-3 text-sm font-semibold border-b-2 ${tab==="edges"?"border-primary text-primary":"border-transparent text-muted-foreground"}`} onClick={()=>setTab("edges")}>
     Hàng từ đâu đến đâu ({routes.length})
    </button>
    <button type="button" className={`pb-2 px-3 text-sm font-semibold border-b-2 ${tab==="daily"?"border-primary text-primary":"border-transparent text-muted-foreground"}`} onClick={()=>setTab("daily")}>
     Theo ngày và khu ({report?.daily?.length??0})
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
         <TableHead className="pl-5">Khu nhận / đang giữ</TableHead>
         <TableHead className="min-w-[200px]">Mặt hàng</TableHead>
         <TableHead>Khu dự kiến</TableHead>
         <TableHead className="text-right">Đầu kỳ</TableHead>
         <TableHead className="text-right text-emerald-700">Nhập mua</TableHead>
         <TableHead className="text-right text-blue-700">Chuyển đến</TableHead>
         <TableHead className="text-right text-amber-700">Chuyển đi</TableHead>
         <TableHead className="text-right">Trả về</TableHead>
         <TableHead className="text-right">Trả đi</TableHead>
         <TableHead className="text-right text-rose-700">Tiêu hao</TableHead>
         <TableHead className="text-right">Hỏng thuần</TableHead>
         <TableHead className="text-right">Mất / hủy</TableHead>
         <TableHead className="text-right">Trả NCC</TableHead>
         <TableHead className="text-right">Kiểm kê / Đảo</TableHead>
         <TableHead className="text-right font-bold">Biến động</TableHead>
         <TableHead className="text-right font-bold pr-5">Cuối kỳ</TableHead>
        </TableRow>
       </TableHeader>
       <TableBody>
        {visibleRows.map((r:any,idx:number)=>(
         <TableRow key={idx}>
          <TableCell className="pl-5 text-sm font-medium">{r.locationName}</TableCell>
          <TableCell className="table-cell-name">
           <b>{r.itemName}</b>
           <p className="subtle">{r.item} · {r.category} {r.condition==="damaged"?"· (Hỏng)":""}</p>
          </TableCell>
          <TableCell className="text-sm subtle">{r.usageLocationName}</TableCell>
          <TableCell className="text-right whitespace-nowrap">{qty(r.opening)} <small className="subtle">{r.unit}</small></TableCell>
          <TableCell className="text-right whitespace-nowrap text-emerald-700">{r.receipt>0?"+"+qty(r.receipt):"—"}</TableCell>
          <TableCell className="text-right whitespace-nowrap text-blue-700">{r.transferIn>0?"+"+qty(r.transferIn):"—"}</TableCell>
          <TableCell className="text-right whitespace-nowrap text-amber-700">{r.transferOut>0?"-"+qty(r.transferOut):"—"}</TableCell>
          <TableCell className="text-right whitespace-nowrap">{r.returnIn>0?"+"+qty(r.returnIn):"—"}</TableCell>
          <TableCell className="text-right whitespace-nowrap">{r.returnOut>0?"-"+qty(r.returnOut):"—"}</TableCell>
          <TableCell className="text-right whitespace-nowrap text-rose-700">{r.consumption>0?"-"+qty(r.consumption):"—"}</TableCell>
          <TableCell className="text-right whitespace-nowrap">{r.damageNet!==0?(r.damageNet>0?"+":"")+qty(r.damageNet):"—"}</TableCell>
          <TableCell className="text-right whitespace-nowrap">{r.loss>0?"-"+qty(r.loss):"—"}</TableCell>
          <TableCell className="text-right whitespace-nowrap">{r.supplierReturn>0?"-"+qty(r.supplierReturn):"—"}</TableCell>
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
    <div className="space-y-3">
    <p className="subtle text-sm">Theo dõi nhập từ NCC, chuyển / trả giữa các khu và hàng rời khu do tiêu hao, mất/hủy hoặc trả NCC. Phiếu đã đảo được loại khỏi danh sách tuyến còn hiệu lực.</p>
    <div className="panel p-0 overflow-x-auto">
     <Table>
      <TableHeader>
       <TableRow>
        <TableHead className="pl-5">Loại</TableHead>
        <TableHead>Từ NCC / khu</TableHead>
        <TableHead>Nơi nhận / xử lý</TableHead>
        <TableHead>Mặt hàng</TableHead>
        <TableHead className="text-right">Số lượng</TableHead>
        <TableHead className="text-right">Số phiếu</TableHead>
        <TableHead className="text-right pr-5">Gần nhất</TableHead>
       </TableRow>
      </TableHeader>
      <TableBody>
       {routes.map((e,idx)=>(
        <TableRow key={idx}>
         <TableCell className="pl-5">{e.type}</TableCell>
         <TableCell>{e.from}</TableCell>
         <TableCell className="font-medium">{e.toName}</TableCell>
         <TableCell><b>{e.itemName}</b> <span className="subtle text-xs">({e.item})</span></TableCell>
         <TableCell className="text-right font-bold">{qty(e.quantity)} {e.unit}</TableCell>
         <TableCell className="text-right">{e.txCount}</TableCell>
         <TableCell className="text-right pr-5">{dt(e.lastDate)}</TableCell>
        </TableRow>
       ))}
      </TableBody>
     </Table>
     {!routes.length&&<Empty title="Chưa có tuyến nhập hoặc xuất trong kỳ" detail="Số dư đầu từ file cũ là mốc kiểm kê, không phải phiếu nhập từ nhà cung cấp."/>}
    </div>
    </div>
   )}

   {tab==="daily"&&(
    <div className="panel p-0 overflow-x-auto">
     <Table>
      <TableHeader>
       <TableRow>
        <TableHead className="pl-5">Ngày</TableHead>
        <TableHead>Khu</TableHead>
        <TableHead>Mặt hàng</TableHead>
        <TableHead className="text-right text-emerald-700">Nhập mua</TableHead>
        <TableHead className="text-right text-blue-700">Chuyển đến</TableHead>
        <TableHead className="text-right text-amber-700">Chuyển đi</TableHead>
        <TableHead className="text-right">Trả về</TableHead>
        <TableHead className="text-right">Trả đi</TableHead>
        <TableHead className="text-right">Kiểm kê</TableHead>
        <TableHead className="text-right text-rose-700">Tiêu hao</TableHead>
        <TableHead className="text-right">Mất / hủy</TableHead>
        <TableHead className="text-right">Trả NCC</TableHead>
        <TableHead className="text-right">Đảo phiếu</TableHead>
        <TableHead className="text-right pr-5">Thay đổi thuần</TableHead>
       </TableRow>
      </TableHeader>
      <TableBody>
       {report?.daily?.map((d,idx)=>(
        <TableRow key={idx}>
         <TableCell className="pl-5 font-medium">{dt(d.date)}</TableCell>
         <TableCell>{d.locationName}</TableCell>
         <TableCell>{d.itemName} <span className="subtle text-xs">({d.item})</span></TableCell>
         <TableCell className="text-right text-emerald-700">{d.receipt>0?"+"+qty(d.receipt):"—"}</TableCell>
         <TableCell className="text-right text-blue-700">{d.transferIn>0?"+"+qty(d.transferIn):"—"}</TableCell>
         <TableCell className="text-right text-amber-700">{d.transferOut>0?"-"+qty(d.transferOut):"—"}</TableCell>
         <TableCell className="text-right">{d.returnIn>0?"+"+qty(d.returnIn):"—"}</TableCell>
         <TableCell className="text-right">{d.returnOut>0?"-"+qty(d.returnOut):"—"}</TableCell>
         <TableCell className="text-right">{d.countAdjustment!==0?(d.countAdjustment>0?"+":"")+qty(d.countAdjustment):"—"}</TableCell>
         <TableCell className="text-right text-rose-700">{d.consumption>0?"-"+qty(d.consumption):"—"}</TableCell>
         <TableCell className="text-right">{d.loss>0?"-"+qty(d.loss):"—"}</TableCell>
         <TableCell className="text-right">{d.supplierReturn>0?"-"+qty(d.supplierReturn):"—"}</TableCell>
         <TableCell className="text-right">{d.reversal!==0?(d.reversal>0?"+":"")+qty(d.reversal):"—"}</TableCell>
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

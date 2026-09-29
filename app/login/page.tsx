"use client";
import {useState} from "react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Field} from "@/app/kho-ui";
export default function Login(){
 const [username,setUsername]=useState("quanlykho"),[password,setPassword]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 async function submit(event:React.FormEvent){event.preventDefault();setBusy(true);setError("");try{const response=await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username,password})}),result=await response.json() as {error?:string;role?:string};if(!response.ok)throw new Error(result.error||"Không thể đăng nhập.");setPassword("");window.location.assign(result.role==="viewer"?"/review":"/");}catch(e:any){setError(e.message);}finally{setBusy(false);}}
 return <main className="min-h-screen grid place-items-center p-5"><form className="panel w-full max-w-md space-y-5" onSubmit={submit}><div><h1 className="text-2xl font-bold">LAKA Kho</h1><p className="subtle mt-2">Đăng nhập để quản lý kho, chứng từ và công nợ.</p></div><Field label="Tên đăng nhập"><Input autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} required maxLength={64}/></Field><Field label="Mật khẩu"><Input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required maxLength={256}/></Field>{error&&<p role="alert" className="text-red-700">{error}</p>}<Button className="w-full" disabled={busy} type="submit">{busy?"Đang đăng nhập…":"Đăng nhập"}</Button><p className="subtle text-xs">Tài khoản do người quản trị server cấp.</p></form></main>;
}

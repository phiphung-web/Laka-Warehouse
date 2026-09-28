import fs from "node:fs";import path from "node:path";
type SourceData={sourceId:string;sourceTitle:string;importedAt:string;items:{code:string;name:string;unit:string;category:string;note:string}[];history:any[]};
export function readSource():SourceData{
 const file=process.env.LAKA_SEED_FILE||path.join(process.env.LAKA_DATA_DIR||path.resolve("data"),"source-data.json");
 if(!fs.existsSync(file))return {sourceId:"",sourceTitle:"Chưa nhập dữ liệu nguồn",importedAt:"",items:[],history:[]};
 const data=JSON.parse(fs.readFileSync(file,"utf8"));if(!Array.isArray(data.items)||!Array.isArray(data.history))throw new Error("SQLITE_INVALID_SEED");return data;
}

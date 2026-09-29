import fs from "node:fs";import path from "node:path";import {DatabaseSync,backup} from "node:sqlite";import {createGzip} from "node:zlib";import {pipeline} from "node:stream/promises";
const data=path.resolve(process.env.LAKA_DATA_DIR||"data"),target=path.resolve(process.env.LAKA_BACKUP_DIR||path.join(data,"backups"));
fs.mkdirSync(target,{recursive:true,mode:0o700});
const stamp=new Date().toISOString().replace(/[:.]/g,"-"),folder=path.join(target,"snapshot-"+stamp);fs.mkdirSync(folder,{mode:0o700});
const source=path.join(data,"warehouse.sqlite"),copy=path.join(folder,"warehouse.sqlite");
if(!fs.existsSync(source))throw Error("Database is missing; no backup created");
const db=new DatabaseSync(source,{readOnly:true});try{await backup(db,copy);}finally{db.close();}
const check=new DatabaseSync(copy,{readOnly:true});try{if(check.prepare("PRAGMA integrity_check").get().integrity_check!=="ok")throw Error("Backup integrity failed");}finally{check.close();}
await pipeline(fs.createReadStream(copy),createGzip(),fs.createWriteStream(copy+".gz",{mode:0o600}));fs.unlinkSync(copy);
for(const name of ["owner.json","viewers.json","source-data.json"]){const file=path.join(data,name);if(fs.existsSync(file)){fs.copyFileSync(file,path.join(folder,name));fs.chmodSync(path.join(folder,name),0o600);}}
fs.writeFileSync(path.join(folder,"manifest.json"),JSON.stringify({createdAt:new Date().toISOString(),release:process.env.LAKA_RELEASE||"unknown",database:"warehouse.sqlite.gz",integrity:"ok",containsPrivateData:true},null,2),{mode:0o600});
// Prune only completed task-owned snapshot directories after a new verified copy exists.
const snapshots=fs.readdirSync(target).filter(n=>/^snapshot-\d{4}-\d\d-\d\dT[\d-]+Z$/.test(n)).sort().filter(n=>fs.existsSync(path.join(target,n,"manifest.json")));
for(const name of snapshots.slice(0,Math.max(0,snapshots.length-28))){const old=path.resolve(target,name);if(!old.startsWith(target+path.sep)||fs.lstatSync(old).isSymbolicLink())throw Error("Unsafe backup path");fs.rmSync(old,{recursive:true,force:true});}
console.log(JSON.stringify({ok:true,snapshot:folder,integrity:"ok",retained:Math.min(28,snapshots.length)}));

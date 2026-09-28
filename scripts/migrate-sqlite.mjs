import fs from "node:fs";import path from "node:path";import {fileURLToPath} from "node:url";import {createHash} from "node:crypto";import {DatabaseSync} from "node:sqlite";
export function migrate(filename,folder){
 fs.mkdirSync(path.dirname(filename),{recursive:true,mode:0o700});const db=new DatabaseSync(filename);
 try{db.exec("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;");
 db.exec("CREATE TABLE IF NOT EXISTS _laka_migrations(name TEXT PRIMARY KEY,sha256 TEXT NOT NULL,applied_at TEXT NOT NULL)");
 const files=fs.readdirSync(folder).filter(f=>/^\d+_.*\.sql$/.test(f)).sort(),applied=db.prepare("SELECT name,sha256 FROM _laka_migrations").all();
 for(const row of applied)if(!files.includes(row.name))throw Error("Database has unknown migration: "+row.name);
 let count=0;
 for(const name of files){const sql=fs.readFileSync(path.join(folder,name),"utf8"),hash=createHash("sha256").update(sql).digest("hex"),old=applied.find(r=>r.name===name);if(old){if(old.sha256!==hash)throw Error("Applied migration changed: "+name);continue;}
 db.exec("BEGIN IMMEDIATE");try{db.exec(sql);db.prepare("INSERT INTO _laka_migrations VALUES(?,?,?)").run(name,hash,new Date().toISOString());db.exec("COMMIT");count++;}catch(e){db.exec("ROLLBACK");throw e;}}
 return {applied:count,total:files.length};
 }finally{db.close();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const dir=path.resolve(process.env.LAKA_DATA_DIR||"data"),folder=path.resolve(process.env.LAKA_MIGRATIONS_DIR||"drizzle");console.log(JSON.stringify(migrate(path.join(dir,"warehouse.sqlite"),folder)));}

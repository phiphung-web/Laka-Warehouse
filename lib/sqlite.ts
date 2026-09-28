import fs from "node:fs";
import path from "node:path";
import {DatabaseSync,type SQLInputValue} from "node:sqlite";
class Statement {
 readonly owner:SQLiteStore;readonly sql:string;readonly values:SQLInputValue[];
 constructor(owner:SQLiteStore,sql:string,values:SQLInputValue[]=[]){this.owner=owner;this.sql=sql;this.values=values;}
 bind(...values:SQLInputValue[]){return new Statement(this.owner,this.sql,values);}
 async first<T=any>():Promise<T|null>{return (this.owner.connection.prepare(this.sql).get(...this.values) as T|undefined)??null;}
 async all<T=any>():Promise<{results:T[]}>{return {results:this.rows() as T[]};}
 async run(){return this.owner.connection.prepare(this.sql).run(...this.values);}
 rows():any[]{return this.owner.connection.prepare(this.sql).all(...this.values);}
}
export class SQLiteStore {
 readonly connection:DatabaseSync;
 constructor(filename:string){this.connection=new DatabaseSync(filename);this.connection.exec("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;");}
 prepare(sql:string){return new Statement(this,sql);}
 async batch(statements:Statement[]):Promise<{results:any[]}[]>{
  this.connection.exec("BEGIN IMMEDIATE");
  try{const result=statements.map(s=>{if(s.owner!==this)throw new Error("Mixed database batch");return {results:s.rows()};});this.connection.exec("COMMIT");return result;}
  catch(error){this.connection.exec("ROLLBACK");throw error;}
 }
 close(){this.connection.close();}
}
export function databasePath(){return path.join(process.env.LAKA_DATA_DIR||path.resolve("data"),"warehouse.sqlite");}
const globalDb=globalThis as typeof globalThis&{__lakaDatabase?:{filename:string;db:SQLiteStore}};
export function getDatabase(){const filename=databasePath();if(globalDb.__lakaDatabase?.filename===filename)return globalDb.__lakaDatabase.db;if(!fs.existsSync(filename))throw new Error("SQLITE_NOT_INITIALIZED");const db=new SQLiteStore(filename);globalDb.__lakaDatabase={filename,db};return db;}

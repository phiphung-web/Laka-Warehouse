import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { migrate } from "../scripts/migrate-sqlite.mjs";
import { runImporter } from "../scripts/import-source-opening.mjs";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "laka-importer-test-"));
const dbFile = path.join(dir, "warehouse.sqlite");
const sourceFile = path.join(dir, "source-data.json");

// Run migrations on test sqlite
migrate(dbFile, path.resolve("drizzle"));

// Seed initial settings & locations
const db = new DatabaseSync(dbFile);
db.exec("PRAGMA foreign_keys=ON;");
db.prepare("INSERT INTO settings (id,owner,revision,seeded,created_at) VALUES (1,'qa_user',0,1,'2026-01-01')").run();
for (const [id, name] of [
 ["KHO_TONG", "Kho tổng"],
 ["BUONG_PHONG", "Buồng phòng"],
 ["HOMESTAY", "Homestay / Lễ tân"],
 ["BEP", "Bếp"],
 ["NHA_HANG", "Nhà hàng bên ngoài"],
 ["CAFE", "Cafe"],
 ["DUNG_CHUNG", "Dùng chung"]
]) {
 db.prepare("INSERT OR IGNORE INTO locations(id,name,active) VALUES (?,?,1)").run(id, name);
}

// Pre-existing item with live operational ledger to test conflict protection
db.prepare("INSERT INTO items (code,name,unit,category,kind,note,active,pack_unit,pack_size,usage_location,updated_at) VALUES ('LIVE_01','Trà ô long','Gói','Đồ uống','consumable','',1,'',1000,'CAFE','2026-01-01')").run();
db.prepare("INSERT INTO events (id,kind,detail,actor,created_at,expected_revision) VALUES ('tx-live','COUNT','KK','live',datetime('now'),0)").run();
db.prepare("INSERT INTO transactions (id,number,type,date,lines,request,total,created_at,actor) VALUES ('tx-live','KK-LIVE','COUNT','2026-01-01','[]','{}',0,datetime('now'),'live')").run();
db.prepare("INSERT INTO ledger (tx,item,location,condition,lot,expiry,quantity,verified_at) VALUES ('tx-live','LIVE_01','CAFE','usable','','',50000,datetime('now'))").run();
db.close();

let passed = 0;

// Synthetic source data covering:
// 1. NhapKho_Homestay: [seq,date,code,name,unit,quantity,price,total,supplier,person]
// 2. NhapKho_Nhahang: [seq,date,code,category,name,unit,quantity,price,total,supplier,person] (blank codes)
// 3. Nhập đồ-Hàng ngày: [date,person,area,category,name,unit,qty,price,...] (merged carry-over)
// 4. XuatKho_PhanBo: excluded
const syntheticSource = {
 sourceId: "synthetic-sheet-01",
 sourceTitle: "Test Opening Import",
 importedAt: "2026-09-28",
 items: [],
 history: [
  // Homestay sheet
  { source: "NhapKho_Homestay", row: 2, values: [1, "2026-01-01", "HS_001", "Dầu gội mini", "Chai", 100, 5000, 500000, "NCC A", "Lan"] },
  { source: "NhapKho_Homestay", row: 3, values: [2, "2026-01-01", "HS_001", "Dầu gội mini", "Chai", 50, 5000, 250000, "NCC A", "Lan"] }, // repeated item row to test aggregation
  // Nhahang sheet (has blank codes)
  { source: "NhapKho_Nhahang", row: 2, values: [1, "2026-01-02", "", "Gia vị", "Muối tinh", "Kg", 20, 8000, 160000, "NCC B", "Hùng"] },
  { source: "NhapKho_Nhahang", row: 3, values: [2, "2026-01-02", "", "Gia vị", "Đường cát", "Kg", 30, 20000, 600000, "NCC B", "Hùng"] },
  // Nhập đồ-Hàng ngày (merged date, area, category carry-over)
  { source: "Nhập đồ-Hàng ngày", row: 2, values: ["2026-01-03", "Tuấn", "Buồng phòng", "Vệ sinh", "Nước lau kính", "Chai", 5, 25000] },
  { source: "Nhập đồ-Hàng ngày", row: 3, values: ["", "", "", "", "Nước lau sàn", "Can", 2, 80000] }, // carried date, area, category
  // Excluded tab
  { source: "XuatKho_PhanBo", row: 2, values: [1, "2026-01-04", "HS_001", "Dầu gội mini", "Chai", 10] }
 ]
};
fs.writeFileSync(sourceFile, JSON.stringify(syntheticSource, null, 2));

// 1. Dry run default (does not require --location-mode, does not write changes)
const dry1 = runImporter({ sourceFile, dbFile });
assert.equal(dry1.dryRun, true);
assert.equal(dry1.counts.valid, 6);
assert.equal(dry1.counts.conflicts, 0);
assert.equal(dry1.counts.unresolved, 0);
assert.equal(dry1.counts.created, 5);
assert.equal(dry1.counts.skipped, 0);
// Verify XuatKho_PhanBo was excluded: only 6 valid rows out of 7 total history rows
passed++;

// 2. Apply requires --location-mode
assert.throws(() => runImporter({ apply: true, sourceFile, dbFile }), /--location-mode by-sheet\|central is required/);
passed++;

// 3. Apply by-sheet
const applied = runImporter({ apply: true, locationMode: "by-sheet", sourceFile, dbFile });
assert.equal(applied.applied, true);
assert.equal(applied.counts.valid, 6);

// Verify database state after apply
const dbCheck = new DatabaseSync(dbFile, { readOnly: true });
const items = dbCheck.prepare("SELECT * FROM items").all();
assert.ok(items.some(i => i.code === "HS_001" && i.usage_location === "HOMESTAY"));
const saltItem = items.find(i => i.name === "Muối tinh");
assert.ok(saltItem);
assert.ok(saltItem.code.startsWith("NH-CL-"), "Uncoded restaurant item gets NH-CL- prefix: " + saltItem.code);

const glassCleaner = items.find(i => i.name === "Nước lau sàn");
assert.ok(glassCleaner);
assert.ok(glassCleaner.code.startsWith("BP-CL-"), "Carried Buồng phòng area gets BP-CL- prefix: " + glassCleaner.code);

// Check ledger aggregation: HS_001 at HOMESTAY should aggregate 100 + 50 = 150 (scaled to 150000)
const hs001Ledger = dbCheck.prepare("SELECT * FROM ledger WHERE item='HS_001' AND location='HOMESTAY'").all();
assert.equal(hs001Ledger.length, 1, "Repeated item rows must aggregate into a single ledger line per location");
assert.equal(hs001Ledger[0].quantity, 150000);

// Check import_provenance has 6 rows
const provs = dbCheck.prepare("SELECT * FROM import_provenance").all();
assert.equal(provs.length, 6);
dbCheck.close();
passed++;

// 4. Exact repeat skips without duplication
const dry2 = runImporter({ sourceFile, dbFile });
assert.equal(dry2.counts.skipped, 6);
assert.equal(dry2.counts.valid, 0);
assert.equal(dry2.counts.conflicts, 0);
passed++;

// 5. Changed prior row fingerprint triggers conflict reject
const modifiedSource = JSON.parse(JSON.stringify(syntheticSource));
modifiedSource.history[0].values[5] = 999; // change quantity from 100 to 999
fs.writeFileSync(sourceFile, JSON.stringify(modifiedSource, null, 2));
const dryConflict = runImporter({ sourceFile, dbFile });
assert.equal(dryConflict.counts.conflicts, 1);
assert.match(dryConflict.conflictRows[0].reason, /fingerprint changed/);
passed++;

// 6. Pre-existing live operational ledger balance conflict protection
const conflictLiveSource = {
 sourceId: "synthetic-sheet-02",
 sourceTitle: "Live Conflict Test",
 importedAt: "2026-09-28",
 items: [],
 history: [
  // Row targeting LIVE_01 at CAFE where live operational ledger exists!
  { source: "NhapKho_Cafe", row: 2, values: [1, "2026-01-01", "LIVE_01", "Trà ô long", "Gói", 10, 10000] }
 ]
};
fs.writeFileSync(sourceFile, JSON.stringify(conflictLiveSource, null, 2));
const dryLiveConflict = runImporter({ sourceFile, dbFile });
assert.equal(dryLiveConflict.counts.conflicts, 1);
assert.match(dryLiveConflict.conflictRows[0].reason, /live operational ledger/);
assert.throws(() => runImporter({ apply: true, locationMode: "by-sheet", sourceFile, dbFile }), /conflict rows/);
passed++;

// 7. Unit conflict on existing code
const unitConflictSource = {
 sourceId: "synthetic-sheet-03",
 sourceTitle: "Unit Conflict Test",
 importedAt: "2026-09-28",
 items: [],
 history: [
  // HS_001 was created with unit 'Chai', incoming unit is 'Thùng'
  { source: "NhapKho_Homestay", row: 10, values: [1, "2026-01-01", "HS_001", "Dầu gội mini", "Thùng", 5] }
 ]
};
fs.writeFileSync(sourceFile, JSON.stringify(unitConflictSource, null, 2));
const dryUnitConflict = runImporter({ sourceFile, dbFile });
assert.equal(dryUnitConflict.counts.unresolved, 1);
assert.match(dryUnitConflict.unresolvedRows[0].reason, /Coded row conflict/);
passed++;

// Cleanup
try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}

console.log(JSON.stringify({ importerChecksPassed: passed }));

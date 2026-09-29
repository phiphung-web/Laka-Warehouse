import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { normalize, sanitizeAreaPrefix, KIND_PREFIX_MAP, scaled, today, validDate } from "../lib/inventory.ts";
import { allocateNextItemCode, TAB_LOCATION_MAP, resolveDailyArea, canonicalJson } from "../lib/auto-code.ts";

export function runImporter(options = {}) {
 const apply = !!options.apply;
 const locationMode = options.locationMode;
 if (apply && (!locationMode || !["by-sheet", "central"].includes(locationMode))) {
  throw new Error("--location-mode by-sheet|central is required when --apply is specified.");
 }
 const effectiveLocationMode = locationMode || "by-sheet";
 if (!["by-sheet", "central"].includes(effectiveLocationMode)) throw Error("Invalid location mode");
 const baselineDate = options.date || today();
 if (!validDate(baselineDate) || baselineDate > today()) throw new Error("Invalid baseline date: " + baselineDate);

 const sourceFile = path.resolve(options.sourceFile || path.join(options.dataDir || process.env.LAKA_DATA_DIR || "data", "source-data.json"));
 if (!fs.existsSync(sourceFile)) throw new Error("Source data file not found: " + sourceFile);
 const sourceData = JSON.parse(fs.readFileSync(sourceFile, "utf8"));
 const { sourceId = "unknown", sourceTitle = "", items: seedItems = [], history = [] } = sourceData;
 if (typeof sourceId !== "string" || !sourceId.trim() || sourceId === "unknown" || !Array.isArray(history)) throw Error("Invalid source identity/history");

 const dbFile = path.resolve(options.dbFile || path.join(options.dataDir || process.env.LAKA_DATA_DIR || "data", "warehouse.sqlite"));
 if (!fs.existsSync(dbFile)) throw new Error("Database file not found: " + dbFile);

 const db = new DatabaseSync(dbFile, {readOnly: !apply});
 let transaction = false;
 try {
  db.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
  db.exec(apply ? "BEGIN IMMEDIATE" : "BEGIN"); transaction = true;
  const locations = new Map(db.prepare("SELECT id,active FROM locations").all().map(l => [l.id,l]));

  const settingsRow = db.prepare("SELECT revision FROM settings WHERE id=1").get();
  if (!settingsRow && apply) throw new Error("Database settings row missing; initialize database before applying.");
  const currentRevision = settingsRow ? Number(settingsRow.revision) : 0;

  const existingItems = db.prepare("SELECT code, name, unit, category, kind, usage_location, active FROM items").all();
  const itemsByCode = new Map(existingItems.map(i => [i.code, { ...i }]));
  const canonicalUnits = new Map();
  for (const i of existingItems) if (!canonicalUnits.has(i.unit.trim().toLowerCase())) canonicalUnits.set(i.unit.trim().toLowerCase(),i.unit.trim());
  const itemsByNameAndUnit = new Map();
  for (const itm of existingItems) {
   const key = `${normalize(itm.name)}:::${itm.unit.trim().toLowerCase()}`;
   if (!itemsByNameAndUnit.has(key)) itemsByNameAndUnit.set(key, []);
   itemsByNameAndUnit.get(key).push({ ...itm });
  }
  const allCodes = new Set(existingItems.map(i => i.code));

  const existingLedger = db.prepare("SELECT item, location FROM ledger").all();
  const ledgerItemLocations = new Set(existingLedger.map(l => `${l.item}:::${l.location}`));

  const hasProvTable = !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='import_provenance'").get();
  const existingProv = hasProvTable ? db.prepare("SELECT source_id, source_tab, row_number, row_fingerprint, item_code, location FROM import_provenance").all() : [];
  const provMap = new Map(existingProv.map(p => [`${p.source_id}:::${p.source_tab}:::${p.row_number}`, p]));

  let carriedDate = "", carriedArea = "", carriedCategory = "";
  const validRows = [];
  const unresolvedRows = [];
  const conflictRows = [];
  const skippedRows = [];
  const newItemsToCreate = new Map();
  const newlyAllocatedCodesByNameUnit = new Map();
  const usageAreas = new Map(), seenRows = new Set(), excludedRows = {};
  const rememberArea = (code, area) => { if (!usageAreas.has(code)) usageAreas.set(code, new Set()); usageAreas.get(code).add(area); };

  for (const entry of history) {
   const { source, row, values } = entry;
   if (source === "XuatKho_PhanBo" || (options.purchaseTabsOnly && source === "Nhập đồ-Hàng ngày")) { excludedRows[source] = (excludedRows[source] || 0) + 1; continue; }
   const identity = `${sourceId}:::${source}:::${row}`;
   if (!Number.isSafeInteger(row) || row < 1 || !Array.isArray(values)) { unresolvedRows.push({source,row,reason:"Invalid source row"}); continue; }
   if (seenRows.has(identity)) { conflictRows.push({source,row,reason:"Duplicate source row identity"}); continue; }
   seenRows.add(identity);

   let rawCode = "", rawName = "", rawUnit = "", rawQty = undefined, category = "Chung", targetLocation = "", usageArea = "";

   if (source === "Nhập đồ-Hàng ngày") {
    if (values[0]) carriedDate = String(values[0]).trim();
    if (values[2]) carriedArea = String(values[2]).trim();
    if (values[3]) carriedCategory = String(values[3]).trim();

    rawName = values[4];
    rawUnit = values[5];
    rawQty = values[6];
    category = carriedCategory || "Chung";

    const mappedArea = resolveDailyArea(carriedArea);
    if (!mappedArea) {
     unresolvedRows.push({ source, row, reason: "Unresolved daily area: '" + carriedArea + "'" });
     continue;
    }
    targetLocation = effectiveLocationMode === "central" ? "KHO_TONG" : mappedArea;
    usageArea = mappedArea;
   } else if (Object.hasOwn(TAB_LOCATION_MAP, source)) {
    targetLocation = effectiveLocationMode === "central" ? "KHO_TONG" : TAB_LOCATION_MAP[source];
    usageArea = TAB_LOCATION_MAP[source];
    if (source === "NhapKho_Nhahang") {
     rawCode = values[2];
     category = values[3] || "Chung";
     rawName = values[4];
     rawUnit = values[5];
     rawQty = values[6];
    } else {
     rawCode = values[2];
     category = "Chung";
     rawName = values[3];
     rawUnit = values[4];
     rawQty = values[5];
    }
   } else {
    unresolvedRows.push({ source, row, reason: "Unrecognized source tab: " + source });
    continue;
   }

   const name = typeof rawName === "string" ? rawName.trim() : "";
   const enteredUnit = typeof rawUnit === "string" ? rawUnit.trim() : "";
   const unit = canonicalUnits.get(enteredUnit.toLowerCase()) || enteredUnit;
   if (!name || !unit || name.length > 300 || unit.length > 40 || !locations.get(targetLocation)?.active || !locations.get(usageArea)?.active) {
    unresolvedRows.push({ source, row, reason: "Missing item name or unit" });
    continue;
   }

   const rawNum = typeof rawQty === "number" ? rawQty : (typeof rawQty === "string" && /^\d+(?:\.\d+)?$/.test(rawQty.trim()) ? Number(rawQty) : NaN);
   if (isNaN(rawNum) || !Number.isFinite(rawNum) || rawNum <= 0) {
    unresolvedRows.push({ source, row, reason: "Invalid quantity: " + rawQty });
    continue;
   }

   let scaledQty = 0;
   try {
    scaledQty = scaled(rawNum, false);
   } catch {
    unresolvedRows.push({ source, row, reason: "Quantity precision/scale invalid: " + rawQty });
    continue;
   }

   const fingerprint = createHash("sha256").update(canonicalJson({values,usageArea,targetLocation,category,carriedDate:source === "Nhập đồ-Hàng ngày" ? carriedDate : ""})).digest("hex");
   const provKey = `${sourceId}:::${source}:::${row}`;
   const prevProv = provMap.get(provKey);
   if (prevProv) {
    if (prevProv.row_fingerprint === fingerprint && prevProv.location === targetLocation) {
     skippedRows.push({ source, row, itemCode: prevProv.item_code, location: prevProv.location });
     rememberArea(prevProv.item_code, usageArea);
     continue;
    } else {
     conflictRows.push({ source, row, reason: "Row fingerprint changed compared to previous import provenance" });
     continue;
    }
   }

   let itemCode = null;
   const code = typeof rawCode === "string" ? rawCode.trim() : "";
   if (code && !/^[\p{L}\p{N}_-]{1,40}$/u.test(code)) { unresolvedRows.push({source,row,reason:"Invalid item code"}); continue; }
   if (code) {
    const existing = itemsByCode.get(code) || newItemsToCreate.get(code);
    if (existing) {
     if (existing.unit.trim().toLowerCase() !== unit.toLowerCase() || existing.name.trim() !== name) {
      unresolvedRows.push({ source, row, code, reason: `Coded row conflict on ${code}: existing ('${existing.name}', '${existing.unit}') vs incoming ('${name}', '${unit}')` });
      continue;
     }
     itemCode = existing.code;
    } else {
     itemCode = code;
     const newItem = {
      code,
      name,
      unit,
      category,
      kind: "unclassified",
      note: "",
      active: 1,
      pack_unit: "",
      pack_size: 1000,
      usage_location: usageArea,
      updated_at: new Date().toISOString()
     };
     newItemsToCreate.set(code, newItem);
     allCodes.add(code);
     const nuKey = `${normalize(name)}:::${unit.toLowerCase()}`;
     if (!itemsByNameAndUnit.has(nuKey)) itemsByNameAndUnit.set(nuKey, []);
     itemsByNameAndUnit.get(nuKey).push(newItem);
    }
   } else {
    const nuKey = `${normalize(name)}:::${unit.toLowerCase()}`;
    const matches = (itemsByNameAndUnit.get(nuKey) || []).filter(i => i.unit.trim().toLowerCase() === unit.toLowerCase() && normalize(i.name) === normalize(name));
    if (matches.length > 1) {
     unresolvedRows.push({ source, row, reason: `Ambiguity: ${matches.length} items match normalized name '${name}' and unit '${unit}'` });
     continue;
    } else if (matches.length === 1) {
     itemCode = matches[0].code;
    } else {
     if (newlyAllocatedCodesByNameUnit.has(nuKey)) {
      itemCode = newlyAllocatedCodesByNameUnit.get(nuKey);
     } else {
      const areaPrefix = sanitizeAreaPrefix(usageArea);
      const kindPrefix = "CL";
      const prefix = `${areaPrefix}-${kindPrefix}-`;
      itemCode = allocateNextItemCode(allCodes, prefix);
      allCodes.add(itemCode);
      newlyAllocatedCodesByNameUnit.set(nuKey, itemCode);
      const newItem = {
       code: itemCode,
       name,
       unit,
       category,
       kind: "unclassified",
       note: "",
       active: 1,
       pack_unit: "",
       pack_size: 1000,
       usage_location: usageArea,
       updated_at: new Date().toISOString()
      };
      newItemsToCreate.set(itemCode, newItem);
      if (!itemsByNameAndUnit.has(nuKey)) itemsByNameAndUnit.set(nuKey, []);
      itemsByNameAndUnit.get(nuKey).push(newItem);
     }
    }
   }

   const locKey = `${itemCode}:::${targetLocation}`;
   if (itemsByCode.get(itemCode)?.active === 0) { unresolvedRows.push({source,row,reason:"Item is inactive: "+itemCode}); continue; }
   if (ledgerItemLocations.has(locKey)) {
    conflictRows.push({ source, row, itemCode, location: targetLocation, reason: `Conflict: live operational ledger balance exists for ${itemCode} at ${targetLocation}` });
    continue;
   }

   rememberArea(itemCode, usageArea);
   validRows.push({
    source,
    row,
    fingerprint,
    itemCode,
    name,
    unit,
    enteredUnit,
    location: targetLocation,
    scaledQty
   });
  }

  for (const p of existingProv) if (p.source_id === sourceId && !(options.purchaseTabsOnly && p.source_tab === "Nhập đồ-Hàng ngày") && !seenRows.has(`${sourceId}:::${p.source_tab}:::${p.row_number}`)) conflictRows.push({source:p.source_tab,row:p.row_number,reason:"Previously imported row is missing"});
  const quantities = Object.create(null);
  const locationGroups = new Map();
  for (const r of validRows) {
   if (!quantities[r.unit]) quantities[r.unit] = Object.create(null);
   quantities[r.unit][r.location] = (quantities[r.unit][r.location] || 0) + r.scaledQty / 1000;

   if (!locationGroups.has(r.location)) locationGroups.set(r.location, new Map());
   const itmMap = locationGroups.get(r.location);
   const combined = (itmMap.get(r.itemCode) || 0) + r.scaledQty;
   if (!Number.isSafeInteger(combined)) throw Error("Quantity total exceeds safe precision");
   itmMap.set(r.itemCode, combined);
  }

  const result = {
   dryRun: !apply,
   locationMode: effectiveLocationMode,
   baselineDate,
   counts: {
    valid: validRows.length,
    unresolved: unresolvedRows.length,
    created: newItemsToCreate.size,
    conflicts: conflictRows.length,
    skipped: skippedRows.length
   },
   quantities,
   excludedRows,
   unresolvedRows,
   conflictRows
  };

  if (!apply) {
   return result;
  }

  if (unresolvedRows.length > 0 || conflictRows.length > 0) {
   throw new Error(`Cannot apply import: ${unresolvedRows.length} unresolved rows, ${conflictRows.length} conflict rows.`);
  }

  const actor = options.actor || "Hệ thống";
  const now = new Date().toISOString();
  try {
   for (const itm of newItemsToCreate.values()) {
    db.prepare("INSERT INTO items (code,name,unit,category,kind,note,active,pack_unit,pack_size,usage_location,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)").run(
     itm.code, itm.name, itm.unit, itm.category, itm.kind, itm.note, itm.active, itm.pack_unit, itm.pack_size, usageAreas.get(itm.code)?.size === 1 ? [...usageAreas.get(itm.code)][0] : null, now
    );
   }

   for (const [code, areas] of usageAreas) if (validRows.length && areas.size === 1 && !newItemsToCreate.has(code) && !itemsByCode.get(code)?.usage_location) db.prepare("UPDATE items SET usage_location=?,updated_at=? WHERE code=? AND usage_location IS NULL").run([...areas][0],now,code);
   let rev = currentRevision;
   for (const [locId, itmMap] of locationGroups.entries()) {
    if (itmMap.size === 0) continue;
    const txId = "tx-init-" + randomUUID();
    const countNumber = "KK-" + baselineDate.replaceAll("-", "") + "-" + txId.slice(8, 16).toUpperCase();
    const lines = [];
    const postings = [];

    for (const [code, qtyScaled] of itmMap.entries()) {
     const itm = itemsByCode.get(code) || newItemsToCreate.get(code);
     const baseQty = qtyScaled / 1000;
     lines.push({
      item: code,
      quantity: baseQty,
      unitMode: "base",
      price: 0,
      lot: "",
      expiry: "",
      condition: "usable",
      itemName: itm.name,
      baseUnit: itm.unit,
      enteredUnit: itm.unit,
      baseQuantity: baseQty,
      priceMissing: true,
      amount: 0,
      before: 0,
      difference: baseQty
     });
     postings.push({ item: code, quantity: qtyScaled });
    }

    db.prepare("INSERT INTO events (id,kind,detail,actor,created_at,expected_revision) VALUES (?,?,?,?,?,?)").run(
     txId, "COUNT", countNumber + " · Mốc ban đầu theo lượng nhập file", actor, now, rev
    );
    rev++;

    const txRequest = JSON.stringify({ id: txId, type: "COUNT", date: baselineDate, to: locId, lines });
    db.prepare("INSERT INTO transactions (id,number,type,date,from_location,to_location,partner,person,note,reference,lines,request,total,created_at,actor,reversal_of) VALUES (?,?,?,?,NULL,?,?,?,?,?,?,?,?,?,?,NULL)").run(
     txId, countNumber, "COUNT", baselineDate, locId, "", actor, "Mốc ban đầu theo lượng nhập file", sourceTitle || sourceId, JSON.stringify(lines), txRequest, 0, now, actor
    );

    for (const p of postings) {
     db.prepare("INSERT INTO ledger (tx,item,location,condition,lot,expiry,quantity,verified_at) VALUES (?,?,?,'usable','','',?,?)").run(
      txId, p.item, locId, p.quantity, now
     );
    }

    const locRows = validRows.filter(r => r.location === locId);
    for (const r of locRows) {
     const provId = "imp-" + randomUUID();
     db.prepare("INSERT INTO import_provenance (id,source_id,source_tab,row_number,row_fingerprint,item_code,location,quantity,entered_unit,tx_id,applied_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)").run(
      provId, sourceId, r.source, r.row, r.fingerprint, r.itemCode, r.location, r.scaledQty, r.enteredUnit, txId, now
     );
    }
   }

   db.exec("COMMIT"); transaction = false;
  } catch (err) {
   db.exec("ROLLBACK"); transaction = false;
   throw err;
  }

  return { ...result, applied: true };
 } finally {
  if (transaction) db.exec("ROLLBACK");
  db.close();
 }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
 const args = process.argv.slice(2);
 const apply = args.includes("--apply");
 const locModeIdx = args.indexOf("--location-mode");
 const locationMode = locModeIdx !== -1 ? args[locModeIdx + 1] : undefined;
 const dateIdx = args.indexOf("--date");
 const date = dateIdx !== -1 ? args[dateIdx + 1] : undefined;
 const dirIdx = args.indexOf("--dir");
 const dataDir = dirIdx !== -1 ? args[dirIdx + 1] : undefined;
 const sourceIdx = args.indexOf("--source");
 const sourceFile = sourceIdx !== -1 ? args[sourceIdx + 1] : undefined;
 const dbIdx = args.indexOf("--db");
 const dbFile = dbIdx !== -1 ? args[dbIdx + 1] : undefined;

 try {
  const summary = runImporter({ apply, locationMode, date, dataDir, sourceFile, dbFile, purchaseTabsOnly: args.includes("--purchase-tabs-only") });
  console.log(JSON.stringify(summary, null, 2));
 } catch (err) {
  console.error("Importer error:", err.message);
  process.exit(1);
 }
}

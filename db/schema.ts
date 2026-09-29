import { sqliteTable, text, integer, primaryKey, index, uniqueIndex, check } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
export const settings = sqliteTable("settings", {
 id:integer("id").primaryKey(),owner:text("owner").notNull(),revision:integer("revision").notNull().default(0),seeded:integer("seeded").notNull().default(0),createdAt:text("created_at").notNull(),
});
export const items = sqliteTable("items", {
 code:text("code").primaryKey(),name:text("name").notNull(),unit:text("unit").notNull(),category:text("category").notNull(),
 kind:text("kind").notNull().default("unclassified"),note:text("note").notNull().default(""),active:integer("active").notNull().default(1),
 packUnit:text("pack_unit").notNull().default(""),packSize:integer("pack_size").notNull().default(1000),
 usageLocation:text("usage_location").references(()=>locations.id),
 updatedAt:text("updated_at").notNull(),
}, t=>[index("items_usage_location").on(t.usageLocation)]);
export const locations = sqliteTable("locations", {
 id:text("id").primaryKey(),name:text("name").notNull(),active:integer("active").notNull().default(1),
}, t=>[uniqueIndex("locations_name").on(t.name)]);
export const events = sqliteTable("events", {
 id:text("id").primaryKey(),kind:text("kind").notNull(),detail:text("detail").notNull(),actor:text("actor").notNull(),
 createdAt:text("created_at").notNull(),expectedRevision:integer("expected_revision").notNull(),
});
export const transactions = sqliteTable("transactions", {
 id:text("id").primaryKey().references(()=>events.id),number:text("number").notNull(),type:text("type").notNull(),
 date:text("date").notNull(),from:text("from_location"),to:text("to_location"),partner:text("partner").notNull().default(""),
 person:text("person").notNull().default(""),note:text("note").notNull().default(""),reference:text("reference").notNull().default(""),
 lines:text("lines").notNull(),request:text("request").notNull(),total:integer("total").notNull().default(0),
 createdAt:text("created_at").notNull(),actor:text("actor").notNull(),reversalOf:text("reversal_of"),
},t=>[uniqueIndex("tx_number").on(t.number),uniqueIndex("tx_reversal").on(t.reversalOf),index("tx_date").on(t.date)]);
export const balances = sqliteTable("balances", {
 item:text("item").notNull().references(()=>items.code),location:text("location").notNull().references(()=>locations.id),
 condition:text("condition").notNull(),lot:text("lot").notNull().default(""),expiry:text("expiry").notNull().default(""),
 quantity:integer("quantity").notNull().default(0),verifiedAt:text("verified_at"),
},t=>[primaryKey({columns:[t.item,t.location,t.condition,t.lot,t.expiry]}),check("quantity_nonnegative",sql`${t.quantity}>=0`),index("balance_location").on(t.location)]);
export const ledger = sqliteTable("ledger", {
 id:integer("id").primaryKey({autoIncrement:true}),tx:text("tx").notNull().references(()=>transactions.id),
 item:text("item").notNull().references(()=>items.code),location:text("location").notNull().references(()=>locations.id),
 condition:text("condition").notNull(),lot:text("lot").notNull().default(""),expiry:text("expiry").notNull().default(""),
 quantity:integer("quantity").notNull(),verifiedAt:text("verified_at"),
},t=>[index("ledger_tx").on(t.tx),index("ledger_item_location").on(t.item,t.location)]);
export const minimums = sqliteTable("minimums", {
 item:text("item").notNull().references(()=>items.code),location:text("location").notNull().references(()=>locations.id),quantity:integer("quantity").notNull(),
},t=>[primaryKey({columns:[t.item,t.location]}),check("minimum_nonnegative",sql`${t.quantity}>=0`)]);
export const drafts = sqliteTable("drafts", {id:text("id").primaryKey(),payload:text("payload").notNull(),updatedAt:text("updated_at").notNull()});
export const suppliers=sqliteTable("suppliers",{
 id:text("id").primaryKey(),code:text("code").notNull(),name:text("name").notNull(),contact:text("contact").notNull(),phone:text("phone").notNull(),email:text("email").notNull(),address:text("address").notNull(),taxId:text("tax_id").notNull(),bankName:text("bank_name").notNull(),bankAccount:text("bank_account").notNull(),bankHolder:text("bank_holder").notNull(),categories:text("categories").notNull(),termsDays:integer("terms_days").notNull(),note:text("note").notNull(),active:integer("active").notNull(),updatedAt:text("updated_at").notNull(),
},t=>[uniqueIndex("supplier_code").on(t.code)]);
export const purchaseInvoices=sqliteTable("purchase_invoices",{
 id:text("id").primaryKey().references(()=>events.id),number:text("number").notNull(),supplierId:text("supplier_id").notNull().references(()=>suppliers.id),supplierSnapshot:text("supplier_snapshot").notNull(),date:text("date").notNull(),dueDate:text("due_date").notNull(),reference:text("reference").notNull(),buyerName:text("buyer_name").notNull(),buyerAddress:text("buyer_address").notNull(),lines:text("lines").notNull(),subtotal:integer("subtotal").notNull(),discount:integer("discount").notNull(),shipping:integer("shipping").notNull(),total:integer("total").notNull(),note:text("note").notNull(),createdAt:text("created_at").notNull(),actor:text("actor").notNull(),
},t=>[uniqueIndex("purchase_number").on(t.number),index("purchase_supplier_date").on(t.supplierId,t.date),check("purchase_total_valid",sql`${t.total}>=0 AND ${t.total}=${t.subtotal}-${t.discount}+${t.shipping} AND ${t.discount}>=0 AND ${t.discount}<=${t.subtotal} AND ${t.shipping}>=0`)]);
export const supplierPayments=sqliteTable("supplier_payments",{
 id:text("id").primaryKey().references(()=>events.id),invoiceId:text("invoice_id").notNull().references(()=>purchaseInvoices.id),date:text("date").notNull(),amount:integer("amount").notNull(),method:text("method").notNull(),reference:text("reference").notNull(),note:text("note").notNull(),reversalOf:text("reversal_of"),createdAt:text("created_at").notNull(),actor:text("actor").notNull(),
},t=>[index("payment_invoice_date").on(t.invoiceId,t.date),uniqueIndex("payment_reversal").on(t.reversalOf),check("payment_sign",sql`(${t.reversalOf} IS NULL AND ${t.amount}>0) OR (${t.reversalOf} IS NOT NULL AND ${t.amount}<0)`)]);
export const invoiceVoids=sqliteTable("invoice_voids",{
 id:text("id").primaryKey().references(()=>events.id),invoiceId:text("invoice_id").notNull().references(()=>purchaseInvoices.id),date:text("date").notNull(),reason:text("reason").notNull(),actor:text("actor").notNull(),createdAt:text("created_at").notNull(),
},t=>[uniqueIndex("invoice_void_once").on(t.invoiceId)]);
export const invoiceReceipts=sqliteTable("invoice_receipts",{
 invoiceId:text("invoice_id").notNull().references(()=>purchaseInvoices.id),txId:text("tx_id").notNull().references(()=>transactions.id),eventId:text("event_id").notNull().references(()=>events.id),
},t=>[primaryKey({columns:[t.invoiceId,t.txId]}),index("receipt_invoice_link").on(t.txId)]);
export const commerceRequests=sqliteTable("commerce_requests",{id:text("id").primaryKey().references(()=>events.id),request:text("request").notNull(),result:text("result").notNull()});
export const catalogRequests=sqliteTable("catalog_requests",{id:text("id").primaryKey().references(()=>events.id),request:text("request").notNull(),result:text("result").notNull()});
export const importProvenance=sqliteTable("import_provenance",{
 id:text("id").primaryKey(),
 sourceId:text("source_id").notNull(),
 sourceTab:text("source_tab").notNull(),
 rowNumber:integer("row_number").notNull(),
 rowFingerprint:text("row_fingerprint").notNull(),
 itemCode:text("item_code").notNull().references(()=>items.code),
 location:text("location").notNull().references(()=>locations.id),
 quantity:integer("quantity").notNull(),
 enteredUnit:text("entered_unit").notNull(),
 txId:text("tx_id").notNull().references(()=>transactions.id),
 appliedAt:text("applied_at").notNull(),
},t=>[uniqueIndex("import_source_tab_row").on(t.sourceId,t.sourceTab,t.rowNumber),index("import_provenance_tx").on(t.txId)]);


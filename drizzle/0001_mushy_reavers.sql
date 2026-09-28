CREATE TABLE `commerce_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`request` text NOT NULL,
	`result` text NOT NULL,
	FOREIGN KEY (`id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `invoice_receipts` (
	`invoice_id` text NOT NULL,
	`tx_id` text NOT NULL,
	`event_id` text NOT NULL,
	PRIMARY KEY(`invoice_id`, `tx_id`),
	FOREIGN KEY (`invoice_id`) REFERENCES `purchase_invoices`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tx_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `receipt_invoice_link` ON `invoice_receipts` (`tx_id`);--> statement-breakpoint
CREATE TABLE `invoice_voids` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`date` text NOT NULL,
	`reason` text NOT NULL,
	`actor` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invoice_id`) REFERENCES `purchase_invoices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoice_void_once` ON `invoice_voids` (`invoice_id`);--> statement-breakpoint
CREATE TABLE `purchase_invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`supplier_id` text NOT NULL,
	`supplier_snapshot` text NOT NULL,
	`date` text NOT NULL,
	`due_date` text NOT NULL,
	`reference` text NOT NULL,
	`buyer_name` text NOT NULL,
	`buyer_address` text NOT NULL,
	`lines` text NOT NULL,
	`subtotal` integer NOT NULL,
	`discount` integer NOT NULL,
	`shipping` integer NOT NULL,
	`total` integer NOT NULL,
	`note` text NOT NULL,
	`created_at` text NOT NULL,
	`actor` text NOT NULL,
	FOREIGN KEY (`id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "purchase_total_valid" CHECK("purchase_invoices"."total">=0 AND "purchase_invoices"."total"="purchase_invoices"."subtotal"-"purchase_invoices"."discount"+"purchase_invoices"."shipping" AND "purchase_invoices"."discount">=0 AND "purchase_invoices"."discount"<="purchase_invoices"."subtotal" AND "purchase_invoices"."shipping">=0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_number` ON `purchase_invoices` (`number`);--> statement-breakpoint
CREATE INDEX `purchase_supplier_date` ON `purchase_invoices` (`supplier_id`,`date`);--> statement-breakpoint
CREATE TABLE `supplier_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`date` text NOT NULL,
	`amount` integer NOT NULL,
	`method` text NOT NULL,
	`reference` text NOT NULL,
	`note` text NOT NULL,
	`reversal_of` text,
	`created_at` text NOT NULL,
	`actor` text NOT NULL,
	FOREIGN KEY (`id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invoice_id`) REFERENCES `purchase_invoices`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "payment_sign" CHECK(("supplier_payments"."reversal_of" IS NULL AND "supplier_payments"."amount">0) OR ("supplier_payments"."reversal_of" IS NOT NULL AND "supplier_payments"."amount"<0))
);
--> statement-breakpoint
CREATE INDEX `payment_invoice_date` ON `supplier_payments` (`invoice_id`,`date`);--> statement-breakpoint
CREATE UNIQUE INDEX `payment_reversal` ON `supplier_payments` (`reversal_of`);--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`contact` text NOT NULL,
	`phone` text NOT NULL,
	`email` text NOT NULL,
	`address` text NOT NULL,
	`tax_id` text NOT NULL,
	`bank_name` text NOT NULL,
	`bank_account` text NOT NULL,
	`bank_holder` text NOT NULL,
	`categories` text NOT NULL,
	`terms_days` integer NOT NULL,
	`note` text NOT NULL,
	`active` integer NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `supplier_code` ON `suppliers` (`code`);
--> statement-breakpoint
CREATE TRIGGER payment_business_guard BEFORE INSERT ON supplier_payments
BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM invoice_voids WHERE invoice_id=NEW.invoice_id) THEN RAISE(ABORT,'COMMERCE_VOID') END;
 SELECT CASE WHEN NEW.amount>0 AND NEW.amount+COALESCE((SELECT SUM(amount) FROM supplier_payments WHERE invoice_id=NEW.invoice_id),0)>(SELECT total FROM purchase_invoices WHERE id=NEW.invoice_id) THEN RAISE(ABORT,'COMMERCE_OVERPAY') END;
 SELECT CASE WHEN NEW.reversal_of IS NOT NULL AND NOT EXISTS(SELECT 1 FROM supplier_payments WHERE id=NEW.reversal_of AND invoice_id=NEW.invoice_id AND reversal_of IS NULL AND amount=-NEW.amount) THEN RAISE(ABORT,'COMMERCE_BAD_REVERSAL') END;
END;
--> statement-breakpoint
CREATE TRIGGER void_balance_guard BEFORE INSERT ON invoice_voids
WHEN COALESCE((SELECT SUM(amount) FROM supplier_payments WHERE invoice_id=NEW.invoice_id),0)<>0
BEGIN SELECT RAISE(ABORT,'COMMERCE_PAID_INVOICE'); END;
--> statement-breakpoint
CREATE TRIGGER invoice_reference_guard BEFORE INSERT ON purchase_invoices
WHEN NEW.reference<>'' AND EXISTS(SELECT 1 FROM purchase_invoices i WHERE i.supplier_id=NEW.supplier_id AND i.reference=NEW.reference AND NOT EXISTS(SELECT 1 FROM invoice_voids v WHERE v.invoice_id=i.id))
BEGIN SELECT RAISE(ABORT,'COMMERCE_DUPLICATE_REFERENCE'); END;
--> statement-breakpoint
CREATE TRIGGER receipt_link_guard BEFORE INSERT ON invoice_receipts
WHEN EXISTS(SELECT 1 FROM invoice_receipts r WHERE r.tx_id=NEW.tx_id AND NOT EXISTS(SELECT 1 FROM invoice_voids v WHERE v.invoice_id=r.invoice_id))
BEGIN SELECT RAISE(ABORT,'COMMERCE_DUPLICATE_RECEIPT'); END;
--> statement-breakpoint
CREATE TRIGGER purchase_no_update BEFORE UPDATE ON purchase_invoices BEGIN SELECT RAISE(ABORT,'IMMUTABLE_PURCHASE'); END;
--> statement-breakpoint
CREATE TRIGGER purchase_no_delete BEFORE DELETE ON purchase_invoices BEGIN SELECT RAISE(ABORT,'IMMUTABLE_PURCHASE'); END;
--> statement-breakpoint
CREATE TRIGGER payment_no_update BEFORE UPDATE ON supplier_payments BEGIN SELECT RAISE(ABORT,'IMMUTABLE_PAYMENT'); END;
--> statement-breakpoint
CREATE TRIGGER payment_no_delete BEFORE DELETE ON supplier_payments BEGIN SELECT RAISE(ABORT,'IMMUTABLE_PAYMENT'); END;
--> statement-breakpoint
CREATE TRIGGER void_no_update BEFORE UPDATE ON invoice_voids BEGIN SELECT RAISE(ABORT,'IMMUTABLE_VOID'); END;
--> statement-breakpoint
CREATE TRIGGER void_no_delete BEFORE DELETE ON invoice_voids BEGIN SELECT RAISE(ABORT,'IMMUTABLE_VOID'); END;
--> statement-breakpoint
CREATE TRIGGER receipt_link_no_update BEFORE UPDATE ON invoice_receipts BEGIN SELECT RAISE(ABORT,'IMMUTABLE_RECEIPT_LINK'); END;
--> statement-breakpoint
CREATE TRIGGER receipt_link_no_delete BEFORE DELETE ON invoice_receipts BEGIN SELECT RAISE(ABORT,'IMMUTABLE_RECEIPT_LINK'); END;
--> statement-breakpoint
CREATE TRIGGER commerce_request_no_update BEFORE UPDATE ON commerce_requests BEGIN SELECT RAISE(ABORT,'IMMUTABLE_COMMERCE_REQUEST'); END;
--> statement-breakpoint
CREATE TRIGGER commerce_request_no_delete BEFORE DELETE ON commerce_requests BEGIN SELECT RAISE(ABORT,'IMMUTABLE_COMMERCE_REQUEST'); END;

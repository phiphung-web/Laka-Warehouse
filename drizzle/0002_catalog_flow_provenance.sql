ALTER TABLE `items` ADD `usage_location` text REFERENCES locations(id);--> statement-breakpoint
CREATE INDEX `items_usage_location` ON `items` (`usage_location`);--> statement-breakpoint
CREATE TABLE `catalog_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`request` text NOT NULL,
	`result` text NOT NULL,
	FOREIGN KEY (`id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `import_provenance` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`source_tab` text NOT NULL,
	`row_number` integer NOT NULL,
	`row_fingerprint` text NOT NULL,
	`item_code` text NOT NULL,
	`location` text NOT NULL,
	`quantity` integer NOT NULL,
	`entered_unit` text NOT NULL,
	`tx_id` text NOT NULL,
	`applied_at` text NOT NULL,
	FOREIGN KEY (`item_code`) REFERENCES `items`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`location`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tx_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `import_source_tab_row` ON `import_provenance` (`source_id`,`source_tab`,`row_number`);--> statement-breakpoint
CREATE INDEX `import_provenance_tx` ON `import_provenance` (`tx_id`);--> statement-breakpoint
CREATE TRIGGER catalog_request_no_update BEFORE UPDATE ON catalog_requests BEGIN SELECT RAISE(ABORT,'IMMUTABLE_CATALOG_REQUEST'); END;--> statement-breakpoint
CREATE TRIGGER catalog_request_no_delete BEFORE DELETE ON catalog_requests BEGIN SELECT RAISE(ABORT,'IMMUTABLE_CATALOG_REQUEST'); END;--> statement-breakpoint
CREATE TRIGGER import_provenance_no_update BEFORE UPDATE ON import_provenance BEGIN SELECT RAISE(ABORT,'IMMUTABLE_IMPORT_PROVENANCE'); END;--> statement-breakpoint
CREATE TRIGGER import_provenance_no_delete BEFORE DELETE ON import_provenance BEGIN SELECT RAISE(ABORT,'IMMUTABLE_IMPORT_PROVENANCE'); END;

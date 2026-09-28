CREATE TABLE `balances` (
	`item` text NOT NULL,
	`location` text NOT NULL,
	`condition` text NOT NULL,
	`lot` text DEFAULT '' NOT NULL,
	`expiry` text DEFAULT '' NOT NULL,
	`quantity` integer DEFAULT 0 NOT NULL,
	`verified_at` text,
	PRIMARY KEY(`item`, `location`, `condition`, `lot`, `expiry`),
	FOREIGN KEY (`item`) REFERENCES `items`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`location`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "quantity_nonnegative" CHECK("balances"."quantity">=0)
);
--> statement-breakpoint
CREATE INDEX `balance_location` ON `balances` (`location`);--> statement-breakpoint
CREATE TABLE `drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`detail` text NOT NULL,
	`actor` text NOT NULL,
	`created_at` text NOT NULL,
	`expected_revision` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `items` (
	`code` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`unit` text NOT NULL,
	`category` text NOT NULL,
	`kind` text DEFAULT 'unclassified' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`pack_unit` text DEFAULT '' NOT NULL,
	`pack_size` integer DEFAULT 1000 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ledger` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tx` text NOT NULL,
	`item` text NOT NULL,
	`location` text NOT NULL,
	`condition` text NOT NULL,
	`lot` text DEFAULT '' NOT NULL,
	`expiry` text DEFAULT '' NOT NULL,
	`quantity` integer NOT NULL,
	`verified_at` text,
	FOREIGN KEY (`tx`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item`) REFERENCES `items`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`location`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ledger_tx` ON `ledger` (`tx`);--> statement-breakpoint
CREATE INDEX `ledger_item_location` ON `ledger` (`item`,`location`);--> statement-breakpoint
CREATE TABLE `locations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `locations_name` ON `locations` (`name`);--> statement-breakpoint
CREATE TABLE `minimums` (
	`item` text NOT NULL,
	`location` text NOT NULL,
	`quantity` integer NOT NULL,
	PRIMARY KEY(`item`, `location`),
	FOREIGN KEY (`item`) REFERENCES `items`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`location`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "minimum_nonnegative" CHECK("minimums"."quantity">=0)
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`seeded` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`type` text NOT NULL,
	`date` text NOT NULL,
	`from_location` text,
	`to_location` text,
	`partner` text DEFAULT '' NOT NULL,
	`person` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`reference` text DEFAULT '' NOT NULL,
	`lines` text NOT NULL,
	`request` text NOT NULL,
	`total` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`actor` text NOT NULL,
	`reversal_of` text,
	FOREIGN KEY (`id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tx_number` ON `transactions` (`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `tx_reversal` ON `transactions` (`reversal_of`);--> statement-breakpoint
CREATE INDEX `tx_date` ON `transactions` (`date`);
--> statement-breakpoint
CREATE TRIGGER events_revision_guard BEFORE INSERT ON events
WHEN NEW.expected_revision <> (SELECT revision FROM settings WHERE id=1)
BEGIN SELECT RAISE(ABORT,'STALE_REVISION'); END;
--> statement-breakpoint
CREATE TRIGGER events_revision_increment AFTER INSERT ON events
BEGIN UPDATE settings SET revision=revision+1 WHERE id=1; END;
--> statement-breakpoint
CREATE TRIGGER ledger_balance_apply AFTER INSERT ON ledger
BEGIN
 INSERT OR IGNORE INTO balances(item,location,condition,lot,expiry,quantity,verified_at)
 VALUES(NEW.item,NEW.location,NEW.condition,NEW.lot,NEW.expiry,0,NULL);
 UPDATE balances SET quantity=quantity+NEW.quantity,verified_at=COALESCE(NEW.verified_at,verified_at)
 WHERE item=NEW.item AND location=NEW.location AND condition=NEW.condition AND lot=NEW.lot AND expiry=NEW.expiry;
END;
--> statement-breakpoint
CREATE TRIGGER ledger_no_update BEFORE UPDATE ON ledger BEGIN SELECT RAISE(ABORT,'IMMUTABLE_LEDGER'); END;
--> statement-breakpoint
CREATE TRIGGER ledger_no_delete BEFORE DELETE ON ledger BEGIN SELECT RAISE(ABORT,'IMMUTABLE_LEDGER'); END;
--> statement-breakpoint
CREATE TRIGGER tx_no_update BEFORE UPDATE ON transactions BEGIN SELECT RAISE(ABORT,'IMMUTABLE_TRANSACTION'); END;
--> statement-breakpoint
CREATE TRIGGER tx_no_delete BEFORE DELETE ON transactions BEGIN SELECT RAISE(ABORT,'IMMUTABLE_TRANSACTION'); END;
--> statement-breakpoint
CREATE TRIGGER events_no_update BEFORE UPDATE ON events BEGIN SELECT RAISE(ABORT,'IMMUTABLE_AUDIT'); END;
--> statement-breakpoint
CREATE TRIGGER events_no_delete BEFORE DELETE ON events BEGIN SELECT RAISE(ABORT,'IMMUTABLE_AUDIT'); END;

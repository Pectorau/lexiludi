CREATE TABLE `lexical_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lemma` varchar(255) NOT NULL,
	`normalized_lemma` varchar(255) NOT NULL,
	`category` varchar(100),
	`subcategory` varchar(100),
	`is_locution` varchar(16),
	`gender` varchar(32),
	`linked_lemmas` text,
	`pronunciation` text,
	`origins` text,
	`source_name` varchar(100) NOT NULL DEFAULT 'Morphalou 3',
	`source_license` varchar(50) NOT NULL DEFAULT 'LGPL-LR',
	`cnrtl_url` varchar(512) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lexical_entries_id` PRIMARY KEY(`id`),
	CONSTRAINT `lexical_entries_lemma_category_unique` UNIQUE(`lemma`,`category`)
);
--> statement-breakpoint
CREATE TABLE `lexical_forms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entry_id` int NOT NULL,
	`form` varchar(255) NOT NULL,
	`normalized_form` varchar(255) NOT NULL,
	`grammatical_number` varchar(32),
	`mode` varchar(32),
	`gender` varchar(32),
	`tense` varchar(32),
	`person` varchar(32),
	`pronunciation` text,
	`origins` text,
	CONSTRAINT `lexical_forms_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
CREATE INDEX `lexical_entries_normalized_lemma_idx` ON `lexical_entries` (`normalized_lemma`);--> statement-breakpoint
CREATE INDEX `lexical_forms_entry_idx` ON `lexical_forms` (`entry_id`);--> statement-breakpoint
CREATE INDEX `lexical_forms_normalized_form_idx` ON `lexical_forms` (`normalized_form`);

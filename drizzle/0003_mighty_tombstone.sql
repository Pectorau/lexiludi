CREATE TABLE `lexical_definitions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lexical_entry_id` int NOT NULL,
	`lemma` varchar(255) NOT NULL,
	`normalized_lemma` varchar(255) NOT NULL,
	`definition` text NOT NULL,
	`source_name` varchar(100) NOT NULL DEFAULT 'DBnary / Wiktionnaire',
	`source_license` varchar(64) NOT NULL DEFAULT 'CC BY-SA 3.0',
	`source_url` varchar(512) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lexical_definitions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `lexical_definitions_normalized_lemma_idx` ON `lexical_definitions` (`normalized_lemma`);

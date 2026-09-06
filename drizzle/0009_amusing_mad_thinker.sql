CREATE TABLE `lexical_relations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`source_entry_id` int NOT NULL,
	`target_entry_id` int NOT NULL,
	`relation` enum('synonym','antonym') NOT NULL,
	`source_name` varchar(100) NOT NULL DEFAULT 'DBnary / Wiktionnaire',
	`source_license` varchar(64) NOT NULL DEFAULT 'CC BY-SA 3.0',
	`source_url` varchar(512) NOT NULL DEFAULT 'https://kaiko.getalp.org/about-dbnary/',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lexical_relations_id` PRIMARY KEY(`id`),
	CONSTRAINT `lexical_relations_unique_idx` UNIQUE(`source_entry_id`,`target_entry_id`,`relation`)
);
--> statement-breakpoint
CREATE INDEX `lexical_relations_source_idx` ON `lexical_relations` (`source_entry_id`,`relation`);--> statement-breakpoint
CREATE INDEX `lexical_relations_target_idx` ON `lexical_relations` (`target_entry_id`,`relation`);

CREATE TABLE `herbarium_discoveries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`owner_key` varchar(64) NOT NULL,
	`lexical_entry_id` int NOT NULL,
	`root_id` varchar(32) NOT NULL,
	`source_mode` varchar(32) NOT NULL,
	`discovered_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `herbarium_discoveries_id` PRIMARY KEY(`id`),
	CONSTRAINT `herbarium_discoveries_owner_entry_unique` UNIQUE(`owner_key`,`lexical_entry_id`)
);
--> statement-breakpoint
CREATE TABLE `herbarium_roots` (
	`id` varchar(32) NOT NULL,
	`display_name` varchar(80) NOT NULL,
	`prefix` varchar(64) NOT NULL,
	`origin` varchar(180) NOT NULL,
	`description` text NOT NULL,
	`category` varchar(64) NOT NULL,
	`source_name` varchar(100) NOT NULL DEFAULT 'CNRTL',
	`source_url` varchar(512) NOT NULL,
	`order_index` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `herbarium_roots_id` PRIMARY KEY(`id`),
	CONSTRAINT `herbarium_roots_prefix_unique` UNIQUE(`prefix`)
);
--> statement-breakpoint
CREATE INDEX `herbarium_discoveries_owner_root_idx` ON `herbarium_discoveries` (`owner_key`,`root_id`);--> statement-breakpoint
CREATE INDEX `herbarium_discoveries_entry_idx` ON `herbarium_discoveries` (`lexical_entry_id`);--> statement-breakpoint
CREATE INDEX `herbarium_roots_order_idx` ON `herbarium_roots` (`order_index`);
--> statement-breakpoint
INSERT INTO `herbarium_roots` (`id`, `display_name`, `prefix`, `origin`, `description`, `category`, `source_name`, `source_url`, `order_index`) VALUES
('chrono', 'CHRON(O)-', 'chrono', 'Grec χρόνος — « temps »', 'Élément de composition issu du grec χρόνος, « temps » ; ses composés scientifiques évoquent le plus souvent une durée ou un moment précis.', 'Temps', 'CNRTL', 'https://www.cnrtl.fr/definition/chrono-', 10),
('bio', 'BIO-', 'bio', 'Grec βίος — « vie »', 'Élément de composition désignant la vie comme phénomène organique et les domaines qui l’étudient.', 'Vie', 'CNRTL', 'https://www.cnrtl.fr/definition/bio-', 20),
('grapho', 'GRAPHO-', 'grapho', 'Grec γράφειν — « écrire »', 'Élément initial issu du grec γράφειν, « écrire », formant des mots savants relatifs à l’écriture.', 'Écriture', 'CNRTL', 'https://www.cnrtl.fr/definition/grapho-', 30)
ON DUPLICATE KEY UPDATE `display_name` = VALUES(`display_name`), `origin` = VALUES(`origin`), `description` = VALUES(`description`), `category` = VALUES(`category`), `source_name` = VALUES(`source_name`), `source_url` = VALUES(`source_url`), `order_index` = VALUES(`order_index`);

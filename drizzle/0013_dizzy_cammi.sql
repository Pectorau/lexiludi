ALTER TABLE `multiplayer_players` ADD `archetype` enum('cryptographer','berserker','banker','necromancer') DEFAULT 'cryptographer' NOT NULL;--> statement-breakpoint
ALTER TABLE `multiplayer_players` ADD `mana` int DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE `multiplayer_players` ADD `mana_updated_at` timestamp DEFAULT (now()) NOT NULL;

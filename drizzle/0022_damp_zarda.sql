ALTER TABLE `multiplayer_players` DROP INDEX `multiplayer_players_resume_token_unique`;--> statement-breakpoint
ALTER TABLE `multiplayer_players` ADD `resume_token_hash` varchar(64);--> statement-breakpoint
ALTER TABLE `multiplayer_players` ADD `resume_token_expires_at` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `session_version` int DEFAULT 1 NOT NULL;--> statement-breakpoint
UPDATE `multiplayer_players` SET `resume_token_hash` = SHA2(`resume_token`, 256), `resume_token_expires_at` = DATE_ADD(NOW(), INTERVAL 24 HOUR);--> statement-breakpoint
ALTER TABLE `multiplayer_players` MODIFY `resume_token_hash` varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE `multiplayer_players` MODIFY `resume_token_expires_at` timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE `multiplayer_players` ADD CONSTRAINT `multiplayer_players_resume_token_hash_unique` UNIQUE(`resume_token_hash`);--> statement-breakpoint
ALTER TABLE `multiplayer_players` DROP COLUMN `resume_token`;

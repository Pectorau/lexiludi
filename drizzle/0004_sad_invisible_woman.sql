ALTER TABLE `multiplayer_rooms` MODIFY COLUMN `game_mode` enum('quiz','motus','definition') NOT NULL;--> statement-breakpoint
ALTER TABLE `multiplayer_submissions` MODIFY COLUMN `submission_type` enum('quiz','motus','definition') NOT NULL;

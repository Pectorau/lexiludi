ALTER TABLE `multiplayer_rounds` ADD CONSTRAINT `multiplayer_rounds_room_position_unique` UNIQUE(`room_id`,`position`);--> statement-breakpoint
ALTER TABLE `multiplayer_submissions` ADD CONSTRAINT `multiplayer_submissions_round_player_attempt_unique` UNIQUE(`round_id`,`player_id`,`attempt_index`);

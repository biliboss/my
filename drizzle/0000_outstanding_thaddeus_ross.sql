CREATE TABLE `folder` (
	`path` text PRIMARY KEY NOT NULL,
	`label` text,
	`position` integer NOT NULL,
	`hidden` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `folder_position` ON `folder` (`position`);--> statement-breakpoint
CREATE TABLE `folder_tag` (
	`path` text NOT NULL,
	`tag` text NOT NULL,
	PRIMARY KEY(`path`, `tag`),
	FOREIGN KEY (`path`) REFERENCES `folder`(`path`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `folder_tag_tag` ON `folder_tag` (`tag`);--> statement-breakpoint
CREATE TABLE `sidebar_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`folders` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sidebar_history_at` ON `sidebar_history` (`at`,`id`);
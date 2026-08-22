//! Where this package keeps its own state: `~/.me/agents.json` and
//! `~/.me/workspaces.json`, the roster and the workspace fence.
//!
//! Machine state, never the house: which pane an agent sits in is true of THIS
//! box, and versioning it is what made two sessions fight over one file.

import { homedir } from "node:os";
import { join } from "node:path";

export const machine = (): string => process.env.MY_MACHINE ?? join(process.env.HOME ?? homedir(), ".me");

export const store = (file: "agents.json" | "workspaces.json"): string => join(machine(), file);

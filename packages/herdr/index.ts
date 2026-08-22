//! The herdr surface, one import away. Subpaths stay exported for the CLI verbs,
//! which map one file to one subcommand.
//!
//! `run` is the ONE place this family shells out to herdr: it carries the 9s
//! timeout, the 30s remote one, and `MY_HERDR_HOST`. A second `execFile("herdr")`
//! anywhere else is the bug this package exists to remove.

export { HERDR_REMOTE_TIMEOUT_MS, HERDR_TIMEOUT_MS, did, envelopeError, host, result, run } from "./run.ts";
export { fence, marks, type Mark } from "./policy.ts";

export { list as agents } from "./agents/list.ts";
export { roster, stored, remember, forget } from "./agents/roster.ts";

export { read } from "./panes/read.ts";
export { send, submit } from "./panes/send.ts";
export { split } from "./panes/split.ts";
export { mirror } from "./panes/mirror.ts";
export { mirrors, type Mirror } from "./panes/mirrors.ts";

export { create as createTab } from "./tabs/create.ts";
export { list as tabs } from "./tabs/list.ts";

export { list as workspaces, type Workspace } from "./workspaces/list.ts";
export { create as createWorkspace } from "./workspaces/create.ts";
export { resolve as resolveWorkspace } from "./workspaces/resolve.ts";

//! The one door. `ls packages/scene-*` answers which screens exist — note 002 —
//! so a scene package owes exactly one entry and no registry.
//!
//! `./adapt` is deliberately NOT re-exported here: it is the base's half of the
//! contract, and importing it from the same specifier as the component is how a
//! scene ends up one line away from reading its own data.

export { ResourcesScene, type ResourcesSceneProps } from "./ResourcesScene.tsx";
export {
	LENS_ASKS,
	LENS_NAMES,
	type LensName,
	type SceneResource,
	inLens,
	offeredLenses,
	unlabelled,
} from "./lens.ts";
export { TOKYO } from "./tokyo.ts";

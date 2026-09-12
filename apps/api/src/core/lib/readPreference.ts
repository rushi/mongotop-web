import type { ReadPreferenceMode } from "@mongotop-web/types";

const VALID_MODES: ReadPreferenceMode[] = ["primary", "secondaryPreferred"];

// currentOp ignores the URI's readPreference and defaults to primary — the caller
// must pass this explicitly on every admin command that should honor the toggle.
export const parseReadPreference = (value: string | undefined): ReadPreferenceMode => {
    return VALID_MODES.includes(value as ReadPreferenceMode) ? (value as ReadPreferenceMode) : "primary";
};

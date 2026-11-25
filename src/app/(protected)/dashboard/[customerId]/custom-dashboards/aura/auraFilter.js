/**
 * Campaign filter for the Aura dashboards. It is one setting on the account (saved under Data inputs, Campaign filter)
 * and applies to every Aura dashboard, so it is configured once.
 *
 * Shape: { enabled, google: { include, exclude, excludeExact[] }, meta: { include, exclude, excludeExact[] } }
 * include / exclude are comma separated "name contains" terms, excludeExact holds exact campaign names.
 */

export {
    EMPTY_FILTER,
    FILTER_CHANNELS,
    FILTER_PRESETS,
} from "@/lib/auraFilterPresets";

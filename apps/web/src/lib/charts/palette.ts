/*
 * Categorical chart palette. The order passes a CVD separation check
 * (dataviz validate_palette.js, light mode); keep it. Assign in order, never cycle:
 * past five slices a pie folds into "Other".
 */
export const CHART_PALETTE = ["#2563EB", "#6ea335", "#556adc", "#df9c2a", "#38BDF8"] as const;

/** Single-series charts. */
export const CHART_PRIMARY = CHART_PALETTE[0];
/** The folded "Other" slice. */
export const CHART_OTHER = "#b3b3b3";

export const CHART_GRID = "#f0f0f0";
export const CHART_AXIS = "#e6e6e6";
export const CHART_TEXT = "#666666";
export const CHART_TEXT_STRONG = "#1f1f1f";
export const CHART_SURFACE = "#ffffff";

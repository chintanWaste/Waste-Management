/**
 * Chart colour slots.
 *
 * Fixed categorical order — slots are assigned to an entity once and never
 * cycled or re-assigned when a filter changes the number of series.
 * Validated for colour-vision deficiency on a white surface (worst adjacent
 * pair ΔE 9.1 protan, normal-vision ΔE 19.6), so a legend plus the value
 * labels/tooltips carry identity rather than colour alone.
 */

export const SERIES = [
  "#2a78d6", // 1 blue
  "#eb6834", // 2 orange
  "#1baf7a", // 3 aqua
  "#eda100", // 4 yellow
  "#e87ba4", // 5 magenta
  "#008300", // 6 green
  "#6250d6", // 7 violet
  "#e34948", // 8 red
];

/** Colour by entity, so the same source type is always the same hue. */
export const SOURCE_COLOR = {
  BWG: SERIES[0],
  MMRF: SERIES[1],
  RRR: SERIES[2],
  SPECIAL: SERIES[3],
};

export const STREAM_COLOR = {
  Wet: SERIES[2],
  Dry: SERIES[0],
  Sanitary: SERIES[4],
  "Special Care": SERIES[1],
  Others: SERIES[3],
};

export const AXIS = {
  stroke: "#e3e8e6",
  tick: { fill: "#76857f", fontSize: 11 },
};

export const TOOLTIP_STYLE = {
  contentStyle: {
    borderRadius: 10,
    border: "1px solid #e3e8e6",
    boxShadow: "0 4px 16px rgba(17,38,31,.1)",
    fontSize: 12.5,
  },
  labelStyle: { color: "#11261f", fontWeight: 650, marginBottom: 4 },
};

export const LEGEND_STYLE = { fontSize: 12, paddingTop: 8 };

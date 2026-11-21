import StatTile from "./StatTile";
import { kgShort, num, pct } from "../../utils/format";

/** Shows a figure only when it exists; otherwise the tile renders a dash. */
const n = (value) => (value === null || value === undefined ? null : num(value, 0));
const w = (value) => (value === null || value === undefined ? null : kgShort(value));

/**
 * Turns { MCD: 4, NDMC: 2 } into the small split line under a tile.
 * `format` renders each value — counts use num, weights use kgShort.
 */
const splitsOf = (map, keys, format = (v) => num(v, 0)) => {
  if (!map) return [];
  return keys
    .filter((k) => map[k])
    .map((k) => ({ label: k, value: format(map[k]) }));
};

const SOURCE_LABEL = { BWG: "BWG", MMRF: "MMRF", RRR: "RRR", SPECIAL: "Special" };

/** The summary cards of section 6.2, all computed from the Google Sheet. */
export default function SummaryCards({ s, loading }) {
  return (
    <div className="stats">
      <StatTile
        label="Total BWGs" value={n(s.bwgs.total)} loading={loading}
        splits={splitsOf(s.bwgs.byArea, ["MCD", "NDMC", "Others"])}
      />

      <StatTile
        label="Total Vendors" value={n(s.vendors.total)} loading={loading}
        splits={splitsOf(s.vendors.byType, Object.keys(s.vendors.byType || {}).slice(0, 2))}
      />

      <StatTile
        label="MMRF / RRR Centres" value={n(s.mmrfs.total)} loading={loading}
        splits={splitsOf(s.mmrfs.byArea, ["MCD", "NDMC", "Others"])}
      />

      <StatTile
        label="RRR on Wheels" value={n(s.fleet.vehicles)} unit="vehicles" loading={loading}
        splits={s.fleet.drivers ? [{ label: "Drivers", value: num(s.fleet.drivers, 0) }] : []}
      />

      <StatTile
        label="Waste Collected" value={w(s.collected)} unit="kg" loading={loading} tone="info"
        splits={splitsOf(
          s.collectedBySource,
          ["BWG", "MMRF", "RRR", "SPECIAL"],
          kgShort
        ).map((split) => ({ ...split, label: SOURCE_LABEL[split.label] }))}
      />

      <StatTile
        label="Waste Dispatched" value={w(s.dispatched)} unit="kg" loading={loading} tone="info"
      />

      <StatTile
        label="Current Stock" value={w(s.stock)} unit="kg" loading={loading}
      />

      <StatTile
        label="Landfill Diversion"
        value={s.diversion === null ? null : pct(s.diversion)}
        loading={loading}
      />

      <StatTile
        label="Certificates Pending" value={w(s.certificatesPending)} unit="kg"
        loading={loading} tone="warn"
      />
    </div>
  );
}

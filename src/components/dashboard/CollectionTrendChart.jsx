import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { LineChart as LineChartIcon } from "lucide-react";
import Card from "../common/Card";
import { EmptyState } from "../common/States";
import { AXIS, LEGEND_STYLE, SOURCE_COLOR, TOOLTIP_STYLE } from "./chartTheme";
import { kgShort } from "../../utils/format";

const SERIES_KEYS = [
  { key: "BWG", label: "BWGs" },
  { key: "MMRF", label: "MMRF / RRR Centres" },
  { key: "RRR", label: "RRR on Wheels" },
  { key: "SPECIAL", label: "Special collection" },
];

/** Kg collected per day, split by source type (section 6.3). */
export default function CollectionTrendChart({ data = [] }) {
  return (
    <Card title="Collection Trend" subtitle="Kg collected per day, by source type">
      {data.length === 0 ? (
        <EmptyState icon={LineChartIcon} title="No Collection Recorded" text="Inward entries in this period will appear here." />
      ) : (
      <div style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 6, right: 12, bottom: 0, left: -8 }}>
            <CartesianGrid stroke={AXIS.stroke} vertical={false} />
            <XAxis dataKey="label" tick={AXIS.tick} tickLine={false} axisLine={{ stroke: AXIS.stroke }} />
            <YAxis tick={AXIS.tick} tickLine={false} axisLine={false} tickFormatter={kgShort} width={56} />
            <Tooltip
              {...TOOLTIP_STYLE}
              formatter={(value, name) => [`${kgShort(value)} kg`, name]}
            />
            <Legend wrapperStyle={LEGEND_STYLE} iconType="plainline" />
            {SERIES_KEYS.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={SOURCE_COLOR[s.key]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      )}
    </Card>
  );
}

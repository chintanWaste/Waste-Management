import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { BarChart3 } from "lucide-react";
import Card from "../common/Card";
import { EmptyState } from "../common/States";
import { AXIS, LEGEND_STYLE, STREAM_COLOR, TOOLTIP_STYLE } from "./chartTheme";
import { kgShort } from "../../utils/format";

/** Wet / Dry / Sanitary / Special Care / Others by month (section 6.3). */
export default function WasteStreamChart({ data = [] }) {
  // Streams are whatever the rows actually contain, in STREAM_COLOR order.
  const streams = Object.keys(STREAM_COLOR).filter((name) =>
    data.some((row) => Number(row[name]) > 0)
  );

  return (
    <Card
      title="Waste Streams"
      subtitle="Categorised sources only — BWG, RRR on Wheels and Special collection"
    >
      {data.length === 0 ? (
        <EmptyState icon={BarChart3} title="No Categorised Waste Yet" text="Categorise an RRR, BWG or Special collection entry to see streams." />
      ) : (
      <div style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 6, right: 12, bottom: 0, left: -8 }}>
            <CartesianGrid stroke={AXIS.stroke} vertical={false} />
            <XAxis dataKey="label" tick={AXIS.tick} tickLine={false} axisLine={{ stroke: AXIS.stroke }} />
            <YAxis tick={AXIS.tick} tickLine={false} axisLine={false} tickFormatter={kgShort} width={56} />
            <Tooltip
              {...TOOLTIP_STYLE}
              cursor={{ fill: "rgba(17,38,31,.04)" }}
              formatter={(value, name) => [`${kgShort(value)} kg`, name]}
            />
            <Legend wrapperStyle={LEGEND_STYLE} iconType="square" />
            {streams.map((stream, i) => (
              <Bar
                key={stream}
                dataKey={stream}
                stackId="stream"
                fill={STREAM_COLOR[stream]}
                stroke="#fff"
                strokeWidth={2}
                maxBarSize={44}
                radius={i === streams.length - 1 ? [4, 4, 0, 0] : 0}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      )}
    </Card>
  );
}

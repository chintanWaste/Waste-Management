import {
  Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { BarChart3 } from "lucide-react";
import Card from "../common/Card";
import { EmptyState } from "../common/States";
import { AXIS, SERIES, TOOLTIP_STYLE } from "./chartTheme";
import { kg, kgShort } from "../../utils/format";

/** Top 10 BWGs by kg collected (section 6.3). Single series — no legend needed. */
export default function TopBwgChart({ data = [] }) {
  return (
    <Card title="Top 10 BWGs" subtitle="By kg collected in the selected period">
      {data.length === 0 ? (
        <EmptyState icon={BarChart3} title="No BWG Collection Recorded" text="The ten largest BWGs will be ranked here." />
      ) : (
      <div style={{ width: "100%", height: 320 }}>
        <ResponsiveContainer>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 56, bottom: 0, left: 8 }}
          >
            <CartesianGrid stroke={AXIS.stroke} horizontal={false} />
            <XAxis type="number" tick={AXIS.tick} tickLine={false} axisLine={false} tickFormatter={kgShort} />
            <YAxis
              type="category"
              dataKey="label"
              tick={AXIS.tick}
              tickLine={false}
              axisLine={false}
              width={128}
            />
            <Tooltip
              {...TOOLTIP_STYLE}
              cursor={{ fill: "rgba(17,38,31,.04)" }}
              formatter={(value) => [kg(value), "Collected"]}
            />
            <Bar dataKey="value" fill={SERIES[0]} radius={[0, 4, 4, 0]} maxBarSize={18}>
              <LabelList
                dataKey="value"
                position="right"
                formatter={kgShort}
                style={{ fill: "#3c4a45", fontSize: 11, fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      )}
    </Card>
  );
}

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { PieChart as PieChartIcon } from "lucide-react";
import Card from "../common/Card";
import { EmptyState } from "../common/States";
import { LEGEND_STYLE, SOURCE_COLOR, TOOLTIP_STYLE } from "./chartTheme";
import { kg, num } from "../../utils/format";

/** Share of each collection source in the period (section 6.3). */
export default function SourceMixChart({ data = [] }) {
  const total = data.reduce((sum, d) => sum + Number(d.value || 0), 0);

  return (
    <Card title="Source Mix" subtitle="Share of waste collected, by source">
      {data.length === 0 ? (
        <EmptyState icon={PieChartIcon} title="No Collection Recorded" text="The share of each source will appear once waste is entered." />
      ) : (
      <div style={{ width: "100%", height: 280, position: "relative" }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius="58%"
              outerRadius="82%"
              paddingAngle={2}
              stroke="#fff"
              strokeWidth={2}
            >
              {data.map((d) => (
                <Cell key={d.key} fill={SOURCE_COLOR[d.key]} />
              ))}
            </Pie>
            <Tooltip
              {...TOOLTIP_STYLE}
              formatter={(value, name) => [
                `${kg(value)} (${num((value / (total || 1)) * 100, 1)}%)`,
                name,
              ]}
            />
            <Legend wrapperStyle={LEGEND_STYLE} iconType="circle" />
          </PieChart>
        </ResponsiveContainer>

        <div
          style={{
            position: "absolute", top: "42%", left: 0, right: 0,
            textAlign: "center", pointerEvents: "none",
          }}
        >
          <div className="u-small u-muted">Total collected</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--c-ink)" }}>
            {kg(total, 0)}
          </div>
        </div>
      </div>
      )}
    </Card>
  );
}

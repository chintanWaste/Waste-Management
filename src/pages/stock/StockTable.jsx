import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { EmptyState } from "../../components/common/States";
import { num } from "../../utils/format";

const cell = (value) => (value ? num(value, 2) : "—");

/** Expandable stream > material group > category rows (section 13.2). */
export default function StockTable({ streams, uncategorisedRow }) {
  const [openStreams, setOpenStreams] = useState(() => new Set());
  const [openGroups, setOpenGroups] = useState(() => new Set());

  const toggle = (set, key, update) => {
    const next = new Set(set);
    next.has(key) ? next.delete(key) : next.add(key);
    update(next);
  };

  const totals = streams.reduce(
    (acc, s) => ({
      opening: acc.opening + s.opening,
      collected: acc.collected + s.collected,
      dispatched: acc.dispatched + s.dispatched,
      closing: acc.closing + s.closing,
    }),
    { opening: 0, collected: 0, dispatched: 0, closing: 0 }
  );

  if (uncategorisedRow) {
    totals.opening += uncategorisedRow.opening;
    totals.collected += uncategorisedRow.collected;
    totals.closing += uncategorisedRow.closing;
  }

  if (!streams.length && !uncategorisedRow?.closing) {
    return (
      <EmptyState
        title="No Stock in This Period"
        text="Record inward entries and categorise them to build stock."
      />
    );
  }

  return (
    <div className="tablewrap">
      <table className="table stocktable">
        <thead>
          <tr>
            <th>Stream · material group · category</th>
            <th className="u-right">Opening (kg)</th>
            <th className="u-right">Collected (kg)</th>
            <th className="u-right">Dispatched (kg)</th>
            <th className="u-right">Closing (kg)</th>
          </tr>
        </thead>
        <tbody>
          {streams.map((stream) => {
            const streamOpen = openStreams.has(stream.name);
            return [
              <tr key={stream.name} className="stockrow stockrow--stream">
                <td>
                  <button
                    className="stocktoggle"
                    onClick={() => toggle(openStreams, stream.name, setOpenStreams)}
                    aria-expanded={streamOpen}
                  >
                    {streamOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    {stream.name}
                  </button>
                </td>
                <td className="u-right u-mono">{cell(stream.opening)}</td>
                <td className="u-right u-mono">{cell(stream.collected)}</td>
                <td className="u-right u-mono">{cell(stream.dispatched)}</td>
                <td className="u-right u-mono"><b>{cell(stream.closing)}</b></td>
              </tr>,

              ...(streamOpen
                ? stream.groups.flatMap((group) => {
                    const key = `${stream.name}/${group.name}`;
                    const groupOpen = openGroups.has(key);
                    return [
                      <tr key={key} className="stockrow stockrow--group">
                        <td>
                          <button
                            className="stocktoggle stocktoggle--indent"
                            onClick={() => toggle(openGroups, key, setOpenGroups)}
                            aria-expanded={groupOpen}
                          >
                            {groupOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                            {group.name}
                          </button>
                        </td>
                        <td className="u-right u-mono">{cell(group.opening)}</td>
                        <td className="u-right u-mono">{cell(group.collected)}</td>
                        <td className="u-right u-mono">{cell(group.dispatched)}</td>
                        <td className="u-right u-mono">{cell(group.closing)}</td>
                      </tr>,

                      ...(groupOpen
                        ? group.items.map((item) => (
                            <tr key={item.categoryId} className="stockrow stockrow--item">
                              <td className="stockitem">{item.name}</td>
                              <td className="u-right u-mono">{cell(item.opening)}</td>
                              <td className="u-right u-mono">{cell(item.collected)}</td>
                              <td className="u-right u-mono">{cell(item.dispatched)}</td>
                              <td className="u-right u-mono">{cell(item.closing)}</td>
                            </tr>
                          ))
                        : []),
                    ];
                  })
                : []),
            ];
          })}

          {uncategorisedRow && uncategorisedRow.closing > 0 && (
            <tr className="stockrow stockrow--stream stockrow--uncat">
              <td>
                Uncategorised
                <span className="u-small u-muted"> — cannot be dispatched by category</span>
              </td>
              <td className="u-right u-mono">{cell(uncategorisedRow.opening)}</td>
              <td className="u-right u-mono">{cell(uncategorisedRow.collected)}</td>
              <td className="u-right u-mono">—</td>
              <td className="u-right u-mono"><b>{cell(uncategorisedRow.closing)}</b></td>
            </tr>
          )}
        </tbody>

        <tfoot>
          <tr className="stockrow--total">
            <td>Total</td>
            <td className="u-right u-mono">{cell(totals.opening)}</td>
            <td className="u-right u-mono">{cell(totals.collected)}</td>
            <td className="u-right u-mono">{cell(totals.dispatched)}</td>
            <td className="u-right u-mono">{cell(totals.closing)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

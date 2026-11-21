import { ArrowDown, ArrowUp } from "lucide-react";
import { useMemo, useState } from "react";
import ExportMenu from "./ExportMenu";
import { SearchBox } from "./Field";
import { EmptyState, ErrorState, SkeletonRows } from "./States";

const PAGE_SIZE = 25; // section 4.6

/**
 * Directory table with search, sorting, pagination and Excel (CSV) export.
 *
 * columns: [{ key, header, render?, align?, sortable? }]
 */
export default function DataTable({
  columns,
  rows,
  loading,
  error,
  onRetry,
  searchable = true,
  exportName,
  exportTitle,
  exportMeta,
  emptyText = "No records yet",
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState({ key: null, dir: 1 });
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      columns.some((c) => String(row[c.key] ?? "").toLowerCase().includes(q))
    );
  }, [rows, columns, query]);

  const sorted = useMemo(() => {
    if (!sort.key) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sort.key] ?? "";
      const bv = b[sort.key] ?? "";
      const na = Number(av);
      const nb = Number(bv);
      const cmp =
        Number.isFinite(na) && Number.isFinite(nb) && av !== "" && bv !== ""
          ? na - nb
          : String(av).localeCompare(String(bv));
      return cmp * sort.dir;
    });
  }, [filtered, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const visible = sorted.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  const toggleSort = (key) =>
    setSort((s) => ({ key, dir: s.key === key ? -s.dir : 1 }));

  if (loading) return <SkeletonRows />;
  if (error) return <ErrorState error={error} onRetry={onRetry} />;

  return (
    <div>
      {(searchable || exportName) && (
        <div className="u-row-between u-wrap" style={{ padding: "12px 16px" }}>
          {searchable ? (
            <SearchBox value={query} onChange={(v) => { setQuery(v); setPage(0); }} />
          ) : <span />}
          <div className="u-row">
            <span className="u-small u-muted">{sorted.length} records</span>
            {exportName && (
              <ExportMenu
                fileName={exportName}
                title={exportTitle || exportName.replace(/_/g, " ")}
                meta={exportMeta}
                columns={columns}
                rows={sorted}
              />
            )}
          </div>
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyState text={emptyText} />
      ) : (
        <div className="tablewrap">
          <table className="table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    onClick={c.sortable === false ? undefined : () => toggleSort(c.key)}
                    style={{
                      cursor: c.sortable === false ? "default" : "pointer",
                      textAlign: c.align || "left",
                    }}
                  >
                    {c.header}
                    {sort.key === c.key && (sort.dir === 1
                      ? <ArrowUp size={12} className="table__sort" aria-hidden="true" />
                      : <ArrowDown size={12} className="table__sort" aria-hidden="true" />)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((row, i) => (
                <tr key={row.id ?? i}>
                  {columns.map((c) => (
                    <td key={c.key} style={{ textAlign: c.align || "left" }}>
                      {c.render ? c.render(row) : (row[c.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 && (
        <div className="u-row-between" style={{ padding: "12px 16px", borderTop: "1px solid var(--c-line)" }}>
          <span className="u-small u-muted">
            Page {current + 1} of {pageCount}
          </span>
          <div className="u-row">
            <button className="btn btn--secondary btn--sm" disabled={current === 0} onClick={() => setPage(current - 1)}>
              Previous
            </button>
            <button className="btn btn--secondary btn--sm" disabled={current >= pageCount - 1} onClick={() => setPage(current + 1)}>
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

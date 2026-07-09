/* HistoryTable — case ledger / evidence log */
const RISK_BADGE  = { LOW: "badge badge-low", MEDIUM: "badge badge-medium", HIGH: "badge badge-high" };
const RISK_LABEL  = { LOW: "Authentic", MEDIUM: "Suspicious", HIGH: "Fraudulent" };
const BAR_COLOR   = { LOW: "#2d7a4f", MEDIUM: "#b45309", HIGH: "#c0392b" };

export default function HistoryTable({ records, onSelect }) {
  if (!records?.length) {
    return (
      <div className="card p-12 flex flex-col items-center gap-5 text-center">
        {/* Empty state as manila folder */}
        <div className="w-20 h-20 border-2 border-ink bg-note-yellow flex items-center justify-center"
          style={{ borderRadius: "4px 16px 4px 8px", boxShadow: "3px 3px 0 #2d2d2d" }}>
          <svg className="w-10 h-10 text-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 7a2 2 0 012-2h4l2 2h7a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>
          </svg>
        </div>
        <div>
          <p className="font-heading font-bold text-ink text-lg">No cases on record yet</p>
          <p className="font-body text-sm text-faint mt-1">Submit evidence above to open your first case.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      {/* Ledger header strip */}
      <div className="bg-muted border-b-2 border-ink px-5 py-2 flex items-center gap-2">
        <svg className="w-4 h-4 text-ink shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
        </svg>
        <span className="font-heading font-bold text-xs uppercase tracking-widest text-ink">Evidence Ledger</span>
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-dashed border-faint">
              {["File", "Type", "Verdict", "Confidence", "Date"].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-xs font-heading font-bold text-faint uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map((r, idx) => (
              <tr
                key={r._id}
                onClick={() => onSelect?.(r._id)}
                className={`border-b border-dashed border-faint hover:bg-blue-50/30 transition-colors duration-100 cursor-pointer group
                  ${idx % 2 === 0 ? "" : "bg-muted/20"}`}
              >
                {/* File */}
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 border-2 border-ink bg-muted flex items-center justify-center shrink-0"
                      style={{ borderRadius: "4px 8px 4px 4px" }}>
                      {r.type === "video" ? (
                        <svg className="w-4 h-4 text-brand" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14v-4zm-2 6H4a2 2 0 01-2-2V6a2 2 0 012-2h9a2 2 0 012 2v8a2 2 0 01-2 2z"/>
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-ink" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M9 2H5a2 2 0 00-2 2v16a2 2 0 002 2h14a2 2 0 002-2V9l-7-7zm-1 1.5L14.5 9H8V3.5zm8 16.5H5V4h7v6h6v10z"/>
                        </svg>
                      )}
                    </div>
                    <span className="font-body font-medium text-ink group-hover:text-brand transition-colors truncate max-w-[160px]">
                      {r.filename}
                    </span>
                  </div>
                </td>
                {/* Type */}
                <td className="px-5 py-3.5 font-body text-faint capitalize">{r.type}</td>
                {/* Verdict badge */}
                <td className="px-5 py-3.5">
                  <span className={RISK_BADGE[r.riskLevel] || "badge badge-medium"}>
                    {RISK_LABEL[r.riskLevel] || r.verdict}
                  </span>
                </td>
                {/* Confidence bar */}
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-2.5 border border-ink bg-muted overflow-hidden"
                      style={{ borderRadius: "2px 4px 2px 3px" }}>
                      <div
                        className="h-full"
                        style={{
                          width: `${Math.min(r.confidenceScore, 100)}%`,
                          background: BAR_COLOR[r.riskLevel] || "#b45309",
                        }}
                      />
                    </div>
                    <span className="font-body text-faint text-xs">{r.confidenceScore?.toFixed(0)}%</span>
                  </div>
                </td>
                {/* Date */}
                <td className="px-5 py-3.5 font-body text-faint text-xs whitespace-nowrap">
                  {new Date(r.createdAt).toLocaleDateString("en-GB", {
                    day: "numeric", month: "short", year: "numeric",
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="sm:hidden divide-y-2 divide-dashed divide-faint">
        {records.map((r) => (
          <button
            key={r._id}
            onClick={() => onSelect?.(r._id)}
            className="w-full text-left px-4 py-4 hover:bg-blue-50/30 transition-colors space-y-2 block"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-heading font-bold text-ink text-sm truncate max-w-[180px]">{r.filename}</span>
              <span className={RISK_BADGE[r.riskLevel] || "badge badge-medium"}>
                {RISK_LABEL[r.riskLevel] || r.verdict}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs font-body text-faint">
              <span className="capitalize">{r.type}</span>
              <span>&middot;</span>
              <span>{r.confidenceScore?.toFixed(0)}% confidence</span>
              <span>&middot;</span>
              <span>{new Date(r.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

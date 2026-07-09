/* ResultCard — investigation report with stamped verdict */
const RISK_CONFIG = {
  LOW:    { label: "Authentic",   stampClass: "stamp-authentic",  badgeClass: "badge-low",    barColor: "#2d7a4f", icon: "CLEAR" },
  MEDIUM: { label: "Suspicious",  stampClass: "stamp-suspicious", badgeClass: "badge-medium", barColor: "#b45309", icon: "SUSP." },
  HIGH:   { label: "Fraudulent",  stampClass: "stamp-fraudulent", badgeClass: "badge-high",   barColor: "#c0392b", icon: "FRAUD" },
};

export default function ResultCard({ result }) {
  const cfg    = RISK_CONFIG[result.riskLevel] || RISK_CONFIG.MEDIUM;
  const isVideo = result.type === "video";

  return (
    <div className="card p-6 space-y-5 relative animate-slide-up overflow-visible">

      {/* Tape strip top decoration */}
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-5 bg-yellow-100 border border-yellow-300 opacity-70 rotate-1" style={{ borderRadius: "2px" }} aria-hidden="true"/>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 pt-2">
        <div className="space-y-1 flex-1 min-w-0">
          {/* Case type label */}
          <span className="label-tag text-xs">
            {isVideo ? "Video Analysis" : "Document Analysis"}
          </span>
          <h2 className="font-heading font-bold text-lg text-ink truncate mt-2">
            {result.filename}
          </h2>
        </div>

        {/* Stamped verdict badge */}
        <div className="shrink-0 relative">
          <span className={`stamp-badge ${cfg.stampClass} animate-stamp`}>
            {cfg.icon}
          </span>
          {/* Invisible placeholder for layout spacing */}
          <span className="invisible block px-4 py-2 text-sm font-heading">{cfg.icon}</span>
        </div>
      </div>

      <hr className="border-dashed border-faint border-t-2"/>

      {/* Confidence meter — like a measuring ruler */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs font-heading font-bold text-faint uppercase tracking-wider">Confidence Score</span>
          <span className="font-heading font-bold text-base" style={{ color: cfg.barColor }}>
            {result.confidenceScore?.toFixed(1)}%
          </span>
        </div>
        {/* Ruler track */}
        <div className="h-4 border-2 border-ink bg-muted overflow-hidden relative"
          style={{ borderRadius: "3px 8px 3px 6px" }}>
          {/* Tick marks */}
          <div className="absolute inset-0 flex">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="flex-1 border-r border-ink/20 flex items-end pb-0.5">
                {i === 4 && <span className="text-[8px] text-ink/30 ml-0.5 font-body leading-none">50</span>}
              </div>
            ))}
          </div>
          {/* Fill bar */}
          <div
            className="h-full transition-all duration-1000 ease-out relative z-10"
            style={{ width: `${Math.min(result.confidenceScore, 100)}%`, background: cfg.barColor, opacity: 0.75 }}
          />
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3">
        <StatCell label="Verdict"    value={result.verdict} />
        <StatCell label="Type"       value={isVideo ? "Video" : "Document"} />
        <StatCell label="Risk"       value={cfg.label} />
      </div>

      {/* AI Analyst note */}
      {result.claudeReport && (
        <div className="bg-note-yellow border-2 border-ink p-4 space-y-2 relative"
          style={{ borderRadius: "4px 16px 4px 8px", boxShadow: "3px 3px 0 #2d2d2d", transform: "rotate(-0.3deg)" }}>
          {/* Note header */}
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-ink shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2a2 2 0 012 2v1h3a1 1 0 011 1v3a6 6 0 01-6 6 6 6 0 01-6-6V6a1 1 0 011-1h3V4a2 2 0 012-2z"/>
            </svg>
            <span className="font-heading font-bold text-xs text-ink uppercase tracking-wider">AI Analyst Note</span>
          </div>
          <p className="font-body text-sm text-ink leading-relaxed">{result.claudeReport}</p>
        </div>
      )}

      {/* Timestamp as case log footer */}
      {result.createdAt && (
        <p className="text-xs font-body text-faint border-t-2 border-dashed border-faint pt-3">
          Case logged: {new Date(result.createdAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}

function StatCell({ label, value }) {
  return (
    <div className="stat-cell">
      <p className="text-xs font-body text-faint uppercase tracking-wider mb-1">{label}</p>
      <p className="font-heading font-bold text-sm text-ink">{value}</p>
    </div>
  );
}

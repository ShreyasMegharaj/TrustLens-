import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import HistoryTable from "../components/HistoryTable";
import ResultCard   from "../components/ResultCard";
import { getHistory, getVerification } from "../api";

function Spinner({ size = 5 }) {
  return (
    <svg className={`w-${size} h-${size} animate-spin text-brand`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
    </svg>
  );
}

const STAT_STYLE = [
  { bg: "bg-paper",     label: "Total Cases" },
  { bg: "bg-note-red",  label: "Fraudulent" },
  { bg: "bg-note-yellow", label: "Suspicious" },
  { bg: "bg-note-green",  label: "Authentic" },
];

export default function HistoryPage() {
  const navigate = useNavigate();

  const [records,      setRecords]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");
  const [selected,     setSelected]     = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [pagination,   setPagination]   = useState({ page: 1, pages: 1, total: 0 });

  const load = async (page = 1) => {
    setLoading(true);
    setError("");
    try {
      const data = await getHistory(page);
      setRecords(data.records);
      setPagination(data.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSelect = async (id) => {
    setLoadingDetail(true);
    try {
      const detail = await getVerification(id);
      setSelected(detail);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingDetail(false);
    }
  };

  const statValues = [
    pagination.total,
    records.filter(r => r.riskLevel === "HIGH").length,
    records.filter(r => r.riskLevel === "MEDIUM").length,
    records.filter(r => r.riskLevel === "LOW").length,
  ];

  return (
    <main className="max-w-5xl mx-auto px-4 py-12 space-y-8">

      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h1 className="font-heading font-bold text-3xl text-ink">
            Case <span className="underline-sketch">Ledger</span>
          </h1>
          <p className="font-body text-faint">All past analyses for your account.</p>
        </div>
        <button
          id="new-verification-btn"
          onClick={() => navigate("/upload")}
          className="btn-primary shrink-0"
        >
          + New Case
        </button>
      </div>

      {/* Stats strip — pinned index cards */}
      {!loading && records.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 animate-fade-in">
          {STAT_STYLE.map((s, i) => (
            <div key={s.label}
              className={`${s.bg} border-2 border-ink p-4 space-y-1`}
              style={{
                borderRadius: i % 2 === 0 ? "8px 16px 8px 12px" : "14px 6px 12px 6px",
                boxShadow: "3px 3px 0 #2d2d2d",
                transform: i % 3 === 0 ? "rotate(-0.5deg)" : i % 2 === 0 ? "rotate(0.5deg)" : "rotate(0deg)",
              }}>
              {/* Pin */}
              <div className="w-3 h-3 rounded-full bg-ink/30 ml-auto" aria-hidden="true"/>
              <p className="font-body text-xs text-faint uppercase tracking-wider">{s.label}</p>
              <p className="font-heading font-bold text-2xl text-ink">{statValues[i]}</p>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-note-red border-2 border-risk-high px-4 py-3 animate-fade-in"
          style={{ borderRadius: "6px 12px 6px 6px" }}>
          <p className="text-sm font-body text-risk-high">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="card p-10 flex items-center justify-center gap-3 font-body text-faint">
          <Spinner />
          <span>Loading case files...</span>
        </div>
      ) : (
        <HistoryTable records={records} onSelect={handleSelect} />
      )}

      {/* Pagination — numbered tabs */}
      {pagination.pages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => load(p)}
              className={`w-9 h-9 font-heading font-bold text-sm border-2 border-ink transition-all duration-100
                ${p === pagination.page
                  ? "bg-brand text-white shadow-hard-sm"
                  : "bg-paper text-ink hover:bg-muted hover:shadow-hard-sm"
                }`}
              style={{ borderRadius: "6px 10px 6px 8px" }}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Detail modal — case file overlay */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
          style={{ background: "rgba(45,45,45,0.6)", backdropFilter: "blur(2px)" }}
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-lg animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <div className="flex justify-end mb-3">
              <button
                onClick={() => setSelected(null)}
                aria-label="Close"
                className="w-9 h-9 border-2 border-ink bg-paper flex items-center justify-center font-heading font-bold text-ink hover:bg-note-red transition-colors"
                style={{ borderRadius: "6px 10px 6px 8px", boxShadow: "2px 2px 0 #2d2d2d" }}
              >
                &times;
              </button>
            </div>
            <ResultCard result={selected} />
          </div>
        </div>
      )}

      {/* Loading detail overlay */}
      {loadingDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(45,45,45,0.5)" }}>
          <Spinner size={10} />
        </div>
      )}
    </main>
  );
}

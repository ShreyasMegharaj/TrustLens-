import { useState } from "react";
import UploadZone from "../components/UploadZone";
import ResultCard from "../components/ResultCard";
import { verifyFile } from "../api";

const STAGES = {
  idle:       { label: "",                     pct: 0   },
  uploading:  { label: "Uploading evidence...", pct: 0   },
  analyzing:  { label: "Analysing...",          pct: 80  },
  generating: { label: "Writing AI report...",  pct: 95  },
  done:       { label: "Done",                  pct: 100 },
};

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
    </svg>
  );
}

export default function UploadPage() {
  const [file,     setFile]     = useState(null);
  const [stage,    setStage]    = useState("idle");
  const [progress, setProgress] = useState(0);
  const [result,   setResult]   = useState(null);
  const [error,    setError]    = useState("");

  const handleFile = (f) => {
    setFile(f);
    setResult(null);
    setError("");
    setStage("idle");
  };

  const handleAnalyse = async () => {
    if (!file) return;
    setResult(null);
    setError("");
    setStage("uploading");
    setProgress(0);

    try {
      const data = await verifyFile(file, (pct) => {
        setProgress(pct);
        if (pct === 100) setStage("analyzing");
      });
      setStage("generating");
      await new Promise((r) => setTimeout(r, 800));
      setResult(data);
      setStage("done");
    } catch (err) {
      setError(err.message);
      setStage("idle");
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setError("");
    setStage("idle");
    setProgress(0);
  };

  const isLoading = stage !== "idle" && stage !== "done";
  const stageInfo = STAGES[stage];

  return (
    <main className="max-w-2xl mx-auto px-4 py-12 space-y-8">

      {/* Page header — case folder label */}
      <div className="flex items-start gap-4">
        <div className="hidden sm:flex w-12 h-12 items-center justify-center border-2 border-ink bg-note-blue shrink-0"
          style={{ borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%", boxShadow: "2px 2px 0 #2d2d2d" }}>
          <svg className="w-6 h-6 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </div>
        <div>
          <h1 className="font-heading font-bold text-3xl text-ink">Submit Evidence</h1>
          <p className="font-body text-faint mt-1">
            Upload a video to detect deepfakes, or a document image to check for tampering.
          </p>
        </div>
      </div>

      {/* Upload panel */}
      {!result && (
        <div className="card p-6 space-y-5">

          {/* Tape top */}
          <div className="flex justify-center -mt-10">
            <div className="tape font-heading font-bold text-xs text-ink px-8 py-1">
              EVIDENCE SUBMISSION
            </div>
          </div>

          <UploadZone onFile={handleFile} />

          {/* Selected file info — evidence tag */}
          {file && (
            <div className="flex items-center justify-between border-2 border-ink bg-muted px-4 py-3 animate-fade-in"
              style={{ borderRadius: "6px 12px 6px 8px", boxShadow: "2px 2px 0 #2d2d2d" }}>
              <div className="flex items-center gap-3 min-w-0">
                {/* File icon */}
                <div className="w-8 h-8 border-2 border-ink bg-note-yellow flex items-center justify-center shrink-0"
                  style={{ borderRadius: "4px 8px 4px 4px" }}>
                  <svg className="w-4 h-4 text-ink" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="font-heading font-bold text-sm text-ink truncate max-w-[220px]">{file.name}</p>
                  <p className="text-xs font-body text-faint">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>
              <button
                onClick={reset}
                aria-label="Remove file"
                className="w-7 h-7 border-2 border-ink bg-paper flex items-center justify-center text-ink hover:bg-note-red transition-colors"
                style={{ borderRadius: "4px 8px 4px 4px" }}>
                &times;
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-note-red border-2 border-risk-high px-4 py-3 animate-fade-in"
              style={{ borderRadius: "6px 12px 6px 6px" }}>
              <p className="text-sm font-body text-risk-high">{error}</p>
            </div>
          )}

          {/* Progress bar — looks like a ruler */}
          {isLoading && (
            <div className="space-y-2 animate-fade-in">
              <div className="flex justify-between text-xs font-body text-faint">
                <span className="flex items-center gap-1.5"><Spinner/>{stageInfo.label}</span>
                <span className="font-heading font-bold">{stage === "uploading" ? progress : stageInfo.pct}%</span>
              </div>
              <div className="h-5 border-2 border-ink bg-muted overflow-hidden relative"
                style={{ borderRadius: "4px 8px 4px 6px" }}>
                {/* Ruler ticks */}
                <div className="absolute inset-0 flex pointer-events-none">
                  {[...Array(10)].map((_, i) => (
                    <div key={i} className="flex-1 border-r border-ink/20"/>
                  ))}
                </div>
                <div
                  className="h-full bg-brand transition-all duration-500 ease-out relative z-10"
                  style={{ width: `${stage === "uploading" ? progress : stageInfo.pct}%` }}
                />
              </div>
            </div>
          )}

          {/* Analyse button */}
          {file && !isLoading && (
            <button
              id="analyse-btn"
              onClick={handleAnalyse}
              className="btn-primary w-full py-3.5 text-base animate-fade-in"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8"/>
                <path d="M21 21l-4.35-4.35"/>
              </svg>
              Analyse Evidence
            </button>
          )}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-4 animate-slide-up">
          <ResultCard result={result} />
          <button onClick={reset} className="btn-secondary w-full py-3">
            Submit Another File
          </button>
        </div>
      )}
    </main>
  );
}

import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const FEATURES = [
  {
    icon: (
      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14v-4zm-2 6H4a2 2 0 01-2-2V6a2 2 0 012-2h9a2 2 0 012 2v8a2 2 0 01-2 2z"/>
      </svg>
    ),
    emoji: "🎬",
    title:  "Deepfake Video Detection",
    desc:   "ResNeXt50 model analyses 16 frames per video, spotting face-swap and synthesis artefacts.",
    bg:     "bg-note-blue",
    rot:    "-rotate-1",
  },
  {
    icon: (
      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 2H5a2 2 0 00-2 2v16a2 2 0 002 2h14a2 2 0 002-2V9l-7-7zm-1 1.5L14.5 9H8V3.5z"/>
        <path d="M9 13h6M9 17h4"/>
      </svg>
    ),
    emoji: "📄",
    title:  "Document Tampering (ELA)",
    desc:   "Error Level Analysis reveals pixel-level inconsistencies from copy-paste edits or forgery.",
    bg:     "bg-note-yellow",
    rot:    "rotate-1",
  },
  {
    icon: (
      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8"/>
        <path d="M21 21l-4.35-4.35"/>
      </svg>
    ),
    emoji: "🤖",
    title:  "AI Fraud Report",
    desc:   "Gemini AI translates raw ML scores into a plain-language report anyone can understand.",
    bg:     "bg-note-green",
    rot:    "-rotate-0.5",
  },
];

const TRUST_CHIPS = ["ResNeXt50 Model", "ELA Forensics", "Gemini AI Reports", "Evidence Logging"];

const EXT_STEPS = [
  { num: "1", label: "Download the zip", icon: "⬇️" },
  { num: "2", label: "Open chrome://extensions", icon: "🌐" },
  { num: "3", label: "Enable Developer Mode", icon: "🔧" },
  { num: "4", label: "Load Unpacked → done!", icon: "✅" },
];

export default function HomePage() {
  const { user } = useAuth();

  return (
    <main className="space-y-20 pb-24">

      {/* ── Hero ── */}
      <section className="max-w-4xl mx-auto px-4 pt-16 text-center space-y-8 animate-slide-up">

        {/* Tape header badge */}
        <div className="inline-block relative">
          <div className="tape font-heading text-sm font-bold text-ink px-8 py-1.5">
            AI-Powered Media Forensics
          </div>
        </div>

        {/* Main heading on a ruled paper look */}
        <div className="relative inline-block">
          <h1 className="font-heading font-bold text-5xl sm:text-6xl text-ink leading-tight">
            Detect Deepfakes.{" "}
            <span className="underline-sketch text-brand">Expose Fraud.</span>
          </h1>
        </div>

        <p className="font-body text-lg text-faint max-w-2xl mx-auto leading-relaxed">
          TrustLens combines a trained ResNeXt50 model, Error Level Analysis, and Gemini AI to verify
          videos and documents in seconds &mdash; with a plain-language report anyone can understand.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link to={user ? "/upload" : "/signup"} className="btn-primary px-8 py-3.5 text-base">
            {user ? "Analyse a File" : "Get Started -- Free"}
          </Link>
          {!user && (
            <Link to="/login" className="btn-secondary px-8 py-3.5 text-base">
              Sign In
            </Link>
          )}
          <a
            href="#extension"
            className="btn-secondary px-8 py-3.5 text-base flex items-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 15V3m0 12l-4-4m4 4l4-4"/>
              <path d="M2 17l.621 2.485A2 2 0 004.561 21h14.878a2 2 0 001.94-1.515L22 17"/>
            </svg>
            Get Extension
          </a>
        </div>

        {/* Trust chips — pinned notes row */}
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          {TRUST_CHIPS.map((t) => (
            <span key={t}
              className="flex items-center gap-1.5 text-xs font-body text-ink bg-note-green
                border-2 border-ink px-3 py-1"
              style={{ borderRadius: "4px 10px 4px 6px", boxShadow: "2px 2px 0 #2d2d2d" }}>
              <span className="text-risk-low font-bold">&#10003;</span>
              {t}
            </span>
          ))}
        </div>
      </section>

      {/* ── Decorative case board divider ── */}
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-center gap-4">
          <hr className="flex-1 border-t-2 border-dashed border-faint"/>
          <span className="font-heading text-sm text-faint uppercase tracking-widest">How it works</span>
          <hr className="flex-1 border-t-2 border-dashed border-faint"/>
        </div>
      </div>

      {/* ── Features — pinned sticky notes ── */}
      <section className="max-w-5xl mx-auto px-4">
        <div className="text-center space-y-3 mb-12">
          <h2 className="font-heading font-bold text-3xl text-ink">
            Three layers of analysis
          </h2>
          <p className="font-body text-faint">One clear verdict.</p>
        </div>

        <div className="grid sm:grid-cols-3 gap-8">
          {FEATURES.map((f, i) => (
            <div
              key={i}
              className={`card p-6 space-y-4 ${f.bg} ${f.rot} hover:-translate-y-1 transition-transform duration-200 group`}
              style={{ boxShadow: "5px 5px 0 #2d2d2d" }}
            >
              {/* Pin top decoration */}
              <div className="flex justify-end">
                <div className="w-4 h-4 rounded-full bg-accent border-2 border-ink opacity-80" aria-hidden="true"/>
              </div>
              {/* Icon */}
              <div className="w-12 h-12 border-2 border-ink bg-white flex items-center justify-center text-ink"
                style={{ borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%" }}>
                {f.icon}
              </div>
              {/* Content */}
              <div className="space-y-2">
                <h3 className="font-heading font-bold text-ink text-lg">{f.title}</h3>
                <p className="font-body text-sm text-faint leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Extension Download Section ── */}
      <section id="extension" className="max-w-5xl mx-auto px-4">
        <div className="flex items-center gap-4 mb-10">
          <hr className="flex-1 border-t-2 border-dashed border-faint"/>
          <span className="font-heading text-sm text-faint uppercase tracking-widest">Browser Extension</span>
          <hr className="flex-1 border-t-2 border-dashed border-faint"/>
        </div>

        <div className="card p-8 sm:p-10 bg-note-blue space-y-8" style={{ boxShadow: "6px 6px 0 #2d2d2d" }}>
          {/* Pin */}
          <div className="flex justify-end -mt-4 -mr-4">
            <div className="w-5 h-5 rounded-full bg-brand border-2 border-ink opacity-90" aria-hidden="true"/>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {/* Extension icon */}
            <div className="shrink-0 w-20 h-20 border-2 border-ink bg-white flex items-center justify-center"
              style={{ borderRadius: "16px 24px 16px 20px", boxShadow: "4px 4px 0 #2d2d2d" }}>
              <svg className="w-10 h-10 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/>
              </svg>
            </div>

            {/* Text */}
            <div className="flex-1 space-y-2">
              <div className="tape inline-block font-heading text-xs font-bold text-ink px-4 py-1">
                Chrome Extension
              </div>
              <h2 className="font-heading font-bold text-2xl sm:text-3xl text-ink">
                Verify right from your browser
              </h2>
              <p className="font-body text-faint leading-relaxed">
                The TrustLens extension lets you right-click any video or image on the web and instantly
                check it for deepfakes &amp; tampering — no tab switching needed.
              </p>
            </div>
          </div>

          {/* Steps */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {EXT_STEPS.map((s) => (
              <div key={s.num}
                className="bg-paper border-2 border-ink p-3 text-center space-y-1"
                style={{ borderRadius: "6px 12px 6px 8px", boxShadow: "3px 3px 0 #2d2d2d" }}>
                <div className="text-2xl">{s.icon}</div>
                <div className="font-heading font-bold text-xs text-brand">Step {s.num}</div>
                <div className="font-body text-xs text-faint leading-tight">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Download button */}
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <a
              id="extension-download-btn"
              href="https://github.com/ShreyasMegharaj/TrustLens-/archive/refs/heads/main.zip"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary px-8 py-3.5 text-base"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 15V3m0 12l-4-4m4 4l4-4"/>
                <path d="M2 17l.621 2.485A2 2 0 004.561 21h14.878a2 2 0 001.94-1.515L22 17"/>
              </svg>
              Download Extension (.zip)
            </a>
            <span className="font-body text-sm text-faint">
              Free forever · Chrome / Edge · No account needed
            </span>
          </div>

          {/* Note */}
          <p className="font-body text-xs text-faint border-t-2 border-dashed border-ink/30 pt-4">
            📌 <strong>After download:</strong> Unzip the file, go to{" "}
            <code className="bg-white border border-ink px-1 rounded text-xs">chrome://extensions</code>,
            enable <em>Developer Mode</em>, click <em>Load unpacked</em>, and select the{" "}
            <code className="bg-white border border-ink px-1 rounded text-xs">extension/</code> folder.
          </p>
        </div>
      </section>

      {/* ── CTA panel — manila evidence folder ── */}
      <section className="max-w-3xl mx-auto px-4">
        <div className="card p-10 text-center space-y-6 bg-note-yellow -rotate-0.5"
          style={{ boxShadow: "6px 6px 0 #2d2d2d" }}>
          {/* Top tear strip */}
          <div className="w-24 h-3 bg-ink/10 mx-auto border border-ink/20 mb-4"
            style={{ borderRadius: "2px" }} aria-hidden="true"/>
          <h2 className="font-heading font-bold text-2xl text-ink">
            Ready to verify something?
          </h2>
          <p className="font-body text-faint">
            Upload any video or document image and get a result in under a minute.
          </p>
          <Link to={user ? "/upload" : "/signup"} className="btn-primary px-8 py-3.5 text-base inline-flex mx-auto">
            Open a Case &rarr;
          </Link>
        </div>
      </section>
    </main>
  );
}

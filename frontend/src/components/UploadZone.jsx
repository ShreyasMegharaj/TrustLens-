import { useCallback, useState } from "react";

const ACCEPTED = {
  video:    [".mp4", ".avi", ".mov", ".mkv", ".webm"],
  document: [".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp"],
  all:      [".mp4", ".avi", ".mov", ".mkv", ".webm", ".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp"],
};

const MAX_SIZE = 200 * 1024 * 1024;

export default function UploadZone({ onFile }) {
  const [dragging, setDragging] = useState(false);
  const [error,    setError]    = useState("");

  const validate = (file) => {
    const ext = "." + file.name.split(".").pop().toLowerCase();
    if (!ACCEPTED.all.includes(ext)) {
      setError(`Unsupported format: ${ext}. Please upload a video or image file.`);
      return false;
    }
    if (file.size > MAX_SIZE) {
      setError("File is too large. Maximum size is 200 MB.");
      return false;
    }
    setError("");
    return true;
  };

  const handleFile = useCallback((file) => {
    if (!file) return;
    if (validate(file)) onFile(file);
  }, [onFile]);

  const onDrop     = (e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); };
  const onDragOver  = (e) => { e.preventDefault(); setDragging(true);  };
  const onDragLeave = ()  => setDragging(false);
  const onInputChange = (e) => handleFile(e.target.files[0]);

  return (
    <div className="space-y-3">

      {/* Dashed evidence drop area */}
      <label
        htmlFor="file-input"
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={`flex flex-col items-center justify-center gap-5 p-10 cursor-pointer
          border-[3px] border-dashed border-ink bg-white transition-all duration-200
          ${dragging ? "dropzone-active bg-note-blue" : "hover:border-brand hover:bg-blue-50/30"}`}
        style={{ borderRadius: "8px 20px 8px 16px" }}
      >
        {/* Icon in a note-yellow circle */}
        <div className={`w-16 h-16 rounded-full border-2 border-ink flex items-center justify-center transition-all duration-200
          ${dragging ? "bg-note-blue shadow-hard-blue" : "bg-note-yellow shadow-hard"}`}>
          {dragging ? (
            /* Downward arrow when dragging */
            <svg className="w-8 h-8 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12l7 7 7-7"/>
            </svg>
          ) : (
            /* Upload cloud icon */
            <svg className="w-8 h-8 text-ink" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          )}
        </div>

        {/* Main text */}
        <div className="text-center space-y-1">
          <p className="font-heading font-bold text-lg text-ink">
            {dragging ? "Drop evidence here!" : "Drop evidence here"}
          </p>
          <p className="font-body text-sm text-faint">
            or <span className="text-brand underline underline-offset-2">click to browse files</span>
          </p>
        </div>

        {/* Sketchy arrow */}
        <div className="text-faint text-2xl leading-none" aria-hidden="true">
          &#8595;
        </div>

        {/* Format chips as evidence tags */}
        <div className="flex flex-wrap justify-center gap-2">
          {["MP4", "AVI", "MOV", "JPG", "PNG", "WEBP"].map((fmt) => (
            <span key={fmt} className="label-tag text-xs">
              {fmt}
            </span>
          ))}
        </div>

        <p className="text-xs text-faint font-body">Max 200 MB &middot; Videos or document images</p>
      </label>

      <input
        id="file-input"
        type="file"
        className="sr-only"
        accept={ACCEPTED.all.join(",")}
        onChange={onInputChange}
      />

      {error && (
        <div className="flex items-center gap-2 p-3 bg-note-red border-2 border-risk-high animate-fade-in"
          style={{ borderRadius: "6px 12px 6px 6px" }}>
          <svg className="w-4 h-4 shrink-0 text-risk-high" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <circle cx="12" cy="16" r="0.5" fill="currentColor"/>
          </svg>
          <p className="text-sm font-body text-risk-high">{error}</p>
        </div>
      )}
    </div>
  );
}

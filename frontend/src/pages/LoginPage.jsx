import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "../api";
import { useAuth } from "../context/AuthContext";

/* Reusable form field */
function Field({ id, label, type, name, placeholder, autoComplete, value, onChange, required, minLength }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-heading font-bold text-ink">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="input"
      />
    </div>
  );
}

/* Spinner */
function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
    </svg>
  );
}

export default function LoginPage() {
  const { saveAuth } = useAuth();
  const navigate     = useNavigate();

  const [form,    setForm]    = useState({ email: "", password: "" });
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);
  const [slowMsg, setSlowMsg] = useState("");

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSlowMsg("");
    setLoading(true);

    // After 6s, show a hint that the server might be waking up from sleep
    const wakeTimer = setTimeout(() => {
      setSlowMsg("⏳ Waking up server… (Render free tier sleeps — hang tight!)");
    }, 6000);

    try {
      const data = await login(form.email, form.password);
      saveAuth(data.token, data.user);
      navigate("/upload");
    } catch (err) {
      setError(err.message);
    } finally {
      clearTimeout(wakeTimer);
      setSlowMsg("");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6 animate-slide-up">

        {/* Brand header */}
        <div className="text-center space-y-3">
          {/* Hand-drawn shield */}
          <div className="inline-flex items-center justify-center w-16 h-16 border-2 border-ink bg-note-blue mx-auto"
            style={{ borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%", boxShadow: "3px 3px 0 #2d2d2d" }}>
            <svg className="w-8 h-8 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <h1 className="font-heading font-bold text-3xl text-ink">Welcome back</h1>
          <p className="font-body text-faint">Sign in to your TrustLens account</p>
        </div>

        {/* Form card — looks like a paper form */}
        <div className="card p-8 space-y-5">

          {/* Tape decoration */}
          <div className="flex justify-center -mt-12 mb-2">
            <div className="tape text-xs font-heading text-ink font-bold px-6 py-1">
              CASE FILE - LOGIN
            </div>
          </div>

          {error && (
            <div className="bg-note-red border-2 border-risk-high px-4 py-3 animate-fade-in"
              style={{ borderRadius: "6px 12px 6px 6px" }}>
              <p className="text-sm font-body text-risk-high">{error}</p>
            </div>
          )}

          {slowMsg && !error && (
            <div className="bg-note-blue border-2 border-brand px-4 py-3 animate-fade-in"
              style={{ borderRadius: "6px 12px 6px 6px" }}>
              <p className="text-sm font-body text-brand">{slowMsg}</p>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <Field id="login-email" label="Email address" type="email" name="email"
              placeholder="you@example.com" autoComplete="email" required
              value={form.email} onChange={onChange} />

            <Field id="login-password" label="Password" type="password" name="password"
              placeholder="••••••••" autoComplete="current-password" required
              value={form.password} onChange={onChange} />

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 text-base disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {loading ? <><Spinner /> Signing in...</> : "Sign In"}
            </button>
          </form>

          <hr className="border-dashed border-faint border-t-2"/>

          <p className="text-center text-sm font-body text-faint">
            No account yet?{" "}
            <Link to="/signup" className="text-brand font-heading font-bold hover:underline underline-offset-2">
              Sign up free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { supabase } from "./supabase.js";

export default function AuthScreen() {
  const [mode, setMode] = useState("signin"); // "signin" | "signup" | "sent"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMode("sent");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // onAuthStateChange in main.jsx handles the session and re-renders App
      }
    } catch (err) {
      setError(err.message || "Something went wrong");
    }
    setLoading(false);
  }

  const inputStyle = {
    width: "100%", padding: "12px 14px", borderRadius: 10,
    border: "1px solid #e0e0dc", background: "#fff", color: "#1a1a1a",
    fontSize: 15, outline: "none", boxSizing: "border-box",
  };

  if (mode === "sent") {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fafaf8", padding: 24 }}>
        <div style={{ maxWidth: 360, width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📬</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#1a1a1a", marginBottom: 8 }}>Check your email</div>
          <div style={{ fontSize: 14, color: "#888", lineHeight: 1.6 }}>
            We sent a confirmation link to <strong>{email}</strong>.<br />
            Click it to activate your account, then sign in.
          </div>
          <button onClick={() => setMode("signin")}
            style={{ marginTop: 24, fontSize: 13, color: "#1B6FE8", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fafaf8", padding: 24 }}>
      <div style={{ maxWidth: 360, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#1a1a1a", letterSpacing: "-0.5px" }}>Paceman</div>
          <div style={{ fontSize: 13, color: "#aaa", marginTop: 4 }}>
            {mode === "signin" ? "Sign in to your account" : "Create your account"}
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="Email" required autoComplete="email"
            style={inputStyle}
            onFocus={e => e.target.style.borderColor = "#1B6FE8"}
            onBlur={e => e.target.style.borderColor = "#e0e0dc"}
          />
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Password" required autoComplete={mode === "signup" ? "new-password" : "current-password"}
            style={inputStyle}
            onFocus={e => e.target.style.borderColor = "#1B6FE8"}
            onBlur={e => e.target.style.borderColor = "#e0e0dc"}
          />

          {error && (
            <div style={{ padding: "10px 12px", borderRadius: 8, background: "#fff0f0", border: "1px solid #fcc", fontSize: 13, color: "#c00" }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{ padding: 14, borderRadius: 10, background: loading ? "#e0e0dc" : "#1B6FE8", color: loading ? "#aaa" : "white", border: "none", fontSize: 15, fontWeight: 700, cursor: loading ? "default" : "pointer", marginTop: 4 }}>
            {loading ? "…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "#888" }}>
          {mode === "signin" ? (
            <>No account? <button onClick={() => { setMode("signup"); setError(""); }}
              style={{ color: "#1B6FE8", background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 13, fontWeight: 600 }}>Sign up</button></>
          ) : (
            <>Already have an account? <button onClick={() => { setMode("signin"); setError(""); }}
              style={{ color: "#1B6FE8", background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 13, fontWeight: 600 }}>Sign in</button></>
          )}
        </div>
      </div>
    </div>
  );
}

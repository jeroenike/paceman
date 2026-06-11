import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import AuthScreen from "./AuthScreen.jsx";
import { supabase, supabaseConfigured } from "./supabase.js";

function Root() {
  // null = loading, false = signed out, object = session
  const [session, setSession] = useState(supabaseConfigured ? null : false);

  useEffect(() => {
    if (!supabaseConfigured) return;
    // getSession() can hang indefinitely (iOS standalone/PWA LockManager
    // deadlock, dropped connections) — never leave the user on the boot
    // spinner. After 6s fall through to signed-out; onAuthStateChange still
    // upgrades to the real session if it arrives later.
    let settled = false;
    const timer = setTimeout(() => { if (!settled) setSession(false); }, 6000);
    // Get session on first load
    supabase.auth.getSession().then(({ data: { session } }) => {
      settled = true; clearTimeout(timer);
      setSession(session ?? false);
    }).catch(() => {
      settled = true; clearTimeout(timer);
      setSession(false);
    });
    // Keep session updated (handles token refresh, sign-out from other tab, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      settled = true; clearTimeout(timer);
      setSession(session ?? false);
    });
    return () => { clearTimeout(timer); subscription.unsubscribe(); };
  }, []);

  if (session === null) {
    // Loading — show minimal spinner while Supabase checks the stored session
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fafaf8" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#1B6FE8", animation: "pulse 1.2s ease-in-out infinite", animationDelay: `${i * 0.2}s` }} />
          ))}
          <style>{`@keyframes pulse{0%,80%,100%{opacity:.2}40%{opacity:1}}`}</style>
        </div>
      </div>
    );
  }

  if (supabaseConfigured && !session) return <AuthScreen />;

  return <App session={session || null} />;
}

ReactDOM.createRoot(document.getElementById("root")).render(<Root />);

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.replace("/");
        router.refresh();
        return;
      }
      const data = await res.json();
      setError(data.error ?? "No s'ha pogut iniciar sessió");
    } catch {
      setError("Error de connexió");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container login-container">
      <form className="card login-card" onSubmit={handleSubmit}>
        <div className="logo" aria-hidden>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Z"
              fill="white"
            />
            <path
              d="M6 11a6 6 0 0 0 12 0M12 18v3"
              stroke="white"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <h1 className="title">ScribaAI</h1>
        <p className="subtitle">Introdueix la contrasenya per continuar.</p>

        <input
          type="password"
          className="password-input"
          placeholder="Contrasenya"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          autoComplete="current-password"
        />

        <button type="submit" className="btn primary" disabled={loading}>
          {loading ? "Entrant…" : "Entrar"}
        </button>

        {error && <div className="error">{error}</div>}
      </form>
    </main>
  );
}

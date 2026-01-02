"use client";

import { useState } from "react";

type Player = { id: string; nickname: string; points: number; room_id?: string };

async function fetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  try {
    const res = await fetch(input, init);
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, status: res.status, error: (json as any)?.error ?? "REQUEST_FAILED" };
    }
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, status: 0, error: "NETWORK_ERROR" };
  }
}

export function JoinNickname({
  disabled,
  onJoined,
  joinMode
}: {
  disabled?: boolean;
  onJoined: (data: { sessionToken: string; player: Player }) => void;
  joinMode?: { type: "global" } | { type: "room"; code: string };
}) {
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const mode = joinMode?.type ?? "global";
    const url = mode === "room" ? "/api/rooms/join" : "/api/join";
    const body =
      mode === "room"
        ? { nickname, code: (joinMode as any).code }
        : { nickname };

    const res = await fetchJson<{ sessionToken: string; player: Player }>(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    setLoading(false);

    if (!res.ok) {
      if (res.error === "NICKNAME_TAKEN") setError("Ese nickname ya está cogido.");
      else if (res.error === "INVALID_NICKNAME") setError("Nickname inválido (3-24, letras/números, espacios, _ o -).");
      else setError(res.error);
      return;
    }

    try {
      localStorage.setItem("st", res.data.sessionToken);
    } catch {}

    onJoined(res.data);
  }

  return (
    <section className="card">
      <h2 style={{ margin: 0, fontSize: 18 }}>Elige tu nickname</h2>
      <p style={{ margin: "8px 0 0", color: "var(--muted)", lineHeight: 1.5 }}>
        3-24 caracteres. Letras/números, espacios, _ o -.
      </p>

      <form onSubmit={onSubmit} style={{ marginTop: 12, display: "grid", gap: 10 }}>
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="mi_nickname"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          disabled={disabled || loading}
          style={{
            padding: "12px 12px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--field-bg)",
            color: "var(--text)",
            outline: "none"
          }}
        />
        <button
          type="submit"
          disabled={disabled || loading}
          style={{
            padding: "12px 12px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--field-bg-strong)",
            color: "var(--text)",
            fontWeight: 800
          }}
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
        {error ? <div style={{ color: "var(--danger)", fontSize: 14 }}>{error}</div> : null}
      </form>
    </section>
  );
}

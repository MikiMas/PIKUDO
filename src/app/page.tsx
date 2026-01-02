"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

async function fetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  try {
    const res = await fetch(input, init);
    const json = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, status: res.status, error: (json as any)?.error ?? "REQUEST_FAILED" };
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, status: 0, error: "NETWORK_ERROR" };
  }
}

export default function LandingPage() {
  const [nickname, setNickname] = useState("");
  const [roomName, setRoomName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const placeholderName = useMemo(() => {
    const d = new Date();
    return `Pikudo ${d.getFullYear()}`;
  }, []);

  async function onContinue() {
    setLoading(true);
    setError(null);
    try {
      if (!nickname.trim()) {
        setError("Pon tu nickname");
        return;
      }
      if (!roomName.trim()) {
        setError("Pon el nombre de la sala");
        return;
      }

      const res = await fetchJson<{
        ok: true;
        room: { code: string };
        sessionToken: string;
      }>("/api/rooms/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nickname, roomName, rounds: 4 })
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }

      try {
        localStorage.setItem("st", res.data.sessionToken);
        localStorage.setItem("draft.nickname", nickname.trim());
        localStorage.setItem("draft.roomName", roomName.trim());
      } catch {}

      window.location.href = `/setup/${encodeURIComponent(res.data.room.code)}`;
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <section className="card coverCard">
        <div className="coverTitle">
          <div className="brandHero" style={{ fontSize: 26 }}>
            Pikudo
          </div>
          <div style={{ marginTop: 6, color: "var(--muted)", lineHeight: 1.4, fontWeight: 700 }}>
            Crea una sala, invita y comparte las fotos.
          </div>
        </div>

        <div className="coverMedia" aria-hidden="true">
          <Image
            src="/foto_portada.png"
            alt=""
            fill
            priority
            sizes="(max-width: 920px) 100vw, 920px"
            style={{ objectFit: "contain" }}
          />
        </div>
      </section>

      <section className="card">
        <h1 style={{ margin: 0, fontSize: 22 }}>Crear sala</h1>
        <p style={{ margin: "8px 0 0", color: "var(--muted)", lineHeight: 1.5 }}>
          Escribe tu nickname y el nombre de la sala. En el siguiente paso eliges el horario y podrás invitar con un
          enlace.
        </p>
      </section>

      {error ? (
        <section className="card" style={{ borderColor: "rgba(254, 202, 202, 0.35)" }}>
          <div style={{ color: "#fecaca", fontSize: 14 }}>
            Error: <strong>{error}</strong>
          </div>
        </section>
      ) : null}

      <section className="card">
        <h2 style={{ margin: 0, fontSize: 18 }}>Tu nickname</h2>
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="mi_nickname"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          disabled={loading}
          style={{
            marginTop: 10,
            width: "100%",
            padding: "12px 12px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--field-bg)",
            color: "var(--text)",
            outline: "none"
          }}
        />
        <p style={{ margin: "8px 0 0", color: "var(--muted)", lineHeight: 1.4, fontSize: 13 }}>
          3-24 caracteres. Letras/números, espacios, _ o -.
        </p>
      </section>

      <section className="card">
        <h2 style={{ margin: 0, fontSize: 18 }}>Nombre de la sala</h2>
        <input
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          placeholder={placeholderName}
          disabled={loading}
          style={{
            marginTop: 10,
            width: "100%",
            padding: "12px 12px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--field-bg)",
            color: "var(--text)",
            outline: "none",
            fontWeight: 900
          }}
        />
        <button
          onClick={onContinue}
          disabled={loading}
          style={{
            marginTop: 12,
            width: "100%",
            padding: "12px 12px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--field-bg-strong)",
            color: "var(--text)",
            fontWeight: 900
          }}
        >
          {loading ? "..." : "Continuar"}
        </button>
      </section>
    </>
  );
}

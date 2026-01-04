"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { LoadingScreen } from "@/components/app/LoadingScreen";
import { AdSlot } from "@/components/app/AdSlot";

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

type Player = { id: string; nickname: string; points: number };

export default function SetupRoomPage() {
  const params = useParams<{ code: string }>();
  const code = (params?.code ?? "").toUpperCase();

  const [roomName, setRoomName] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [shareNotSupported, setShareNotSupported] = useState(false);
  const [starting, setStarting] = useState(false);
  const [inviter, setInviter] = useState<string>("");
  const [ready, setReady] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [rounds, setRounds] = useState(4);

  const inviteLink = useMemo(() => {
    if (!code) return "";
    if (typeof window === "undefined") return "";
    const url = new URL(`${window.location.origin}/room/${code}`);
    const from = inviter.trim();
    if (from) url.searchParams.set("from", from);
    return url.toString();
  }, [code, inviter]);

  useEffect(() => {
    try {
      setRoomName(localStorage.getItem("draft.roomName") ?? "");
    } catch {}
    try {
      setInviter(localStorage.getItem("draft.nickname") ?? "");
    } catch {}
    try {
      const r = Number(localStorage.getItem("draft.rounds") ?? "");
      if (Number.isFinite(r) && r >= 1 && r <= 10) setRounds(Math.floor(r));
    } catch {}

    try {
      setShareNotSupported(!(typeof navigator !== "undefined" && "share" in navigator));
    } catch {
      setShareNotSupported(true);
    }
  }, []);

  useEffect(() => {
    if (!code) return;
    (async () => {
      setReady(false);
      const res = await fetchJson<{ ok: true; room: { name: string | null; rounds?: number } }>(
        `/api/rooms/info?code=${encodeURIComponent(code)}`
      );
      if (!res.ok) {
        setReady(true);
        return;
      }
      const n = (res.data as any)?.room?.name;
      if (typeof n === "string") setRoomName(n.trim());
      const rr = (res.data as any)?.room?.rounds;
      if (typeof rr === "number" && Number.isFinite(rr) && rr >= 1 && rr <= 10) setRounds(Math.floor(rr));
      setReady(true);
    })();
  }, [code]);

  useEffect(() => {
    (async () => {
      const me = await fetchJson<{ ok: true; role: string }>("/api/rooms/me", { cache: "no-store" });
      if (!me.ok) return;
      setIsOwner(String((me.data as any)?.role ?? "") === "owner");
    })();
  }, []);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;

    async function refreshPlayers() {
      const res = await fetchJson<{ ok: true; players: Player[] }>(`/api/rooms/players?code=${encodeURIComponent(code)}`, {
        cache: "no-store"
      });
      if (cancelled) return;
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setPlayers((res.data as any).players ?? []);
    }

    refreshPlayers().catch(() => {});
    const id = setInterval(() => refreshPlayers().catch(() => {}), 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [code]);

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteLink);
    } catch {
      const el = document.createElement("textarea");
      el.value = inviteLink;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
  }

  async function shareInvite() {
    try {
      if (!inviteLink) return;
      if (typeof navigator !== "undefined" && "share" in navigator) {
        await (navigator as any).share({
          title: `Sala ${roomName || code}`.trim(),
          text: "Únete a mi sala:",
          url: inviteLink
        });
        return;
      }
    } catch {
      return;
    }

    await copyInvite();
  }

  async function startGame() {
    if (!isOwner) return;
    if (!code) return;

    setStarting(true);
    setError(null);
    try {
      const name = roomName.trim();
      if (name) {
        const rename = await fetchJson<{ ok: true; room: { code: string; name: string } }>("/api/rooms/rename", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code, name })
        });
        if (!rename.ok) {
          setError(rename.error);
          return;
        }
      }

      const roundsRes = await fetchJson<{ ok: true; room: { code: string; rounds: number } }>("/api/rooms/rounds", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, rounds })
      });
      if (!roundsRes.ok && roundsRes.status !== 409) {
        setError(roundsRes.error);
        return;
      }

      const startRes = await fetchJson<{ ok: true; startsAt: string; endsAt: string }>("/api/rooms/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code })
      });
      if (!startRes.ok && startRes.status !== 409) {
        setError(startRes.error);
        return;
      }

      window.location.href = `/room/${encodeURIComponent(code)}`;
    } finally {
      setStarting(false);
    }
  }

  async function closeRoom() {
    if (!isOwner) return;
    if (!code) return;

    const ok = typeof window !== "undefined" ? window.confirm("¿Cerrar la sala y borrar todo?") : false;
    if (!ok) return;

    setStarting(true);
    setError(null);
    try {
      const res = await fetchJson<{ ok: true }>("/api/rooms/close", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code })
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      window.location.href = "/";
    } finally {
      setStarting(false);
    }
  }

  if (!ready) return <LoadingScreen title="Cargando configuración…" />;

  const totalMinutes = rounds * 30;
  const totalHours = Math.floor(totalMinutes / 60);
  const restMinutes = totalMinutes % 60;
  const totalLabel = totalHours > 0 ? `${totalHours}h ${restMinutes}m` : `${restMinutes}m`;

  return (
    <>
      <section className="card">
        <h1 style={{ margin: 0, fontSize: 22 }}>Configurar sala</h1>
        <p style={{ margin: "8px 0 0", color: "var(--muted)", lineHeight: 1.5 }}>
          {isOwner ? "Ajusta el nombre y la duración y luego empieza la partida." : "Espera a que el admin configure y empiece la partida."}
        </p>
      </section>

      {error ? (
        <section className="card" style={{ borderColor: "rgba(254, 202, 202, 0.35)" }}>
          <div style={{ color: "var(--danger)", fontSize: 14 }}>
            Error: <strong>{error}</strong>
          </div>
        </section>
      ) : null}

      <section className="card">
        <h2 style={{ margin: 0, fontSize: 18 }}>Sala</h2>
        <input
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          placeholder={`PIKUDO ${new Date().getFullYear()}`}
          disabled={!isOwner || starting}
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
        <div className="row" style={{ marginTop: 10 }}>
          <span className="pill" style={{ width: "100%", justifyContent: "space-between" }}>
            <strong>Código</strong> {code || ""}
          </span>
        </div>
      </section>

      {isOwner ? (
        <section className="card">
          <h2 style={{ margin: 0, fontSize: 18 }}>Duración</h2>
          <p style={{ margin: "8px 0 0", color: "var(--muted)", lineHeight: 1.5 }}>
            Cada ronda dura 30 minutos. Total: <strong style={{ color: "var(--text)" }}>{totalLabel}</strong>
          </p>
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <span className="pill">
                <strong>Rondas</strong> {rounds}
              </span>
              <select
                value={rounds}
                onChange={(e) => setRounds(Number(e.target.value))}
                disabled={starting}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "var(--field-bg)",
                  color: "var(--text)",
                  fontWeight: 900
                }}
              >
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={startGame}
              disabled={starting}
              style={{
                padding: "12px 12px",
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "var(--field-bg-strong)",
                color: "var(--text)",
                fontWeight: 900,
                opacity: starting ? 0.7 : 1
              }}
            >
              {starting ? "Empezando..." : "Empezar partida"}
            </button>
            <button
              onClick={closeRoom}
              disabled={starting}
              style={{
                padding: "12px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255, 59, 59, 0.35)",
                background: "rgba(255, 59, 59, 0.12)",
                color: "var(--text)",
                fontWeight: 900,
                opacity: starting ? 0.7 : 1
              }}
            >
              Cerrar sala (borrar todo)
            </button>
          </div>
        </section>
      ) : null}

      <section className="card">
        <h2 style={{ margin: 0, fontSize: 18 }}>Invitar</h2>
        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          <div className="pill" style={{ justifyContent: "space-between", width: "100%" }}>
            <strong>Enlace</strong>
            <span style={{ wordBreak: "break-all" }}>{inviteLink}</span>
          </div>
          <button
            onClick={shareInvite}
            style={{
              padding: "12px 12px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--field-bg-strong)",
              color: "var(--text)",
              fontWeight: 900
            }}
          >
            {shareNotSupported ? "Copiar para compartir" : "Compartir enlace"}
          </button>
          <button
            onClick={copyInvite}
            style={{
              padding: "12px 12px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "rgba(244, 247, 245, 0.06)",
              color: "var(--text)",
              fontWeight: 900
            }}
          >
            Copiar enlace
          </button>
          {!isOwner ? (
            <button
              onClick={() => {
                window.location.href = `/room/${code}`;
              }}
              style={{
                padding: "12px 12px",
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "rgba(244, 247, 245, 0.06)",
                color: "var(--text)",
                fontWeight: 900
              }}
            >
              Entrar a la sala
            </button>
          ) : null}
        </div>
      </section>

      <section className="card">
        <h2 style={{ margin: 0, fontSize: 18 }}>Jugadores ({players.length})</h2>
        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          {players.length === 0 ? (
            <div style={{ color: "var(--muted)", fontSize: 14 }}>Aún no ha entrado nadie.</div>
          ) : (
            players.map((p) => (
              <div key={p.id} className="pill" style={{ justifyContent: "space-between", width: "100%" }}>
                <span style={{ fontWeight: 900 }}>{p.nickname}</span>
                <span style={{ color: "var(--muted)" }}>{p.points} pts</span>
              </div>
            ))
          )}
        </div>
      </section>

      <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_SETUP ?? ""} className="card" />
    </>
  );
}

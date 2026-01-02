"use client";

import { useEffect, useMemo, useState } from "react";
import { TimeBlockCard } from "@/components/TimeBlockCard";

type Player = { id: string; nickname: string; points: number; created_at: string };
type CompletedItem = {
  id: string;
  title: string;
  description: string;
  completedAt: string | null;
  blockStart: string;
  media: { path: string; mime: string; url: string | null } | null;
};

async function fetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string; hint?: string }> {
  try {
    const res = await fetch(input, init);
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: (json as any)?.error ?? "REQUEST_FAILED",
        hint: (json as any)?.hint
      };
    }
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, status: 0, error: "NETWORK_ERROR" };
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString();
}

export default function AdminPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [completed, setCompleted] = useState<CompletedItem[]>([]);
  const [gameStatus, setGameStatus] = useState<string>("running");
  const [blockStart, setBlockStart] = useState<string>("");
  const [nextBlockInSec, setNextBlockInSec] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const title = useMemo(() => "Admin", []);

  async function loadPlayers() {
    setError(null);
    setHint(null);
    const res = await fetchJson<{ ok: true; players: Player[] }>("/api/admin/players", { cache: "no-store" });
    if (!res.ok) {
      setError(res.error);
      if (res.hint) setHint(res.hint);
      return;
    }
    setPlayers(res.data.players ?? []);
  }

  async function loadOverview() {
    setError(null);
    setHint(null);
    const res = await fetchJson<{
      ok: true;
      blockStart: string;
      nextBlockInSec: number;
      gameStatus: string;
    }>("/api/admin/overview", { cache: "no-store" });
    if (!res.ok) {
      setError(res.error);
      if (res.hint) setHint(res.hint);
      return;
    }
    setGameStatus(res.data.gameStatus ?? "running");
    setBlockStart(res.data.blockStart ?? "");
    setNextBlockInSec(res.data.nextBlockInSec ?? 0);
  }

  async function selectPlayer(player: Player) {
    setSelectedId(player.id);
    setSelectedPlayer(player);
    setCompleted([]);
    setLoading(true);
    setError(null);
    setHint(null);
    try {
      const res = await fetchJson<{
        ok: true;
        player: Player;
        completed: CompletedItem[];
      }>(`/api/admin/player?playerId=${encodeURIComponent(player.id)}`, { cache: "no-store" });
      if (!res.ok) {
        setError(res.error);
        if (res.hint) setHint(res.hint);
        return;
      }
      setSelectedPlayer(res.data.player);
      setCompleted(res.data.completed ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function onToggle() {
    setLoading(true);
    setError(null);
    setHint(null);
    try {
      const res = await fetchJson<{ ok: true; gameStatus: string }>("/api/admin/toggle", { method: "POST" });
      if (!res.ok) {
        setError(res.error);
        if (res.hint) setHint(res.hint);
        return;
      }
      setGameStatus(res.data.gameStatus);
    } finally {
      setLoading(false);
    }
  }

  async function onReject(playerChallengeId: string) {
    setLoading(true);
    setError(null);
    setHint(null);
    try {
      const res = await fetchJson<{ ok: true; points: number; rejectedNow: boolean; playerId: string | null }>(
        "/api/admin/reject",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ playerChallengeId })
        }
      );
      if (!res.ok) {
        setError(res.error);
        if (res.hint) setHint(res.hint);
        return;
      }
      if (!res.data.rejectedNow) return;

      setSelectedPlayer((p) => (p ? { ...p, points: res.data.points } : p));
      setPlayers((ps) => ps.map((p) => (p.id === res.data.playerId ? { ...p, points: res.data.points } : p)));
      setCompleted((items) => items.filter((i) => i.id !== playerChallengeId));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOverview().catch(() => {});
    loadPlayers().catch(() => {});
  }, []);

  return (
    <>
      <section className="card">
        <h1 style={{ margin: 0, fontSize: 22 }}>{title}</h1>
        <p style={{ margin: "8px 0 0", color: "var(--muted)", lineHeight: 1.5 }}>
          Jugadores por ranking → entra en uno para ver tareas completadas y validar media.
        </p>
      </section>

      <TimeBlockCard />

      <section className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="pill">
            <strong>Estado</strong> {gameStatus}
          </div>
          <button
            onClick={onToggle}
            disabled={loading}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "rgba(34, 197, 94, 0.18)",
              color: "var(--text)",
              fontWeight: 800
            }}
          >
            {gameStatus?.toLowerCase() === "paused" ? "Resume" : "Pause"}
          </button>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <span className="pill">
            <strong>block_start</strong> {blockStart || "—"}
          </span>
          <span className="pill">
            <strong>siguiente</strong> {nextBlockInSec}s
          </span>
          <button
            onClick={() => {
              loadOverview().catch(() => {});
              loadPlayers().catch(() => {});
              if (selectedPlayer) selectPlayer(selectedPlayer).catch(() => {});
            }}
            disabled={loading}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "rgba(255,255,255,0.06)",
              color: "var(--text)",
              fontWeight: 800
            }}
          >
            Refrescar
          </button>
        </div>
        {error ? <div style={{ color: "#fecaca", fontSize: 14, marginTop: 10 }}>{error}</div> : null}
        {hint ? <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>{hint}</div> : null}
      </section>

      {!selectedId ? (
        <section className="card">
          <h2 style={{ margin: 0, fontSize: 18 }}>Players (ranking)</h2>
          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            {players.map((p, idx) => (
              <button
                key={p.id}
                onClick={() => selectPlayer(p)}
                style={{
                  textAlign: "left",
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "rgba(0,0,0,0.18)",
                  color: "var(--text)"
                }}
              >
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                    <div style={{ width: 28, color: "var(--muted)", fontSize: 13, fontWeight: 800 }}>#{idx + 1}</div>
                    <div style={{ fontWeight: 900 }}>{p.nickname}</div>
                  </div>
                  <div className="pill">
                    <strong>{p.points}</strong>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <>
          <section className="card">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div style={{ fontWeight: 900, fontSize: 18 }}>{selectedPlayer?.nickname}</div>
                <button
                  onClick={() => {
                    setSelectedId(null);
                    setSelectedPlayer(null);
                    setCompleted([]);
                  }}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--field-bg)",
                    color: "var(--text)",
                    fontWeight: 800
                  }}
                >
                  Volver
                </button>
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <span className="pill">
                <strong>Puntos</strong> {selectedPlayer?.points ?? 0}
              </span>
              <span className="pill">
                <strong>Completadas</strong> {completed.length}
              </span>
            </div>
          </section>

          <section className="card">
            <h2 style={{ margin: 0, fontSize: 18 }}>Tareas completadas</h2>
            <p style={{ margin: "8px 0 0", color: "var(--muted)", lineHeight: 1.5 }}>
              Ordenadas por fecha de completado. Si no es válida, resta 1 punto y descompleta la tarea.
            </p>
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {completed.map((c) => (
                <div
                  key={c.id}
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--field-bg)"
                  }}
                >
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <div style={{ fontWeight: 900 }}>{c.title}</div>
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>{formatDate(c.completedAt)}</div>
                  </div>
                  {c.description ? (
                    <div style={{ marginTop: 6, color: "var(--muted)", lineHeight: 1.45 }}>{c.description}</div>
                  ) : null}

                  <div style={{ marginTop: 10 }}>
                    {c.media?.url ? (
                      c.media.mime.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.media.url}
                          alt="media"
                          style={{ width: "100%", borderRadius: 12, border: "1px solid var(--border)" }}
                        />
                      ) : (
                        <video
                          src={c.media.url}
                          controls
                          style={{ width: "100%", borderRadius: 12, border: "1px solid var(--border)" }}
                        />
                      )
                    ) : (
                      <div style={{ color: "var(--muted)", fontSize: 13 }}>
                        Sin media o no se pudo generar URL (bucket/permiso).
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => onReject(c.id)}
                    disabled={loading}
                    style={{
                      marginTop: 10,
                      width: "100%",
                      padding: "12px 12px",
                      borderRadius: 12,
                      border: "1px solid rgba(254, 202, 202, 0.35)",
                      background: "rgba(239, 68, 68, 0.16)",
                      color: "var(--text)",
                      fontWeight: 900
                    }}
                  >
                    Restar 1 punto (invalidar)
                  </button>
                </div>
              ))}
              {completed.length === 0 ? (
                <div style={{ color: "var(--muted)", fontSize: 14 }}>No hay tareas completadas.</div>
              ) : null}
            </div>
          </section>
        </>
      )}
    </>
  );
}

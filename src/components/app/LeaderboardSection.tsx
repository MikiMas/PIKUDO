"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Leader = { nickname: string; points: number };

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

export function LeaderboardSection({
  authHeaders,
  onNeedsAuthReset,
  refreshSignal
}: {
  authHeaders: Record<string, string>;
  onNeedsAuthReset: () => void;
  refreshSignal: string;
}) {
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const visible = useMemo(() => leaders.slice(0, 50), [leaders]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetchJson<{ ok: true; leaders: Leader[] }>("/api/leaderboard", {
      headers: { ...authHeaders },
      cache: "no-store"
    });
    setLoading(false);

    if (!res.ok) {
      if (res.status === 401) {
        onNeedsAuthReset();
        return;
      }
      setError(res.error);
      return;
    }

    setLeaders(res.data.leaders ?? []);
  }, [authHeaders, onNeedsAuthReset]);

  useEffect(() => {
    load().catch(() => {});
  }, [load, refreshSignal]);

  useEffect(() => {
    const id = setInterval(() => load().catch(() => {}), 8000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <section className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Ranking</h2>
        <button
          onClick={() => load()}
          disabled={loading}
          style={{
            padding: "8px 10px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--field-bg)",
            color: "var(--text)",
            fontWeight: 700
          }}
        >
          {loading ? "..." : "Actualizar"}
        </button>
      </div>

      {error ? <div style={{ marginTop: 10, color: "var(--danger)", fontSize: 14 }}>{error}</div> : null}

      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        {visible.map((l, idx) => {
          const rank = idx + 1;
          const isTop3 = rank <= 3;
          const bg =
            rank === 1
              ? "linear-gradient(135deg, rgba(250,204,21,0.22), rgba(255,255,255,0.70))"
              : rank === 2
                ? "linear-gradient(135deg, rgba(148,163,184,0.22), rgba(255,255,255,0.70))"
                : rank === 3
                  ? "linear-gradient(135deg, rgba(245,158,11,0.20), rgba(255,255,255,0.70))"
                  : "var(--field-bg)";

          const borderColor =
            rank === 1
              ? "rgba(250, 204, 21, 0.45)"
              : rank === 2
                ? "rgba(148, 163, 184, 0.45)"
                : rank === 3
                  ? "rgba(245, 158, 11, 0.35)"
                  : "var(--border)";

          return (
            <div
              key={`${l.nickname}-${idx}`}
              style={{
                padding: rank === 1 ? 16 : rank === 2 ? 15 : rank === 3 ? 14 : 10,
                borderRadius: 14,
                border: `1px solid ${borderColor}`,
                background: bg,
                overflow: "hidden"
              }}
            >
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                  <div
                    style={{
                      width: isTop3 ? 30 : 28,
                      color: "var(--muted)",
                      fontSize: rank === 1 ? 16 : rank === 2 ? 15 : rank === 3 ? 14 : 13,
                      fontWeight: 800
                    }}
                  >
                    #{rank}
                  </div>
                  <div
                    style={{
                      fontWeight: isTop3 ? 900 : 700,
                      fontSize: rank === 1 ? 20 : rank === 2 ? 19 : rank === 3 ? 18 : 15
                    }}
                  >
                    {l.nickname}
                  </div>
                </div>
                <div
                  className="pill"
                  style={{
                    fontSize: rank === 1 ? 16 : rank === 2 ? 15 : rank === 3 ? 15 : 14,
                    borderColor: borderColor,
                    background: "rgba(8, 22, 17, 0.65)",
                    color: "rgba(244, 247, 245, 0.92)"
                  }}
                >
                  <strong style={{ color: "var(--accent)" }}>{l.points}</strong>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

"use client";

import { useMemo } from "react";

type Player = { nickname: string; points: number };

function formatMMSS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function AppHeader({
  player,
  nextBlockInSec,
  paused,
  showGameStatus = true,
  onRetry
}: {
  player: Player | null;
  nextBlockInSec: number;
  paused: boolean;
  showGameStatus?: boolean;
  onRetry: () => void;
}) {
  const countdown = useMemo(() => formatMMSS(nextBlockInSec), [nextBlockInSec]);

  return (
    <section className="card" style={{ marginTop: 16 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{player ? player.nickname : "Pikudo"}</div>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>
            {player ? (
              <>
                Puntos: <strong style={{ color: "var(--text)" }}>{player.points}</strong>
              </>
            ) : (
              "Accede con tu nickname"
            )}
          </div>
        </div>

        <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
          {showGameStatus ? (
            <div className="pill">
              <strong>Próximos retos</strong> {countdown}
            </div>
          ) : null}
          <div className="row" style={{ justifyContent: "flex-end" }}>
            {showGameStatus && paused ? (
              <span className="pill" style={{ borderColor: "rgba(250, 204, 21, 0.35)" }}>
                <strong>PAUSA</strong>
              </span>
            ) : null}
            <button
              onClick={onRetry}
              style={{
                padding: "8px 10px",
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "var(--field-bg)",
                color: "var(--text)",
                fontWeight: 700
              }}
            >
              Refrescar
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

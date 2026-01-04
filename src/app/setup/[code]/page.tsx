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
  const [saving, setSaving] = useState(false);
  const [inviter, setInviter] = useState<string>("");
  const [ready, setReady] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [rounds, setRounds] = useState(4);
  const [savingRounds, setSavingRounds] = useState(false);

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

  async function saveRoomName() {
    setSaving(true);
    setError(null);
    try {
      const name = roomName.trim();
      const res = await fetchJson<{ ok: true; room: { code: string; name: string } }>("/api/rooms/rename", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, name })
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }

      try {
        localStorage.setItem("draft.roomName", name);
      } catch {}
    } finally {
      setSaving(false);
    }
  }

  async function saveRounds() {
    setSavingRounds(true);
    setError(null);
    try {
      const res = await fetchJson<{ ok: true; room: { code: string; rounds: number } }>("/api/rooms/rounds", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, rounds })
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      try {
        localStorage.setItem("draft.rounds", String(rounds));
      } catch {}
    } finally {
      setSavingRounds(false);
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
          Ponle un nombre, comparte el enlace y entra a la sala cuando estéis listos.
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
          placeholder={`Pikudo ${new Date().getFullYear()}`}
          disabled={saving}
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
        <div className="row" style={{ marginTop: 10, justifyContent: "space-between", alignItems: "stretch" }}>
          <span className="pill" style={{ flex: 1, justifyContent: "space-between" }}>
            <strong>Código</strong> {code || ""}
          </span>
          <button
            onClick={saveRoomName}
            disabled={saving || !roomName.trim()}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--field-bg-strong)",
              color: "var(--text)",
              fontWeight: 900,
              opacity: saving || !roomName.trim() ? 0.7 : 1,
              whiteSpace: "nowrap"
            }}
          >
            {saving ? "Guardando..." : "Guardar nombre"}
          </button>
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
                disabled={savingRounds}
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
              onClick={saveRounds}
              disabled={savingRounds}
              style={{
                padding: "12px 12px",
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "var(--field-bg-strong)",
                color: "var(--text)",
                fontWeight: 900,
                opacity: savingRounds ? 0.7 : 1
              }}
            >
              {savingRounds ? "Guardando..." : "Guardar duración"}
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

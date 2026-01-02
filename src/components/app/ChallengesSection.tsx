"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type ChallengeCard = { id: string; title: string; description: string; completed: boolean; hasMedia?: boolean };

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

export function ChallengesSection({
  authHeaders,
  blockStart,
  onPointsUpdate,
  onNeedsAuthReset,
  onRefreshAll
}: {
  authHeaders: Record<string, string>;
  blockStart: string | null;
  onPointsUpdate: (points: number) => void;
  onNeedsAuthReset: () => void;
  onRefreshAll: () => Promise<any> | void;
}) {
  const [challenges, setChallenges] = useState<ChallengeCard[]>([]);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [mediaPreviewById, setMediaPreviewById] = useState<Record<string, { url: string; mime: string }>>({});

  const completedCount = useMemo(() => challenges.filter((c) => c.completed).length, [challenges]);
  const title = useMemo(() => `Tus retos (${completedCount}/${challenges.length || 3})`, [completedCount, challenges.length]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetchJson<
      | { paused: true; nextBlockInSec: number; blockStart: string }
      | { paused: false; nextBlockInSec: number; blockStart: string; challenges: ChallengeCard[] }
    >("/api/challenges", { headers: { ...authHeaders }, cache: "no-store" });
    setLoading(false);

    if (!res.ok) {
      if (res.status === 401) {
        onNeedsAuthReset();
        return;
      }
      setError(res.error);
      return;
    }

    setPaused(res.data.paused);
    setChallenges(res.data.paused ? [] : res.data.challenges);
  }, [authHeaders, onNeedsAuthReset]);

  useEffect(() => {
    load().catch(() => {});
  }, [load, blockStart]);

  async function complete(id: string) {
    setError(null);
    const res = await fetchJson<{ ok: true; points: number; completedNow: boolean }>("/api/complete", {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders },
      body: JSON.stringify({ playerChallengeId: id })
    });

    if (!res.ok) {
      if (res.status === 401) {
        onNeedsAuthReset();
        return;
      }
      setError(res.error);
      return;
    }

    onPointsUpdate(res.data.points);
    setChallenges((prev) => prev.map((c) => (c.id === id ? { ...c, completed: true } : c)));
    await onRefreshAll();
  }

  async function uploadMedia(playerChallengeId: string, file: File) {
    setError(null);
    setUploadingId(playerChallengeId);
    try {
      const urlRes = await fetchJson<{ ok: true; upload: { path: string; token: string; signedUrl: string } }>(
        "/api/upload-url",
        {
          method: "POST",
          headers: { "content-type": "application/json", ...authHeaders },
          body: JSON.stringify({ playerChallengeId, mime: file.type })
        }
      );

      if (!urlRes.ok) {
        if (urlRes.status === 401) {
          onNeedsAuthReset();
          return;
        }
        setError(urlRes.error);
        return;
      }

      const put = await fetch(urlRes.data.upload.signedUrl, {
        method: "PUT",
        headers: { "content-type": file.type },
        body: file
      }).catch(() => null);

      if (!put || !put.ok) {
        setError("UPLOAD_FAILED");
        return;
      }

      const confirmRes = await fetchJson<{ ok: true; media: { url: string; mime: string; type: "image" | "video" } }>(
        "/api/upload-confirm",
        {
          method: "POST",
          headers: { "content-type": "application/json", ...authHeaders },
          body: JSON.stringify({ playerChallengeId, path: urlRes.data.upload.path, mime: file.type })
        }
      );

      if (!confirmRes.ok) {
        if (confirmRes.status === 401) {
          onNeedsAuthReset();
          return;
        }
        setError(confirmRes.error);
        return;
      }

      setChallenges((prev) => prev.map((c) => (c.id === playerChallengeId ? { ...c, hasMedia: true } : c)));
      setMediaPreviewById((m) => ({
        ...m,
        [playerChallengeId]: { url: confirmRes.data.media.url, mime: confirmRes.data.media.mime }
      }));
    } finally {
      setUploadingId((v) => (v === playerChallengeId ? null : v));
    }
  }

  return (
    <section className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2>
        <button
          onClick={() => load()}
          disabled={loading}
          style={{
            padding: "8px 10px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "rgba(255,255,255,0.06)",
            color: "var(--text)",
            fontWeight: 700
          }}
        >
          {loading ? "..." : "Actualizar"}
        </button>
      </div>

      {paused ? (
        <p style={{ margin: "10px 0 0", color: "var(--muted)", lineHeight: 1.5 }}>
          Juego en pausa. No se asignan retos ahora.
        </p>
      ) : null}

      {error ? <div style={{ marginTop: 10, color: "var(--danger)", fontSize: 14 }}>{error}</div> : null}

      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        {paused ? null : challenges.map((c) => (
          <div
            key={c.id}
            style={{
              padding: 12,
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: c.completed ? "var(--success-bg)" : "var(--field-bg)"
            }}
          >
            <div style={{ fontWeight: 800 }}>{c.title}</div>
            <div style={{ marginTop: 6, color: "var(--muted)", lineHeight: 1.45 }}>{c.description}</div>

            <div className="row" style={{ marginTop: 10, justifyContent: "space-between" }}>
              <label style={{ flex: 1 }}>
                <input
                  type="file"
                  accept="image/*"
                  disabled={c.completed || uploadingId === c.id}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    uploadMedia(c.id, f).catch(() => {});
                    e.currentTarget.value = "";
                  }}
                  style={{ display: "none" }}
                />
                <span
                  style={{
                    width: "100%",
                    display: "inline-block",
                    textAlign: "center",
                    padding: "12px 12px",
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--field-bg-strong)",
                    color: "var(--text)",
                    fontWeight: 900,
                    cursor: c.completed ? "not-allowed" : "pointer",
                    opacity: c.completed ? 0.6 : 1
                  }}
                >
                  {uploadingId === c.id ? "Subiendo..." : c.hasMedia ? "Cambiar foto" : "Hacer foto"}
                </span>
              </label>

              <label style={{ flex: 1 }}>
                <input
                  type="file"
                  accept="video/*"
                  disabled={c.completed || uploadingId === c.id}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    uploadMedia(c.id, f).catch(() => {});
                    e.currentTarget.value = "";
                  }}
                  style={{ display: "none" }}
                />
                <span
                  style={{
                    width: "100%",
                    display: "inline-block",
                    textAlign: "center",
                    padding: "12px 12px",
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--success-bg)",
                    color: "var(--text)",
                    fontWeight: 900,
                    cursor: c.completed ? "not-allowed" : "pointer",
                    opacity: c.completed ? 0.6 : 1
                  }}
                >
                  {uploadingId === c.id ? "Subiendo..." : c.hasMedia ? "Cambiar vídeo" : "Grabar vídeo"}
                </span>
              </label>
            </div>

            {mediaPreviewById[c.id] ? (
              <div style={{ marginTop: 10 }}>
                {mediaPreviewById[c.id]!.mime.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mediaPreviewById[c.id]!.url}
                    alt="media"
                    style={{ width: "100%", borderRadius: 12, border: "1px solid var(--border)" }}
                  />
                ) : (
                  <video
                    src={mediaPreviewById[c.id]!.url}
                    controls
                    style={{ width: "100%", borderRadius: 12, border: "1px solid var(--border)" }}
                  />
                )}
              </div>
            ) : null}

            <button
              onClick={() => complete(c.id)}
              disabled={c.completed || !c.hasMedia}
              style={{
                marginTop: 10,
                width: "100%",
                padding: "12px 12px",
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: c.completed || !c.hasMedia ? "var(--field-bg)" : "var(--success-bg)",
                color: "var(--text)",
                fontWeight: 800,
                opacity: c.completed || !c.hasMedia ? 0.7 : 1
              }}
            >
              {c.completed ? "Completado" : c.hasMedia ? "Marcar como completado" : "Sube foto/vídeo para completar"}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

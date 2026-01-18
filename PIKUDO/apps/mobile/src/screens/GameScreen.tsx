import { useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { ActivityIndicator, Alert, Image, Modal, Pressable, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { apiFetchJson, getDeviceId, getSessionToken } from "../lib/api";
import { VideoPreview } from "../components/VideoPreview";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { H2, Muted } from "../ui/Text";
import { theme } from "../ui/theme";
import type { Challenge, Leader, Player, RoomState } from "./roomTypes";

export function GameScreen({
  apiBaseUrl,
  roomCode,
  state,
  isOwner,
  loading,
  error,
  nextBlockInSec,
  challenges,
  leaders,
  player,
  totalRounds,
  roomStartsAt,
  uploadingById,
  uploadErrorById,
  setUploadingById,
  setUploadErrorById,
  setChallenges,
  setNextBlockInSec,
  setState,
  setLeaders,
  onExitHome
}: {
  apiBaseUrl: string;
  roomCode: string;
  state: RoomState;
  isOwner: boolean;
  loading: boolean;
  error: string | null;
  nextBlockInSec: number;
  challenges: Challenge[];
  leaders: Leader[];
  player: Player | null;
  totalRounds: number;
  roomStartsAt: string | null;
  uploadingById: Record<string, boolean>;
  uploadErrorById: Record<string, string | null>;
  setUploadingById: Dispatch<SetStateAction<Record<string, boolean>>>;
  setUploadErrorById: Dispatch<SetStateAction<Record<string, string | null>>>;
  setChallenges: Dispatch<SetStateAction<Challenge[]>>;
  setNextBlockInSec: Dispatch<SetStateAction<number>>;
  setState: Dispatch<SetStateAction<RoomState>>;
  setLeaders: Dispatch<SetStateAction<Leader[]>>;
  onExitHome: () => Promise<void>;
}) {
  const completedCount = useMemo(() => challenges.filter((c) => c.completed).length, [challenges]);
  const nextMinutes = Math.max(1, Math.ceil(nextBlockInSec / 60));
  const nextLabel =
    nextBlockInSec <= 0
      ? "Ahora"
      : nextBlockInSec < 60
        ? `${nextBlockInSec} s`
        : `${nextMinutes} min`;

  const currentRound = useMemo(() => {
    if (!roomStartsAt) return 1;
    const started = new Date(roomStartsAt).getTime();
    if (!Number.isFinite(started)) return 1;
    const now = Date.now();
    const minutes = Math.max(0, Math.floor((now - started) / 60000));
    const round = Math.floor(minutes / 30) + 1;
    return Math.min(Math.max(round, 1), Math.max(totalRounds, 1));
  }, [roomStartsAt, totalRounds]);

  const points = useMemo(() => {
    if (!player?.nickname) return player?.points ?? 0;
    const leader = leaders.find((l) => l.nickname === player.nickname);
    return leader ? leader.points : player?.points ?? 0;
  }, [leaders, player?.nickname, player?.points]);

  const position = useMemo(() => {
    if (!player?.nickname) return null;
    const idx = leaders.findIndex((l) => l.nickname === player.nickname);
    return idx >= 0 ? idx + 1 : null;
  }, [leaders, player?.nickname]);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [previewMedia, setPreviewMedia] = useState<{ url: string; type: "image" | "video" } | null>(null);

  const [uploadProgress, setUploadProgress] = useState<{ id: string; pct: number } | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);

  const mediaTypes = (kind: "all" | "image" | "video") => {
    const ip: any = ImagePicker as any;
    if (ip.MediaType) {
      if (kind === "image") return [ip.MediaType.Images];
      if (kind === "video") return [ip.MediaType.Videos];
      return [ip.MediaType.Images, ip.MediaType.Videos];
    }
    if (kind === "image") return ["images"] as any;
    if (kind === "video") return ["videos"] as any;
    return ["images", "videos"] as any;
  };

  const uploadWithProgress = async (form: FormData, onProgress: (pct: number) => void) => {
    const base = apiBaseUrl.replace(/\/+$/, "");
    const url = `${base}/api/upload`;
    const deviceId = await getDeviceId();
    const session = await getSessionToken();
    return await new Promise<{ ok: boolean; status: number; data: any; error?: string }>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      xhr.setRequestHeader("x-device-id", deviceId);
      if (session) xhr.setRequestHeader("x-session-token", session);
      xhr.onload = () => {
        let json: any = null;
        try {
          json = JSON.parse(xhr.responseText || "null");
        } catch {
          json = null;
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({ ok: true, status: xhr.status, data: json });
        } else {
          resolve({ ok: false, status: xhr.status, data: json, error: (json as any)?.error ?? "REQUEST_FAILED" });
        }
      };
      xhr.onerror = () => resolve({ ok: false, status: 0, data: null, error: "NETWORK_ERROR" });
      xhr.upload.onprogress = (evt) => {
        if (!evt.lengthComputable) return;
        const pct = Math.max(0, Math.min(100, Math.round((evt.loaded / evt.total) * 100)));
        onProgress(pct);
      };
      xhr.send(form as any);
    });
  };

  const handlePickMedia = async (challengeId: string, source: "camera" | "gallery", media: "all" | "image" | "video" = "image") => {
    setUploadErrorById((m) => ({ ...m, [challengeId]: null }));
    if (source === "camera") {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setUploadErrorById((m) => ({ ...m, [challengeId]: "Permiso de camara denegado." }));
        return;
      }
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setUploadErrorById((m) => ({ ...m, [challengeId]: "Permiso de galeria denegado." }));
        return;
      }
    }

    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: mediaTypes(media === "image" ? "image" : media === "video" ? "video" : "all"),
            quality: 0.9,
            videoMaxDuration: 180
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: mediaTypes(media === "image" ? "image" : media === "video" ? "video" : "all"),
            quality: 0.9,
            videoMaxDuration: 180
          });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.uri) return;
    const mime = asset.mimeType || (asset.type === "video" ? "video/mp4" : "image/jpeg");
    const isVideo = mime.startsWith("video/");
    const name = asset.fileName || `reto_${challengeId}.${isVideo ? "mp4" : "jpg"}`;

    setUploadingById((m) => ({ ...m, [challengeId]: true }));
    setUploadProgress({ id: challengeId, pct: 0 });
    try {
      const form = new FormData();
      form.append("playerChallengeId", challengeId);
      form.append("file", { uri: asset.uri, name, type: mime } as any);

      const up = await uploadWithProgress(form, (pct) => {
        setUploadProgress({ id: challengeId, pct });
      });
      if (!up.ok) {
        setUploadErrorById((m) => ({ ...m, [challengeId]: up.error ?? "UPLOAD_FAILED" }));
        return;
      }
      if ((up.data as any)?.ok === false) {
        setUploadErrorById((m) => ({ ...m, [challengeId]: (up.data as any)?.error ?? "UPLOAD_FAILED" }));
        return;
      }

      const done = await apiFetchJson<any>(apiBaseUrl, "/api/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerChallengeId: challengeId })
      });
      if (!done.ok) {
        setUploadErrorById((m) => ({ ...m, [challengeId]: done.error }));
        return;
      }
      if ((done.data as any)?.ok === false) {
        setUploadErrorById((m) => ({ ...m, [challengeId]: (done.data as any)?.error ?? "COMPLETE_FAILED" }));
        return;
      }

      const refreshed = await apiFetchJson<any>(apiBaseUrl, "/api/challenges", { method: "GET" });
      if (refreshed.ok) {
        const data: any = refreshed.data as any;
        setChallenges((data?.challenges ?? []) as any);
        setNextBlockInSec(Number(data?.nextBlockInSec ?? 0) || 0);
        const s = String(data?.state ?? "running") as any;
        if (s === "ended") setState("ended");
        else setState("running");
      }
      const refreshedLeaders = await apiFetchJson<any>(apiBaseUrl, "/api/leaderboard", { method: "GET" });
      if (refreshedLeaders.ok) setLeaders(((refreshedLeaders.data as any)?.leaders ?? []) as any);
    } finally {
      setUploadingById((m) => ({ ...m, [challengeId]: false }));
      setUploadProgress((p) => (p?.id === challengeId ? null : p));
    }
  };

  const handleDeleteMedia = async (challengeId: string) => {
    setUploadErrorById((m) => ({ ...m, [challengeId]: null }));
    setUploadingById((m) => ({ ...m, [challengeId]: true }));
    setUploadProgress({ id: challengeId, pct: 0 });
    try {
      const res = await apiFetchJson<any>(apiBaseUrl, "/api/challenges/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerChallengeId: challengeId })
      });
      if (!res.ok) {
        setUploadErrorById((m) => ({ ...m, [challengeId]: res.error }));
        return;
      }
      if ((res.data as any)?.ok === false) {
        setUploadErrorById((m) => ({ ...m, [challengeId]: (res.data as any)?.error ?? "DELETE_FAILED" }));
        return;
      }

      const refreshed = await apiFetchJson<any>(apiBaseUrl, "/api/challenges", { method: "GET" });
      if (refreshed.ok) {
        const data: any = refreshed.data as any;
        setChallenges((data?.challenges ?? []) as any);
        setNextBlockInSec(Number(data?.nextBlockInSec ?? 0) || 0);
        const s = String(data?.state ?? "running") as any;
        if (s === "ended") setState("ended");
        else setState("running");
      }
      const refreshedLeaders = await apiFetchJson<any>(apiBaseUrl, "/api/leaderboard", { method: "GET" });
      if (refreshedLeaders.ok) setLeaders(((refreshedLeaders.data as any)?.leaders ?? []) as any);
    } finally {
      setUploadingById((m) => ({ ...m, [challengeId]: false }));
      setUploadProgress((p) => (p?.id === challengeId ? null : p));
    }
  };

  const handleAdminAction = async (action: "transfer" | "leave") => {
    if (adminLoading) return;
    setAdminError(null);
    setAdminLoading(true);
    try {
      if (action === "transfer") {
        const res = await apiFetchJson<any>(apiBaseUrl, "/api/rooms/leave-transfer", { method: "POST" });
        if (!res.ok) throw new Error(res.error);
        if ((res.data as any)?.ok === false) throw new Error((res.data as any)?.error ?? "REQUEST_FAILED");
      } else {
        const res = await apiFetchJson<any>(apiBaseUrl, "/api/rooms/leave", { method: "POST" });
        if (!res.ok) throw new Error(res.error);
        if ((res.data as any)?.ok === false) throw new Error((res.data as any)?.error ?? "REQUEST_FAILED");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "REQUEST_FAILED";
      setAdminError(msg);
    } finally {
      setAdminLoading(false);
      setAdminOpen(false);
      await onExitHome();
    }
  };

  const handleAdminEnd = async () => {
    if (adminLoading) return;
    setAdminError(null);
    setAdminLoading(true);
    try {
      const res = await apiFetchJson<any>(apiBaseUrl, "/api/rooms/end", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: roomCode })
      });
      if (!res.ok) throw new Error(res.error);
      if ((res.data as any)?.ok === false) throw new Error((res.data as any)?.error ?? "REQUEST_FAILED");
      setAdminOpen(false);
      setState("ended");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "REQUEST_FAILED";
      setAdminError(msg);
    } finally {
      setAdminLoading(false);
    }
  };

  return (
    <View style={{ gap: 10, position: "relative", paddingTop: 36 }}>
      <Pressable
        onPress={() => {
          setAdminError(null);
          setAdminOpen(true);
        }}
        style={{
          position: "absolute",
          right: 6,
          top: 0,
          zIndex: 20,
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: theme.colors.danger,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: theme.colors.danger,
          elevation: 6
        }}
      >
        <Muted style={{ color: theme.colors.textOnPrimary, fontWeight: "900", fontSize: 16 }}>X</Muted>
      </Pressable>
      <Card style={{ marginBottom: 2 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Muted style={{ color: theme.colors.muted }}>Puntos</Muted>
            <H2>{points}</H2>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Muted style={{ color: theme.colors.muted }}>Puesto</Muted>
            <H2>{position ? `#${position}` : "-"}</H2>
          </View>
        </View>
        {loading ? <Muted style={{ marginTop: 8 }}>Cargando sala...</Muted> : null}
        {error ? <Muted style={{ marginTop: 8, color: theme.colors.danger }}>{error}</Muted> : null}
      </Card>

      <Card style={{ marginBottom: 2 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Muted>Ronda {currentRound} / {Math.max(totalRounds, 1)}</Muted>
          <Muted>Próximos retos en {nextLabel}</Muted>
        </View>
      </Card>

      <View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
          <H2>Retos</H2>
          <Muted>{completedCount} / {challenges.length} completados</Muted>
        </View>
        <View style={{ height: 10 }} />
        {challenges.length === 0 ? (
          <Muted>Cargando retos...</Muted>
        ) : (
          <View>
            {challenges.map((c) => (
              <Card
                key={c.id}
                style={{
                  borderColor: theme.colors.buttonPrimaryBorder,
                  backgroundColor: theme.colors.buttonPrimary,
                  padding: 12,
                  marginBottom: 10,
                  overflow: "hidden"
                }}
              >
                <View
                  style={{
                    backgroundColor: theme.colors.buttonSecondary,
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    margin: -12,
                    marginBottom: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.colors.buttonSecondaryBorder
                  }}
                >
                  <Muted style={{ color: theme.colors.textOnPrimary, fontWeight: "900", textAlign: "center" }}>{c.title}</Muted>
                </View>
                {c.description ? <Muted style={{ marginTop: 6 }}>{c.description}</Muted> : null}
                <Muted style={{ marginTop: 8, fontWeight: "800" }}>{c.completed ? "Completado" : "Pendiente"}</Muted>

                {c.media?.url ? (
                  <View style={{ marginTop: 10, gap: 10 }}>
                    {c.media.type === "video" ? (
                      <VideoPreview url={c.media.url} />
                    ) : (
                      <Image
                        source={{ uri: c.media.url }}
                        style={{
                          width: "100%",
                          height: 240,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: theme.colors.border,
                          backgroundColor: "rgba(0,0,0,0.25)"
                        }}
                        resizeMode="contain"
                      />
                    )}

                    <View style={{ flexDirection: "row", gap: 12, justifyContent: "center", alignItems: "center" }}>
                      <Button
                        variant="secondary"
                        size="sm"
                        fullWidth={false}
                        onPress={() => {
                          if ((c.media?.type === "image" || c.media?.type === "video") && c.media.url) {
                            setPreviewMedia({ url: c.media.url, type: c.media.type });
                          }
                        }}
                      >
                        <Image
                          source={require("../../assets/ojo-abierto.png")}
                          style={{ width: 20, height: 20, tintColor: theme.colors.text }}
                          resizeMode="contain"
                        />
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        fullWidth={false}
                        disabled={Boolean(uploadingById[c.id])}
                        onPress={() => {
                          setConfirmDeleteId(c.id);
                        }}
                      >
                        {uploadingById[c.id] ? (
                          <Image
                            source={require("../../assets/cubo-de-basura.png")}
                            style={{ width: 20, height: 20, tintColor: theme.colors.textOnPrimary, opacity: 0.6 }}
                            resizeMode="contain"
                          />
                        ) : (
                          <Image
                            source={require("../../assets/cubo-de-basura.png")}
                            style={{ width: 20, height: 20, tintColor: theme.colors.textOnPrimary }}
                            resizeMode="contain"
                          />
                        )}
                      </Button>
                    </View>
                  </View>
                ) : null}

                {!c.completed ? (
                  <View style={{ marginTop: 12, gap: 10 }}>
                    <View style={{ flexDirection: "row", gap: 16, justifyContent: "center", alignItems: "center" }}>
                      <View style={{ width: 64 }}>
                        <Button
                          variant="secondary"
                          size="sm"
                          fullWidth
                          disabled={Boolean(uploadingById[c.id])}
                          onPress={() => {
                            handlePickMedia(c.id, "camera", "image");
                          }}
                        >
                          <Image
                            source={require("../../assets/camara.png")}
                            style={{ width: 22, height: 22, tintColor: theme.colors.textOnPrimary }}
                            resizeMode="contain"
                          />
                        </Button>
                      </View>
                      <View style={{ width: 64 }}>
                        <Button
                          variant="secondary"
                          size="sm"
                          fullWidth
                          disabled={Boolean(uploadingById[c.id])}
                          onPress={async () => {
                            await handlePickMedia(c.id, "gallery", "image");
                          }}
                        >
                          <Image
                            source={require("../../assets/galeria-de-imagenes.png")}
                            style={{ width: 22, height: 22, tintColor: theme.colors.textOnPrimary }}
                            resizeMode="contain"
                          />
                        </Button>
                      </View>
                    </View>

                    {uploadingById[c.id] ? <Muted>Subiendo reto...</Muted> : null}
                    {uploadErrorById[c.id] ? <Muted style={{ color: theme.colors.danger }}>{uploadErrorById[c.id]}</Muted> : null}
                  </View>
                ) : null}
              </Card>
            ))}
          </View>
        )}
      </View>

      <Card
        style={{
          marginTop: 6,
          borderColor: "rgba(60,140,255,0.35)",
          backgroundColor: "rgba(10,24,44,0.92)"
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <H2>Ranking</H2>
        </View>
        <View style={{ height: 12 }} />
        {leaders.length === 0 ? (
          <Muted>Cargando ranking...</Muted>
        ) : (
          <View style={{ gap: 10 }}>
            {leaders.slice(0, 10).map((l, idx) => (
              <View
                key={`${l.nickname}-${idx}`}
                style={{
                  borderWidth: 1,
                  borderColor:
                    idx === 0
                      ? "rgba(255,214,102,0.75)"
                      : idx === 1
                        ? "rgba(190,205,224,0.7)"
                        : idx === 2
                          ? "rgba(255,176,120,0.7)"
                          : "rgba(90,140,190,0.35)",
                  borderRadius: 16,
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  backgroundColor:
                    idx === 0
                      ? "rgba(255,214,102,0.18)"
                      : idx === 1
                        ? "rgba(190,205,224,0.16)"
                        : idx === 2
                          ? "rgba(255,176,120,0.16)"
                          : "rgba(16,34,64,0.85)",
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 999,
                      backgroundColor:
                        idx === 0
                          ? "rgba(255,214,102,0.95)"
                          : idx === 1
                            ? "rgba(190,205,224,0.95)"
                            : idx === 2
                              ? "rgba(255,176,120,0.95)"
                              : "rgba(255,255,255,0.12)",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    <Muted style={{ color: "#0b1220", fontWeight: "900" }}>{idx + 1}</Muted>
                  </View>
                  <Muted style={{ color: theme.colors.text, fontWeight: "900" }}>{l.nickname}</Muted>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Muted style={{ color: "rgba(140,200,255,0.9)", fontWeight: "700" }}>pts</Muted>
                  <Muted style={{ fontWeight: "900", fontSize: 16 }}>{l.points}</Muted>
                </View>
              </View>
            ))}
          </View>
        )}
      </Card>
      <Modal transparent visible={adminOpen} animationType="fade" onRequestClose={() => setAdminOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", padding: 16, justifyContent: "center" }}
          onPress={() => {
            if (!adminLoading) setAdminOpen(false);
          }}
        >
          <Pressable onPress={() => {}}>
            <Card>
              <Muted style={{ color: theme.colors.text, fontWeight: "900" }}>
                Opciones de la sala
              </Muted>
              <Muted style={{ marginTop: 6 }}>
                {isOwner
                  ? "Puedes finalizar la partida o salir de la partida."
                  : "Puedes salir de la partida. El resto seguira jugando."}
              </Muted>
              {adminError ? (
                <Muted style={{ marginTop: 10, color: theme.colors.danger }}>
                  {adminError}
                </Muted>
              ) : null}
              <View style={{ marginTop: 12, gap: 10 }}>
                {isOwner ? (
                  <>
                    {state !== "ended" ? (
                      <Button
                        variant="secondary"
                        disabled={adminLoading}
                        onPress={() => {
                          Alert.alert(
                            "Finalizar partida?",
                            "Se marcara la partida como finalizada y se ira a la sala final.",
                            [
                              { text: "Cancelar", style: "cancel" },
                              {
                                text: adminLoading ? "Finalizando..." : "Finalizar partida",
                                style: "default",
                                onPress: async () => {
                                  await handleAdminEnd();
                                }
                              }
                            ],
                            { cancelable: true }
                          );
                        }}
                      >
                        {adminLoading ? "Finalizando..." : "Finalizar partida"}
                      </Button>
                    ) : null}
                    {leaders.length > 1 ? (
                      <Button
                        variant="danger"
                        disabled={adminLoading}
                        onPress={() => {
                          Alert.alert(
                            "Salir de la partida?",
                            "El liderazgo se asignara a otro jugador y saldras de la partida.",
                            [
                              { text: "Cancelar", style: "cancel" },
                              {
                                text: adminLoading ? "Saliendo..." : "Salir",
                                style: "default",
                                onPress: async () => {
                                  await handleAdminAction("transfer");
                                }
                              }
                            ],
                            { cancelable: true }
                          );
                        }}
                      >
                        {adminLoading ? "Saliendo..." : "Salir de la partida"}
                      </Button>
                    ) : null}
                  </>
                ) : (
                  <Button
                    variant="danger"
                    disabled={adminLoading}
                    onPress={() => {
                      Alert.alert(
                        "Salir de la partida?",
                        "Saldras de la sala, pero tus fotos y puntos se mantendran para el final.",
                        [
                          { text: "Cancelar", style: "cancel" },
                          {
                            text: adminLoading ? "Saliendo..." : "Salir",
                            style: "destructive",
                            onPress: async () => {
                              await handleAdminAction("leave");
                            }
                          }
                        ],
                        { cancelable: true }
                      );
                    }}
                  >
                    {adminLoading ? "Saliendo..." : "Salir de la partida"}
                  </Button>
                )}
                <Button
                  variant="primary"
                  disabled={adminLoading}
                  onPress={() => {
                    setAdminOpen(false);
                  }}
                >
                  Volver
                </Button>
              </View>
            </Card>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal transparent visible={Boolean(confirmDeleteId)} animationType="fade" onRequestClose={() => setConfirmDeleteId(null)}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", padding: 18, justifyContent: "center" }}
          onPress={() => setConfirmDeleteId(null)}
        >
          <Pressable
            style={{ borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: "rgba(26,28,58,0.95)", padding: 14 }}
            onPress={() => {}}
          >
            <H2>Eliminar media</H2>
            <Muted style={{ marginTop: 6 }}>Se borrara el archivo y se quitara el punto.</Muted>
            <View style={{ height: 12 }} />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Button
                  variant="ghost"
                  onPress={() => {
                    setConfirmDeleteId(null);
                  }}
                >
                  Cancelar
                </Button>
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  variant="danger"
                  disabled={!confirmDeleteId}
                  onPress={async () => {
                    const id = confirmDeleteId;
                    setConfirmDeleteId(null);
                    if (id) await handleDeleteMedia(id);
                  }}
                >
                  Eliminar
                </Button>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal transparent visible={Boolean(previewMedia)} animationType="fade" onRequestClose={() => setPreviewMedia(null)}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.75)", padding: 16, justifyContent: "center" }}
          onPress={() => setPreviewMedia(null)}
        >
          <Pressable
            style={{ borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: "rgba(0,0,0,0.85)", padding: 10 }}
            onPress={() => {}}
          >
            <Pressable
              onPress={() => setPreviewMedia(null)}
              style={{ position: "absolute", right: 10, top: 10, zIndex: 2, padding: 6 }}
            >
              <Muted style={{ fontWeight: "900", fontSize: 18 }}>X</Muted>
            </Pressable>
            {previewMedia ? (
              previewMedia.type === "video" ? (
                <VideoPreview url={previewMedia.url} />
              ) : (
                <Image
                  source={{ uri: previewMedia.url }}
                  style={{ width: "100%", height: 420, borderRadius: 12 }}
                  resizeMode="contain"
                />
              )
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
      <Modal transparent visible={Boolean(uploadProgress)} animationType="fade" onRequestClose={() => {}}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", padding: 18, justifyContent: "center" }}>
          <View style={{ borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: "rgba(26,28,58,0.95)", padding: 14 }}>
            <H2>Subiendo reto</H2>
            <View style={{ height: 12 }} />
            <ActivityIndicator color={theme.colors.text} />
            <View style={{ height: 12 }} />
            <View style={{ height: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.12)", overflow: "hidden" }}>
              <View
                style={{
                  height: 8,
                  width: `${uploadProgress?.pct ?? 0}%`,
                  backgroundColor: theme.colors.buttonSecondary
                }}
              />
            </View>
            <Muted style={{ marginTop: 8, textAlign: "center" }}>{uploadProgress?.pct ?? 0}%</Muted>
          </View>
        </View>
      </Modal>
    </View>
  );
}





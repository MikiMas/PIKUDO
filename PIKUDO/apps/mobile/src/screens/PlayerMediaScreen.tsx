import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StatusBar, View } from "react-native";
import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiFetchJson } from "../lib/api";
import { VideoPreview } from "../components/VideoPreview";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Screen } from "../ui/Screen";
import { H2, Label, Muted, Title } from "../ui/Text";
import { theme } from "../ui/theme";

type MediaItem = {
  id: string;
  title: string;
  description: string | null;
  completedAt: string | null;
  media: { url: string; mime: string; type: string } | null;
  owner: { id: string; nickname: string } | null;
};

type FinalPlayerRes =
  | { ok: true; player: { id: string; nickname: string; points: number }; completed: MediaItem[] }
  | { ok: false; error: string };

type FinalChallengeRes =
  | { ok: true; challenge: { id: string; title: string; description: string | null }; media: MediaItem[] }
  | { ok: false; error: string };

const getExtension = (mime: string, url: string) => {
  const lower = mime.toLowerCase();
  if (lower.includes("png")) return ".png";
  if (lower.includes("jpeg") || lower.includes("jpg")) return ".jpg";
  if (lower.includes("mp4")) return ".mp4";
  if (lower.includes("quicktime")) return ".mov";
  const clean = url.split("?")[0] ?? "";
  const dot = clean.lastIndexOf(".");
  if (dot !== -1 && dot > clean.length - 6) return clean.slice(dot);
  return lower.startsWith("video") ? ".mp4" : ".jpg";
};

export function PlayerMediaScreen({ route }: { route: any }) {
  const params = route.params as
    | { apiBaseUrl: string; roomCode: string; mode: "player"; playerId: string; nickname: string }
    | { apiBaseUrl: string; roomCode: string; mode: "challenge"; challengeId: string; title: string };
  const { apiBaseUrl } = params;
  const roomCode = params.roomCode;
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [savedById, setSavedById] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  const scopeId = params.mode === "player" ? params.playerId : params.challengeId;
  const savedKey = useMemo(() => {
    const base = apiBaseUrl.replace(/\/+$/, "");
    return `saved_media:${base}:${roomCode}:${params.mode}:${scopeId}`;
  }, [apiBaseUrl, params.mode, roomCode, scopeId]);

  useEffect(() => {
    let canceled = false;
    const loadSaved = async () => {
      const raw = await AsyncStorage.getItem(savedKey).catch(() => null);
      if (canceled) return;
      if (!raw) {
        setSavedById({});
        return;
      }
      try {
        const parsed = JSON.parse(raw) as Record<string, boolean>;
        setSavedById(parsed && typeof parsed === "object" ? parsed : {});
      } catch {
        setSavedById({});
      }
    };
    loadSaved().catch(() => {});
    return () => {
      canceled = true;
    };
  }, [savedKey]);

  useEffect(() => {
    let canceled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      if (params.mode === "player") {
        const res = await apiFetchJson<FinalPlayerRes>(
          apiBaseUrl,
          `/api/final/player?playerId=${encodeURIComponent(params.playerId)}`,
          { method: "GET" }
        );
        if (canceled) return;
        setLoading(false);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        if ((res.data as any)?.ok === false) {
          setError((res.data as any)?.error ?? "REQUEST_FAILED");
          return;
        }
        const completed = ((res.data as any)?.completed ?? []) as MediaItem[];
        setItems(completed.filter((c) => !!c.media?.url));
        return;
      }

      const res = await apiFetchJson<FinalChallengeRes>(
        apiBaseUrl,
        `/api/final/challenge?challengeId=${encodeURIComponent(params.challengeId)}`,
        { method: "GET" }
      );
      if (canceled) return;
      setLoading(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if ((res.data as any)?.ok === false) {
        setError((res.data as any)?.error ?? "REQUEST_FAILED");
        return;
      }
      const media = ((res.data as any)?.media ?? []) as MediaItem[];
      const title = (res.data as any)?.challenge?.title ?? params.title;
      const description = (res.data as any)?.challenge?.description ?? null;
      const shaped = media.map((m) => ({ ...m, title, description }));
      setItems(shaped.filter((c) => !!c.media?.url));
    };
    load().catch(() => {});
    return () => {
      canceled = true;
    };
  }, [apiBaseUrl, params]);

  const selectedIds = useMemo(() => Object.keys(selected).filter((id) => selected[id]), [selected]);

  const toggle = (id: string) => {
    if (savedById[id]) return;
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const saveSelected = async () => {
    if (selectedIds.length === 0 || saving) return;
    setSaving(true);
    setError(null);
    setSavedCount(null);
    try {
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        setError("Necesitamos permisos para guardar en la galeria.");
        return;
      }
      let saved = 0;
      const nextSaved = { ...savedById };
      const nextSelected = { ...selected };
      for (const id of selectedIds) {
        const item = items.find((c) => c.id === id);
        if (!item?.media?.url) continue;
        const ext = getExtension(item.media.mime ?? "", item.media.url);
        const targetFile = new FileSystem.File(FileSystem.Paths.cache, `canoo-${id}${ext}`);
        const downloaded = await FileSystem.File.downloadFileAsync(item.media.url, targetFile);
        await MediaLibrary.saveToLibraryAsync(downloaded.uri);
        saved += 1;
        nextSaved[id] = true;
        nextSelected[id] = false;
      }
      setSavedCount(saved);
      setSavedById(nextSaved);
      setSelected(nextSelected);
      await AsyncStorage.setItem(savedKey, JSON.stringify(nextSaved)).catch(() => {});
    } catch (e) {
      const raw = e instanceof Error ? e.message : "SAVE_FAILED";
      const msg = raw.toLowerCase().includes("destination already exists") ? "Foto ya descargada." : raw;
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <StatusBar barStyle="light-content" />
      <View style={{ gap: 10 }}>
        <Card>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Title>{params.mode === "player" ? `Media de ${params.nickname}` : params.title}</Title>
              <Muted style={{ marginTop: 4 }}>Selecciona lo que quieres descargar</Muted>
            </View>
            <Button variant="secondary" fullWidth={false} onPress={() => navigation.goBack()}>
              Volver
            </Button>
          </View>
        </Card>

        <Card>
          <H2>Descarga</H2>
          <View style={{ height: 8 }} />
          <Muted>Seleccionadas: {selectedIds.length}</Muted>
          {savedCount !== null ? <Muted style={{ marginTop: 6 }}>Guardadas: {savedCount}</Muted> : null}
          <View style={{ height: 10 }} />
          <Button disabled={selectedIds.length === 0 || saving} onPress={saveSelected}>
            {saving ? "Guardando..." : "Guardar seleccionadas"}
          </Button>
          {error ? <Muted style={{ marginTop: 8, color: theme.colors.danger }}>{error}</Muted> : null}
        </Card>

        <Card>
          <H2>Retos</H2>
          <View style={{ height: 8 }} />
          {loading ? (
            <Muted>Cargando...</Muted>
          ) : items.length === 0 ? (
            <Muted>No hay media para mostrar.</Muted>
          ) : (
              <View style={{ gap: 12 }}>
                {items.map((c) => {
                  const active = !!selected[c.id];
                  const savedAlready = !!savedById[c.id];
                  return (
                    <Card
                      key={c.id}
                      style={{
                        backgroundColor: theme.colors.cardAlt,
                        borderColor: active ? theme.colors.success : savedAlready ? theme.colors.border : theme.colors.border
                      }}
                    >
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <View style={{ flex: 1 }}>
                          <Label>{c.title}</Label>
                          {params.mode === "challenge" && c.owner?.nickname ? (
                            <Muted style={{ marginTop: 4 }}>Subido por {c.owner.nickname}</Muted>
                          ) : null}
                          {c.description ? <Muted style={{ marginTop: 4 }}>{c.description}</Muted> : null}
                        </View>
                        <View style={{ alignItems: "center", gap: 6 }}>
                          <Pressable
                            disabled={savedAlready}
                            onPress={() => toggle(c.id)}
                            style={{
                              minWidth: 30,
                              height: 30,
                              paddingHorizontal: 0,
                              borderRadius: 999,
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: active
                                ? theme.colors.success
                                : savedAlready
                                  ? "rgba(0,0,0,0.18)"
                                  : "rgba(0,0,0,0.35)",
                              borderWidth: 1,
                              borderColor: active ? theme.colors.success : "rgba(0,0,0,0.45)",
                              opacity: savedAlready ? 0.6 : 1
                            }}
                          >
                            <Image
                              source={require("../../assets/boton-de-verificacion.png")}
                              style={{
                                width: 18,
                                height: 18,
                                tintColor: theme.colors.text,
                                opacity: active ? 1 : savedAlready ? 0.2 : 0.35
                              }}
                              resizeMode="contain"
                            />
                          </Pressable>
                          {savedAlready ? <Muted>Ya guardada</Muted> : null}
                        </View>
                      </View>
                      {c.media?.url ? (
                        <View style={{ marginTop: 10 }}>
                          <Pressable disabled={savedAlready} onPress={() => toggle(c.id)}>
                            {c.media.type === "video" ? (
                              <VideoPreview url={c.media.url} />
                            ) : (
                              <Image
                                source={{ uri: c.media.url }}
                                style={{
                                  width: "100%",
                                  height: 220,
                                  borderRadius: 12,
                                  borderWidth: 1,
                                  borderColor: theme.colors.border,
                                  backgroundColor: "rgba(0,0,0,0.25)"
                                }}
                                resizeMode="contain"
                              />
                            )}
                          </Pressable>
                        </View>
                      ) : null}
                    </Card>
                  );
                })}
              </View>
          )}
        </Card>
        
    </View>
    </Screen>
  );
}

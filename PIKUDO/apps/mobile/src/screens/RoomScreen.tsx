import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert, Modal, Pressable, Share, StatusBar, Text, View } from "react-native";
import { apiFetchJson, clearSessionToken } from "../lib/api";
import { STORAGE_LAST_ROOM, STORAGE_ROUNDS } from "../lib/storage";
import { FinalScreen } from "./FinalScreen";
import { GameScreen } from "./GameScreen";
import { WaitingMemberScreen } from "./WaitingMemberScreen";
import { WaitingOwnerScreen } from "./WaitingOwnerScreen";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Screen } from "../ui/Screen";
import { H2, Muted } from "../ui/Text";
import { theme } from "../ui/theme";
import type { Challenge, Leader, Player, RoomState } from "./roomTypes";
export function RoomScreen({ route, navigation }: { route: any; navigation: any }) {
  const { apiBaseUrl, roomCode } = route.params as { apiBaseUrl: string; roomCode: string };
  const [rounds, setRounds] = useState<number>(4);
  const [draftRounds, setDraftRounds] = useState<number>(4);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"owner" | "member">("member");
  const [ownerNickname, setOwnerNickname] = useState<string>("");
  const [state, setState] = useState<RoomState>("scheduled");
  const [nextBlockInSec, setNextBlockInSec] = useState<number>(0);
  const [players, setPlayers] = useState<Player[]>([]);
  const [player, setPlayer] = useState<Player | null>(null);
  const [roomStartsAt, setRoomStartsAt] = useState<string | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [uploadingById, setUploadingById] = useState<Record<string, boolean>>({});
  const [uploadErrorById, setUploadErrorById] = useState<Record<string, string | null>>({});
  const [shouldShowFinal, setShouldShowFinal] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [exitError, setExitError] = useState<string | null>(null);
  const [exiting, setExiting] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [startLoading, setStartLoading] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [allowExit, setAllowExit] = useState(false);
  const [finalLeaveRequested, setFinalLeaveRequested] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const pollingRef = useRef(false);
  const allowExitRef = useRef(false);
  const startedRef = useRef(false);
  const POLL_MS = 15000;

  const handleMissingRoom = async () => {
    allowExitRef.current = true;
    setAllowExit(true);
    try {
      await AsyncStorage.removeItem(STORAGE_LAST_ROOM);
      await clearSessionToken();
    } catch {
      // ignore
    }
    navigation.reset({ index: 0, routes: [{ name: "Home" }] });
  };

  const handleExitHome = async () => {
    allowExitRef.current = true;
    setAllowExit(true);
    await clearSessionToken();
    await AsyncStorage.removeItem(STORAGE_LAST_ROOM).catch(() => {});
    navigation.reset({ index: 0, routes: [{ name: "Home" }] });
  };

  const handleExitAction = async (action: "close" | "end" | "leave") => {
    setExitError(null);
    setExiting(true);
    try {
      if (action === "close") {
        const res = await apiFetchJson<any>(apiBaseUrl, "/api/rooms/close", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code: roomCode })
        });
        if (!res.ok) throw new Error(res.error);
        if ((res.data as any)?.ok === false) throw new Error((res.data as any)?.error ?? "REQUEST_FAILED");
      } else if (action === "end") {
        const res = await apiFetchJson<any>(apiBaseUrl, "/api/rooms/end", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code: roomCode })
        });
        if (!res.ok) throw new Error(res.error);
        if ((res.data as any)?.ok === false) throw new Error((res.data as any)?.error ?? "REQUEST_FAILED");
        setExitOpen(false);
        setState("ended");
        return;
      } else {
        const res = await apiFetchJson<any>(apiBaseUrl, "/api/rooms/leave", { method: "POST" });
        if (!res.ok) throw new Error(res.error);
        if ((res.data as any)?.ok === false) throw new Error((res.data as any)?.error ?? "REQUEST_FAILED");
      }

      await clearSessionToken();
      await AsyncStorage.removeItem(STORAGE_LAST_ROOM).catch(() => {});
      setExitOpen(false);
      setShouldShowFinal(false);
      startedRef.current = false;
      setState("scheduled");
      allowExitRef.current = true;
      setAllowExit(true);
      navigation.reset({ index: 0, routes: [{ name: "Home" }] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "REQUEST_FAILED";
      setExitError(msg);
    } finally {
      setExiting(false);
    }
  };

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_ROUNDS)
      .then((v) => {
        const n = Number(v ?? "");
        if (Number.isFinite(n) && n >= 1 && n <= 10) setDraftRounds(Math.floor(n));
      })
      .catch(() => {});
  }, []);

  const refreshAll = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const me = await apiFetchJson<any>(apiBaseUrl, "/api/rooms/me", { method: "GET" });
      if (me.ok && (me.data as any)?.ok !== false) {
        setRole(((me.data as any)?.role ?? "member") === "owner" ? "owner" : "member");
        const nextPlayer = (me.data as any)?.player ?? null;
        if (nextPlayer?.id) setPlayer(nextPlayer as Player);
      } else if (!me.ok && (me as any).status && (((me as any).status === 401) || ((me as any).status === 404))) {
        await handleMissingRoom();
        return;
      }

      const info = await apiFetchJson<any>(apiBaseUrl, `/api/rooms/info?code=${encodeURIComponent(roomCode)}`, { method: "GET" });
      if (info.ok && (info.data as any)?.ok !== false) {
        const roomStatus = String((info.data as any)?.room?.status ?? "").toLowerCase();
        if (roomStatus === "ended") {
          setState("ended");
        } else if (roomStatus === "running") {
          startedRef.current = true;
          setState("running");
        } else if (roomStatus === "scheduled" && !startedRef.current) {
          setState("scheduled");
        }
        const nextRounds = Number((info.data as any)?.room?.rounds ?? NaN);
        const nextStartsAt = (info.data as any)?.room?.starts_at ?? null;
        if (typeof nextStartsAt === "string") setRoomStartsAt(nextStartsAt);
        if (Number.isFinite(nextRounds) && nextRounds >= 1 && nextRounds <= 10) {
          setRounds(Math.floor(nextRounds));
        }
      } else if (!info.ok && (info as any).status && (((info as any).status === 401) || ((info as any).status === 404))) {
        await handleMissingRoom();
        return;
      }
      const ps = await apiFetchJson<any>(apiBaseUrl, `/api/rooms/players?code=${encodeURIComponent(roomCode)}`, { method: "GET", auth: false });
      if (ps.ok && (ps.data as any)?.ok !== false) {
        setPlayers(((ps.data as any)?.players ?? []) as any);
      } else if (!ps.ok && (ps as any).status && (((ps as any).status === 401) || ((ps as any).status === 404))) {
        await handleMissingRoom();
        return;
      }

      const ch = await apiFetchJson<any>(apiBaseUrl, "/api/challenges", { method: "GET" });
      if (!ch.ok) throw new Error(ch.error);
      const data: any = ch.data as any;
      if (data?.ok === false) throw new Error(data?.error ?? "REQUEST_FAILED");
      const s = String(data?.state ?? "running") as any;
      if (s === "ended") {
        setState("ended");
      } else if (s === "scheduled" && !startedRef.current) {
        setState("scheduled");
      } else {
        startedRef.current = true;
        setState("running");
      }
      setNextBlockInSec(Number(data?.nextBlockInSec ?? 0) || 0);
      setChallenges((data?.challenges ?? []) as any);

      const lb = await apiFetchJson<any>(apiBaseUrl, "/api/leaderboard", { method: "GET" });
      if (lb.ok && (lb.data as any)?.ok !== false) setLeaders(((lb.data as any)?.leaders ?? []) as any);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "REQUEST_FAILED";
      setError(msg);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let canceled = false;
    setError(null);
    const loadInfo = async () => {
      const res = await apiFetchJson<any>(apiBaseUrl, `/api/rooms/info?code=${encodeURIComponent(roomCode)}`, {
        method: "GET"
      });
      if (canceled) return;
      if (!res.ok) {
        if ((res as any).status && (((res as any).status === 401) || ((res as any).status === 404))) {
          await handleMissingRoom();
          return;
        }
        setError(res.error);
        return;
      }
      if ((res.data as any)?.ok === false) {
        if ((res.data as any)?.error === "ROOM_NOT_FOUND") {
          await handleMissingRoom();
          return;
        }
        setError((res.data as any)?.error ?? "REQUEST_FAILED");
        return;
      }
      const roomStatus = String((res.data as any)?.room?.status ?? "").toLowerCase();
      if (roomStatus === "ended") {
        setState("ended");
      } else if (roomStatus === "running") {
        startedRef.current = true;
        setState("running");
      } else if (roomStatus === "scheduled" && !startedRef.current) {
        setState("scheduled");
      }
      const nextRounds = Number((res.data as any)?.room?.rounds ?? NaN);
      const nextStartsAt = (res.data as any)?.room?.starts_at ?? null;
      if (typeof nextStartsAt === "string") setRoomStartsAt(nextStartsAt);
      if (Number.isFinite(nextRounds) && nextRounds >= 1 && nextRounds <= 10) {
        setRounds(Math.floor(nextRounds));
        if (!(Number.isFinite(draftRounds) && draftRounds >= 1 && draftRounds <= 10)) setDraftRounds(Math.floor(nextRounds));
      }
    };

    const loadMe = async () => {
      const res = await apiFetchJson<any>(apiBaseUrl, "/api/rooms/me", { method: "GET" });
      if (canceled) return;
      if (!res.ok) {
        if ((res as any).status && (((res as any).status === 401) || ((res as any).status === 404))) {
          await handleMissingRoom();
        }
        return;
      }
      const data: any = res.data as any;
      if (data?.ok === false) return;
      setRole((data?.role ?? "member") === "owner" ? "owner" : "member");
      if (data?.player?.id) setPlayer(data.player as Player);
    };

    const loadPlayers = async () => {
      const res = await apiFetchJson<any>(apiBaseUrl, `/api/rooms/players?code=${encodeURIComponent(roomCode)}`, {
        method: "GET",
        auth: false
      });
      if (canceled) return;
      if (!res.ok) {
        if ((res as any).status && (((res as any).status === 401) || ((res as any).status === 404))) {
          await handleMissingRoom();
        }
        return;
      }
      if ((res.data as any)?.ok === false) return;
      setPlayers(((res.data as any)?.players ?? []) as any);
    };

    const loadOwner = async () => {
      const res = await apiFetchJson<any>(apiBaseUrl, `/api/rooms/owner?code=${encodeURIComponent(roomCode)}`, {
        method: "GET",
        auth: false
      });
      if (canceled) return;
      if (!res.ok) {
        if ((res as any).status && (((res as any).status === 401) || ((res as any).status === 404))) {
          await handleMissingRoom();
        }
        return;
      }
      const data: any = res.data as any;
      if (data?.ok === false) return;
      setOwnerNickname(String(data?.owner?.nickname ?? ""));
    };

    const loadChallenges = async () => {
      const res = await apiFetchJson<any>(apiBaseUrl, "/api/challenges", { method: "GET" });
      if (canceled) return;
      if (!res.ok) {
        if (res.status === 401) {
          setError("UNAUTHORIZED");
        } else {
          setError(res.error);
        }
        return;
      }
      const data: any = res.data as any;
      const s = String(data?.state ?? "scheduled") as any;
      if (s === "ended") {
        setState("ended");
      } else if (s === "scheduled" && !startedRef.current) {
        setState("scheduled");
      } else {
        startedRef.current = true;
        setState("running");
      }
      setNextBlockInSec(Number(data?.nextBlockInSec ?? 0) || 0);
      setChallenges((data?.challenges ?? []) as any);
    };

    const loadLeaders = async () => {
      const res = await apiFetchJson<any>(apiBaseUrl, "/api/leaderboard", { method: "GET" });
      if (canceled) return;
      if (!res.ok) return;
      const data: any = res.data as any;
      if (data?.ok === false) return;
      setLeaders((data?.leaders ?? []) as any);
    };

    setLoading(true);
    Promise.all([loadInfo(), loadMe(), loadPlayers(), loadOwner(), loadChallenges(), loadLeaders()])
      .catch(() => {})
      .finally(() => {
        if (canceled) return;
        setLoading(false);
      });

    const poll = async () => {
      if (pollingRef.current) return;
      pollingRef.current = true;
      try {
        const tasks: Promise<void>[] = [loadChallenges(), loadLeaders(), loadMe()];
        if (state === "scheduled") {
          tasks.push(loadPlayers(), loadOwner(), loadInfo());
        }
        await Promise.all(tasks);
      } finally {
        pollingRef.current = false;
      }
    };

    const id = setInterval(() => {
      poll().catch(() => {});
    }, POLL_MS);

    return () => {
      clearInterval(id);
      canceled = true;
    };
  }, [apiBaseUrl, roomCode, state]);

  useEffect(() => {
    if (state !== "ended") return;
    setShouldShowFinal(true);
  }, [state]);

  useEffect(() => {
    if (state === "scheduled" || state === "ended") return;
    const id = setInterval(() => setNextBlockInSec((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [state]);

  useEffect(() => {
    const sub = navigation.addListener("beforeRemove", (e: any) => {
      if (allowExitRef.current || allowExit || finalLeaveRequested) return;
      e.preventDefault();
      setExitError(null);
      setExitOpen(true);
          });
    return sub;
  }, [navigation, allowExit, finalLeaveRequested]);

  const handleDecRounds = () => {
    const next = Math.max(1, draftRounds - 1);
    setDraftRounds(next);
    AsyncStorage.setItem(STORAGE_ROUNDS, String(next)).catch(() => {});
  };

  const handleIncRounds = () => {
    const next = Math.min(10, draftRounds + 1);
    setDraftRounds(next);
    AsyncStorage.setItem(STORAGE_ROUNDS, String(next)).catch(() => {});
  };

  const handleInvite = async () => {
    try {
      await Share.share({
        title: `Sala ${roomCode}`.trim(),
        message: `Unete a mi sala: ${roomCode}`
      });
    } catch {
      // ignore
    }
  };

  const handleStart = async () => {
    setError(null);
    if (Number.isFinite(draftRounds) && draftRounds >= 1 && draftRounds <= 10) {
      const rr = await apiFetchJson<any>(apiBaseUrl, "/api/rooms/rounds", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: roomCode, rounds: draftRounds })
      });
      if (!rr.ok) {
        setError(rr.error);
        return false;
      }
      if ((rr.data as any)?.ok === false) {
        setError((rr.data as any)?.error ?? "REQUEST_FAILED");
        return false;
      }
    }

    const res = await apiFetchJson<any>(apiBaseUrl, "/api/rooms/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: roomCode })
    });
    if (!res.ok) {
      setError(res.error);
      return false;
    }
    if ((res.data as any)?.ok === false) {
      setError((res.data as any)?.error ?? "REQUEST_FAILED");
      return false;
    }
    startedRef.current = true;
    setState("running");
    await refreshAll();
    return true;
  };

  const handleRequestClose = () => {
    setExitOpen(true);
    setExitError(null);
  };

  const handleMemberLeave = async () => {
    // Allow immediate exit, then attempt server-side unlink.
    setShouldShowFinal(false);
    startedRef.current = false;
    setState("scheduled");
    allowExitRef.current = true;
    setAllowExit(true);
    await clearSessionToken();
    await AsyncStorage.removeItem(STORAGE_LAST_ROOM).catch(() => {});
    const res = await apiFetchJson<any>(apiBaseUrl, "/api/rooms/leave", { method: "POST" });
    if (!res.ok) throw new Error(res.error);
    if ((res.data as any)?.ok === false) throw new Error((res.data as any)?.error ?? "REQUEST_FAILED");
  };
  if (shouldShowFinal) {
    return (
      <FinalScreen
        apiBaseUrl={apiBaseUrl}
        roomCode={roomCode}
        onLeave={async () => {
          if (finalLeaveRequested) return;
          setFinalLeaveRequested(true);
          try {
            await apiFetchJson<any>(apiBaseUrl, "/api/rooms/leave", { method: "POST" });
          } catch {
            // ignore
          }
          await clearSessionToken();
          await AsyncStorage.removeItem(STORAGE_LAST_ROOM).catch(() => {});
          setShouldShowFinal(false);
          startedRef.current = false;
          setState("scheduled");
          allowExitRef.current = true;
          setAllowExit(true);
          navigation.reset({ index: 0, routes: [{ name: "Home" }] });
        }}
      />
    );
  }

  return (
    <Screen>
      <StatusBar barStyle="light-content" />
      {state === "scheduled" ? (
        role === "owner" ? (
          <WaitingOwnerScreen
            roomCode={roomCode}
            draftRounds={draftRounds}
            players={players}
            onDecRounds={handleDecRounds}
            onIncRounds={handleIncRounds}
            onInvite={handleInvite}
            onStart={() => {
              setStartError(null);
              setStartOpen(true);
            }}
            onRequestClose={handleRequestClose}
          />
        ) : (
          <WaitingMemberScreen
            roomCode={roomCode}
            ownerNickname={ownerNickname}
            players={players}
            onLeave={handleMemberLeave}
          />
        )
      ) : state !== "ended" ? (
        <GameScreen
          apiBaseUrl={apiBaseUrl}
          roomCode={roomCode}
          state={state}
          isOwner={role === "owner"}
          loading={loading}
          error={error}
          nextBlockInSec={nextBlockInSec}
          challenges={challenges}
          leaders={leaders}
          player={player}
          totalRounds={rounds}
          roomStartsAt={roomStartsAt}
          uploadingById={uploadingById}
          uploadErrorById={uploadErrorById}
          setUploadingById={setUploadingById}
          setUploadErrorById={setUploadErrorById}
          setChallenges={setChallenges}
          setNextBlockInSec={setNextBlockInSec}
          setState={setState}
          setLeaders={setLeaders}
          onExitHome={handleExitHome}
        />
      ) : null}

      <Modal
        transparent
        visible={startOpen}
        animationType="fade"
        onRequestClose={() => {
          if (!startLoading) setStartOpen(false);
        }}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(7, 16, 33, 0.65)",
            alignItems: "center",
            justifyContent: "center",
            padding: 18
          }}
          onPress={() => {
            if (!startLoading) setStartOpen(false);
          }}
        >
          <Pressable style={{ width: "100%", maxWidth: 420 }}>
            <Card>
              <Muted style={{ color: theme.colors.text, fontWeight: "900" }}>
                Iniciar la partida ahora?
              </Muted>
              <Muted style={{ marginTop: 6 }}>
                Todos los jugadores pasarán al juego y empezará la primera ronda.
              </Muted>
              {startError ? (
                <Muted style={{ marginTop: 10, color: theme.colors.danger }}>
                  {startError}
                </Muted>
              ) : null}
              <View style={{ marginTop: 12, gap: 10 }}>
                <Pressable
                  disabled={startLoading}
                  onPress={async () => {
                    setStartError(null);
                    setStartLoading(true);
                    const ok = await handleStart();
                    setStartLoading(false);
                    if (ok) {
                      setStartOpen(false);
                      return;
                    }
                    setStartError("No se pudo iniciar la partida.");
                  }}
                  style={({ pressed }: { pressed: boolean }) => [
                    {
                      paddingVertical: 18,
                      paddingHorizontal: 18,
                      borderRadius: theme.radius.field,
                      borderWidth: 2,
                      borderColor: "#059669",
                      backgroundColor: "#10b981",
                      opacity: startLoading ? 0.55 : pressed ? 0.9 : 1,
                      width: "100%",
                      shadowColor: "#000",
                      shadowOpacity: 0.32,
                      shadowRadius: 16,
                      shadowOffset: { width: 0, height: 12 },
                      elevation: 6
                    }
                  ]}
                >
                  <Text style={{ color: "#fff", fontWeight: "900", textAlign: "center", fontSize: 18, letterSpacing: 0.3 }}>
                    {startLoading ? "Iniciando..." : "Iniciar"}
                  </Text>
                </Pressable>
                <Pressable
                  disabled={startLoading}
                  onPress={() => setStartOpen(false)}
                  style={({ pressed }: { pressed: boolean }) => [
                    {
                      paddingVertical: 13,
                      paddingHorizontal: 14,
                      borderRadius: theme.radius.field,
                      borderWidth: 2,
                      borderColor: "#1e40af",
                      backgroundColor: "#3b82f6",
                      opacity: startLoading ? 0.55 : pressed ? 0.9 : 1,
                      width: "100%",
                      shadowColor: "#000",
                      shadowOpacity: 0.16,
                      shadowRadius: 16,
                      shadowOffset: { width: 0, height: 12 },
                      elevation: 2
                    }
                  ]}
                >
                  <Text style={{ color: "#fff", fontWeight: "900", textAlign: "center", fontSize: 15, letterSpacing: 0.3 }}>
                    Volver
                  </Text>
                </Pressable>
              </View>
            </Card>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        transparent
        visible={exitOpen}
        animationType="fade"
        onRequestClose={() => {
          if (!exiting) setExitOpen(false);
        }}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.55)",
            padding: 16,
            justifyContent: "center"
          }}
          onPress={() => {
            if (!exiting) setExitOpen(false);
          }}
        >
          <Pressable onPress={() => {}}>
            <Card>
              <H2>{role === "owner" ? "Cerrar sala" : "Salir de la sala"}</H2>
              <Muted style={{ marginTop: 6 }}>
                {role === "owner"
                  ? "Se cerrara la sala para todos los jugadores."
                  : "Saldras de la sala, pero tus fotos y puntos se mantendran."}
              </Muted>
              {exitError ? (
                <Muted style={{ marginTop: 10, color: theme.colors.danger }}>{exitError}</Muted>
              ) : null}
              <View style={{ marginTop: 12, gap: 10 }}>
                <Button
                  variant="danger"
                  disabled={exiting}
                  onPress={() => {
                    if (exiting) return;
                    handleExitAction(role === "owner" ? "close" : "leave");
                  }}
                >
                  {exiting ? "Cerrando..." : role === "owner" ? "Si, cerrar" : "Si, salir"}
                </Button>
                <Button variant="secondary" disabled={exiting} onPress={() => setExitOpen(false)}>
                  Volver
                </Button>
              </View>
            </Card>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

























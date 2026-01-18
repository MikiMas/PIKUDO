import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StatusBar, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { apiFetchJson } from "../lib/api";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Screen } from "../ui/Screen";
import { H2, Label, Muted, Title } from "../ui/Text";
import { theme } from "../ui/theme";

type Leader = { id: string; nickname: string; points: number };

type FinalSummary =
  | { ok: true; roomName: string | null; leaders: Leader[] }
  | { ok: false; error: string };

export function FinalScreen({
  apiBaseUrl,
  roomCode,
  onLeave
}: {
  apiBaseUrl: string;
  roomCode: string;
  onLeave: () => Promise<void>;
}) {
  const navigation = useNavigation<any>();
  const [summary, setSummary] = useState<FinalSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = async () => {
    setLoading(true);
    setError(null);
    const res = await apiFetchJson<FinalSummary>(apiBaseUrl, "/api/final/summary", { method: "GET" });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSummary(res.data);
  };

  useEffect(() => {
    loadSummary().catch(() => {});
  }, []);

  const leaders: Leader[] = summary && (summary as any).ok ? ((summary as any).leaders ?? []) : [];
  const winner = leaders[0] ?? null;
  const [leaving, setLeaving] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);

  const handleLeave = async () => {
    if (leaving) return;
    setLeaving(true);
    try {
      await onLeave();
    } finally {
      setLeaving(false);
    }
  };

  return (
    <Screen>
      <StatusBar barStyle="light-content" />
      <View style={{ gap: 10 }}>
        <Card>
          <Title>Partida finalizada</Title>
          <Muted style={{ marginTop: 4 }}>{roomCode}</Muted>
        </Card>

        <Card>
          <H2>Resultado</H2>
          {winner ? (
            <View
              style={{
                marginTop: 12,
                borderRadius: theme.radius.card,
                borderWidth: 1,
                borderColor: "rgba(255,210,63,0.45)",
                padding: 12,
                backgroundColor: "rgba(255,210,63,0.12)"
              }}
            >
              <Label>Ganador/a</Label>
              <View style={{ height: 8 }} />
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: "rgba(255,210,63,0.35)",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <Muted style={{ color: theme.colors.text, fontSize: 18 }}>🥇</Muted>
                </View>
                <View style={{ flex: 1 }}>
                  <Title style={{ fontSize: 22 }}>{winner.nickname}</Title>
                  <Muted style={{ marginTop: 2 }}>{winner.points} puntos</Muted>
                </View>
              </View>
            </View>
          ) : null}
          {error ? <Muted style={{ marginTop: 10, color: theme.colors.danger }}>{error}</Muted> : null}
        </Card>

        <Card>
          <H2>Descarga tus retos favoritos</H2>
          <View style={{ height: 8 }} />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Button
                variant="secondary"
                onPress={() => navigation.navigate("FinalPlayers", { apiBaseUrl, roomCode })}
              >
                Por jugador
              </Button>
            </View>
            <View style={{ flex: 1 }}>
              <Button
                variant="secondary"
                onPress={() => navigation.navigate("FinalChallenges", { apiBaseUrl, roomCode })}
              >
                Por retos
              </Button>
            </View>
          </View>
        </Card>

        <Card>
          <H2>Ranking final</H2>
          <View style={{ height: 8 }} />
          {loading ? (
            <Muted>Cargando ranking...</Muted>
          ) : leaders.length === 0 ? (
            <Muted>No hay jugadores.</Muted>
          ) : (
            <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ paddingBottom: 4 }}>
              <View style={{ gap: 12 }}>
                {leaders.map((l, idx) => (
                  <View key={l.id}>
                    <Card
                      style={{
                        borderColor:
                          idx === 0
                            ? "rgba(255,210,63,0.45)"
                            : idx === 1
                              ? "rgba(148,163,184,0.45)"
                              : idx === 2
                                ? "rgba(255,159,28,0.35)"
                                : theme.colors.border,
                        backgroundColor: theme.colors.cardAlt
                      }}
                    >
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <View style={{ flex: 1 }}>
                          <Muted style={{ color: theme.colors.text, fontWeight: "900" }}>
                            #{idx + 1} {l.nickname}
                          </Muted>
                          <Muted>{l.points} pts</Muted>
                        </View>
                        <View style={{ width: 10 }} />
                                              </View>
                    </Card>
                  </View>
                ))}
              </View>
            </ScrollView>
          )}
        </Card>

        <Card>
          <Button variant="danger" disabled={leaving} onPress={() => setLeaveOpen(true)}>
            {leaving ? "Saliendo..." : "Abandonar partida"}
          </Button>
        </Card>
      </View>

      <Modal transparent visible={leaveOpen} animationType="fade" onRequestClose={() => setLeaveOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", padding: 16, justifyContent: "center" }}
          onPress={() => setLeaveOpen(false)}
        >
          <Pressable
            style={{
              borderRadius: 18,
              borderWidth: 2,
              borderColor: theme.colors.buttonPrimaryBorder,
              backgroundColor: theme.colors.cardAlt,
              padding: 14
            }}
            onPress={() => {}}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <H2>Abandonar partida</H2>
              <Pressable
                onPress={() => setLeaveOpen(false)}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: theme.colors.buttonGhost,
                  borderWidth: 1,
                  borderColor: theme.colors.buttonGhostBorder
                }}
              >
                <Muted style={{ color: theme.colors.text, fontWeight: "900" }}>X</Muted>
              </Pressable>
            </View>
            <View style={{ height: 10 }} />
            <Muted>Saldras de la sala y se borraran tus datos locales.</Muted>
            <View style={{ height: 12 }} />
            <Button
              variant="danger"
              disabled={leaving}
              onPress={async () => {
                setLeaveOpen(false);
                await handleLeave();
              }}
            >
              {leaving ? "Saliendo..." : "Confirmar salida"}
            </Button>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}


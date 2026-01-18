import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StatusBar, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { apiFetchJson } from "../lib/api";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Screen } from "../ui/Screen";
import { H2, Muted, Title } from "../ui/Text";
import { theme } from "../ui/theme";

type PlayerRow = { id: string; nickname: string; points: number; completedCount: number };
type PlayersRes = { ok: true; players: PlayerRow[] } | { ok: false; error: string };

export function FinalPlayersScreen({ route }: { route: any }) {
  const { apiBaseUrl, roomCode } = route.params as { apiBaseUrl: string; roomCode: string };
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);

  useEffect(() => {
    let canceled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      const res = await apiFetchJson<PlayersRes>(apiBaseUrl, "/api/final/players", { method: "GET" });
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
      setPlayers(((res.data as any)?.players ?? []) as PlayerRow[]);
    };
    load().catch(() => {});
    return () => {
      canceled = true;
    };
  }, [apiBaseUrl]);

  const total = useMemo(() => players.length, [players.length]);

  return (
    <Screen>
      <StatusBar barStyle="light-content" />
      <View style={{ gap: 10 }}>
        <Card>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Title>Por jugador</Title>
              <Muted style={{ marginTop: 4 }}>Selecciona a quien descargar</Muted>
            </View>
            <Button variant="secondary" fullWidth={false} onPress={() => navigation.goBack()}>
              Volver
            </Button>
          </View>
        </Card>

        <Card>
          <H2>Jugadores ({total})</H2>
          <View style={{ height: 8 }} />
          {loading ? (
            <Muted>Cargando...</Muted>
          ) : error ? (
            <Muted style={{ color: theme.colors.danger }}>{error}</Muted>
          ) : players.length === 0 ? (
            <Muted>No hay jugadores.</Muted>
          ) : (
            <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ paddingBottom: 4 }}>
              <View style={{ gap: 12 }}>
                {players.map((p, idx) => (
                  <Pressable
                    key={p.id}
                    onPress={() =>
                      navigation.navigate("PlayerMedia", {
                        apiBaseUrl,
                        roomCode,
                        mode: "player",
                        playerId: p.id,
                        nickname: p.nickname
                      })
                    }
                  >
                    <Card
                      style={{
                        backgroundColor: theme.colors.cardAlt,
                        borderColor: idx === 0 ? "rgba(255,210,63,0.45)" : theme.colors.border
                      }}
                    >
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <View style={{ flex: 1 }}>
                          <Muted style={{ color: theme.colors.text, fontWeight: "900" }}>{p.nickname}</Muted>
                          <Muted>{p.completedCount} retos</Muted>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Muted style={{ color: theme.colors.muted }}>Puntos</Muted>
                          <Muted style={{ fontWeight: "900" }}>{p.points}</Muted>
                        </View>
                      </View>
                    </Card>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          )}
        </Card>
      </View>
    </Screen>
  );
}

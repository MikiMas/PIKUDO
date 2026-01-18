import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StatusBar, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { apiFetchJson } from "../lib/api";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Screen } from "../ui/Screen";
import { H2, Muted, Title } from "../ui/Text";
import { theme } from "../ui/theme";

type ChallengeRow = { id: string; title: string; description: string | null; mediaCount: number };
type ChallengesRes = { ok: true; challenges: ChallengeRow[] } | { ok: false; error: string };

export function FinalChallengesScreen({ route }: { route: any }) {
  const { apiBaseUrl, roomCode } = route.params as { apiBaseUrl: string; roomCode: string };
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [challenges, setChallenges] = useState<ChallengeRow[]>([]);

  useEffect(() => {
    let canceled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      const res = await apiFetchJson<ChallengesRes>(apiBaseUrl, "/api/final/challenges", { method: "GET" });
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
      setChallenges(((res.data as any)?.challenges ?? []) as ChallengeRow[]);
    };
    load().catch(() => {});
    return () => {
      canceled = true;
    };
  }, [apiBaseUrl]);

  const total = useMemo(() => challenges.length, [challenges.length]);

  return (
    <Screen>
      <StatusBar barStyle="light-content" />
      <View style={{ gap: 10 }}>
        <Card>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Title>Por retos</Title>
              <Muted style={{ marginTop: 4 }}>Explora los retos de la partida</Muted>
            </View>
            <Button variant="secondary" fullWidth={false} onPress={() => navigation.goBack()}>
              Volver
            </Button>
          </View>
        </Card>

        <Card>
          <H2>Retos ({total})</H2>
          <View style={{ height: 8 }} />
          {loading ? (
            <Muted>Cargando...</Muted>
          ) : error ? (
            <Muted style={{ color: theme.colors.danger }}>{error}</Muted>
          ) : challenges.length === 0 ? (
            <Muted>No hay retos.</Muted>
          ) : (
            <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ paddingBottom: 4 }}>
              <View style={{ gap: 12 }}>
                {challenges.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() =>
                      navigation.navigate("PlayerMedia", {
                        apiBaseUrl,
                        roomCode,
                        mode: "challenge",
                        challengeId: c.id,
                        title: c.title
                      })
                    }
                  >
                    <Card style={{ backgroundColor: theme.colors.cardAlt, borderColor: theme.colors.border }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <View style={{ flex: 1 }}>
                          <Muted style={{ color: theme.colors.text, fontWeight: "900" }}>{c.title}</Muted>
                          {c.description ? <Muted style={{ marginTop: 4 }}>{c.description}</Muted> : null}
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Muted style={{ color: theme.colors.muted }}>Media</Muted>
                          <Muted style={{ fontWeight: "900" }}>{c.mediaCount}</Muted>
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

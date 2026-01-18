import { Pressable, Share, View } from "react-native";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Pill } from "../ui/Pill";
import { H2, Label, Muted, Title } from "../ui/Text";
import { theme } from "../ui/theme";
import type { Player } from "./roomTypes";

export function WaitingOwnerScreen({
  roomCode,
  draftRounds,
  players,
  onDecRounds,
  onIncRounds,
  onInvite,
  onStart,
  onRequestClose
}: {
  roomCode: string;
  draftRounds: number;
  players: Player[];
  onDecRounds: () => void;
  onIncRounds: () => void;
  onInvite: () => Promise<void>;
  onStart: () => void | Promise<void>;
  onRequestClose: () => void;
}) {
  const totalMinutes = draftRounds * 30;
  const timeLabel = totalMinutes < 60 ? `${totalMinutes} min` : `${totalMinutes / 60}h`;

  return (
    <View style={{ gap: 10 }}>
      <Card>
        <View style={{ alignItems: "center", gap: 6 }}>
          <Muted style={{ color: theme.colors.muted }}>Codigo de sala</Muted>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Title style={{ fontSize: 44, letterSpacing: 4 }}>{roomCode}</Title>
            <Pressable
              onPress={async () => {
                try {
                  await Share.share({
                    title: `Sala ${roomCode}`.trim(),
                    message: `Unete a mi sala: ${roomCode}`
                  });
                } catch {
                  // ignore
                }
              }}
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: theme.colors.buttonSecondary,
                borderWidth: 1,
                borderColor: theme.colors.buttonSecondaryBorder
              }}
            >
              <View style={{ width: 14, height: 14, position: "relative" }}>
                <View
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 5,
                    width: 3,
                    height: 3,
                    borderRadius: 1.5,
                    backgroundColor: theme.colors.text
                  }}
                />
                <View
                  style={{
                    position: "absolute",
                    right: 0,
                    top: 0,
                    width: 3,
                    height: 3,
                    borderRadius: 1.5,
                    backgroundColor: theme.colors.text
                  }}
                />
                <View
                  style={{
                    position: "absolute",
                    right: 0,
                    bottom: 0,
                    width: 3,
                    height: 3,
                    borderRadius: 1.5,
                    backgroundColor: theme.colors.text
                  }}
                />
                <View
                  style={{
                    position: "absolute",
                    left: 1.5,
                    top: 4.5,
                    width: 10,
                    height: 1.5,
                    borderRadius: 2,
                    backgroundColor: theme.colors.text,
                    transform: [{ rotate: "-25deg" }]
                  }}
                />
                <View
                  style={{
                    position: "absolute",
                    left: 1.5,
                    bottom: 4.5,
                    width: 10,
                    height: 1.5,
                    borderRadius: 2,
                    backgroundColor: theme.colors.text,
                    transform: [{ rotate: "25deg" }]
                  }}
                />
              </View>
            </Pressable>
          </View>
        </View>
        <View style={{ height: 10 }} />
      </Card>

      <Card>
        <Label>Duracion (rondas)</Label>
        <View style={{ height: 8 }} />
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          <Button variant="secondary" fullWidth={false} onPress={onDecRounds} disabled={draftRounds <= 1}>
            -
          </Button>
          <Pill style={{ flex: 1, justifyContent: "space-between" }}>
            <Muted style={{ color: theme.colors.text, fontWeight: "900" }}>{draftRounds} rondas</Muted>
            <Muted>{timeLabel}</Muted>
          </Pill>
          <Button variant="secondary" fullWidth={false} onPress={onIncRounds} disabled={draftRounds >= 10}>
            +
          </Button>
        </View>
      </Card>

      <Card>
        <Label>Jugadores ({players.length})</Label>
        <View style={{ height: 8 }} />
        {players.length === 0 ? (
          <Muted>Aun no ha entrado nadie.</Muted>
        ) : (
          <View style={{ gap: 8 }}>
            {players.map((p) => (
              <Pill key={p.id} style={{ justifyContent: "space-between", width: "100%" }}>
                <Muted style={{ color: theme.colors.text, fontWeight: "900" }}>{p.nickname}</Muted>
              </Pill>
            ))}
          </View>
        )}
      </Card>

      <Card>
        <View style={{ gap: 10 }}>
          <Button variant="secondary" onPress={onStart}>Empezar ahora</Button>
          <Button variant="danger" onPress={onRequestClose}>
            Cerrar sala
          </Button>
        </View>
      </Card>
    </View>
  );
}

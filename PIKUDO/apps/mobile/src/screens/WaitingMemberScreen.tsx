import { useState } from "react";
import { Modal, Pressable, Share, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Pill } from "../ui/Pill";
import { H2, Label, Muted, Title } from "../ui/Text";
import { theme } from "../ui/theme";
import type { Player } from "./roomTypes";

export function WaitingMemberScreen({
  roomCode,
  ownerNickname,
  players,
  onLeave
}: {
  roomCode: string;
  ownerNickname: string;
  players: Player[];
  onLeave: () => Promise<void>;
}) {
  const navigation = useNavigation<any>();
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  return (
    <>
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
        <View style={{ height: 12 }} />
        <H2>Sala</H2>
        <View style={{ height: 8 }} />
        <Muted>Estas en la sala de espera.</Muted>

        <View style={{ marginTop: 12 }}>
          <Pill>
            <Muted style={{ color: theme.colors.text, fontWeight: "900" }}>Admin</Muted>
            <Muted>{ownerNickname || "-"}</Muted>
          </Pill>
        </View>

        <View
          style={{
            marginTop: 12,
            gap: 8,
            padding: 12,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: "rgba(0,0,0,0.18)",
            backgroundColor: "rgba(255,255,255,0.06)"
          }}
        >
          <Label>Jugadores ({players.length})</Label>
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
        </View>

        <View style={{ marginTop: 12 }}>
          <Button variant="danger" onPress={() => setLeaveOpen(true)}>
            Abandonar partida
          </Button>
        </View>
      </Card>

      <Modal
        transparent
        visible={leaveOpen}
        animationType="fade"
        onRequestClose={() => {
          if (!leaving) setLeaveOpen(false);
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
            if (!leaving) setLeaveOpen(false);
          }}
        >
          <Pressable onPress={() => {}} style={{ width: "100%" }}>
            <Card>
              <H2>Abandonar partida</H2>
              <Muted style={{ marginTop: 6 }}>
                Saldras de la sala, pero tus fotos y puntos se mantendran para el final.
              </Muted>
              {leaveError ? (
                <Muted style={{ marginTop: 10, color: theme.colors.danger }}>{leaveError}</Muted>
              ) : null}
              <View style={{ marginTop: 12, gap: 10 }}>
                <Button
                  variant="danger"
                  disabled={leaving}
                  onPress={() => {
                    if (leaving) return;
                    setLeaveError(null);
                    setLeaving(true);
                    setLeaveOpen(false);
                    onLeave().catch(() => {});
                    navigation.reset({ index: 0, routes: [{ name: "Home" }] });
                  }}
                >
                  {leaving ? "Saliendo..." : "Si, salir"}
                </Button>
                <Button variant="secondary" disabled={leaving} onPress={() => setLeaveOpen(false)}>
                  Volver
                </Button>
              </View>
            </Card>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

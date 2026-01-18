import { Modal, View, Animated, Easing } from "react-native";
import { useEffect, useRef } from "react";
import { Card } from "./Card";
import { H2, Muted } from "./Text";
import { theme } from "./theme";

export function LoadingOverlay({ visible, title, subtitle }: { visible: boolean; title: string; subtitle?: string }) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true
      })
    );
    loop.start();
    return () => {
      loop.stop();
      spin.setValue(0);
    };
  }, [spin, visible]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.55)",
          padding: 16,
          justifyContent: "center"
        }}
        pointerEvents="auto"
      >
        <View style={{ alignItems: "center" }}>
          <Card style={{ width: "100%", maxWidth: 420 }}>
            <H2>{title}</H2>
            {subtitle ? <Muted style={{ marginTop: 8 }}>{subtitle}</Muted> : null}
            <View style={{ marginTop: 14, alignItems: "center" }}>
              <Animated.View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 999,
                  borderWidth: 3,
                  borderColor: "rgba(255,255,255,0.14)",
                  borderTopColor: theme.colors.buttonPrimary,
                  transform: [{ rotate }]
                }}
              />
            </View>
          </Card>
        </View>
      </View>
    </Modal>
  );
}

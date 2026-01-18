import { ReactNode } from "react";
import { View, ViewStyle } from "react-native";
import { theme } from "./theme";

export function Pill({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <View
      style={{
        borderWidth: 2,
        borderColor: "rgba(0,0,0,0.18)",
        backgroundColor: theme.colors.cardAlt,
        borderRadius: theme.radius.pill,
        paddingVertical: 8,
        paddingHorizontal: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        ...(style ?? {})
      }}
    >
      {children}
    </View>
  );
}

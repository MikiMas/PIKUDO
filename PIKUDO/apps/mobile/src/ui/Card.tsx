import { ReactNode } from "react";
import { View, ViewStyle } from "react-native";
import { theme } from "./theme";

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <View
      style={[
        {
          borderWidth: 2,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.card,
          borderRadius: theme.radius.card,
          padding: 14,
          shadowColor: "#000",
          shadowOpacity: 0.30,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 14 },
          elevation: 7
        },
        style
      ]}
    >
      {children}
    </View>
  );
}

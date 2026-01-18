import { ReactNode } from "react";
import { Text as RNText, TextStyle } from "react-native";
import { theme } from "./theme";

export function Title({ children, style }: { children: ReactNode; style?: TextStyle }) {
  return <RNText style={[{ color: theme.colors.text, fontSize: 26, fontWeight: "900" }, style]}>{children}</RNText>;
}

export function H2({ children, style }: { children: ReactNode; style?: TextStyle }) {
  return <RNText style={[{ color: theme.colors.text, fontSize: 18, fontWeight: "900" }, style]}>{children}</RNText>;
}

export function Label({ children, style }: { children: ReactNode; style?: TextStyle }) {
  return (
    <RNText style={[{ color: theme.colors.muted, fontSize: 13, fontWeight: "900", letterSpacing: 0.3 }, style]}>
      {children}
    </RNText>
  );
}

export function Muted({ children, style }: { children: ReactNode; style?: TextStyle }) {
  return (
    <RNText style={[{ color: theme.colors.muted, lineHeight: 18, fontSize: 14 }, style]}>
      {children}
    </RNText>
  );
}

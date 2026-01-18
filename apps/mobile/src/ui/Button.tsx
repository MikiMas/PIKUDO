import { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { theme } from "./theme";

export function Button({
  children,
  onPress,
  disabled,
  variant = "primary",
  fullWidth = true,
  size = "md"
}: {
  children: ReactNode;
  onPress: () => void | Promise<void>;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "warning";
  fullWidth?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const bg =
    variant === "danger"
      ? "#e53935"
      : variant === "warning"
        ? theme.colors.buttonWarning
      : variant === "secondary"
        ? theme.colors.buttonSecondary
      : variant === "ghost"
        ? theme.colors.buttonGhost
        : theme.colors.buttonPrimary;
  const border =
    variant === "danger"
      ? "#b71c1c"
      : variant === "warning"
        ? theme.colors.buttonWarningBorder
      : variant === "secondary"
        ? theme.colors.buttonSecondaryBorder
      : variant === "ghost"
        ? theme.colors.buttonGhostBorder
        : theme.colors.buttonPrimaryBorder;
  const textColor =
    variant === "primary" ? theme.colors.textOnPrimary : variant === "danger" ? "#fff" : variant === "warning" ? "#fff" : theme.colors.text;
  const paddingVertical = size === "lg" ? 18 : size === "sm" ? 8 : 13;
  const paddingHorizontal = size === "lg" ? 18 : size === "sm" ? 10 : 14;
  const fontSize = size === "lg" ? 18 : size === "sm" ? 16 : 15;

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }: { pressed: boolean }) => [
        {
          paddingVertical,
          paddingHorizontal,
          borderRadius: theme.radius.field,
          borderWidth: variant === "ghost" ? 1 : 2,
          borderColor: border,
          backgroundColor: bg,
          opacity: disabled ? 0.55 : pressed ? 0.9 : 1,
          width: fullWidth ? "100%" : undefined,
          shadowColor: "#000",
          shadowOpacity: variant === "ghost" ? 0.16 : 0.32,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 12 },
          elevation: variant === "ghost" ? 2 : 6
        }
      ]}
    >
      {typeof children === "string" || typeof children === "number" ? (
        <Text style={{ color: textColor, fontWeight: "900", textAlign: "center", fontSize, letterSpacing: 0.3 }}>
          {children}
        </Text>
      ) : (
        <View style={{ alignItems: "center", justifyContent: "center" }}>{children}</View>
      )}
    </Pressable>
  );
}

import { TextInput, TextInputProps } from "react-native";
import { theme } from "./theme";

export function Input(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={theme.colors.disabled}
      {...props}
      style={[
        {
          borderWidth: 2,
          borderColor: "rgba(0,0,0,0.18)",
          backgroundColor: theme.colors.fieldBg,
          borderRadius: theme.radius.field,
          paddingHorizontal: 14,
          paddingVertical: 12,
          color: theme.colors.text,
          fontWeight: "800"
        },
        props.style
      ]}
    />
  );
}

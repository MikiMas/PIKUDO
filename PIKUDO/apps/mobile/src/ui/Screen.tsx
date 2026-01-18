import { ReactNode } from "react";
import { ImageBackground, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AdBanner } from "./AdBanner";
import { theme } from "./theme";

export function Screen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={["top", "bottom"]}>
      <ImageBackground
        source={require("../../assets/fondo_pikudo.png")}
        resizeMode="cover"
        style={{ flex: 1, backgroundColor: theme.colors.bg }}
      >
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.52,
            backgroundColor: "#000"
          }}
        />
        <View style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 18,
              paddingBottom: 28,
              gap: 14,
              flexGrow: 1
            }}
          >
            {children}
          </ScrollView>
          <AdBanner />
        </View>
      </ImageBackground>
    </SafeAreaView>
  );
}

import { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as ScreenOrientation from "expo-screen-orientation";
import { HomeScreen } from "./screens/HomeScreen";
import { FinalPlayersScreen } from "./screens/FinalPlayersScreen";
import { FinalChallengesScreen } from "./screens/FinalChallengesScreen";
import { PlayerMediaScreen } from "./screens/PlayerMediaScreen";
import { RoomScreen } from "./screens/RoomScreen";
import { theme } from "./ui/theme";

type RootStackParamList = {
  Home: undefined;
  Room: { apiBaseUrl: string; roomCode: string };
  Final: { apiBaseUrl: string; roomCode: string };
  PlayerMedia:
    | { apiBaseUrl: string; roomCode: string; mode: "player"; playerId: string; nickname: string }
    | { apiBaseUrl: string; roomCode: string; mode: "challenge"; challengeId: string; title: string };
  FinalPlayers: { apiBaseUrl: string; roomCode: string };
  FinalChallenges: { apiBaseUrl: string; roomCode: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function App() {
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
  }, []);

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          headerStyle: { backgroundColor: theme.colors.bg },
          headerTintColor: theme.colors.text,
          headerTitleStyle: { fontWeight: "900" },
          contentStyle: { backgroundColor: theme.colors.bg }
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: "PIKUDO" }} />
        <Stack.Screen name="Room" component={RoomScreen} options={{ title: "Sala" }} />
        <Stack.Screen name="PlayerMedia" component={PlayerMediaScreen} options={{ title: "Media" }} />
        <Stack.Screen name="FinalPlayers" component={FinalPlayersScreen} options={{ title: "Jugadores" }} />
        <Stack.Screen name="FinalChallenges" component={FinalChallengesScreen} options={{ title: "Retos" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

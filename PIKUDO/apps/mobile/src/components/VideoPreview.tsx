import { useVideoPlayer, VideoView } from "expo-video";
import { theme } from "../ui/theme";

export function VideoPreview({ url }: { url: string }) {
  const player = useVideoPlayer({ uri: url }, () => {});
  return (
    <VideoView
      player={player}
      nativeControls
      contentFit="contain"
      style={{
        width: "100%",
        height: 220,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: "rgba(0,0,0,0.35)"
      }}
    />
  );
}

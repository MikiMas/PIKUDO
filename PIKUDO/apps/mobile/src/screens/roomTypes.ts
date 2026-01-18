export type RoomState = "scheduled" | "paused" | "running" | "ended";

export type Player = { id: string; nickname: string; points: number };

export type Challenge = {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  hasMedia?: boolean;
  media?: { url: string; type: "image" | "video"; mime: string | null } | null;
};

export type Leader = { nickname: string; points: number };

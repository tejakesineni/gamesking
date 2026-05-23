export type RoomStatus = "waiting" | "live" | "finished";

export type Room = {
  hostName: string;
  game: string;
  roomCode: string;
  status: RoomStatus;
  createdAt: string;
};

export type BingoColumn = {
  label: string;
  values: Array<number | "FREE">;
};

export type NewGameFormState = {
  hostName: string;
};

export type JoinGameFormState = {
  roomCode: string;
  playerName: string;
};

export type RoomUser = {
  id: string;
  roomCode: string;
  playerName: string;
  joinedAt: string;
};

export type WaitingRoomDetails = Room & {
  players: RoomUser[];
};

export type GameOption =
  | "Bingo"
  | "Ludo"
  | "Snakes and Ladders"
  | "Tambola"
  | "Tic Tac Toe";

export type SnakesAndLaddersMoveKind =
  | "normal"
  | "snake"
  | "ladder"
  | "blocked";

export type SnakesAndLaddersMove = {
  playerName: string;
  roll: number;
  from: number;
  to: number;
  kind: SnakesAndLaddersMoveKind;
};

export type SnakesAndLaddersState = {
  roomCode: string;
  playerOrder: string[];
  positions: Record<string, number>;
  currentTurnIndex: number;
  status: "running" | "finished";
  winner: string | null;
  lastMove: SnakesAndLaddersMove | null;
};

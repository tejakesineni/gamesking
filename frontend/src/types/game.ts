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
  | "Blind Four"
  | "Chess"
  | "Ludo"
  | "Snakes and Ladders"
  | "Tambola"
  | "Tic Tac Toe";

export type BlindFourCard = {
  id: string;
  rank: string;
  suit: string;
  locked?: boolean;
  lockedByCard?: {
    id: string;
    rank: string;
    suit: string;
  } | null;
};

export type BlindFourLastAction = {
  playerName: string;
  action: string;
  detail: string;
};

export type BlindFourPendingJokerChoice = {
  playerName: string;
  options: Array<
    | "lock-card"
    | "swap-card"
    | "shuffle-cards"
    | "pick-your-cards"
    | "see-opponent-card"
  >;
};

export type BlindFourPendingLockChoice = {
  playerName: string;
  source: "joker-lock" | "king-discard";
  lockingCard?: BlindFourCard | null;
};

export type BlindFourPendingSwapChoice = {
  playerName: string;
  source: "joker-swap" | "queen-discard";
};

export type BlindFourPendingShuffleChoice = {
  playerName: string;
  source: "joker-shuffle" | "jack-discard";
  targetPlayers: string[];
};

export type BlindFourPendingTenChoice = {
  playerName: string;
  options: Array<"pick-your-cards" | "see-opponent-card">;
};

export type BlindFourPendingSeeOwnCards = {
  playerName: string;
  startedAt: string;
  durationMs: number;
};

export type BlindFourPendingPeekChoice = {
  playerName: string;
  source: "joker-peek-opponent" | "ten-peek-opponent";
  targetPlayers: string[];
};

export type BlindFourActivePeekReveal = {
  playerName: string;
  targetPlayerName: string;
  slotIndex: number;
  startedAt: string;
  durationMs: number;
};

export type BlindFourState = {
  roomCode: string;
  playerOrder: string[];
  hands: Record<string, BlindFourCard[]>;
  deckCount: number;
  discardTop: BlindFourCard | null;
  pendingDrawCard: BlindFourCard | null;
  initialPeekIndexes: Record<string, number[]>;
  setupReady: Record<string, boolean>;
  phase: "setup" | "running";
  currentTurnIndex: number;
  currentTurnPlayer: string | null;
  status: "running" | "finished";
  winner: string | null;
  scores: Record<string, number> | null;
  knocker: string | null;
  turnsAfterKnock: number;
  lastAction: BlindFourLastAction | null;
  pendingJokerChoice: BlindFourPendingJokerChoice | null;
  pendingLockChoice: BlindFourPendingLockChoice | null;
  pendingSwapChoice: BlindFourPendingSwapChoice | null;
  pendingShuffleChoice: BlindFourPendingShuffleChoice | null;
  pendingTenChoice: BlindFourPendingTenChoice | null;
  pendingSeeOwnCards: BlindFourPendingSeeOwnCards | null;
  pendingPeekChoice: BlindFourPendingPeekChoice | null;
  activePeekReveal: BlindFourActivePeekReveal | null;
};

export type ChessColor = "white" | "black";

export type ChessMove = {
  playerName: string;
  from: string;
  to: string;
  promotion: string | null;
  san: string;
  piece: string;
  captured: string | null;
};

export type ChessState = {
  roomCode: string;
  playerOrder: string[];
  colors: Record<string, ChessColor>;
  fen: string;
  currentTurnColor: ChessColor;
  currentTurnPlayer: string | null;
  legalMovesByFrom: Record<string, string[]>;
  status: "running" | "finished";
  winner: string | null;
  isDraw: boolean;
  isCheck: boolean;
  lastMove: ChessMove | null;
};

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

export type LudoMoveKind = "move" | "capture" | "blocked" | "finished";

export type LudoMove = {
  playerName: string;
  roll: number;
  tokenIndex: number;
  from: number;
  to: number;
  kind: LudoMoveKind;
  capturedPlayers: string[];
};

export type LudoState = {
  roomCode: string;
  playerOrder: string[];
  tokenProgress: Record<string, number[]>;
  currentTurnIndex: number;
  status: "running" | "finished";
  winner: string | null;
  lastMove: LudoMove | null;
};

export type TicTacToeMark = "X" | "O";

export type TicTacToeCell = "" | TicTacToeMark;

export type TicTacToeMove = {
  playerName: string;
  mark: TicTacToeMark;
  index: number;
};

export type TicTacToeState = {
  roomCode: string;
  playerOrder: string[];
  marks: Record<string, TicTacToeMark>;
  board: TicTacToeCell[];
  currentTurnIndex: number;
  status: "running" | "finished";
  winner: string | null;
  isDraw: boolean;
  lastMove: TicTacToeMove | null;
};

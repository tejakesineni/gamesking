import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import type { LudoState, RoomUser } from "../../types/game";
import styles from "./LudoGame.module.css";

type LudoGameProps = {
  roomCode: string;
  socket: Socket | null;
  players: RoomUser[];
  localPlayerName: string;
  isSocketConnected: boolean;
  onlinePlayerNames: string[];
};

type GridPoint = { row: number; col: number };

type TokenPlacement = {
  playerName: string;
  playerIndex: number;
  tokenIndex: number;
  progress: number;
  left: string;
  top: string;
};

type LudoChoiceRequiredEvent = {
  roomCode: string;
  playerName: string;
  roll: number;
  movableTokenIndexes: number[];
};

const CENTER_POINT: GridPoint = { row: 7, col: 7 };

const BOARD_SIZE = 15;
const TOKEN_COUNT = 4;
const PLAYER_COLORS = ["#16a34a", "#facc15", "#38bdf8", "#ef4444"];
const LUDO_BOARD_TRACK_LENGTH = 52;
const LUDO_HOME_ENTRY_PROGRESS = 51;
const LUDO_HOME_LANE_LENGTH = 5;
const LUDO_CENTER_PROGRESS =
  LUDO_HOME_ENTRY_PROGRESS + LUDO_HOME_LANE_LENGTH + 1;
const LUDO_MAX_PROGRESS = LUDO_CENTER_PROGRESS;
const ENTRY_OFFSETS = [0, 13, 26, 39];
const ROLL_TIMEOUT_MS = 5000;
const SAFE_TRACK_INDEXES = [0, 8, 13, 21, 26, 34, 39, 47];
const ARROW_CELL_MAP: Record<string, "up" | "down" | "left" | "right"> = {
  "0-7": "down",
  "7-14": "left",
  "14-7": "up",
  "7-0": "right",
};

const TRACK_CELLS = buildTrackCells();
const TRACK_CELL_KEYS = new Set(
  TRACK_CELLS.map((cell) => `${cell.row}-${cell.col}`),
);
const SAFE_TRACK_KEYS = new Set(
  SAFE_TRACK_INDEXES.map((index) => TRACK_CELLS[index]).map(
    (cell) => `${cell.row}-${cell.col}`,
  ),
);
const START_TRACK_CLASS_BY_KEY: Record<string, string> = {
  [`${TRACK_CELLS[0].row}-${TRACK_CELLS[0].col}`]: "startGreen",
  [`${TRACK_CELLS[13].row}-${TRACK_CELLS[13].col}`]: "startYellow",
  [`${TRACK_CELLS[26].row}-${TRACK_CELLS[26].col}`]: "startBlue",
  [`${TRACK_CELLS[39].row}-${TRACK_CELLS[39].col}`]: "startRed",
};
const PLAYER_LANES: GridPoint[][] = [
  [
    { row: 7, col: 1 },
    { row: 7, col: 2 },
    { row: 7, col: 3 },
    { row: 7, col: 4 },
    { row: 7, col: 5 },
  ],
  [
    { row: 1, col: 7 },
    { row: 2, col: 7 },
    { row: 3, col: 7 },
    { row: 4, col: 7 },
    { row: 5, col: 7 },
  ],
  [
    { row: 7, col: 13 },
    { row: 7, col: 12 },
    { row: 7, col: 11 },
    { row: 7, col: 10 },
    { row: 7, col: 9 },
  ],
  [
    { row: 13, col: 7 },
    { row: 12, col: 7 },
    { row: 11, col: 7 },
    { row: 10, col: 7 },
    { row: 9, col: 7 },
  ],
];

const PLAYER_BASE_SLOTS: GridPoint[][] = [
  [
    { row: 2, col: 2 },
    { row: 2, col: 4 },
    { row: 4, col: 2 },
    { row: 4, col: 4 },
  ],
  [
    { row: 2, col: 10 },
    { row: 2, col: 12 },
    { row: 4, col: 10 },
    { row: 4, col: 12 },
  ],
  [
    { row: 10, col: 10 },
    { row: 10, col: 12 },
    { row: 12, col: 10 },
    { row: 12, col: 12 },
  ],
  [
    { row: 10, col: 2 },
    { row: 10, col: 4 },
    { row: 12, col: 2 },
    { row: 12, col: 4 },
  ],
];

function buildTrackCells() {
  return [
    { row: 6, col: 1 },
    { row: 6, col: 2 },
    { row: 6, col: 3 },
    { row: 6, col: 4 },
    { row: 6, col: 5 },
    { row: 5, col: 6 },
    { row: 4, col: 6 },
    { row: 3, col: 6 },
    { row: 2, col: 6 },
    { row: 1, col: 6 },
    { row: 0, col: 6 },
    { row: 0, col: 7 },
    { row: 0, col: 8 },
    { row: 1, col: 8 },
    { row: 2, col: 8 },
    { row: 3, col: 8 },
    { row: 4, col: 8 },
    { row: 5, col: 8 },
    { row: 6, col: 9 },
    { row: 6, col: 10 },
    { row: 6, col: 11 },
    { row: 6, col: 12 },
    { row: 6, col: 13 },
    { row: 6, col: 14 },
    { row: 7, col: 14 },
    { row: 8, col: 14 },
    { row: 8, col: 13 },
    { row: 8, col: 12 },
    { row: 8, col: 11 },
    { row: 8, col: 10 },
    { row: 8, col: 9 },
    { row: 9, col: 8 },
    { row: 10, col: 8 },
    { row: 11, col: 8 },
    { row: 12, col: 8 },
    { row: 13, col: 8 },
    { row: 14, col: 8 },
    { row: 14, col: 7 },
    { row: 14, col: 6 },
    { row: 13, col: 6 },
    { row: 12, col: 6 },
    { row: 11, col: 6 },
    { row: 10, col: 6 },
    { row: 9, col: 6 },
    { row: 8, col: 5 },
    { row: 8, col: 4 },
    { row: 8, col: 3 },
    { row: 8, col: 2 },
    { row: 8, col: 1 },
    { row: 8, col: 0 },
    { row: 7, col: 0 },
    { row: 6, col: 0 },
  ];
}

function getCellCenter(point: GridPoint) {
  return {
    left: `${((point.col + 0.5) / BOARD_SIZE) * 100}%`,
    top: `${((point.row + 0.5) / BOARD_SIZE) * 100}%`,
  };
}

function getTrackPoint(playerIndex: number, progress: number) {
  const startOffset = ENTRY_OFFSETS[playerIndex] ?? 0;
  const trackIndex = (startOffset + progress - 1) % LUDO_BOARD_TRACK_LENGTH;

  return TRACK_CELLS[trackIndex] ?? TRACK_CELLS[0];
}

function getBoardSlotIndex(playerCount: number, playerIndex: number) {
  if (playerCount === 2) {
    return playerIndex === 0 ? 0 : 2;
  }

  return Math.max(0, Math.min(3, playerIndex));
}

function getPerspectiveRotationSteps(playerBoardSlotIndex: number) {
  return (3 - playerBoardSlotIndex + 4) % 4;
}

function rotatePointClockwise(point: GridPoint, stepsClockwise: number) {
  let rotatedPoint = point;

  for (let step = 0; step < stepsClockwise; step += 1) {
    rotatedPoint = {
      row: rotatedPoint.col,
      col: BOARD_SIZE - 1 - rotatedPoint.row,
    };
  }

  return rotatedPoint;
}

function rotateArrowDirection(
  direction: "up" | "down" | "left" | "right",
  stepsClockwise: number,
) {
  const directions: Array<"up" | "right" | "down" | "left"> = [
    "up",
    "right",
    "down",
    "left",
  ];
  const directionIndex = directions.indexOf(direction);
  const rotatedIndex = (directionIndex + stepsClockwise) % directions.length;

  return directions[rotatedIndex] ?? direction;
}

function getTokenPoint(
  playerIndex: number,
  tokenIndex: number,
  progress: number,
) {
  const boundedPlayerIndex = Math.max(0, Math.min(3, playerIndex));
  const boundedTokenIndex = Math.max(0, Math.min(TOKEN_COUNT - 1, tokenIndex));

  if (progress <= 0) {
    return PLAYER_BASE_SLOTS[boundedPlayerIndex][boundedTokenIndex];
  }

  if (progress <= LUDO_HOME_ENTRY_PROGRESS) {
    return getTrackPoint(boundedPlayerIndex, progress);
  }

  if (progress >= LUDO_CENTER_PROGRESS) {
    return CENTER_POINT;
  }

  return (
    PLAYER_LANES[boundedPlayerIndex][progress - LUDO_HOME_ENTRY_PROGRESS - 1] ??
    PLAYER_LANES[boundedPlayerIndex][
      PLAYER_LANES[boundedPlayerIndex].length - 1
    ]
  );
}

function getBoardCellClass(row: number, col: number) {
  const cellKey = `${row}-${col}`;

  if (row >= 6 && row <= 8 && col >= 6 && col <= 8) {
    if (row === 7 && col === 7) {
      return styles.centerCore;
    }

    return styles.centerAround;
  }

  if (SAFE_TRACK_KEYS.has(cellKey)) {
    const startClassName = START_TRACK_CLASS_BY_KEY[cellKey];

    if (startClassName) {
      return (
        styles[startClassName as keyof typeof styles] ?? styles.safeTrackCell
      );
    }

    return styles.safeTrackCell;
  }

  if (TRACK_CELL_KEYS.has(cellKey)) {
    return styles.trackCell;
  }

  if (row >= 0 && row <= 5 && col >= 0 && col <= 5) {
    return styles.homeGreen;
  }

  if (row >= 0 && row <= 5 && col >= 9 && col <= 14) {
    return styles.homeYellow;
  }

  if (row >= 9 && row <= 14 && col >= 9 && col <= 14) {
    return styles.homeBlue;
  }

  if (row >= 9 && row <= 14 && col >= 0 && col <= 5) {
    return styles.homeRed;
  }

  if (row >= 1 && row <= 5 && col === 7) {
    return styles.laneYellow;
  }

  if (row === 7 && col >= 9 && col <= 13) {
    return styles.laneBlue;
  }

  if (row >= 9 && row <= 13 && col === 7) {
    return styles.laneRed;
  }

  if (row === 7 && col >= 1 && col <= 5) {
    return styles.laneGreen;
  }

  return styles.boardCell;
}

function getTrackIndexForCell(row: number, col: number) {
  return TRACK_CELLS.findIndex((cell) => cell.row === row && cell.col === col);
}

function getLaneIndexForCell(row: number, col: number) {
  const laneCells = PLAYER_LANES.flat();
  return laneCells.findIndex((cell) => cell.row === row && cell.col === col);
}

function moveKindCopy(kind: NonNullable<LudoState["lastMove"]>["kind"]) {
  if (kind === "capture") {
    return "Captured a token";
  }

  if (kind === "blocked") {
    return "No legal move";
  }

  if (kind === "finished") {
    return "Reached the finish";
  }

  return "Moved";
}

function resolveWinnerName(state: LudoState | null) {
  if (!state) {
    return null;
  }

  if (state.winner && state.winner.trim().length > 0) {
    return state.winner;
  }

  return null;
}

export default function LudoGame({
  roomCode,
  socket,
  players,
  localPlayerName,
  isSocketConnected,
  onlinePlayerNames,
}: LudoGameProps) {
  const [isHowToOpen, setIsHowToOpen] = useState(false);
  const [gameState, setGameState] = useState<LudoState | null>(null);
  const [gameError, setGameError] = useState("");
  const [pendingChoice, setPendingChoice] =
    useState<LudoChoiceRequiredEvent | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [diceFace, setDiceFace] = useState(1);
  const isHydratedRef = useRef(false);
  const isRollingRef = useRef(false);
  const diceAudioContextRef = useRef<AudioContext | null>(null);
  const diceAudioPulseIntervalRef = useRef<number | null>(null);
  const diceAudioStopTimeoutRef = useRef<number | null>(null);
  const rollStartedAtRef = useRef(0);
  const pendingStateTimeoutRef = useRef<number | null>(null);
  const rollTimeoutRef = useRef<number | null>(null);
  const infoPopoverRef = useRef<HTMLDivElement | null>(null);

  const playerOrder =
    gameState?.playerOrder ??
    players.map((player) => player.playerName).slice(0, 4);
  const currentTurnPlayer =
    gameState && playerOrder.length
      ? (playerOrder[gameState.currentTurnIndex] ?? "")
      : "";
  const isMyTurn =
    !!localPlayerName &&
    gameState?.status === "running" &&
    currentTurnPlayer === localPlayerName;
  const winnerName = resolveWinnerName(gameState);
  const activePlayers = playerOrder.slice(0, 4);
  const localPlayerOrderIndex = activePlayers.indexOf(localPlayerName);
  const localPlayerBoardSlotIndex =
    localPlayerOrderIndex >= 0
      ? getBoardSlotIndex(activePlayers.length, localPlayerOrderIndex)
      : 3;
  const perspectiveRotationSteps = getPerspectiveRotationSteps(
    localPlayerBoardSlotIndex,
  );

  useEffect(() => {
    const resetTimeoutId = window.setTimeout(() => {
      if (diceAudioPulseIntervalRef.current !== null) {
        window.clearInterval(diceAudioPulseIntervalRef.current);
        diceAudioPulseIntervalRef.current = null;
      }

      if (diceAudioStopTimeoutRef.current !== null) {
        window.clearTimeout(diceAudioStopTimeoutRef.current);
        diceAudioStopTimeoutRef.current = null;
      }

      if (pendingStateTimeoutRef.current !== null) {
        window.clearTimeout(pendingStateTimeoutRef.current);
        pendingStateTimeoutRef.current = null;
      }

      if (rollTimeoutRef.current !== null) {
        window.clearTimeout(rollTimeoutRef.current);
        rollTimeoutRef.current = null;
      }

      rollStartedAtRef.current = 0;
      setGameState(null);
      setGameError("");
      setPendingChoice(null);
      setIsRolling(false);
      isRollingRef.current = false;
      setDiceFace(1);
      isHydratedRef.current = false;
    }, 0);

    return () => {
      window.clearTimeout(resetTimeoutId);
    };
  }, [roomCode]);

  useEffect(() => {
    const onDocumentPointerDown = (event: PointerEvent) => {
      if (
        infoPopoverRef.current &&
        !infoPopoverRef.current.contains(event.target as Node)
      ) {
        setIsHowToOpen(false);
      }
    };

    const onDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsHowToOpen(false);
      }
    };

    document.addEventListener("pointerdown", onDocumentPointerDown);
    document.addEventListener("keydown", onDocumentKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onDocumentPointerDown);
      document.removeEventListener("keydown", onDocumentKeyDown);
    };
  }, []);

  useEffect(() => {
    const stopDiceRollingSound = () => {
      if (diceAudioPulseIntervalRef.current !== null) {
        window.clearInterval(diceAudioPulseIntervalRef.current);
        diceAudioPulseIntervalRef.current = null;
      }

      if (diceAudioStopTimeoutRef.current !== null) {
        window.clearTimeout(diceAudioStopTimeoutRef.current);
        diceAudioStopTimeoutRef.current = null;
      }
    };

    if (!isRolling) {
      stopDiceRollingSound();
      return;
    }

    const createPulse = (context: AudioContext) => {
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      const now = context.currentTime;
      const durationSeconds = 0.075;
      const baseFrequency = 150 + Math.random() * 100;

      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(baseFrequency, now);
      oscillator.frequency.linearRampToValueAtTime(
        baseFrequency - 45,
        now + durationSeconds,
      );

      gainNode.gain.setValueAtTime(0.0001, now);
      gainNode.gain.linearRampToValueAtTime(0.045, now + 0.012);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + durationSeconds);

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);

      oscillator.start(now);
      oscillator.stop(now + durationSeconds);
    };

    const AudioContextImpl = window.AudioContext;

    if (!AudioContextImpl) {
      return;
    }

    try {
      if (!diceAudioContextRef.current) {
        diceAudioContextRef.current = new AudioContextImpl();
      }

      const audioContext = diceAudioContextRef.current;
      void audioContext.resume();

      createPulse(audioContext);
      diceAudioPulseIntervalRef.current = window.setInterval(() => {
        createPulse(audioContext);
      }, 95);

      diceAudioStopTimeoutRef.current = window.setTimeout(() => {
        stopDiceRollingSound();
      }, 2600);
    } catch {
      stopDiceRollingSound();
    }

    const intervalId = window.setInterval(() => {
      setDiceFace(Math.floor(Math.random() * 6) + 1);
    }, 90);

    return () => {
      window.clearInterval(intervalId);
      stopDiceRollingSound();
    };
  }, [isRolling]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const onState = (payload: LudoState) => {
      if (payload.roomCode !== roomCode) {
        return;
      }

      if (rollTimeoutRef.current !== null) {
        window.clearTimeout(rollTimeoutRef.current);
        rollTimeoutRef.current = null;
      }

      if (payload.lastMove?.roll) {
        setDiceFace(payload.lastMove.roll);
      }

      setGameState(payload);
      setIsRolling(false);
      isRollingRef.current = false;
      setGameError("");
      setPendingChoice(null);
      rollStartedAtRef.current = 0;
      isHydratedRef.current = true;
    };

    const onChoiceRequired = (payload: LudoChoiceRequiredEvent) => {
      if (payload.roomCode !== roomCode) {
        return;
      }

      if (rollTimeoutRef.current !== null) {
        window.clearTimeout(rollTimeoutRef.current);
        rollTimeoutRef.current = null;
      }

      setDiceFace(payload.roll);
      setIsRolling(false);
      isRollingRef.current = false;
      rollStartedAtRef.current = 0;

      if (payload.playerName === localPlayerName) {
        setPendingChoice(payload);
        setGameError("");
      }
    };

    const onError = (payload: { roomCode: string; message?: string }) => {
      if (payload.roomCode !== roomCode) {
        return;
      }

      if (pendingStateTimeoutRef.current !== null) {
        window.clearTimeout(pendingStateTimeoutRef.current);
        pendingStateTimeoutRef.current = null;
      }

      if (rollTimeoutRef.current !== null) {
        window.clearTimeout(rollTimeoutRef.current);
        rollTimeoutRef.current = null;
      }

      rollStartedAtRef.current = 0;
      setGameError(payload.message ?? "Unable to process the move.");
      setIsRolling(false);
      isRollingRef.current = false;
    };

    socket.on("ludo:state", onState);
    socket.on("ludo:choice-required", onChoiceRequired);
    socket.on("ludo:error", onError);
    socket.emit("ludo:sync", { roomCode });

    return () => {
      if (pendingStateTimeoutRef.current !== null) {
        window.clearTimeout(pendingStateTimeoutRef.current);
        pendingStateTimeoutRef.current = null;
      }

      if (rollTimeoutRef.current !== null) {
        window.clearTimeout(rollTimeoutRef.current);
        rollTimeoutRef.current = null;
      }

      socket.off("ludo:state", onState);
      socket.off("ludo:choice-required", onChoiceRequired);
      socket.off("ludo:error", onError);
    };
  }, [localPlayerName, roomCode, socket]);

  const onRollDice = () => {
    if (!socket || !socket.connected || !localPlayerName || !isMyTurn) {
      return;
    }

    rollStartedAtRef.current = Date.now();

    if (pendingStateTimeoutRef.current !== null) {
      window.clearTimeout(pendingStateTimeoutRef.current);
      pendingStateTimeoutRef.current = null;
    }

    if (rollTimeoutRef.current !== null) {
      window.clearTimeout(rollTimeoutRef.current);
      rollTimeoutRef.current = null;
    }

    setIsRolling(true);
    isRollingRef.current = true;
    setPendingChoice(null);
    setGameError("");
    socket.emit("ludo:roll", {
      roomCode,
      playerName: localPlayerName,
    });

    rollTimeoutRef.current = window.setTimeout(() => {
      rollTimeoutRef.current = null;
      if (isRollingRef.current) {
        isRollingRef.current = false;
        setIsRolling(false);
        setGameError("Roll timed out. Please try again.");
      }
    }, ROLL_TIMEOUT_MS);
  };

  const onChooseToken = (tokenIndex: number) => {
    if (!socket || !socket.connected || !localPlayerName || !pendingChoice) {
      return;
    }

    if (!pendingChoice.movableTokenIndexes.includes(tokenIndex)) {
      return;
    }

    setPendingChoice(null);
    setGameError("");
    socket.emit("ludo:roll", {
      roomCode,
      playerName: localPlayerName,
      tokenIndex,
    });
  };

  const tokenEntries: TokenPlacement[] = activePlayers.flatMap(
    (playerName, playerIndex) => {
      const boardSlotIndex = getBoardSlotIndex(
        activePlayers.length,
        playerIndex,
      );
      const progresses =
        gameState?.tokenProgress[playerName] ??
        Array.from({ length: TOKEN_COUNT }, () => 0);

      return progresses.map((progress, tokenIndex) => {
        const position = getTokenPoint(boardSlotIndex, tokenIndex, progress);
        const renderedPosition = rotatePointClockwise(
          position,
          perspectiveRotationSteps,
        );

        return {
          playerName,
          playerIndex: boardSlotIndex,
          tokenIndex,
          progress,
          ...getCellCenter(renderedPosition),
        };
      });
    },
  );

  const groupedEntries = tokenEntries.reduce<Record<string, TokenPlacement[]>>(
    (accumulator, entry) => {
      const key = `${entry.left}-${entry.top}`;
      accumulator[key] = accumulator[key] ?? [];
      accumulator[key].push(entry);
      return accumulator;
    },
    {},
  );

  const boardCells = Array.from(
    { length: BOARD_SIZE * BOARD_SIZE },
    (_, index) => {
      const row = Math.floor(index / BOARD_SIZE);
      const col = index % BOARD_SIZE;
      const renderedPoint = rotatePointClockwise(
        { row, col },
        perspectiveRotationSteps,
      );
      const canonicalArrowDirection = ARROW_CELL_MAP[`${row}-${col}`];
      const arrowDirection = canonicalArrowDirection
        ? rotateArrowDirection(
            canonicalArrowDirection,
            perspectiveRotationSteps,
          )
        : undefined;
      const trackIndex = getTrackIndexForCell(row, col);
      const laneIndex = getLaneIndexForCell(row, col);

      return (
        <div
          key={`${row}-${col}`}
          className={`${styles.boardCellBase} ${getBoardCellClass(row, col)}`}
          data-arrow={arrowDirection}
          style={{
            gridRowStart: renderedPoint.row + 1,
            gridColumnStart: renderedPoint.col + 1,
          }}
        >
          {trackIndex >= 0 ? (
            <span className={styles.trackIndexLabel}>{trackIndex + 1}</span>
          ) : null}
          {laneIndex >= 0 ? (
            <span className={styles.laneIndexLabel}>
              {((laneIndex % 5) + 1).toString()}
            </span>
          ) : null}
        </div>
      );
    },
  );
  const isAwaitingLocalChoice =
    !!pendingChoice && pendingChoice.playerName === localPlayerName;

  return (
    <section className={styles.surface}>
      <div className={styles.headerRow}>
        <div>
          <h2>Ludo</h2>
        </div>

        <div className={styles.infoWrap} ref={infoPopoverRef}>
          <button
            type="button"
            className={styles.infoButton}
            onClick={() => setIsHowToOpen((currentValue) => !currentValue)}
            aria-haspopup="dialog"
            aria-expanded={isHowToOpen}
            aria-label="How to play"
          >
            i
          </button>

          {isHowToOpen ? (
            <div
              className={styles.infoPopover}
              role="dialog"
              aria-label="How to play"
            >
              <strong>How to play</strong>
              <ul>
                <li>Click the dice on your turn to roll.</li>
                <li>Roll a 6 to release a token from home.</li>
                <li>Landing on an opponent captures that token.</li>
                <li>Get all four tokens to the finish lane to win.</li>
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      {gameState?.status === "finished" && winnerName ? (
        <div className={styles.winnerBanner}>
          Game completed. Winner: <strong>{winnerName}</strong>
        </div>
      ) : null}

      {gameState?.lastMove ? (
        <div className={styles.lastMove} data-kind={gameState.lastMove.kind}>
          <strong>{gameState.lastMove.playerName}</strong> rolled{" "}
          {gameState.lastMove.roll}. {moveKindCopy(gameState.lastMove.kind)} (
          {gameState.lastMove.from} → {gameState.lastMove.to})
          {gameState.lastMove.capturedPlayers.length > 0 ? (
            <span>
              {" "}
              Captured {gameState.lastMove.capturedPlayers.join(", ")}
            </span>
          ) : null}
        </div>
      ) : null}

      {gameError ? <div className={styles.errorBanner}>{gameError}</div> : null}

      <div className={styles.gameArea}>
        <div className={styles.boardFrame}>
          <div className={styles.board}>
            {boardCells}

            <div className={styles.centerZoneOverlay} aria-hidden="true" />

            {Object.values(groupedEntries).flatMap((entries) =>
              entries.map((entry, index) => {
                const stackOffset = (index - (entries.length - 1) / 2) * 0.18;
                const selectable =
                  isAwaitingLocalChoice &&
                  entry.playerName === localPlayerName &&
                  !!pendingChoice &&
                  pendingChoice.movableTokenIndexes.includes(entry.tokenIndex);

                return (
                  <div
                    key={`${entry.playerName}-${entry.tokenIndex}`}
                    className={`${styles.token} ${
                      gameState?.lastMove?.playerName === entry.playerName &&
                      gameState.lastMove.tokenIndex === entry.tokenIndex
                        ? styles.tokenActive
                        : ""
                    } ${selectable ? styles.tokenSelectable : ""}`}
                    style={{
                      left: entry.left,
                      top: entry.top,
                      transform: `translate(-50%, -50%) translateX(${stackOffset}rem)`,
                      backgroundColor:
                        PLAYER_COLORS[entry.playerIndex % PLAYER_COLORS.length],
                    }}
                    role={selectable ? "button" : undefined}
                    tabIndex={selectable ? 0 : undefined}
                    onClick={
                      selectable
                        ? () => onChooseToken(entry.tokenIndex)
                        : undefined
                    }
                    onKeyDown={
                      selectable
                        ? (event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              onChooseToken(entry.tokenIndex);
                            }
                          }
                        : undefined
                    }
                    title={`${entry.playerName} token ${entry.tokenIndex + 1}: ${entry.progress}`}
                  >
                    {entry.tokenIndex + 1}
                  </div>
                );
              }),
            )}
          </div>
        </div>

        <div className={styles.sidebar}>
          <div className={styles.dicePanel}>
            <button
              type="button"
              className={styles.diceTrigger}
              onClick={onRollDice}
              disabled={
                !isSocketConnected || !isMyTurn || isRolling || !!pendingChoice
              }
              aria-label={
                isRolling
                  ? "Dice is rolling"
                  : isMyTurn
                    ? `Roll dice. Current face ${diceFace}`
                    : `Dice shows ${diceFace}`
              }
            >
              <div className={styles.diceScene}>
                <div
                  className={`${styles.diceCube} ${
                    isRolling ? styles.rolling : styles[`show${diceFace}`]
                  }`}
                >
                  <span className={`${styles.diceFace} ${styles.face1}`}>
                    1
                  </span>
                  <span className={`${styles.diceFace} ${styles.face2}`}>
                    2
                  </span>
                  <span className={`${styles.diceFace} ${styles.face3}`}>
                    3
                  </span>
                  <span className={`${styles.diceFace} ${styles.face4}`}>
                    4
                  </span>
                  <span className={`${styles.diceFace} ${styles.face5}`}>
                    5
                  </span>
                  <span className={`${styles.diceFace} ${styles.face6}`}>
                    6
                  </span>
                </div>
              </div>
            </button>

            <div className={styles.diceCaption}>
              {isAwaitingLocalChoice
                ? `You rolled ${pendingChoice.roll}. Tap a coin to move.`
                : isMyTurn
                  ? "Your turn"
                  : currentTurnPlayer
                    ? `${currentTurnPlayer}'s turn`
                    : "Waiting for game"}
            </div>
          </div>

          <div className={styles.playerLegendPanel}>
            <ul className={styles.playerLegendGrid}>
              {activePlayers.map((playerName, index) => {
                const boardSlotIndex = getBoardSlotIndex(
                  activePlayers.length,
                  index,
                );
                const isCurrentPlayer = currentTurnPlayer === playerName;
                const playerOnline = onlinePlayerNames.includes(playerName);
                const tokenProgress = gameState?.tokenProgress[playerName] ?? [
                  0, 0, 0, 0,
                ];
                const finishedCount = tokenProgress.filter(
                  (progress) => progress === LUDO_MAX_PROGRESS,
                ).length;

                return (
                  <li
                    key={playerName}
                    className={`${styles.playerLegendItem} ${
                      isCurrentPlayer ? styles.playerLegendItemActive : ""
                    } ${playerOnline ? "" : styles.playerLegendItemOffline}`}
                  >
                    <span
                      className={styles.playerDot}
                      style={{
                        backgroundColor: playerOnline
                          ? PLAYER_COLORS[boardSlotIndex % PLAYER_COLORS.length]
                          : "#b91c1c",
                      }}
                    />
                    <span
                      className={`${styles.playerLegendName} ${
                        playerOnline ? "" : styles.playerLegendNameOffline
                      }`}
                    >
                      {playerName}
                    </span>
                    <span
                      className={`${styles.playerLegendBadge} ${
                        playerOnline
                          ? isCurrentPlayer
                            ? styles.playerLegendBadgePlaying
                            : ""
                          : styles.playerLegendBadgeOffline
                      }`}
                    >
                      {playerOnline
                        ? isCurrentPlayer
                          ? "Playing"
                          : "Online"
                        : "Offline"}
                    </span>
                    <span className={styles.playerLegendMeta}>
                      {finishedCount}/4 home
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import type {
  RoomUser,
  SnakesAndLaddersState,
  SnakesAndLaddersMoveKind,
} from "../../types/game";
import sandlBoardImage from "../../assets/sandl.jpg";
import styles from "./SnakesAndLaddersGame.module.css";

type SnakesAndLaddersGameProps = {
  roomCode: string;
  socket: Socket | null;
  players: RoomUser[];
  localPlayerName: string;
  isSocketConnected: boolean;
  onlinePlayerNames: string[];
};

const BOARD_SIZE = 10;
const PLAYER_COLORS = ["#f97316", "#0ea5e9", "#8b5cf6", "#16a34a", "#e11d48"];
const STEP_MOVE_DELAY_MS = 160;
const MIN_DICE_ROLL_MS = 1400;

function buildStepPath(from: number, to: number) {
  if (from === to) {
    return [] as number[];
  }

  const direction = to > from ? 1 : -1;
  const path: number[] = [];

  for (
    let position = from + direction;
    position !== to + direction;
    position += direction
  ) {
    path.push(position);
  }

  return path;
}

function getTokenPosition(position: number) {
  if (position <= 0) {
    return {
      left: "4%",
      top: "96%",
    };
  }

  const rowFromBottom = Math.floor((position - 1) / BOARD_SIZE);
  const indexInRow = (position - 1) % BOARD_SIZE;
  const col =
    rowFromBottom % 2 === 0 ? indexInRow : BOARD_SIZE - 1 - indexInRow;
  const left = ((col + 0.5) / BOARD_SIZE) * 100;
  const top = 100 - ((rowFromBottom + 0.5) / BOARD_SIZE) * 100;

  return {
    left: `${left}%`,
    top: `${top}%`,
  };
}

function moveKindCopy(kind: SnakesAndLaddersMoveKind) {
  if (kind === "ladder") {
    return "Climbed a ladder";
  }

  if (kind === "snake") {
    return "Bitten by a snake";
  }

  if (kind === "blocked") {
    return "Needed an exact roll";
  }

  return "Moved forward";
}

function resolveWinnerName(state: SnakesAndLaddersState | null) {
  if (!state) {
    return null;
  }

  if (state.winner && state.winner.trim().length > 0) {
    return state.winner;
  }

  const playerAtFinish = state.playerOrder.find(
    (playerName) => (state.positions[playerName] ?? 0) >= 100,
  );

  return playerAtFinish ?? null;
}

export default function SnakesAndLaddersGame({
  roomCode,
  socket,
  players,
  localPlayerName,
  isSocketConnected,
  onlinePlayerNames,
}: SnakesAndLaddersGameProps) {
  const [isHowToOpen, setIsHowToOpen] = useState(false);
  const [gameState, setGameState] = useState<SnakesAndLaddersState | null>(
    null,
  );
  const [gameError, setGameError] = useState("");
  const [isRolling, setIsRolling] = useState(false);
  const [diceFace, setDiceFace] = useState(1);
  const [animatedPositions, setAnimatedPositions] = useState<
    Record<string, number>
  >({});
  const lastAnimatedMoveKeyRef = useRef("");
  const isHydratedRef = useRef(false);
  const animationTimeoutsRef = useRef<number[]>([]);
  const diceAudioContextRef = useRef<AudioContext | null>(null);
  const diceAudioPulseIntervalRef = useRef<number | null>(null);
  const diceAudioStopTimeoutRef = useRef<number | null>(null);
  const rollStartedAtRef = useRef(0);
  const pendingStateTimeoutRef = useRef<number | null>(null);
  const infoPopoverRef = useRef<HTMLDivElement | null>(null);

  const playerOrder =
    gameState?.playerOrder ?? players.map((player) => player.playerName);
  const currentTurnPlayer =
    gameState && playerOrder.length
      ? (playerOrder[gameState.currentTurnIndex] ?? "")
      : "";
  const isMyTurn =
    !!localPlayerName &&
    gameState?.status === "running" &&
    currentTurnPlayer === localPlayerName;
  const winnerName = resolveWinnerName(gameState);

  useEffect(() => {
    const resetTimeoutId = window.setTimeout(() => {
      animationTimeoutsRef.current.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      animationTimeoutsRef.current = [];

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

      rollStartedAtRef.current = 0;

      setGameState(null);
      setGameError("");
      setIsRolling(false);
      setDiceFace(1);
      setAnimatedPositions({});
      lastAnimatedMoveKeyRef.current = "";
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

      // Hard stop guard for edge cases where no state update arrives.
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

    const onState = (payload: SnakesAndLaddersState) => {
      if (payload.roomCode !== roomCode) {
        return;
      }

      const move = payload.lastMove;

      const applyStatePayload = () => {
        if (payload.lastMove?.roll) {
          setDiceFace(payload.lastMove.roll);
        }

        setGameState(payload);
        setIsRolling(false);
        setGameError("");
        rollStartedAtRef.current = 0;

        const moveKey = move
          ? `${move.playerName}-${move.from}-${move.roll}-${move.to}-${payload.currentTurnIndex}-${payload.status}`
          : "";

        if (!isHydratedRef.current) {
          setAnimatedPositions(payload.positions);
          isHydratedRef.current = true;
          lastAnimatedMoveKeyRef.current = moveKey;
          return;
        }

        if (!move || lastAnimatedMoveKeyRef.current === moveKey) {
          setAnimatedPositions(payload.positions);
          return;
        }

        lastAnimatedMoveKeyRef.current = moveKey;

        animationTimeoutsRef.current.forEach((timeoutId) => {
          window.clearTimeout(timeoutId);
        });
        animationTimeoutsRef.current = [];

        const isBlockedMove = move.kind === "blocked";
        const rollLandingPosition = isBlockedMove
          ? move.from
          : Math.min(100, move.from + move.roll);
        const basePositions = {
          ...payload.positions,
          [move.playerName]: move.from,
        };
        const regularPath = buildStepPath(move.from, rollLandingPosition);
        const hasSnakeOrLadderJump =
          (move.kind === "snake" || move.kind === "ladder") &&
          rollLandingPosition !== move.to;

        setAnimatedPositions(basePositions);

        if (regularPath.length === 0 && !hasSnakeOrLadderJump) {
          setAnimatedPositions(payload.positions);
          return;
        }

        regularPath.forEach((position, index) => {
          const timeoutId = window.setTimeout(
            () => {
              setAnimatedPositions((currentPositions) => ({
                ...currentPositions,
                [move.playerName]: position,
              }));
            },
            STEP_MOVE_DELAY_MS * (index + 1),
          );

          animationTimeoutsRef.current.push(timeoutId);
        });

        const regularPathFinishDelay = STEP_MOVE_DELAY_MS * regularPath.length;

        if (hasSnakeOrLadderJump) {
          const jumpTimeoutId = window.setTimeout(() => {
            setAnimatedPositions((currentPositions) => ({
              ...currentPositions,
              [move.playerName]: move.to,
            }));
          }, regularPathFinishDelay + STEP_MOVE_DELAY_MS);
          animationTimeoutsRef.current.push(jumpTimeoutId);
        }

        const settleTimeoutId = window.setTimeout(
          () => {
            setAnimatedPositions(payload.positions);
          },
          regularPathFinishDelay +
            STEP_MOVE_DELAY_MS * (hasSnakeOrLadderJump ? 2 : 1),
        );
        animationTimeoutsRef.current.push(settleTimeoutId);
      };

      if (pendingStateTimeoutRef.current !== null) {
        window.clearTimeout(pendingStateTimeoutRef.current);
        pendingStateTimeoutRef.current = null;
      }

      const isLocalRollResult =
        !!move &&
        !!localPlayerName &&
        move.playerName === localPlayerName &&
        isRolling &&
        rollStartedAtRef.current > 0;

      if (isLocalRollResult) {
        const elapsedMs = Date.now() - rollStartedAtRef.current;
        const remainingMs = MIN_DICE_ROLL_MS - elapsedMs;

        if (remainingMs > 0) {
          pendingStateTimeoutRef.current = window.setTimeout(() => {
            pendingStateTimeoutRef.current = null;
            applyStatePayload();
          }, remainingMs);
          return;
        }
      }

      applyStatePayload();
    };

    const onError = (payload: { roomCode: string; message?: string }) => {
      if (payload.roomCode !== roomCode) {
        return;
      }

      if (pendingStateTimeoutRef.current !== null) {
        window.clearTimeout(pendingStateTimeoutRef.current);
        pendingStateTimeoutRef.current = null;
      }

      rollStartedAtRef.current = 0;

      setGameError(payload.message ?? "Unable to process the move.");
      setIsRolling(false);
    };

    socket.on("snl:state", onState);
    socket.on("snl:error", onError);
    socket.emit("snl:sync", { roomCode });

    return () => {
      animationTimeoutsRef.current.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      animationTimeoutsRef.current = [];

      if (pendingStateTimeoutRef.current !== null) {
        window.clearTimeout(pendingStateTimeoutRef.current);
        pendingStateTimeoutRef.current = null;
      }

      socket.off("snl:state", onState);
      socket.off("snl:error", onError);
    };
  }, [isRolling, localPlayerName, roomCode, socket]);

  const onRollDice = () => {
    if (!socket || !socket.connected || !localPlayerName || !isMyTurn) {
      return;
    }

    rollStartedAtRef.current = Date.now();

    if (pendingStateTimeoutRef.current !== null) {
      window.clearTimeout(pendingStateTimeoutRef.current);
      pendingStateTimeoutRef.current = null;
    }

    setIsRolling(true);
    setGameError("");
    socket.emit("snl:roll", {
      roomCode,
      playerName: localPlayerName,
    });
  };

  const playerLegendPlayers = (gameState?.playerOrder ?? playerOrder).slice(
    0,
    4,
  );
  const isPlayerOnline = (playerName: string) =>
    onlinePlayerNames.includes(playerName);

  return (
    <section className={styles.surface}>
      <div className={styles.headerRow}>
        <div>
          <h2>Snakes and Ladders</h2>
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
                <li>Tokens move cell by cell for the roll.</li>
                <li>Landing on a snake or ladder jumps to the other end.</li>
                <li>Reach 100 exactly to win the game.</li>
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
        </div>
      ) : null}

      {gameError ? <div className={styles.errorBanner}>{gameError}</div> : null}

      <div className={styles.gameArea}>
        <div className={styles.boardFrame}>
          <div
            className={styles.board}
            style={{
              backgroundImage: `url(${sandlBoardImage})`,
            }}
          >
            {(gameState?.playerOrder ?? []).map((playerName, playerIndex) => {
              const position =
                animatedPositions[playerName] ??
                gameState?.positions[playerName] ??
                0;
              const coordinates = getTokenPosition(position);
              const stackedPlayers = (gameState?.playerOrder ?? []).filter(
                (name) =>
                  (animatedPositions[name] ??
                    gameState?.positions[name] ??
                    0) === position,
              );
              const stackedIndex = stackedPlayers.indexOf(playerName);
              const offset =
                (stackedIndex - (stackedPlayers.length - 1) / 2) * 14;

              return (
                <div
                  key={playerName}
                  className={`${styles.token} ${
                    gameState?.lastMove?.playerName === playerName
                      ? styles.tokenActive
                      : ""
                  }`}
                  style={{
                    left: coordinates.left,
                    top: coordinates.top,
                    backgroundColor:
                      PLAYER_COLORS[playerIndex % PLAYER_COLORS.length],
                    transform: `translate(-50%, -50%) translateX(${offset}px)`,
                  }}
                  title={`${playerName}: ${position}`}
                >
                  {playerName.charAt(0).toUpperCase()}
                </div>
              );
            })}
          </div>

          <div className={styles.boardDiceDock}>
            <div className={styles.dicePanel}>
              <button
                type="button"
                className={styles.diceTrigger}
                onClick={onRollDice}
                disabled={!isSocketConnected || !isMyTurn || isRolling}
                aria-label={
                  isRolling
                    ? "Dice is rolling"
                    : isMyTurn
                      ? `Roll dice. Current face ${diceFace}`
                      : `Dice shows ${diceFace}`
                }
              >
                <div
                  className={`${styles.diceScene} ${
                    isRolling ? styles.diceSceneRolling : ""
                  }`}
                >
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
            </div>

            <div className={styles.playerLegendPanel}>
              <ul className={styles.playerLegendGrid}>
                {playerLegendPlayers.map((playerName, index) => {
                  const isCurrentPlayer = currentTurnPlayer === playerName;
                  const playerOnline = isPlayerOnline(playerName);

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
                            ? PLAYER_COLORS[index % PLAYER_COLORS.length]
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
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

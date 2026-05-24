import { useEffect, useMemo, useState } from "react";
import type { Socket } from "socket.io-client";
import type { RoomUser, TicTacToeState } from "../../types/game";
import styles from "./TicTacToeGame.module.css";

type TicTacToeGameProps = {
  roomCode: string;
  socket: Socket | null;
  players: RoomUser[];
  localPlayerName: string;
  isSocketConnected: boolean;
  onlinePlayerNames: string[];
};

const PLAYER_COLORS = ["#f97316", "#0ea5e9", "#8b5cf6", "#16a34a"];

export default function TicTacToeGame({
  roomCode,
  socket,
  players,
  localPlayerName,
  isSocketConnected,
  onlinePlayerNames,
}: TicTacToeGameProps) {
  const [gameState, setGameState] = useState<TicTacToeState | null>(null);
  const [gameError, setGameError] = useState("");

  const playerOrder =
    gameState?.playerOrder ??
    players.map((player) => player.playerName).slice(0, 2);
  const currentTurnPlayer =
    gameState && playerOrder.length
      ? (playerOrder[gameState.currentTurnIndex] ?? "")
      : "";

  const markColorMap = useMemo(() => {
    const colorsByMark: Partial<Record<"X" | "O", string>> = {};

    if (!gameState) {
      return colorsByMark;
    }

    playerOrder.forEach((playerName, index) => {
      const mark = gameState.marks[playerName];

      if (!mark) {
        return;
      }

      colorsByMark[mark] = PLAYER_COLORS[index % PLAYER_COLORS.length];
    });

    return colorsByMark;
  }, [gameState, playerOrder]);

  const isMyTurn =
    !!localPlayerName &&
    gameState?.status === "running" &&
    currentTurnPlayer === localPlayerName;

  useEffect(() => {
    if (!socket) {
      return;
    }

    const onState = (payload: TicTacToeState) => {
      if (payload.roomCode !== roomCode) {
        return;
      }

      setGameState(payload);
      setGameError("");
    };

    const onError = (payload: { roomCode: string; message?: string }) => {
      if (payload.roomCode !== roomCode) {
        return;
      }

      setGameError(payload.message ?? "Unable to process this move.");
    };

    socket.on("ttt:state", onState);
    socket.on("ttt:error", onError);
    socket.emit("ttt:sync", { roomCode });

    return () => {
      socket.off("ttt:state", onState);
      socket.off("ttt:error", onError);
    };
  }, [roomCode, socket]);

  const onMove = (index: number) => {
    if (!socket || !socket.connected || !localPlayerName || !isMyTurn) {
      return;
    }

    if (!gameState || gameState.board[index] !== "") {
      return;
    }

    setGameError("");
    socket.emit("ttt:move", {
      roomCode,
      playerName: localPlayerName,
      index,
    });
  };

  const board = gameState?.board ?? Array.from({ length: 9 }, () => "" as "");

  return (
    <section className={styles.surface}>
      <div className={styles.headerRow}>
        <div>
          <h2>Tic Tac Toe</h2>
        </div>
      </div>

      {gameState?.status === "finished" ? (
        <div className={styles.winnerBanner}>
          {gameState.isDraw ? (
            <span>Game completed. It is a draw.</span>
          ) : (
            <span>
              Game completed. Winner: <strong>{gameState.winner}</strong>
            </span>
          )}
        </div>
      ) : null}

      {gameState?.lastMove ? (
        <div className={styles.lastMove}>
          <strong>{gameState.lastMove.playerName}</strong> placed a token at
          cell {gameState.lastMove.index + 1}.
        </div>
      ) : null}

      {gameError ? <div className={styles.errorBanner}>{gameError}</div> : null}

      <div className={styles.gameArea}>
        <div className={styles.boardWrap}>
          <div className={styles.board}>
            {board.map((cell, index) => (
              <button
                key={index}
                type="button"
                className={`${styles.cell} ${cell ? styles.cellFilled : ""}`}
                onClick={() => onMove(index)}
                disabled={
                  !isSocketConnected ||
                  !isMyTurn ||
                  gameState?.status !== "running" ||
                  cell !== ""
                }
                aria-label={`Cell ${index + 1}${cell ? ", occupied" : ""}`}
              >
                {cell ? (
                  <span
                    className={styles.cellToken}
                    style={{
                      backgroundColor: markColorMap[cell] ?? "#4d2d15",
                    }}
                    aria-hidden="true"
                  />
                ) : null}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.legendDock}>
          <div className={styles.playerLegendPanel}>
            <ul className={styles.playerLegendGrid}>
              {playerOrder.map((playerName, index) => {
                const isCurrentPlayer = currentTurnPlayer === playerName;
                const playerOnline = onlinePlayerNames.includes(playerName);
                const playerColor = playerOnline
                  ? PLAYER_COLORS[index % PLAYER_COLORS.length]
                  : "#b91c1c";

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
                        backgroundColor: playerColor,
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
    </section>
  );
}

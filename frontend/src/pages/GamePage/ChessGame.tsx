import { useEffect, useMemo, useState } from "react";
import type { Socket } from "socket.io-client";
import type { ChessColor, ChessState, RoomUser } from "../../types/game";
import styles from "./ChessGame.module.css";

type ChessGameProps = {
  roomCode: string;
  socket: Socket | null;
  players: RoomUser[];
  localPlayerName: string;
  isSocketConnected: boolean;
  onlinePlayerNames: string[];
};

type PieceEntry = {
  code: string;
  isWhite: boolean;
};

const PLAYER_COLORS = ["#f97316", "#0ea5e9", "#8b5cf6", "#16a34a"];
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"] as const;

const PIECE_UNICODE: Record<string, string> = {
  P: "♙",
  N: "♘",
  B: "♗",
  R: "♖",
  Q: "♕",
  K: "♔",
  p: "♟",
  n: "♞",
  b: "♝",
  r: "♜",
  q: "♛",
  k: "♚",
};

function getPieceMapFromFen(fen: string) {
  const boardPart = fen.split(" ")[0] ?? "";
  const rows = boardPart.split("/");
  const map = new Map<string, PieceEntry>();

  rows.forEach((rowPart, rowIndex) => {
    let fileIndex = 0;

    for (const char of rowPart) {
      if (/\d/.test(char)) {
        fileIndex += Number(char);
        continue;
      }

      const file = FILES[fileIndex];
      const rank = String(8 - rowIndex);

      if (file) {
        map.set(`${file}${rank}`, {
          code: char,
          isWhite: char === char.toUpperCase(),
        });
      }

      fileIndex += 1;
    }
  });

  return map;
}

function toColorName(value: ChessColor) {
  return value === "white" ? "White" : "Black";
}

export default function ChessGame({
  roomCode,
  socket,
  players,
  localPlayerName,
  isSocketConnected,
  onlinePlayerNames,
}: ChessGameProps) {
  const [gameState, setGameState] = useState<ChessState | null>(null);
  const [gameError, setGameError] = useState("");
  const [selectedSquare, setSelectedSquare] = useState("");

  const playerOrder =
    gameState?.playerOrder ??
    players.map((player) => player.playerName).slice(0, 2);

  const localColor =
    (localPlayerName ? gameState?.colors[localPlayerName] : undefined) ?? null;

  const isMyTurn =
    !!localPlayerName &&
    gameState?.status === "running" &&
    gameState.currentTurnPlayer === localPlayerName;

  const pieceMap = useMemo(
    () => getPieceMapFromFen(gameState?.fen ?? "8/8/8/8/8/8/8/8 w - - 0 1"),
    [gameState?.fen],
  );

  const legalTargets = selectedSquare
    ? (gameState?.legalMovesByFrom[selectedSquare] ?? [])
    : [];

  const boardRanks = localColor === "black" ? [...RANKS].reverse() : [...RANKS];
  const boardFiles = localColor === "black" ? [...FILES].reverse() : [...FILES];

  useEffect(() => {
    if (!socket) {
      return;
    }

    const onState = (payload: ChessState) => {
      if (payload.roomCode !== roomCode) {
        return;
      }

      setGameState(payload);
      setGameError("");
      setSelectedSquare("");
    };

    const onError = (payload: { roomCode: string; message?: string }) => {
      if (payload.roomCode !== roomCode) {
        return;
      }

      setGameError(payload.message ?? "Unable to process this move.");
    };

    socket.on("chess:state", onState);
    socket.on("chess:error", onError);
    socket.emit("chess:sync", { roomCode });

    return () => {
      socket.off("chess:state", onState);
      socket.off("chess:error", onError);
    };
  }, [roomCode, socket]);

  const onSquareClick = (square: string) => {
    if (!gameState || gameState.status !== "running") {
      return;
    }

    if (!isSocketConnected || !socket?.connected || !localPlayerName) {
      return;
    }

    const clickedPiece = pieceMap.get(square);

    if (!selectedSquare) {
      if (!isMyTurn || !clickedPiece || !localColor) {
        return;
      }

      const isOwnPiece =
        (localColor === "white" && clickedPiece.isWhite) ||
        (localColor === "black" && !clickedPiece.isWhite);

      if (!isOwnPiece) {
        return;
      }

      if (!(gameState.legalMovesByFrom[square]?.length > 0)) {
        return;
      }

      setSelectedSquare(square);
      return;
    }

    if (square === selectedSquare) {
      setSelectedSquare("");
      return;
    }

    if (legalTargets.includes(square)) {
      setSelectedSquare("");
      setGameError("");
      socket.emit("chess:move", {
        roomCode,
        playerName: localPlayerName,
        from: selectedSquare,
        to: square,
        promotion: "q",
      });
      return;
    }

    if (clickedPiece && isMyTurn && localColor) {
      const isOwnPiece =
        (localColor === "white" && clickedPiece.isWhite) ||
        (localColor === "black" && !clickedPiece.isWhite);

      if (isOwnPiece && (gameState.legalMovesByFrom[square]?.length ?? 0) > 0) {
        setSelectedSquare(square);
        return;
      }
    }

    setSelectedSquare("");
  };

  return (
    <section className={styles.surface}>
      <div className={styles.headerRow}>
        <h2>Chess</h2>
      </div>

      {gameState?.status === "finished" ? (
        <div className={styles.winnerBanner}>
          {gameState.isDraw ? (
            <span>Game completed. Draw.</span>
          ) : (
            <span>
              Game completed. Winner: <strong>{gameState.winner}</strong>
            </span>
          )}
        </div>
      ) : null}

      {gameState?.lastMove ? (
        <div className={styles.lastMove}>
          <strong>{gameState.lastMove.playerName}</strong> played{" "}
          {gameState.lastMove.san}
          {gameState.isCheck ? " (check)" : ""}.
        </div>
      ) : null}

      {gameError ? <div className={styles.errorBanner}>{gameError}</div> : null}

      <div className={styles.gameArea}>
        <div className={styles.boardWrap}>
          <div className={styles.board}>
            {boardRanks.flatMap((rank, rowIndex) =>
              boardFiles.map((file, colIndex) => {
                const square = `${file}${rank}`;
                const piece = pieceMap.get(square);
                const isLight = (rowIndex + colIndex) % 2 === 0;
                const isSelected = square === selectedSquare;
                const isTarget = legalTargets.includes(square);

                return (
                  <button
                    key={square}
                    type="button"
                    className={`${styles.cell} ${isLight ? styles.cellLight : styles.cellDark} ${
                      isMyTurn ? styles.cellOwnTurn : styles.cellLocked
                    } ${isSelected ? styles.cellSelected : ""} ${
                      isTarget ? styles.cellTarget : ""
                    }`}
                    onClick={() => onSquareClick(square)}
                    aria-label={`Square ${square}${piece ? `, ${piece.code}` : ""}`}
                  >
                    {piece ? (
                      <span className={styles.piece} aria-hidden="true">
                        {PIECE_UNICODE[piece.code] ?? ""}
                      </span>
                    ) : null}
                  </button>
                );
              }),
            )}
          </div>
        </div>

        <div className={styles.statusPanel}>
          {gameState?.status === "finished"
            ? "Game finished"
            : gameState?.currentTurnPlayer
              ? `${gameState.currentTurnPlayer}'s turn (${toColorName(gameState.currentTurnColor)})`
              : "Waiting for game"}
        </div>

        <ul className={styles.playerLegendGrid}>
          {playerOrder.map((playerName, index) => {
            const playerOnline = onlinePlayerNames.includes(playerName);
            const playerColor =
              gameState?.colors[playerName] ??
              (index === 0 ? "white" : "black");
            const isCurrent = gameState?.currentTurnPlayer === playerName;

            return (
              <li
                key={playerName}
                className={`${styles.playerLegendItem} ${isCurrent ? styles.playerLegendItemActive : ""}`}
              >
                <span
                  className={styles.playerDot}
                  style={{
                    backgroundColor:
                      PLAYER_COLORS[index % PLAYER_COLORS.length],
                  }}
                />
                <span className={styles.playerLegendName}>{playerName}</span>
                <span
                  className={`${styles.playerLegendBadge} ${
                    isCurrent ? styles.playerLegendBadgePlaying : ""
                  }`}
                >
                  {isCurrent ? "Playing" : playerOnline ? "Online" : "Offline"}
                </span>
                <span className={styles.playerLegendName}>
                  {toColorName(playerColor)} pieces
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

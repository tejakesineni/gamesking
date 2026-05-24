import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import gamesKingLogo from "../../assets/games-king-logo.png";
import { connectWaitingRoomSocket } from "./GamePage.service";
import { fetchWaitingRoom } from "./GamePage.service";
import SnakesAndLaddersGame from "./SnakesAndLaddersGame";
import LudoGame from "./LudoGame";
import BlindFourGame from "./BlindFourGame";
import ChessGame from "./ChessGame";
import TicTacToeGame from "./TicTacToeGame";
import type {
  RoomStatus,
  RoomUser,
  WaitingRoomDetails,
} from "../../types/game";
import styles from "./GamePage.module.css";

const ICONS = {
  check: {
    icon: [
      448,
      512,
      [10003, 10004],
      "f00c",
      "M434.8 70.1c14.3 10.4 17.5 30.4 7.1 44.7l-256 352c-5.5 7.6-14 12.3-23.4 13.1s-18.5-2.7-25.1-9.3l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l101.5 101.5 234-321.7c10.4-14.3 30.4-17.5 44.7-7.1z",
    ],
  },
  copy: {
    icon: [
      448,
      512,
      [],
      "f0c5",
      "M192 0c-35.3 0-64 28.7-64 64l0 256c0 35.3 28.7 64 64 64l192 0c35.3 0 64-28.7 64-64l0-200.6c0-17.4-7.1-34.1-19.7-46.2L370.6 17.8C358.7 6.4 342.8 0 326.3 0L192 0zM64 128c-35.3 0-64 28.7-64 64L0 448c0 35.3 28.7 64 64 64l192 0c35.3 0 64-28.7 64-64l0-16-64 0 0 16-192 0 0-256 16 0 0-64-16 0z",
    ],
  },
  key: {
    icon: [
      512,
      512,
      [128273],
      "f084",
      "M336 352c97.2 0 176-78.8 176-176S433.2 0 336 0 160 78.8 160 176c0 18.7 2.9 36.8 8.3 53.7L7 391c-4.5 4.5-7 10.6-7 17l0 80c0 13.3 10.7 24 24 24l80 0c13.3 0 24-10.7 24-24l0-40 40 0c13.3 0 24-10.7 24-24l0-40 40 0c6.4 0 12.5-2.5 17-7l33.3-33.3c16.9 5.4 35 8.3 53.7 8.3zM376 96a40 40 0 1 1 0 80 40 40 0 1 1 0-80z",
    ],
  },
  paperPlane: {
    icon: [
      576,
      512,
      [61913],
      "f1d8",
      "M536.4-26.3c9.8-3.5 20.6-1 28 6.3s9.8 18.2 6.3 28l-178 496.9c-5 13.9-18.1 23.1-32.8 23.1-14.2 0-27-8.6-32.3-21.7l-64.2-158c-4.5-11-2.5-23.6 5.2-32.6l94.5-112.4c5.1-6.1 4.7-15-.9-20.6s-14.6-6-20.6-.9L229.2 276.1c-9.1 7.6-21.6 9.6-32.6 5.2L38.1 216.8c-13.1-5.3-21.7-18.1-21.7-32.3 0-14.7 9.2-27.8 23.1-32.8l496.9-178z",
    ],
  },
} as const;

function FaIcon({
  icon,
  className,
}: {
  icon: (typeof ICONS)[keyof typeof ICONS];
  className?: string;
}) {
  const [width, height, , , pathData] = icon.icon;
  const paths = Array.isArray(pathData) ? pathData : [pathData];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="1em"
      height="1em"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {paths.map((path) => (
        <path key={path} d={path} fill="currentColor" />
      ))}
    </svg>
  );
}

export default function GamePage() {
  const { roomCode: roomCodeParam } = useParams<{ roomCode: string }>();
  const [searchParams] = useSearchParams();
  const [logoMissing, setLogoMissing] = useState(false);
  const [copiedField, setCopiedField] = useState<"roomCode" | null>(null);
  const roomCode = (
    roomCodeParam ??
    searchParams.get("roomCode") ??
    ""
  ).toUpperCase();
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [hasSocketDisconnected, setHasSocketDisconnected] = useState(false);
  const [roomDetails, setRoomDetails] = useState<WaitingRoomDetails | null>(
    null,
  );
  const [roomError, setRoomError] = useState("");
  const [isStartingGame, setIsStartingGame] = useState(false);
  const [liveStartedRoomCode, setLiveStartedRoomCode] = useState("");
  const [onlinePlayerNames, setOnlinePlayerNames] = useState<string[]>([]);
  const [liveSocket, setLiveSocket] = useState<ReturnType<
    typeof connectWaitingRoomSocket
  > | null>(null);
  const liveSocketTimeoutRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);
  const socketRef = useRef<ReturnType<typeof connectWaitingRoomSocket> | null>(
    null,
  );
  const joinedPlayerName = (searchParams.get("playerName") ?? "").trim();
  const hostName = (searchParams.get("hostName") ?? "").trim();
  const localPlayerName = joinedPlayerName || hostName;

  const socketStatus = !roomCode
    ? "idle"
    : isSocketConnected
      ? "connected"
      : hasSocketDisconnected
        ? "disconnected"
        : "connecting";

  const joinLink = useMemo(() => {
    if (!roomCode) {
      return "";
    }

    return `${window.location.origin}/#/join-game/${roomCode}`;
  }, [roomCode]);

  const isHost =
    !!roomDetails &&
    !!hostName &&
    roomDetails.hostName.trim().toLowerCase() === hostName.toLowerCase();
  const playerCount = roomDetails?.players.length ?? 0;
  const isLoadingRoom = !!roomCode && !roomDetails && !roomError;
  const canStartGame =
    isHost && roomDetails?.status === "waiting" && playerCount >= 2;
  const activeGame = roomDetails?.game.trim() ?? "";
  const isLiveView =
    roomDetails?.status === "live" || liveStartedRoomCode === roomCode;

  const syncRoomDetails = useCallback(async () => {
    try {
      const room = await fetchWaitingRoom(roomCode);

      if (!isMountedRef.current) {
        return;
      }

      setRoomDetails(room);
    } catch (error) {
      if (!isMountedRef.current) {
        return;
      }

      setRoomError(
        error instanceof Error ? error.message : "Unable to load room.",
      );
    }
  }, [roomCode]);

  useEffect(() => {
    if (!roomCode) {
      return;
    }

    isMountedRef.current = true;

    const timeoutId = window.setTimeout(() => {
      void syncRoomDetails();
    }, 0);

    return () => {
      isMountedRef.current = false;
      window.clearTimeout(timeoutId);
    };
  }, [joinedPlayerName, roomCode, syncRoomDetails]);

  useEffect(() => {
    if (!roomCode) {
      return;
    }

    const socket = connectWaitingRoomSocket(roomCode, localPlayerName);
    socketRef.current = socket;
    if (liveSocketTimeoutRef.current !== null) {
      window.clearTimeout(liveSocketTimeoutRef.current);
    }
    liveSocketTimeoutRef.current = window.setTimeout(() => {
      setLiveSocket(socket);
      liveSocketTimeoutRef.current = null;
    }, 0);

    socket.on("connect", () => {
      setIsSocketConnected(true);
      setHasSocketDisconnected(false);
      void syncRoomDetails();
    });
    socket.on("disconnect", () => {
      setIsSocketConnected(false);
      setHasSocketDisconnected(true);
    });
    socket.on(
      "room:user-joined",
      (payload: { roomCode: string; playerName: string; joinedAt: string }) => {
        if (payload.roomCode !== roomCode) {
          return;
        }

        setRoomDetails((currentRoom) => {
          if (!currentRoom) {
            void syncRoomDetails();
            return currentRoom;
          }

          const alreadyListed = currentRoom.players.some(
            (player) => player.playerName === payload.playerName,
          );

          if (alreadyListed) {
            return currentRoom;
          }

          const updatedPlayer: RoomUser = {
            id: `${payload.playerName}-${payload.joinedAt}`,
            roomCode: payload.roomCode,
            playerName: payload.playerName,
            joinedAt: payload.joinedAt,
          };

          return {
            ...currentRoom,
            players: [...currentRoom.players, updatedPlayer],
          };
        });
      },
    );
    socket.on(
      "room:presence",
      (payload: { roomCode: string; connectedPlayerNames: string[] }) => {
        if (payload.roomCode !== roomCode) {
          return;
        }

        setOnlinePlayerNames(payload.connectedPlayerNames);
      },
    );
    socket.on(
      "room:started",
      (payload: { roomCode: string; status: RoomStatus }) => {
        if (payload.roomCode !== roomCode) {
          return;
        }

        setLiveStartedRoomCode(payload.roomCode);
        setIsStartingGame(false);

        setRoomDetails((currentRoom) => {
          if (!currentRoom) {
            return currentRoom;
          }

          return {
            ...currentRoom,
            status: payload.status,
          };
        });

        // Always refresh from backend so all players receive the latest room status/game.
        void syncRoomDetails();
      },
    );
    socket.on(
      "room:start-error",
      (payload: { roomCode: string; message?: string }) => {
        if (payload.roomCode !== roomCode) {
          return;
        }

        setIsStartingGame(false);
        setRoomError(payload.message ?? "Unable to start the game.");
      },
    );

    return () => {
      if (liveSocketTimeoutRef.current !== null) {
        window.clearTimeout(liveSocketTimeoutRef.current);
        liveSocketTimeoutRef.current = null;
      }

      socket.off("connect");
      socket.off("disconnect");
      socket.off("room:user-joined");
      socket.off("room:presence");
      socket.off("room:started");
      socket.off("room:start-error");
      socket.disconnect();

      if (socketRef.current === socket) {
        socketRef.current = null;
      }

      window.setTimeout(() => {
        setLiveSocket((currentSocket) =>
          currentSocket === socket ? null : currentSocket,
        );
      }, 0);
    };
  }, [joinedPlayerName, localPlayerName, roomCode, syncRoomDetails]);

  async function onStartGame() {
    if (!roomCode || !hostName || !isHost) {
      return;
    }

    const socket = socketRef.current;

    if (!socket || !socket.connected) {
      setRoomError("Socket disconnected. Please wait for reconnection.");
      return;
    }

    setIsStartingGame(true);
    setRoomError("");

    try {
      socket.emit("room:start", {
        roomCode,
        hostName,
      });
    } catch (error) {
      setIsStartingGame(false);
      setRoomError(
        error instanceof Error ? error.message : "Unable to start the game.",
      );
    }
  }

  function getGameKey(gameName: string) {
    return gameName.trim().toLowerCase();
  }

  function renderGameSurface() {
    const gameKey = getGameKey(activeGame);

    if (gameKey === "bingo") {
      return (
        <section className={styles.liveGameSurface}>
          <h2>Bingo Live</h2>
          <p>
            Match called numbers on your board. First completed pattern wins.
          </p>
        </section>
      );
    }

    if (gameKey === "tambola") {
      return (
        <section className={styles.liveGameSurface}>
          <h2>Tambola Live</h2>
          <p>Track announced numbers and complete your ticket combinations.</p>
        </section>
      );
    }

    if (gameKey === "ludo") {
      return (
        <LudoGame
          roomCode={roomCode}
          socket={liveSocket}
          players={roomDetails?.players ?? []}
          localPlayerName={localPlayerName}
          isSocketConnected={isSocketConnected}
          onlinePlayerNames={onlinePlayerNames}
        />
      );
    }

    if (gameKey === "blind four") {
      return (
        <BlindFourGame
          roomCode={roomCode}
          socket={liveSocket}
          players={roomDetails?.players ?? []}
          localPlayerName={localPlayerName}
          isSocketConnected={isSocketConnected}
          onlinePlayerNames={onlinePlayerNames}
        />
      );
    }

    if (gameKey === "chess") {
      return (
        <ChessGame
          roomCode={roomCode}
          socket={liveSocket}
          players={roomDetails?.players ?? []}
          localPlayerName={localPlayerName}
          isSocketConnected={isSocketConnected}
          onlinePlayerNames={onlinePlayerNames}
        />
      );
    }

    if (gameKey === "snakes and ladders") {
      return (
        <SnakesAndLaddersGame
          roomCode={roomCode}
          socket={liveSocket}
          players={roomDetails?.players ?? []}
          localPlayerName={localPlayerName}
          isSocketConnected={isSocketConnected}
          onlinePlayerNames={onlinePlayerNames}
        />
      );
    }

    if (gameKey === "tic tac toe") {
      return (
        <TicTacToeGame
          roomCode={roomCode}
          socket={liveSocket}
          players={roomDetails?.players ?? []}
          localPlayerName={localPlayerName}
          isSocketConnected={isSocketConnected}
          onlinePlayerNames={onlinePlayerNames}
        />
      );
    }

    return (
      <section className={styles.liveGameSurface}>
        <h2>{activeGame || "Game"} Live</h2>
        <p>The room is live. Game controls will appear here.</p>
      </section>
    );
  }

  const renderLiveView = () => {
    return (
      <main className={`${styles.page} ${styles.livePage}`}>
        <div className={styles.logoCorner}>
          <Link to="/">
            {!logoMissing ? (
              <img
                className={styles.logoImage}
                src={gamesKingLogo}
                alt="Games King - back to home"
                onError={() => setLogoMissing(true)}
              />
            ) : (
              <div className={styles.logoFallback}>Games King</div>
            )}
          </Link>
        </div>

        <section className={`${styles.section} ${styles.liveSection}`}>
          <div className={`${styles.form} ${styles.liveForm}`}>
            {renderGameSurface()}
          </div>
        </section>

        <div className={styles.socketStatus} data-status={socketStatus}>
          {socketStatus === "connected"
            ? "Room connected"
            : socketStatus === "connecting"
              ? "Connecting to room..."
              : socketStatus === "disconnected"
                ? "Room disconnected"
                : "Preparing room connection..."}
        </div>
      </main>
    );
  };

  async function onCopy(text: string, field: "roomCode") {
    if (!text) {
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      window.setTimeout(() => setCopiedField(null), 1800);
    } catch {
      setCopiedField(null);
    }
  }

  async function onSendInvite() {
    if (!joinLink) {
      return;
    }

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "Join my Games King room",
          text: `Use this room code to join: ${roomCode}`,
          url: joinLink,
        });
        return;
      } catch {
        // If share is canceled/unsupported for payload, fall back to copying the invite URL.
      }
    }

    try {
      await navigator.clipboard.writeText(joinLink);
    } catch {
      // No-op: browser may block clipboard if unavailable.
    }
  }
  const renderLobby = () => {
    return (
      <Fragment>
        <div className={styles.logoCorner}>
          <Link to="/">
            {!logoMissing ? (
              <img
                className={styles.logoImage}
                src={gamesKingLogo}
                alt="Games King - back to home"
                onError={() => setLogoMissing(true)}
              />
            ) : (
              <div className={styles.logoFallback}>Games King</div>
            )}
          </Link>
        </div>

        <section className={styles.section}>
          <div className={styles.form}>
            <div className={styles.panelHeader}>
              <span>Waiting room</span>
              <p>Share this room with players and wait for them to join.</p>
            </div>

            {roomError ? (
              <div className={styles.errorBanner}>{roomError}</div>
            ) : null}

            <div className={`${styles.infoRow} ${styles.roomCodeRow}`}>
              <div className={styles.infoLabel}>
                <FaIcon icon={ICONS.key} className={styles.labelIcon} />
                <span>Room code</span>
              </div>
              <div className={styles.roomHolder}>
                <div className={`${styles.infoValue} ${styles.roomCodeValue}`}>
                  {roomCode || "-"}
                </div>
                <span
                  className={styles.copyIcon}
                  title="Copy room code"
                  onClick={() => void onCopy(roomCode, "roomCode")}
                >
                  <FaIcon
                    icon={copiedField === "roomCode" ? ICONS.check : ICONS.copy}
                    className={styles.copyIconGlyph}
                  />
                </span>
              </div>
            </div>

            <button
              type="button"
              className={styles.joinBtn}
              onClick={() => void onSendInvite()}
              disabled={!joinLink}
            >
              <FaIcon icon={ICONS.paperPlane} className={styles.buttonIcon} />
              Send invite
            </button>
          </div>
        </section>

        <section className={styles.playersSection}>
          <div className={styles.playersHeader}>
            <span>Joined players</span>
            <p>
              {isLoadingRoom
                ? "Loading players..."
                : playerCount
                  ? `${playerCount} player${playerCount === 1 ? "" : "s"} in room`
                  : "No players yet"}
            </p>
          </div>

          <ul className={styles.playersList}>
            {(roomDetails?.players ?? []).map((player, index) => (
              <li
                key={`${player.playerName}-${player.joinedAt}`}
                className={styles.playerItem}
              >
                <span>{player.playerName}</span>
                {index === 0 ? (
                  <span className={styles.hostPill}>Host</span>
                ) : null}
              </li>
            ))}
          </ul>

          {isHost ? (
            <button
              type="button"
              className={styles.startBtn}
              onClick={() => void onStartGame()}
              disabled={!canStartGame || isStartingGame}
            >
              {isStartingGame
                ? "Starting game..."
                : canStartGame
                  ? "Start game"
                  : "Waiting for at least one player"}
            </button>
          ) : null}
        </section>
      </Fragment>
    );
  };

  return (
    <main className={styles.page}>
      {isLiveView ? renderLiveView() : renderLobby()}
      <div className={styles.socketStatus} data-status={socketStatus}>
        {socketStatus === "connected"
          ? "Room connected"
          : socketStatus === "connecting"
            ? "Connecting to room..."
            : socketStatus === "disconnected"
              ? "Room disconnected"
              : "Preparing room connection..."}
      </div>
    </main>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import type { BlindFourCard, BlindFourState, RoomUser } from "../../types/game";
import jokerCardImage from "../../assets/joker-card.svg";
import styles from "./BlindFourGame.module.css";

type BlindFourGameProps = {
  roomCode: string;
  socket: Socket | null;
  players: RoomUser[];
  localPlayerName: string;
  isSocketConnected: boolean;
  onlinePlayerNames: string[];
};

function getSuitSymbol(suit: string) {
  if (suit === "S") {
    return "♠";
  }

  if (suit === "H") {
    return "♥";
  }

  if (suit === "D") {
    return "♦";
  }

  if (suit === "C") {
    return "♣";
  }

  return "★";
}

function isRedSuit(suit: string) {
  return suit === "H" || suit === "D";
}

function getRankLabel(rank: string) {
  return rank === "JKR" ? "Jkr" : rank;
}

function getBlindFourCardPoints(card: BlindFourCard) {
  if (card.rank === "A") {
    return 1;
  }

  if (card.rank === "7") {
    return 0;
  }

  if (card.rank === "JKR") {
    return 20;
  }

  if (card.rank === "J" || card.rank === "Q" || card.rank === "K") {
    return 10;
  }

  return Number(card.rank);
}

type JokerPowerOption = NonNullable<
  BlindFourState["pendingJokerChoice"]
>["options"][number];
type TenPowerOption = NonNullable<
  BlindFourState["pendingTenChoice"]
>["options"][number];

const JOKER_OPTION_LABELS: Record<JokerPowerOption, string> = {
  "lock-card": "Lock card",
  "swap-card": "Swap card",
  "shuffle-cards": "Shupple cards",
  "pick-your-cards": "See your cards",
  "see-opponent-card": "See one of the opponent card",
};

const DEBUG_LOCAL_STORAGE_KEY = "isDebugging";

function isDebugModeEnabled() {
  if (typeof window === "undefined") {
    return false;
  }

  const value = window.localStorage.getItem(DEBUG_LOCAL_STORAGE_KEY);

  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1";
}

export default function BlindFourGame({
  roomCode,
  socket,
  players,
  localPlayerName,
  isSocketConnected,
  onlinePlayerNames,
}: BlindFourGameProps) {
  const [gameState, setGameState] = useState<BlindFourState | null>(null);
  const [gameError, setGameError] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<number>(-1);
  const [draggingSlot, setDraggingSlot] = useState<number>(-1);
  const [isDraggingDrawnCard, setIsDraggingDrawnCard] = useState(false);
  const [isDraggingDiscardCard, setIsDraggingDiscardCard] = useState(false);
  const [showLockOverlay, setShowLockOverlay] = useState(true);
  const [showSwapOverlay, setShowSwapOverlay] = useState(true);
  const [showPeekOverlay, setShowPeekOverlay] = useState(true);
  const [swapDragSource, setSwapDragSource] = useState<{
    playerName: string;
    slotIndex: number;
  } | null>(null);
  const [swapMoveAnimation, setSwapMoveAnimation] = useState<{
    from: { left: number; top: number; width: number; height: number };
    to: { left: number; top: number; width: number; height: number };
  } | null>(null);
  const [seeOwnCardsTimerTick, setSeeOwnCardsTimerTick] = useState(0);
  const [peekOpponentTimerTick, setPeekOpponentTimerTick] = useState(0);
  const [shuffleAnimatingPlayerName, setShuffleAnimatingPlayerName] =
    useState("");
  const [shuffleAnimationTick, setShuffleAnimationTick] = useState(0);
  const [isHowToOpen, setIsHowToOpen] = useState(false);
  const [showAllCardsForDebug, setShowAllCardsForDebug] =
    useState(isDebugModeEnabled);
  const hasSeenFirstLastAction = useRef(false);
  const lastActionSignatureRef = useRef("");
  const surfaceRef = useRef<HTMLElement | null>(null);
  const cardElementRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const infoPopoverRef = useRef<HTMLDivElement | null>(null);

  const playerOrder =
    gameState?.playerOrder ?? players.map((player) => player.playerName);
  const displayPlayerOrder = useMemo(() => {
    if (!localPlayerName) {
      return playerOrder;
    }

    const otherPlayers = playerOrder.filter(
      (playerName) => playerName !== localPlayerName,
    );

    return [...otherPlayers, localPlayerName];
  }, [localPlayerName, playerOrder]);

  const currentTurnPlayer = gameState?.currentTurnPlayer ?? "";
  const phase = gameState?.phase ?? "setup";
  const isSetupPhase = gameState?.status !== "finished" && phase === "setup";
  const localReady = !!(
    localPlayerName && gameState?.setupReady?.[localPlayerName]
  );

  const isMyTurn =
    !!localPlayerName &&
    gameState?.status === "running" &&
    phase === "running" &&
    currentTurnPlayer === localPlayerName;

  const localCards = useMemo(() => {
    if (!gameState || !localPlayerName) {
      return [] as BlindFourCard[];
    }

    return gameState.hands[localPlayerName] ?? [];
  }, [gameState, localPlayerName]);

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
    if (!socket) {
      return;
    }

    const onState = (payload: BlindFourState) => {
      if (payload.roomCode !== roomCode) {
        return;
      }

      setGameState(payload);
      setGameError("");
      setSelectedSlot(-1);
      setDraggingSlot(-1);
      setIsDraggingDrawnCard(false);
      setIsDraggingDiscardCard(false);
      setSwapDragSource(null);
    };

    const onError = (payload: { roomCode: string; message?: string }) => {
      if (payload.roomCode !== roomCode) {
        return;
      }

      setGameError(payload.message ?? "Unable to process action.");
    };

    socket.on("blind4:state", onState);
    socket.on("blind4:error", onError);
    socket.emit("blind4:sync", { roomCode });

    return () => {
      socket.off("blind4:state", onState);
      socket.off("blind4:error", onError);
    };
  }, [roomCode, socket]);

  const emitAction = (event: string, payload: Record<string, unknown> = {}) => {
    if (!socket || !socket.connected || !localPlayerName) {
      return;
    }

    setGameError("");
    socket.emit(event, {
      roomCode,
      playerName: localPlayerName,
      ...payload,
    });
  };

  const hasPendingDraw = !!gameState?.pendingDrawCard;
  const pendingJokerChoice = gameState?.pendingJokerChoice ?? null;
  const pendingTenChoice = gameState?.pendingTenChoice ?? null;
  const pendingLockChoice = gameState?.pendingLockChoice ?? null;
  const pendingSwapChoice = gameState?.pendingSwapChoice ?? null;
  const pendingShuffleChoice = gameState?.pendingShuffleChoice ?? null;
  const pendingSeeOwnCards = gameState?.pendingSeeOwnCards ?? null;
  const pendingPeekChoice = gameState?.pendingPeekChoice ?? null;
  const activePeekReveal = gameState?.activePeekReveal ?? null;
  const isAwaitingJokerChoice = !!pendingJokerChoice;
  const isAwaitingTenChoice = !!pendingTenChoice;
  const isAwaitingLockChoice = !!pendingLockChoice;
  const isAwaitingSwapChoice = !!pendingSwapChoice;
  const isAwaitingShuffleChoice = !!pendingShuffleChoice;
  const isAwaitingPeekChoice = !!pendingPeekChoice;
  const isAwaitingPowerChoice =
    isAwaitingJokerChoice ||
    isAwaitingTenChoice ||
    isAwaitingLockChoice ||
    isAwaitingSwapChoice ||
    isAwaitingShuffleChoice ||
    isAwaitingPeekChoice;
  const shouldShowPowerOverlay =
    isAwaitingJokerChoice ||
    isAwaitingTenChoice ||
    (isAwaitingLockChoice && showLockOverlay) ||
    (isAwaitingSwapChoice && showSwapOverlay) ||
    isAwaitingShuffleChoice ||
    (isAwaitingPeekChoice && showPeekOverlay);
  const isMyJokerChoice =
    !!pendingJokerChoice && pendingJokerChoice.playerName === localPlayerName;
  const isMyTenChoice =
    !!pendingTenChoice && pendingTenChoice.playerName === localPlayerName;
  const isMyLockChoice =
    !!pendingLockChoice && pendingLockChoice.playerName === localPlayerName;
  const isMySwapChoice =
    !!pendingSwapChoice && pendingSwapChoice.playerName === localPlayerName;
  const isMyShuffleChoice =
    !!pendingShuffleChoice &&
    pendingShuffleChoice.playerName === localPlayerName;
  const isMyPeekChoice =
    !!pendingPeekChoice && pendingPeekChoice.playerName === localPlayerName;
  const availableShuffleTargets =
    pendingShuffleChoice?.targetPlayers ??
    gameState?.playerOrder.filter(
      (playerName) => playerName !== pendingShuffleChoice?.playerName,
    ) ??
    [];
  const availablePeekTargets =
    pendingPeekChoice?.targetPlayers ??
    gameState?.playerOrder.filter(
      (playerName) => playerName !== pendingPeekChoice?.playerName,
    ) ??
    [];
  const canSeePendingDrawCard =
    hasPendingDraw && currentTurnPlayer === localPlayerName;
  const canDragPendingDrawCard =
    canSeePendingDrawCard &&
    isMyTurn &&
    !isSetupPhase &&
    isSocketConnected &&
    !isAwaitingPowerChoice;
  const canDragDiscardTop =
    !!gameState?.discardTop &&
    isMyTurn &&
    !hasPendingDraw &&
    !isSetupPhase &&
    isSocketConnected &&
    !isAwaitingPowerChoice;
  const canDropDrawnToDiscard =
    isMyTurn &&
    hasPendingDraw &&
    !isSetupPhase &&
    isSocketConnected &&
    !isAwaitingPowerChoice;
  const canDrawFromDeck =
    isSocketConnected &&
    isMyTurn &&
    !hasPendingDraw &&
    !isSetupPhase &&
    !isAwaitingPowerChoice;
  const canKnockNow =
    isSocketConnected &&
    isMyTurn &&
    !hasPendingDraw &&
    !isSetupPhase &&
    !isAwaitingPowerChoice &&
    !gameState?.knocker &&
    gameState?.status === "running";
  const setupReadyCount =
    gameState?.playerOrder.filter(
      (playerName) => !!gameState?.setupReady?.[playerName],
    ).length ?? 0;
  const isSeeOwnCardsWindowActive = (() => {
    if (!pendingSeeOwnCards) {
      return false;
    }

    const startedAtMs = Date.parse(pendingSeeOwnCards.startedAt);

    if (!Number.isFinite(startedAtMs)) {
      return false;
    }

    return (
      Date.now() - startedAtMs < Math.max(0, pendingSeeOwnCards.durationMs)
    );
  })();
  const isLocalTemporaryRevealActive =
    isSeeOwnCardsWindowActive &&
    pendingSeeOwnCards?.playerName === localPlayerName;
  const isOtherPlayerSeeingCards =
    isSeeOwnCardsWindowActive &&
    !!pendingSeeOwnCards &&
    pendingSeeOwnCards.playerName !== localPlayerName;
  const isPeekRevealWindowActive = (() => {
    if (!activePeekReveal) {
      return false;
    }

    const startedAtMs = Date.parse(activePeekReveal.startedAt);

    if (!Number.isFinite(startedAtMs)) {
      return false;
    }

    return Date.now() - startedAtMs < Math.max(0, activePeekReveal.durationMs);
  })();

  useEffect(() => {
    if (!pendingSeeOwnCards) {
      return;
    }

    const startedAtMs = Date.parse(pendingSeeOwnCards.startedAt);

    if (!Number.isFinite(startedAtMs)) {
      return;
    }

    const remainingMs =
      startedAtMs + Math.max(0, pendingSeeOwnCards.durationMs) - Date.now();

    if (remainingMs <= 0) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSeeOwnCardsTimerTick((previous) => previous + 1);
    }, remainingMs + 50);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    pendingSeeOwnCards?.playerName,
    pendingSeeOwnCards?.startedAt,
    pendingSeeOwnCards?.durationMs,
    seeOwnCardsTimerTick,
  ]);

  useEffect(() => {
    if (!activePeekReveal) {
      return;
    }

    const startedAtMs = Date.parse(activePeekReveal.startedAt);

    if (!Number.isFinite(startedAtMs)) {
      return;
    }

    const remainingMs =
      startedAtMs + Math.max(0, activePeekReveal.durationMs) - Date.now();

    if (remainingMs <= 0) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setPeekOpponentTimerTick((previous) => previous + 1);
    }, remainingMs + 50);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    activePeekReveal?.playerName,
    activePeekReveal?.targetPlayerName,
    activePeekReveal?.slotIndex,
    activePeekReveal?.startedAt,
    activePeekReveal?.durationMs,
    peekOpponentTimerTick,
  ]);

  const otherPlayers = displayPlayerOrder.filter(
    (playerName) => playerName !== localPlayerName,
  );
  const showLocalPlayer =
    !!localPlayerName && displayPlayerOrder.includes(localPlayerName);

  const getCardSlotKey = (playerName: string, slotIndex: number) =>
    `${playerName}::${slotIndex}`;

  const triggerSwapMoveAnimation = (
    fromPlayerName: string,
    fromSlotIndex: number,
    toPlayerName: string,
    toSlotIndex: number,
  ) => {
    window.requestAnimationFrame(() => {
      const surfaceElement = surfaceRef.current;
      const fromElement =
        cardElementRefs.current[getCardSlotKey(fromPlayerName, fromSlotIndex)];
      const toElement =
        cardElementRefs.current[getCardSlotKey(toPlayerName, toSlotIndex)];

      if (!surfaceElement || !fromElement || !toElement) {
        return;
      }

      const surfaceRect = surfaceElement.getBoundingClientRect();
      const fromRect = fromElement.getBoundingClientRect();
      const toRect = toElement.getBoundingClientRect();

      setSwapMoveAnimation({
        from: {
          left: fromRect.left - surfaceRect.left,
          top: fromRect.top - surfaceRect.top,
          width: fromRect.width,
          height: fromRect.height,
        },
        to: {
          left: toRect.left - surfaceRect.left,
          top: toRect.top - surfaceRect.top,
          width: toRect.width,
          height: toRect.height,
        },
      });
    });
  };

  useEffect(() => {
    if (!isAwaitingLockChoice) {
      setShowLockOverlay(true);
      return;
    }

    setShowLockOverlay(true);
    const timeoutId = window.setTimeout(() => {
      setShowLockOverlay(false);
    }, 5000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isAwaitingLockChoice, pendingLockChoice?.playerName]);

  useEffect(() => {
    if (!isAwaitingSwapChoice) {
      setShowSwapOverlay(true);
      return;
    }

    setShowSwapOverlay(true);

    if (!isMySwapChoice) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShowSwapOverlay(false);
    }, 5000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isAwaitingSwapChoice, isMySwapChoice]);

  useEffect(() => {
    if (!isAwaitingPeekChoice) {
      setShowPeekOverlay(true);
      return;
    }

    setShowPeekOverlay(true);
    const timeoutId = window.setTimeout(() => {
      setShowPeekOverlay(false);
    }, 5000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isAwaitingPeekChoice, pendingPeekChoice?.playerName]);

  useEffect(() => {
    const syncDebugMode = () => {
      setShowAllCardsForDebug(isDebugModeEnabled());
    };

    syncDebugMode();
    window.addEventListener("storage", syncDebugMode);

    return () => {
      window.removeEventListener("storage", syncDebugMode);
    };
  }, []);

  useEffect(() => {
    const lastAction = gameState?.lastAction;

    if (!lastAction) {
      return;
    }

    const signature = `${lastAction.playerName}|${lastAction.action}|${lastAction.detail}`;

    if (!hasSeenFirstLastAction.current) {
      hasSeenFirstLastAction.current = true;
      lastActionSignatureRef.current = signature;
      return;
    }

    if (lastActionSignatureRef.current === signature) {
      return;
    }

    lastActionSignatureRef.current = signature;

    if (lastAction.action === "power-j") {
      const shuffledMatch = /shuffled\s+(.+?)'s\s+cards\./i.exec(
        lastAction.detail,
      );
      const shuffledPlayerName = shuffledMatch?.[1]?.trim() ?? "";

      if (!shuffledPlayerName) {
        return;
      }

      setShuffleAnimatingPlayerName(shuffledPlayerName);
      setShuffleAnimationTick((previous) => previous + 1);
    }

    if (lastAction.action === "power-q") {
      const swapMatch =
        /Swapped\s+(.+?)\s+card\s+(\d+)\s+with\s+(.+?)\s+card\s+(\d+)\./i.exec(
          lastAction.detail,
        );

      if (!swapMatch) {
        return;
      }

      const fromPlayerName = swapMatch[1]?.trim() ?? "";
      const fromSlotIndex = Number(swapMatch[2]) - 1;
      const toPlayerName = swapMatch[3]?.trim() ?? "";
      const toSlotIndex = Number(swapMatch[4]) - 1;

      if (
        !fromPlayerName ||
        !toPlayerName ||
        !Number.isFinite(fromSlotIndex) ||
        !Number.isFinite(toSlotIndex) ||
        fromSlotIndex < 0 ||
        toSlotIndex < 0
      ) {
        return;
      }

      triggerSwapMoveAnimation(
        fromPlayerName,
        fromSlotIndex,
        toPlayerName,
        toSlotIndex,
      );
    }
  }, [gameState?.lastAction]);

  useEffect(() => {
    if (!shuffleAnimatingPlayerName) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShuffleAnimatingPlayerName("");
    }, 900);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [shuffleAnimatingPlayerName, shuffleAnimationTick]);

  useEffect(() => {
    if (!swapMoveAnimation) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSwapMoveAnimation(null);
    }, 1300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [swapMoveAnimation]);

  const renderFaceCard = (card: BlindFourCard) => {
    const suitSymbol = getSuitSymbol(card.suit);
    const rankLabel = getRankLabel(card.rank);
    const isJoker = card.rank === "JKR";

    if (isJoker) {
      return (
        <span className={`${styles.cardFace} ${styles.cardFaceJoker}`}>
          <img
            src={jokerCardImage}
            alt="Joker"
            className={styles.jokerArtwork}
          />
        </span>
      );
    }

    return (
      <span
        className={`${styles.cardFace} ${
          isRedSuit(card.suit) ? styles.cardFaceRed : styles.cardFaceBlack
        }`}
      >
        <span className={styles.cardCornerTop}>
          {rankLabel}
          <small>{suitSymbol}</small>
        </span>
        <span className={styles.cardCenter}>{suitSymbol}</span>
        <span className={styles.cardCornerBottom}>
          {rankLabel}
          <small>{suitSymbol}</small>
        </span>
      </span>
    );
  };

  const renderPlayerBlock = (playerName: string) => {
    const cards = gameState?.hands[playerName] ?? [];
    const isFinishedRound = gameState?.status === "finished";
    const hasWinner = isFinishedRound && !!gameState?.winner;
    const isLocal = playerName === localPlayerName;
    const isActive = playerName === currentTurnPlayer;
    const isKnocker = gameState?.knocker === playerName;
    const isWinner = isFinishedRound && gameState?.winner === playerName;
    const isLoser = isFinishedRound && hasWinner && !isWinner;
    const resultLabel = isWinner ? "Winner" : isLoser ? "Loser" : "Draw";
    const isShuffleAnimating = playerName === shuffleAnimatingPlayerName;
    const playerReady = !!gameState?.setupReady?.[playerName];
    const isOnline = onlinePlayerNames.includes(playerName);
    const playerScore =
      gameState?.scores?.[playerName] ??
      cards.reduce((sum, card) => sum + getBlindFourCardPoints(card), 0);

    let statusLabel = "Offline";
    if (isKnocker) {
      statusLabel = "Knock Called";
    } else if (isSetupPhase) {
      statusLabel = playerReady ? "Ready" : "Memorizing";
    } else if (isActive) {
      statusLabel = "Playing";
    } else if (isOnline) {
      statusLabel = "Online";
    }

    return (
      <div
        key={playerName}
        className={`${styles.playerBlock} ${isKnocker ? styles.playerBlockKnocker : ""} ${isWinner ? styles.playerBlockWinner : ""} ${isFinishedRound ? styles.playerBlockFinished : ""}`}
      >
        <div className={styles.playerHeader}>
          <span className={styles.playerName}>{playerName}</span>
          <div className={styles.playerHeaderActions}>
            {isActive && isLocal && canKnockNow ? (
              <button
                type="button"
                className={`${styles.actionButton} ${styles.quickKnockInlineButton}`}
                onClick={() => emitAction("blind4:knock")}
              >
                Knock
              </button>
            ) : null}
            <span
              className={`${styles.playerBadge} ${
                isKnocker
                  ? styles.playerBadgeKnock
                  : isActive
                    ? styles.playerBadgeTurn
                    : ""
              }`}
            >
              {statusLabel}
            </span>
          </div>
        </div>

        {isFinishedRound ? (
          <div
            className={`${styles.playerResultOverlay} ${
              isWinner
                ? styles.playerResultOverlayWinner
                : isLoser
                  ? styles.playerResultOverlayLoser
                  : styles.playerResultOverlayDraw
            }`}
          >
            <span className={styles.playerResultLabel}>{resultLabel}</span>
            <span className={styles.playerResultScore}>{playerScore}</span>
          </div>
        ) : null}

        <div
          className={`${styles.cardGrid} ${
            isShuffleAnimating ? styles.cardGridShuffleAnimating : ""
          }`}
        >
          {cards.map((card, index) => {
            const isLocked = !!card.locked;
            const lockingCard = card.lockedByCard ?? null;
            const isSelected = isLocal && selectedSlot === index;
            const canReorder = isLocal && isSetupPhase && !playerReady;
            const canDropDrawnOnCard =
              isLocal &&
              isMyTurn &&
              hasPendingDraw &&
              !isSetupPhase &&
              !isAwaitingPowerChoice;
            const canDropDiscardOnCard =
              isLocal &&
              isMyTurn &&
              !hasPendingDraw &&
              !isSetupPhase &&
              !!gameState?.discardTop &&
              !isAwaitingPowerChoice;
            const canDragSwapChoiceCard = isMySwapChoice;
            const canDropSwapChoiceCard =
              isMySwapChoice &&
              !!swapDragSource &&
              swapDragSource.playerName !== playerName;
            const isDragging = canReorder && draggingSlot === index;
            const isPeekTargetCardActive =
              isPeekRevealWindowActive &&
              !!activePeekReveal &&
              activePeekReveal.targetPlayerName === playerName &&
              activePeekReveal.slotIndex === index;
            const canLocalPlayerSeePeekTargetCard =
              isPeekTargetCardActive &&
              activePeekReveal?.playerName === localPlayerName;
            const showFace =
              showAllCardsForDebug ||
              gameState?.status === "finished" ||
              (isLocal && isSetupPhase && !playerReady) ||
              isLocalTemporaryRevealActive ||
              canLocalPlayerSeePeekTargetCard;
            const suitSymbol = getSuitSymbol(card.suit);
            const rankLabel = getRankLabel(card.rank);
            const cardTitle = showFace
              ? `${rankLabel}${suitSymbol}`
              : "Hidden card";

            return (
              <button
                key={card.id}
                type="button"
                className={`${styles.cardButton} ${
                  isSelected ? styles.cardButtonSelected : ""
                } ${isLocked ? styles.cardButtonLocked : ""} ${
                  canReorder ? styles.cardButtonReorder : ""
                } ${isDragging ? styles.cardButtonDragging : ""} ${
                  isPeekTargetCardActive ? styles.cardButtonPeekSeen : ""
                }`}
                ref={(element) => {
                  cardElementRefs.current[getCardSlotKey(playerName, index)] =
                    element;
                }}
                draggable={canReorder || canDragSwapChoiceCard}
                onClick={() => {
                  if (isMyPeekChoice) {
                    if (!isLocal && availablePeekTargets.includes(playerName)) {
                      emitAction("blind4:choose-peek-target", {
                        targetPlayerName: playerName,
                        slotIndex: index,
                      });
                    }
                    return;
                  }

                  if (isMyLockChoice) {
                    emitAction("blind4:choose-lock-target", {
                      targetPlayerName: playerName,
                      slotIndex: index,
                    });
                    return;
                  }

                  if (!isLocal) {
                    return;
                  }

                  if (canReorder) {
                    if (selectedSlot === -1) {
                      setSelectedSlot(index);
                      return;
                    }

                    if (selectedSlot === index) {
                      setSelectedSlot(-1);
                      return;
                    }

                    const order = cards.map((_, cardIndex) => cardIndex);
                    const temp = order[selectedSlot];
                    order[selectedSlot] = order[index];
                    order[index] = temp;

                    emitAction("blind4:reorder", { order });
                    setSelectedSlot(-1);
                    return;
                  }

                  if (isAwaitingPowerChoice) {
                    return;
                  }

                  setSelectedSlot(index);
                }}
                onDragStart={(event) => {
                  if (canReorder) {
                    setDraggingSlot(index);
                    setSelectedSlot(index);
                    event.dataTransfer.effectAllowed = "move";
                    return;
                  }

                  if (canDragSwapChoiceCard) {
                    setSwapDragSource({
                      playerName,
                      slotIndex: index,
                    });
                    setSelectedSlot(index);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData(
                      "text/plain",
                      "blind4-swap-choice",
                    );
                  }
                }}
                onDragOver={(event) => {
                  if (canReorder && draggingSlot !== -1) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    return;
                  }

                  if (canDropDrawnOnCard && isDraggingDrawnCard) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    return;
                  }

                  if (canDropDiscardOnCard && isDraggingDiscardCard) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    return;
                  }

                  if (canDropSwapChoiceCard) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                  }
                }}
                onDrop={(event) => {
                  if (canReorder && draggingSlot !== -1) {
                    event.preventDefault();

                    if (draggingSlot === index) {
                      setDraggingSlot(-1);
                      setSelectedSlot(-1);
                      return;
                    }

                    const order = cards.map((_, cardIndex) => cardIndex);
                    const temp = order[draggingSlot];
                    order[draggingSlot] = order[index];
                    order[index] = temp;

                    emitAction("blind4:reorder", { order });
                    setDraggingSlot(-1);
                    setSelectedSlot(-1);
                    return;
                  }

                  if (canDropDrawnOnCard && isDraggingDrawnCard) {
                    event.preventDefault();
                    emitAction("blind4:swap-drawn", { slotIndex: index });
                    setIsDraggingDrawnCard(false);
                    setSelectedSlot(-1);
                    return;
                  }

                  if (canDropDiscardOnCard && isDraggingDiscardCard) {
                    event.preventDefault();
                    emitAction("blind4:take-discard", { slotIndex: index });
                    setIsDraggingDiscardCard(false);
                    setSelectedSlot(-1);
                    return;
                  }

                  if (canDropSwapChoiceCard && swapDragSource) {
                    event.preventDefault();
                    emitAction("blind4:choose-swap-target", {
                      fromPlayerName: swapDragSource.playerName,
                      fromSlotIndex: swapDragSource.slotIndex,
                      toPlayerName: playerName,
                      toSlotIndex: index,
                    });
                    setSwapDragSource(null);
                    setSelectedSlot(-1);
                  }
                }}
                onDragEnd={() => {
                  setDraggingSlot(-1);
                  setSwapDragSource(null);
                }}
                onMouseEnter={() => {
                  if (isDraggingDrawnCard || isDraggingDiscardCard) {
                    setSelectedSlot(index);
                  }
                }}
                onMouseLeave={() => {
                  if (isDraggingDrawnCard || isDraggingDiscardCard) {
                    setSelectedSlot(-1);
                  }
                }}
                aria-label={`${playerName} card ${index + 1}: ${cardTitle}${isLocked ? ", locked" : ""}${lockingCard ? `, locked by ${getRankLabel(lockingCard.rank)}${getSuitSymbol(lockingCard.suit)}` : ""}`}
              >
                {showFace ? (
                  renderFaceCard(card)
                ) : (
                  <span className={styles.cardBack}>Blind</span>
                )}
                {lockingCard ? (
                  <span className={styles.lockCardOverlay}>
                    <span className={styles.lockCardMini}>
                      {renderFaceCard(lockingCard)}
                    </span>
                  </span>
                ) : null}
                {isLocked ? (
                  <span className={styles.lockBadge}>Locked</span>
                ) : null}
                {isPeekTargetCardActive ? (
                  <span className={styles.peekSeenBadge}>Seen</span>
                ) : null}
              </button>
            );
          })}
        </div>

        {isLocal && isSetupPhase && !localReady ? (
          <button
            type="button"
            className={styles.actionButton}
            disabled={!isSocketConnected}
            onClick={() => emitAction("blind4:ready")}
          >
            Ready (hide cards)
          </button>
        ) : null}
      </div>
    );
  };

  return (
    <section ref={surfaceRef} className={styles.surface}>
      <div className={styles.headerRow}>
        <h2>Blind Four</h2>
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
                <li>
                  On your turn, draw a card or use discard to replace a slot.
                </li>
                <li>
                  Card values: A = 1, 2-6 = face value, 7 = 0, 8-9 = face value.
                </li>
                <li>
                  Card values: 10 = 10, J = 10, Q = 10, K = 10, Joker = 20.
                </li>
                <li>
                  Use power cards (10, J, Q, K, Joker) to trigger special
                  actions.
                </li>
                <li>Locked cards cannot be swapped or shuffled.</li>
                <li>
                  Call Knock to start final turns; lowest total score wins.
                </li>
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      {swapMoveAnimation ? (
        <div className={styles.swapMoveLayer}>
          <span
            className={styles.swapGhostCard}
            style={{
              left: `${swapMoveAnimation.from.left}px`,
              top: `${swapMoveAnimation.from.top}px`,
              width: `${swapMoveAnimation.from.width}px`,
              height: `${swapMoveAnimation.from.height}px`,
              ["--swap-dx" as string]: `${
                swapMoveAnimation.to.left - swapMoveAnimation.from.left
              }px`,
              ["--swap-dy" as string]: `${
                swapMoveAnimation.to.top - swapMoveAnimation.from.top
              }px`,
            }}
          >
            <span className={styles.cardBack}>Swap</span>
          </span>
          <span
            className={styles.swapGhostCard}
            style={{
              left: `${swapMoveAnimation.to.left}px`,
              top: `${swapMoveAnimation.to.top}px`,
              width: `${swapMoveAnimation.to.width}px`,
              height: `${swapMoveAnimation.to.height}px`,
              ["--swap-dx" as string]: `${
                swapMoveAnimation.from.left - swapMoveAnimation.to.left
              }px`,
              ["--swap-dy" as string]: `${
                swapMoveAnimation.from.top - swapMoveAnimation.to.top
              }px`,
            }}
          >
            <span className={styles.cardBack}>Swap</span>
          </span>
        </div>
      ) : null}

      {isSetupPhase ? (
        <div className={styles.banner}>
          Setup phase: reorder your 4 open cards, then click Ready to lock the
          order and hide them. ({setupReadyCount}/
          {gameState?.playerOrder.length ?? 0} ready)
        </div>
      ) : null}

      {gameState?.lastAction &&
      gameState.lastAction.detail !==
        "Power used: seeing own cards for 10 seconds." ? (
        <div className={styles.banner}>
          <strong>{gameState.lastAction.playerName}</strong>:{" "}
          {gameState.lastAction.detail}
        </div>
      ) : null}

      {isSeeOwnCardsWindowActive && pendingSeeOwnCards ? (
        <div className={styles.banner}>
          <strong>{pendingSeeOwnCards.playerName}</strong> is seeing cards.
          Others must wait until reveal ends.
        </div>
      ) : null}

      {isPeekRevealWindowActive && activePeekReveal ? (
        <div className={styles.banner}>
          <strong>{activePeekReveal.playerName}</strong> is seeing card{" "}
          {activePeekReveal.slotIndex + 1} of{" "}
          {activePeekReveal.targetPlayerName}.
        </div>
      ) : null}

      {gameError ? <div className={styles.errorBanner}>{gameError}</div> : null}

      <div className={styles.gameArea}>
        <div className={styles.handsGrid}>
          {isOtherPlayerSeeingCards ? (
            <div className={styles.jokerOverlay}>
              <div className={styles.jokerOverlayCard}>
                <h3>Cards View In Progress</h3>
                <p>
                  <strong>{pendingSeeOwnCards.playerName}</strong> is seeing
                  cards for 10 seconds. Please wait.
                </p>
              </div>
            </div>
          ) : null}

          {shouldShowPowerOverlay ? (
            <div className={styles.jokerOverlay}>
              <div className={styles.jokerOverlayCard}>
                <h3>
                  {isAwaitingJokerChoice
                    ? "Joker Power"
                    : isAwaitingTenChoice
                      ? "10 Power"
                      : isAwaitingLockChoice
                        ? "Lock Target"
                        : isAwaitingSwapChoice
                          ? "Swap Target"
                          : isAwaitingShuffleChoice
                            ? "Shuffle Target"
                            : "Peek Target"}
                </h3>
                <p>
                  {isAwaitingJokerChoice && isMyJokerChoice
                    ? "Pick one power to apply before your turn continues."
                    : isAwaitingJokerChoice
                      ? `${pendingJokerChoice?.playerName} is choosing Joker power.`
                      : isAwaitingTenChoice && isMyTenChoice
                        ? "Choose to see your cards or one opponent card."
                        : isAwaitingTenChoice
                          ? `${pendingTenChoice?.playerName} is choosing 10 power.`
                          : isAwaitingLockChoice && isMyLockChoice
                            ? "Click any card (yours or opponent) to lock it."
                            : isAwaitingLockChoice
                              ? `${pendingLockChoice?.playerName} is choosing a card to lock.`
                              : isAwaitingSwapChoice && isMySwapChoice
                                ? "Drag any card and drop it on another player's card to swap."
                                : isAwaitingSwapChoice
                                  ? `${pendingSwapChoice?.playerName} is choosing cards to swap.`
                                  : isMyShuffleChoice
                                    ? "Select one remaining player to shuffle their unlocked cards."
                                    : isAwaitingShuffleChoice
                                      ? `${pendingShuffleChoice?.playerName} is selecting a player to shuffle.`
                                      : isMyPeekChoice
                                        ? "Click one opponent card to see it for 7 seconds."
                                        : `${pendingPeekChoice?.playerName} is selecting one opponent card to see.`}
                </p>
                {isAwaitingJokerChoice && isMyJokerChoice ? (
                  <div className={styles.jokerOptionRow}>
                    {(pendingJokerChoice?.options ?? []).map((power) => (
                      <button
                        key={power}
                        type="button"
                        className={styles.actionButton}
                        onClick={() =>
                          emitAction("blind4:choose-joker-power", { power })
                        }
                      >
                        {JOKER_OPTION_LABELS[power] ?? power}
                      </button>
                    ))}
                  </div>
                ) : null}
                {isAwaitingTenChoice && isMyTenChoice ? (
                  <div className={styles.jokerOptionRow}>
                    {(pendingTenChoice?.options ?? []).map((power) => (
                      <button
                        key={power}
                        type="button"
                        className={styles.actionButton}
                        onClick={() =>
                          emitAction("blind4:choose-ten-power", {
                            power: power as TenPowerOption,
                          })
                        }
                      >
                        {JOKER_OPTION_LABELS[power] ?? power}
                      </button>
                    ))}
                  </div>
                ) : null}
                {isAwaitingShuffleChoice && isMyShuffleChoice ? (
                  <div className={styles.jokerOptionRow}>
                    {availableShuffleTargets.map((targetPlayerName) => (
                      <button
                        key={targetPlayerName}
                        type="button"
                        className={styles.actionButton}
                        onClick={() =>
                          emitAction("blind4:choose-shuffle-target", {
                            targetPlayerName,
                          })
                        }
                      >
                        {targetPlayerName}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {otherPlayers.map((playerName) => renderPlayerBlock(playerName))}

          <div className={styles.pileRow}>
            <div className={styles.pileItem}>
              <button
                type="button"
                className={styles.pileCardButton}
                disabled={!canDrawFromDeck}
                onClick={() => emitAction("blind4:draw")}
                aria-label="Draw a card from deck"
              >
                <span className={styles.cardBack}>Deck</span>
                <span className={styles.pileCount}>
                  {gameState?.deckCount ?? 0}
                </span>
              </button>
              <div className={styles.pileLabel}>Draw</div>
            </div>

            <div className={styles.pileItem}>
              <div
                className={`${styles.pileCardWrap} ${
                  isDraggingDrawnCard && canDropDrawnToDiscard
                    ? styles.pileDropTargetActive
                    : ""
                } ${canDragDiscardTop ? styles.pileCardDrawnDraggable : ""}`}
                draggable={canDragDiscardTop}
                onDragStart={(event) => {
                  if (!canDragDiscardTop) {
                    return;
                  }

                  setIsDraggingDiscardCard(true);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData(
                    "text/plain",
                    "blind4-discard-card",
                  );
                }}
                onDragEnd={() => {
                  setIsDraggingDiscardCard(false);
                  setSelectedSlot(-1);
                }}
                onDragOver={(event) => {
                  if (!isDraggingDrawnCard || !canDropDrawnToDiscard) {
                    return;
                  }

                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }}
                onDrop={(event) => {
                  if (!isDraggingDrawnCard || !canDropDrawnToDiscard) {
                    return;
                  }

                  event.preventDefault();
                  emitAction("blind4:discard-drawn");
                  setIsDraggingDrawnCard(false);
                  setSelectedSlot(-1);
                }}
              >
                {gameState?.discardTop ? (
                  renderFaceCard(gameState.discardTop)
                ) : (
                  <span className={styles.cardBack}>Empty</span>
                )}
              </div>
              <div className={styles.pileLabel}>Discard</div>
            </div>

            {canSeePendingDrawCard && gameState?.pendingDrawCard ? (
              <div className={styles.pileItem}>
                <div
                  className={`${styles.pileCardWrap} ${
                    canDragPendingDrawCard ? styles.pileCardDrawnDraggable : ""
                  }`}
                  draggable={canDragPendingDrawCard}
                  onDragStart={(event) => {
                    if (!canDragPendingDrawCard) {
                      return;
                    }

                    setIsDraggingDrawnCard(true);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData(
                      "text/plain",
                      "blind4-drawn-card",
                    );
                  }}
                  onDragEnd={() => {
                    setIsDraggingDrawnCard(false);
                    setSelectedSlot(-1);
                  }}
                >
                  {renderFaceCard(gameState.pendingDrawCard)}
                </div>
                <div className={styles.pileLabel}>Drawn</div>
              </div>
            ) : null}
          </div>

          {showLocalPlayer ? renderPlayerBlock(localPlayerName) : null}
        </div>

        {localCards.length > 0 && isSetupPhase && !localReady ? (
          <div className={styles.banner}>
            All four of your cards are visible now. Reorder them, then click
            Ready to hide in the same order.
          </div>
        ) : null}
      </div>
    </section>
  );
}

import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { forwardRef, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Chess } from 'chess.js';
import { Server, Socket } from 'socket.io';
import { Repository } from 'typeorm';
import { BlindFourStateEntity } from './blind-four-state.entity';
import { ChessStateEntity } from './chess-state.entity';
import { RoomsService } from './rooms.service';
import { RoomStatus } from './room.entity';
import { LudoStateEntity } from './ludo-state.entity';
import { SnakesAndLaddersStateEntity } from './snl-state.entity';
import { TicTacToeStateEntity } from './ttt-state.entity';

type RoomCreatedPayload = {
  roomCode: string;
  hostName: string;
  game: string;
  status: string;
};

type RoomUserJoinedPayload = {
  roomCode: string;
  playerName: string;
  joinedAt: Date;
};

type RoomPresencePayload = {
  roomCode: string;
  connectedPlayerNames: string[];
};

type RoomStartedPayload = {
  roomCode: string;
  status: string;
};

type RoomStartPayload = {
  hostName?: string;
};

type SnakesAndLaddersMoveKind = 'normal' | 'snake' | 'ladder' | 'blocked';

type SnakesAndLaddersMove = {
  playerName: string;
  roll: number;
  from: number;
  to: number;
  kind: SnakesAndLaddersMoveKind;
};

type SnakesAndLaddersState = {
  roomCode: string;
  playerOrder: string[];
  positions: Record<string, number>;
  currentTurnIndex: number;
  status: 'running' | 'finished';
  winner: string | null;
  lastMove: SnakesAndLaddersMove | null;
};

type SnakesAndLaddersRollPayload = {
  playerName?: string;
};

type LudoMoveKind = 'move' | 'capture' | 'blocked' | 'finished';

type LudoMove = {
  playerName: string;
  roll: number;
  tokenIndex: number;
  from: number;
  to: number;
  kind: LudoMoveKind;
  capturedPlayers: string[];
};

type LudoState = {
  roomCode: string;
  playerOrder: string[];
  tokenProgress: Record<string, number[]>;
  currentTurnIndex: number;
  status: 'running' | 'finished';
  winner: string | null;
  lastMove: LudoMove | null;
};

type LudoRollPayload = {
  playerName?: string;
  tokenIndex?: number;
};

type LudoChoiceRequiredPayload = {
  roomCode: string;
  playerName: string;
  roll: number;
  movableTokenIndexes: number[];
};

type TicTacToeMark = 'X' | 'O';

type TicTacToeMove = {
  playerName: string;
  mark: TicTacToeMark;
  index: number;
};

type TicTacToeState = {
  roomCode: string;
  playerOrder: string[];
  marks: Record<string, TicTacToeMark>;
  board: Array<'' | TicTacToeMark>;
  currentTurnIndex: number;
  status: 'running' | 'finished';
  winner: string | null;
  isDraw: boolean;
  lastMove: TicTacToeMove | null;
};

type TicTacToeMovePayload = {
  playerName?: string;
  index?: number;
};

type ChessColor = 'white' | 'black';

type ChessMove = {
  playerName: string;
  from: string;
  to: string;
  promotion: string | null;
  san: string;
  piece: string;
  captured: string | null;
};

type ChessState = {
  roomCode: string;
  playerOrder: string[];
  colors: Record<string, ChessColor>;
  fen: string;
  currentTurnColor: ChessColor;
  currentTurnPlayer: string | null;
  legalMovesByFrom: Record<string, string[]>;
  status: 'running' | 'finished';
  winner: string | null;
  isDraw: boolean;
  isCheck: boolean;
  lastMove: ChessMove | null;
};

type ChessMovePayload = {
  playerName?: string;
  from?: string;
  to?: string;
  promotion?: string;
};

type BlindFourCard = {
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

type BlindFourLastAction = {
  playerName: string;
  action: string;
  detail: string;
};

type BlindFourPendingJokerChoice = {
  playerName: string;
  options: Array<
    | 'lock-card'
    | 'swap-card'
    | 'shuffle-cards'
    | 'pick-your-cards'
    | 'see-opponent-card'
  >;
};

type BlindFourPendingLockChoice = {
  playerName: string;
  source: 'joker-lock' | 'king-discard';
  lockingCard?: BlindFourCard | null;
};

type BlindFourPendingSwapChoice = {
  playerName: string;
  source: 'joker-swap' | 'queen-discard';
};

type BlindFourPendingShuffleChoice = {
  playerName: string;
  source: 'joker-shuffle' | 'jack-discard';
  targetPlayers: string[];
};

type BlindFourPendingTenChoice = {
  playerName: string;
  options: Array<'pick-your-cards' | 'see-opponent-card'>;
};

type BlindFourPendingSeeOwnCards = {
  playerName: string;
  startedAt: string;
  durationMs: number;
};

type BlindFourPendingPeekChoice = {
  playerName: string;
  source: 'joker-peek-opponent' | 'ten-peek-opponent';
  targetPlayers: string[];
};

type BlindFourActivePeekReveal = {
  playerName: string;
  targetPlayerName: string;
  slotIndex: number;
  startedAt: string;
  durationMs: number;
};

type BlindFourState = {
  roomCode: string;
  playerOrder: string[];
  hands: Record<string, BlindFourCard[]>;
  deckCount: number;
  discardTop: BlindFourCard | null;
  pendingDrawCard: BlindFourCard | null;
  initialPeekIndexes: Record<string, number[]>;
  setupReady: Record<string, boolean>;
  phase: 'setup' | 'running';
  currentTurnIndex: number;
  currentTurnPlayer: string | null;
  status: 'running' | 'finished';
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

type BlindFourBasePayload = {
  playerName?: string;
};

type BlindFourSlotPayload = BlindFourBasePayload & {
  slotIndex?: number;
};

type BlindFourTakeDiscardPayload = BlindFourBasePayload & {
  slotIndex?: number;
};

type BlindFourReorderPayload = BlindFourBasePayload & {
  order?: number[];
};

type BlindFourChooseJokerPayload = BlindFourBasePayload & {
  power?: string;
};

type BlindFourChooseTenPayload = BlindFourBasePayload & {
  power?: string;
};

type BlindFourChooseLockTargetPayload = BlindFourBasePayload & {
  targetPlayerName?: string;
  slotIndex?: number;
};

type BlindFourChooseSwapTargetPayload = BlindFourBasePayload & {
  fromPlayerName?: string;
  fromSlotIndex?: number;
  toPlayerName?: string;
  toSlotIndex?: number;
};

type BlindFourChooseShuffleTargetPayload = BlindFourBasePayload & {
  targetPlayerName?: string;
};

type BlindFourChoosePeekTargetPayload = BlindFourBasePayload & {
  targetPlayerName?: string;
  slotIndex?: number;
};

const BLIND_FOUR_RANKS = [
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
];

const BLIND_FOUR_SUITS = ['S', 'H', 'D', 'C'];
const BLIND_FOUR_SEE_OWN_CARDS_DURATION_MS = 10000;
const BLIND_FOUR_PEEK_OPPONENT_DURATION_MS = 7000;

const TIC_TAC_TOE_WIN_LINES: Array<[number, number, number]> = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

// This mapping is aligned to frontend/src/assets/sandl.jpg board artwork.
const SNAKES_AND_LADDERS_JUMPS: Record<number, number> = {
  // Ladders
  4: 25,
  13: 46,
  33: 49,
  50: 69,
  42: 63,
  62: 81,
  74: 92,
  // Snakes
  40: 3,
  43: 18,
  27: 5,
  54: 31,
  66: 45,
  89: 53,
  95: 77,
  99: 41,
};

const LUDO_TOKEN_COUNT = 4;
const LUDO_BOARD_TRACK_LENGTH = 52;
const LUDO_HOME_ENTRY_PROGRESS = 51;
const LUDO_ENTRY_OFFSETS = [0, 13, 26, 39];
const LUDO_HOME_LANE_LENGTH = 5;
const LUDO_CENTER_PROGRESS =
  LUDO_HOME_ENTRY_PROGRESS + LUDO_HOME_LANE_LENGTH + 1;
const LUDO_MAX_PROGRESS = LUDO_CENTER_PROGRESS;
const LUDO_SAFE_TRACK_INDEXES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

function getLudoBoardSlotIndex(playerCount: number, playerIndex: number) {
  if (playerCount === 2) {
    return playerIndex === 0 ? 0 : 2;
  }

  return Math.max(0, Math.min(3, playerIndex));
}

@WebSocketGateway({
  cors: {
    origin: true,
  },
})
export class RoomsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RoomsGateway.name);
  private readonly pendingLudoChoices = new Map<
    string,
    {
      playerName: string;
      roll: number;
      movableTokenIndexes: number[];
    }
  >();

  constructor(
    @Inject(forwardRef(() => RoomsService))
    private readonly roomsService: RoomsService,
    @InjectRepository(SnakesAndLaddersStateEntity)
    private readonly snakesAndLaddersStateRepository: Repository<SnakesAndLaddersStateEntity>,
    @InjectRepository(LudoStateEntity)
    private readonly ludoStateRepository: Repository<LudoStateEntity>,
    @InjectRepository(TicTacToeStateEntity)
    private readonly ticTacToeStateRepository: Repository<TicTacToeStateEntity>,
    @InjectRepository(ChessStateEntity)
    private readonly chessStateRepository: Repository<ChessStateEntity>,
    @InjectRepository(BlindFourStateEntity)
    private readonly blindFourStateRepository: Repository<BlindFourStateEntity>,
  ) {}

  @WebSocketServer()
  private server?: Server;

  async handleConnection(client: Socket) {
    const roomCode = this.getRoomCode(client);
    const playerName = this.getPlayerName(client);

    if (!roomCode) {
      client.disconnect(true);
      return;
    }

    await client.join(roomCode);
    client.emit('room:connected', { roomCode });
    client.to(roomCode).emit('room:user-connected', { roomCode });
    this.emitRoomPresence(roomCode);

    if (playerName) {
      client.to(roomCode).emit('room:user-joined', {
        roomCode,
        playerName,
        joinedAt: new Date(),
      });
    }
  }

  handleDisconnect(client: Socket) {
    const roomCode = this.getRoomCode(client);

    if (roomCode) {
      client.to(roomCode).emit('room:user-disconnected', { roomCode });
      this.emitRoomPresence(roomCode);
    }
  }

  @SubscribeMessage('room:start')
  async handleRoomStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: RoomStartPayload,
  ) {
    const roomCode = this.getRoomCode(client);
    const hostName =
      typeof payload?.hostName === 'string' ? payload.hostName.trim() : '';

    if (!roomCode) {
      return;
    }

    if (!hostName) {
      client.emit('room:start-error', {
        roomCode,
        message: 'Host name is required to start the room.',
      });
      return;
    }

    try {
      await this.roomsService.startRoom(roomCode, { hostName });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to start this room.';

      client.emit('room:start-error', {
        roomCode,
        message,
      });

      this.logger.warn(`Unable to start room ${roomCode}: ${message}`);
    }
  }

  @SubscribeMessage('snl:sync')
  async handleSnakesAndLaddersSync(@ConnectedSocket() client: Socket) {
    const roomCode = this.getRoomCode(client);

    if (!roomCode) {
      return;
    }

    const state = await this.getOrCreateSnakesAndLaddersState(roomCode, client);

    if (!state) {
      return;
    }

    client.emit('snl:state', state);
  }

  @SubscribeMessage('snl:roll')
  async handleSnakesAndLaddersRoll(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SnakesAndLaddersRollPayload,
  ) {
    const roomCode = this.getRoomCode(client);
    const playerName =
      typeof payload?.playerName === 'string' ? payload.playerName.trim() : '';

    if (!roomCode || !playerName) {
      return;
    }

    const state = await this.getOrCreateSnakesAndLaddersState(roomCode, client);

    if (!state) {
      return;
    }

    if (state.status === 'finished') {
      client.emit('snl:error', {
        roomCode,
        message: `Game already finished. Winner: ${state.winner ?? 'unknown'}.`,
      });
      client.emit('snl:state', state);
      return;
    }

    const currentPlayer = state.playerOrder[state.currentTurnIndex];

    if (currentPlayer !== playerName) {
      client.emit('snl:error', {
        roomCode,
        message: `It is ${currentPlayer}'s turn.`,
      });
      return;
    }

    const roll = this.rollDice();
    const fromPosition = state.positions[playerName] ?? 0;
    const moveTarget = fromPosition + roll;
    const blockedMove = moveTarget > 100;
    const baseToPosition = blockedMove ? fromPosition : moveTarget;
    const jumpedTo = SNAKES_AND_LADDERS_JUMPS[baseToPosition] ?? baseToPosition;
    const isLadder = jumpedTo > baseToPosition;
    const isSnake = jumpedTo < baseToPosition;

    state.positions[playerName] = jumpedTo;
    state.lastMove = {
      playerName,
      roll,
      from: fromPosition,
      to: jumpedTo,
      kind: blockedMove
        ? 'blocked'
        : isLadder
          ? 'ladder'
          : isSnake
            ? 'snake'
            : 'normal',
    };

    if (jumpedTo === 100) {
      state.status = 'finished';
      state.winner = playerName;
    } else if (roll !== 6) {
      state.currentTurnIndex =
        (state.currentTurnIndex + 1) % state.playerOrder.length;
    }

    await this.saveSnakesAndLaddersState(state);
    this.server?.to(roomCode).emit('snl:state', state);
  }

  emitRoomCreated(roomCode: string, payload: RoomCreatedPayload) {
    if (!this.server) {
      return;
    }

    this.server.to(roomCode).emit('room:created', payload);
  }

  private emitRoomPresence(roomCode: string) {
    this.server?.to(roomCode).emit('room:presence', {
      roomCode,
      connectedPlayerNames: this.getConnectedPlayerNames(roomCode),
    } satisfies RoomPresencePayload);
  }

  private getConnectedPlayerNames(roomCode: string) {
    if (!this.server) {
      return [];
    }

    const room = this.server.sockets.adapter.rooms.get(roomCode);

    if (!room) {
      return [];
    }

    return Array.from(room)
      .map((socketId) => this.server?.sockets.sockets.get(socketId))
      .filter((socket): socket is Socket => !!socket)
      .map((socket) => this.getPlayerName(socket))
      .filter((playerName): playerName is string => !!playerName)
      .filter(
        (playerName, index, playerNames) =>
          playerNames.indexOf(playerName) === index,
      );
  }

  emitRoomUserJoined(roomCode: string, payload: RoomUserJoinedPayload) {
    if (!this.server) {
      return;
    }

    this.server.to(roomCode).emit('room:user-joined', payload);
  }

  emitRoomStarted(roomCode: string, payload: RoomStartedPayload) {
    if (!this.server) {
      return;
    }

    this.server.to(roomCode).emit('room:started', payload);

    if (payload.status === 'live') {
      void this.ensureLiveGameStarted(roomCode);
    }
  }

  private async ensureLiveGameStarted(roomCode: string) {
    const room = await this.roomsService.findOne(roomCode).catch(() => null);

    if (!room) {
      return;
    }

    const game = room.game.trim().toLowerCase();

    if (game === 'snakes and ladders') {
      const existingState = await this.loadSnakesAndLaddersState(roomCode);

      if (existingState) {
        this.server?.to(roomCode).emit('snl:state', existingState);
        return;
      }

      const state = await this.getOrCreateSnakesAndLaddersState(roomCode);

      if (state) {
        this.server?.to(roomCode).emit('snl:state', state);
      }
      return;
    }

    if (game === 'ludo') {
      const existingState = await this.loadLudoState(roomCode);

      if (existingState) {
        this.server?.to(roomCode).emit('ludo:state', existingState);
        return;
      }

      const state = await this.getOrCreateLudoState(roomCode);

      if (state) {
        this.server?.to(roomCode).emit('ludo:state', state);
      }
      return;
    }

    if (game === 'tic tac toe') {
      const existingState = await this.loadTicTacToeState(roomCode);

      if (existingState) {
        this.server?.to(roomCode).emit('ttt:state', existingState);
        return;
      }

      const state = await this.getOrCreateTicTacToeState(roomCode);

      if (state) {
        this.server?.to(roomCode).emit('ttt:state', state);
      }
      return;
    }

    if (game === 'chess') {
      const existingState = await this.loadChessState(roomCode);

      if (existingState) {
        this.server?.to(roomCode).emit('chess:state', existingState);
        return;
      }

      const state = await this.getOrCreateChessState(roomCode);

      if (state) {
        this.server?.to(roomCode).emit('chess:state', state);
      }
      return;
    }

    if (game === 'blind four') {
      const existingState = await this.loadBlindFourState(roomCode);

      if (existingState) {
        this.server?.to(roomCode).emit('blind4:state', existingState);
        return;
      }

      const state = await this.getOrCreateBlindFourState(roomCode);

      if (state) {
        this.server?.to(roomCode).emit('blind4:state', state);
      }
    }
  }

  @SubscribeMessage('blind4:sync')
  async handleBlindFourSync(@ConnectedSocket() client: Socket) {
    const roomCode = this.getRoomCode(client);

    if (!roomCode) {
      return;
    }

    const state = await this.getOrCreateBlindFourState(roomCode, client);

    if (!state) {
      return;
    }

    client.emit('blind4:state', state);
  }

  @SubscribeMessage('blind4:reorder')
  async handleBlindFourReorder(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: BlindFourReorderPayload,
  ) {
    const roomCode = this.getRoomCode(client);
    const playerName =
      typeof payload?.playerName === 'string' ? payload.playerName.trim() : '';
    const order = Array.isArray(payload?.order)
      ? payload.order
      : ([] as number[]);

    if (!roomCode || !playerName) {
      return;
    }

    const entity = await this.loadBlindFourStateEntity(roomCode);

    if (!entity) {
      client.emit('blind4:error', {
        roomCode,
        message: 'Game state not found.',
      });
      return;
    }

    if (entity.status === 'finished') {
      client.emit('blind4:error', {
        roomCode,
        message: 'Game already finished.',
      });
      return;
    }

    if (entity.phase !== 'setup') {
      client.emit('blind4:error', {
        roomCode,
        message: 'Reorder is available only during setup.',
      });
      return;
    }

    if (!entity.playerOrder.includes(playerName)) {
      client.emit('blind4:error', {
        roomCode,
        message: 'You are not a player in this game.',
      });
      return;
    }

    if (entity.setupReady?.[playerName]) {
      client.emit('blind4:error', {
        roomCode,
        message: 'You are already ready.',
      });
      return;
    }

    const cards = entity.hands[playerName] ?? [];

    if (cards.length === 0) {
      client.emit('blind4:error', {
        roomCode,
        message: 'No cards to reorder.',
      });
      return;
    }

    if (order.length !== cards.length) {
      client.emit('blind4:error', {
        roomCode,
        message: 'Invalid reorder payload.',
      });
      return;
    }

    const uniqueIndexes = new Set(order);

    if (uniqueIndexes.size !== cards.length) {
      client.emit('blind4:error', {
        roomCode,
        message: 'Order must contain unique indexes.',
      });
      return;
    }

    const reordered = order.map((index) => cards[index]).filter(Boolean);

    if (reordered.length !== cards.length) {
      client.emit('blind4:error', {
        roomCode,
        message: 'Order contains invalid indexes.',
      });
      return;
    }

    entity.hands[playerName] = reordered;
    entity.lastAction = {
      playerName,
      action: 'reorder',
      detail: 'Reordered own cards.',
    };

    await this.blindFourStateRepository.save(entity);
    this.server
      ?.to(roomCode)
      .emit('blind4:state', this.buildBlindFourStateFromEntity(entity));
  }

  @SubscribeMessage('blind4:ready')
  async handleBlindFourReady(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: BlindFourBasePayload,
  ) {
    const roomCode = this.getRoomCode(client);
    const playerName =
      typeof payload?.playerName === 'string' ? payload.playerName.trim() : '';

    if (!roomCode || !playerName) {
      return;
    }

    const entity = await this.loadBlindFourStateEntity(roomCode);

    if (!entity) {
      client.emit('blind4:error', {
        roomCode,
        message: 'Game state not found.',
      });
      return;
    }

    if (entity.status === 'finished') {
      client.emit('blind4:error', {
        roomCode,
        message: 'Game already finished.',
      });
      return;
    }

    if (entity.phase !== 'setup') {
      client.emit('blind4:error', {
        roomCode,
        message: 'Setup already completed.',
      });
      return;
    }

    if (!entity.playerOrder.includes(playerName)) {
      client.emit('blind4:error', {
        roomCode,
        message: 'You are not a player in this game.',
      });
      return;
    }

    entity.setupReady = {
      ...(entity.setupReady ?? {}),
      [playerName]: true,
    };

    entity.lastAction = {
      playerName,
      action: 'ready',
      detail: 'Locked setup order and is ready.',
    };

    const everyoneReady = entity.playerOrder.every(
      (name) => !!entity.setupReady?.[name],
    );

    if (everyoneReady) {
      entity.phase = 'running';
      entity.lastAction = {
        playerName,
        action: 'setup-complete',
        detail: 'All players ready. Round started.',
      };
    }

    await this.blindFourStateRepository.save(entity);
    this.server
      ?.to(roomCode)
      .emit('blind4:state', this.buildBlindFourStateFromEntity(entity));
  }

  @SubscribeMessage('blind4:draw')
  async handleBlindFourDraw(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: BlindFourBasePayload,
  ) {
    const roomCode = this.getRoomCode(client);
    const playerName =
      typeof payload?.playerName === 'string' ? payload.playerName.trim() : '';

    if (!roomCode || !playerName) {
      return;
    }

    const entity = await this.getBlindFourEntityForTurn(
      roomCode,
      playerName,
      client,
    );

    if (!entity) {
      return;
    }

    if (entity.pendingDrawCard) {
      client.emit('blind4:error', {
        roomCode,
        message: 'Resolve your drawn card first.',
      });
      return;
    }

    let reshuffledFromDiscard = false;

    if (entity.deck.length === 0) {
      if (entity.discardPile.length <= 1) {
        client.emit('blind4:error', {
          roomCode,
          message: 'Deck is empty.',
        });
        return;
      }

      const discardTop = entity.discardPile.pop();

      if (!discardTop) {
        client.emit('blind4:error', {
          roomCode,
          message: 'Deck is empty.',
        });
        return;
      }

      const recycledDeck = entity.discardPile.map((card) => ({
        ...card,
        locked: false,
        lockedByCard: null,
      }));

      for (let index = recycledDeck.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        const temp = recycledDeck[index];
        recycledDeck[index] = recycledDeck[randomIndex];
        recycledDeck[randomIndex] = temp;
      }

      entity.deck = recycledDeck;
      entity.discardPile = [discardTop];
      reshuffledFromDiscard = true;
    }

    const drawn = entity.deck.shift();

    if (!drawn) {
      client.emit('blind4:error', {
        roomCode,
        message: 'Deck is empty.',
      });
      return;
    }

    entity.pendingDrawCard = drawn;
    entity.lastAction = {
      playerName,
      action: 'draw',
      detail: reshuffledFromDiscard
        ? 'Drew from deck after reshuffling discard pile.'
        : 'Drew from deck.',
    };

    await this.blindFourStateRepository.save(entity);
    this.server
      ?.to(roomCode)
      .emit('blind4:state', this.buildBlindFourStateFromEntity(entity));
  }

  @SubscribeMessage('blind4:take-discard')
  async handleBlindFourTakeDiscard(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: BlindFourTakeDiscardPayload,
  ) {
    const roomCode = this.getRoomCode(client);
    const playerName =
      typeof payload?.playerName === 'string' ? payload.playerName.trim() : '';
    const slotIndex =
      typeof payload?.slotIndex === 'number' &&
      Number.isInteger(payload.slotIndex)
        ? payload.slotIndex
        : -1;

    if (!roomCode || !playerName) {
      return;
    }

    const entity = await this.getBlindFourEntityForTurn(
      roomCode,
      playerName,
      client,
    );

    if (!entity) {
      return;
    }

    if (entity.pendingDrawCard) {
      client.emit('blind4:error', {
        roomCode,
        message: 'Use or discard your drawn card first.',
      });
      return;
    }

    const playerCards = entity.hands[playerName] ?? [];

    if (slotIndex < 0 || slotIndex >= playerCards.length) {
      client.emit('blind4:error', {
        roomCode,
        message: 'Choose a valid card slot.',
      });
      return;
    }

    const cardToReplace = playerCards[slotIndex];

    if (!cardToReplace || cardToReplace.locked) {
      client.emit('blind4:error', {
        roomCode,
        message: 'That card is locked and cannot be swapped.',
      });
      return;
    }

    const discardTop = entity.discardPile.pop();

    if (!discardTop) {
      client.emit('blind4:error', {
        roomCode,
        message: 'Discard pile is empty.',
      });
      return;
    }

    playerCards[slotIndex] = { ...discardTop, locked: false };
    entity.hands[playerName] = playerCards;
    entity.discardPile.push({ ...cardToReplace, locked: false });
    entity.lastAction = {
      playerName,
      action: 'take-discard',
      detail: `Swapped discard into slot ${slotIndex + 1}.`,
    };

    const shouldCompleteTurn = this.applyBlindFourDiscardPower(
      entity,
      playerName,
      cardToReplace,
    );

    if (shouldCompleteTurn) {
      this.completeBlindFourTurn(entity, playerName);
    }
    await this.blindFourStateRepository.save(entity);
    this.server
      ?.to(roomCode)
      .emit('blind4:state', this.buildBlindFourStateFromEntity(entity));
  }

  @SubscribeMessage('blind4:swap-drawn')
  async handleBlindFourSwapDrawn(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: BlindFourSlotPayload,
  ) {
    const roomCode = this.getRoomCode(client);
    const playerName =
      typeof payload?.playerName === 'string' ? payload.playerName.trim() : '';
    const slotIndex =
      typeof payload?.slotIndex === 'number' &&
      Number.isInteger(payload.slotIndex)
        ? payload.slotIndex
        : -1;

    if (!roomCode || !playerName) {
      return;
    }

    const entity = await this.getBlindFourEntityForTurn(
      roomCode,
      playerName,
      client,
    );

    if (!entity) {
      return;
    }

    if (!entity.pendingDrawCard) {
      client.emit('blind4:error', {
        roomCode,
        message: 'Draw a card first.',
      });
      return;
    }

    const playerCards = entity.hands[playerName] ?? [];

    if (slotIndex < 0 || slotIndex >= playerCards.length) {
      client.emit('blind4:error', {
        roomCode,
        message: 'Choose a valid card slot.',
      });
      return;
    }

    const cardToReplace = playerCards[slotIndex];

    if (!cardToReplace || cardToReplace.locked) {
      client.emit('blind4:error', {
        roomCode,
        message: 'That card is locked and cannot be swapped.',
      });
      return;
    }

    playerCards[slotIndex] = { ...entity.pendingDrawCard, locked: false };
    entity.hands[playerName] = playerCards;
    entity.discardPile.push({ ...cardToReplace, locked: false });
    entity.pendingDrawCard = null;
    entity.lastAction = {
      playerName,
      action: 'swap-drawn',
      detail: `Swapped drawn card into slot ${slotIndex + 1}.`,
    };

    const shouldCompleteTurn = this.applyBlindFourDiscardPower(
      entity,
      playerName,
      cardToReplace,
    );

    if (shouldCompleteTurn) {
      this.completeBlindFourTurn(entity, playerName);
    }
    await this.blindFourStateRepository.save(entity);
    this.server
      ?.to(roomCode)
      .emit('blind4:state', this.buildBlindFourStateFromEntity(entity));
  }

  @SubscribeMessage('blind4:discard-drawn')
  async handleBlindFourDiscardDrawn(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: BlindFourBasePayload,
  ) {
    const roomCode = this.getRoomCode(client);
    const playerName =
      typeof payload?.playerName === 'string' ? payload.playerName.trim() : '';

    if (!roomCode || !playerName) {
      return;
    }

    const entity = await this.getBlindFourEntityForTurn(
      roomCode,
      playerName,
      client,
    );

    if (!entity) {
      return;
    }

    if (!entity.pendingDrawCard) {
      client.emit('blind4:error', {
        roomCode,
        message: 'No drawn card to discard.',
      });
      return;
    }

    const discarded = { ...entity.pendingDrawCard, locked: false };
    entity.pendingDrawCard = null;
    entity.discardPile.push(discarded);
    entity.lastAction = {
      playerName,
      action: 'discard-drawn',
      detail: 'Discarded drawn card.',
    };

    const shouldCompleteTurn = this.applyBlindFourDiscardPower(
      entity,
      playerName,
      discarded,
    );

    if (shouldCompleteTurn) {
      this.completeBlindFourTurn(entity, playerName);
    }
    await this.blindFourStateRepository.save(entity);
    this.server
      ?.to(roomCode)
      .emit('blind4:state', this.buildBlindFourStateFromEntity(entity));
  }

  @SubscribeMessage('blind4:slap')
  async handleBlindFourSlap(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: BlindFourSlotPayload,
  ) {
    const roomCode = this.getRoomCode(client);
    const playerName =
      typeof payload?.playerName === 'string' ? payload.playerName.trim() : '';
    const slotIndex =
      typeof payload?.slotIndex === 'number' &&
      Number.isInteger(payload.slotIndex)
        ? payload.slotIndex
        : -1;

    if (!roomCode || !playerName) {
      return;
    }

    const entity = await this.loadBlindFourStateEntity(roomCode);

    if (!entity) {
      client.emit('blind4:error', {
        roomCode,
        message: 'Game state not found.',
      });
      return;
    }

    if (entity.status === 'finished') {
      client.emit('blind4:error', {
        roomCode,
        message: 'Game already finished.',
      });
      return;
    }

    const activeSeeOwnCards = this.getActiveBlindFourSeeOwnCards(entity);

    if (activeSeeOwnCards && activeSeeOwnCards.playerName !== playerName) {
      client.emit('blind4:error', {
        roomCode,
        message: `${activeSeeOwnCards.playerName} is seeing cards. Please wait.`,
      });
      return;
    }

    const activePeekReveal = this.getActiveBlindFourPeekReveal(entity);

    if (activePeekReveal && activePeekReveal.playerName !== playerName) {
      client.emit('blind4:error', {
        roomCode,
        message: `${activePeekReveal.playerName} is seeing an opponent card. Please wait.`,
      });
      return;
    }

    if (entity.pendingJokerChoice) {
      client.emit('blind4:error', {
        roomCode,
        message: `${entity.pendingJokerChoice.playerName} must choose Joker power first.`,
      });
      return;
    }

    const topDiscard = entity.discardPile[entity.discardPile.length - 1];
    const playerCards = entity.hands[playerName] ?? [];

    if (!topDiscard || slotIndex < 0 || slotIndex >= playerCards.length) {
      client.emit('blind4:error', {
        roomCode,
        message: 'Invalid slap target.',
      });
      return;
    }

    const targetCard = playerCards[slotIndex];

    if (!targetCard || targetCard.locked) {
      client.emit('blind4:error', {
        roomCode,
        message: 'That card cannot be slapped.',
      });
      return;
    }

    if (targetCard.rank !== topDiscard.rank) {
      client.emit('blind4:error', {
        roomCode,
        message: 'Slap failed. Rank does not match discard top.',
      });
      return;
    }

    const [removed] = playerCards.splice(slotIndex, 1);
    entity.hands[playerName] = playerCards;
    entity.discardPile.push({ ...removed, locked: false });
    entity.lastAction = {
      playerName,
      action: 'slap',
      detail: `Slapped slot ${slotIndex + 1} and discarded a matching rank.`,
    };

    await this.blindFourStateRepository.save(entity);
    this.server
      ?.to(roomCode)
      .emit('blind4:state', this.buildBlindFourStateFromEntity(entity));
  }

  @SubscribeMessage('blind4:choose-joker-power')
  async handleBlindFourChooseJokerPower(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: BlindFourChooseJokerPayload,
  ) {
    const roomCode = this.getRoomCode(client);
    const playerName =
      typeof payload?.playerName === 'string' ? payload.playerName.trim() : '';
    const power =
      typeof payload?.power === 'string' ? payload.power.trim() : '';

    if (!roomCode || !playerName) {
      return;
    }

    const entity = await this.loadBlindFourStateEntity(roomCode);

    if (!entity) {
      client.emit('blind4:error', {
        roomCode,
        message: 'Game state not found.',
      });
      return;
    }

    if (entity.status === 'finished') {
      client.emit('blind4:error', {
        roomCode,
        message: 'Game already finished.',
      });
      return;
    }

    const pendingChoice = entity.pendingJokerChoice;

    if (!pendingChoice) {
      client.emit('blind4:error', {
        roomCode,
        message: 'There is no pending Joker power choice.',
      });
      return;
    }

    if (pendingChoice.playerName !== playerName) {
      client.emit('blind4:error', {
        roomCode,
        message: 'Only the current player can choose Joker power.',
      });
      return;
    }

    const currentPlayer = entity.playerOrder[entity.currentTurnIndex] ?? '';

    if (currentPlayer !== playerName) {
      client.emit('blind4:error', {
        roomCode,
        message: `It is ${currentPlayer}'s turn.`,
      });
      return;
    }

    if (
      power !== 'lock-card' &&
      power !== 'swap-card' &&
      power !== 'shuffle-cards' &&
      power !== 'pick-your-cards' &&
      power !== 'see-opponent-card'
    ) {
      client.emit('blind4:error', {
        roomCode,
        message:
          'Choose a valid Joker power option before continuing your turn.',
      });
      return;
    }

    if (power === 'lock-card') {
      const hasLockableTarget = entity.playerOrder.some((name) =>
        (entity.hands[name] ?? []).some((card) => !!card && !card.locked),
      );

      if (!hasLockableTarget) {
        entity.lastAction = {
          playerName,
          action: 'power-k',
          detail: 'Power used: no available card to lock.',
        };
        this.completeBlindFourTurn(entity, playerName);
      } else {
        const discardTop = entity.discardPile[entity.discardPile.length - 1];

        if (!discardTop) {
          client.emit('blind4:error', {
            roomCode,
            message: 'Joker lock is unavailable right now.',
          });
          return;
        }

        const lockingCard = entity.discardPile.pop() ?? discardTop;

        entity.pendingLockChoice = {
          playerName,
          source: 'joker-lock',
          lockingCard: {
            ...lockingCard,
            locked: false,
            lockedByCard: null,
          },
        };
        entity.lastAction = {
          playerName,
          action: 'power-k',
          detail:
            'Joker lock used: choose any card (yours or opponent) to lock.',
        };
      }
    } else if (power === 'swap-card') {
      const playersWithUnlockedCards = entity.playerOrder.filter((name) =>
        (entity.hands[name] ?? []).some((card) => !!card && !card.locked),
      );

      if (playersWithUnlockedCards.length < 2) {
        entity.lastAction = {
          playerName,
          action: 'power-q',
          detail: 'Power used: no valid players/cards available for swap.',
        };
        this.completeBlindFourTurn(entity, playerName);
      } else {
        entity.pendingSwapChoice = {
          playerName,
          source: 'joker-swap',
        };
        entity.lastAction = {
          playerName,
          action: 'power-q',
          detail: 'Drag a card onto another player card to swap.',
        };
      }
    } else if (power === 'shuffle-cards') {
      const targetPlayers = entity.playerOrder.filter(
        (name) =>
          name !== playerName &&
          (entity.hands[name] ?? []).some((card) => !!card && !card.locked),
      );

      if (targetPlayers.length === 0) {
        entity.lastAction = {
          playerName,
          action: 'power-j',
          detail: 'Power used: no valid opponent cards available to shuffle.',
        };
        this.completeBlindFourTurn(entity, playerName);
      } else {
        entity.pendingShuffleChoice = {
          playerName,
          source: 'joker-shuffle',
          targetPlayers,
        };
        entity.lastAction = {
          playerName,
          action: 'power-j',
          detail: 'Choose an opponent to shuffle cards.',
        };
      }
    } else if (power === 'pick-your-cards') {
      this.applyBlindFourTenPower(entity, playerName);
      this.completeBlindFourTurn(entity, playerName);
    } else {
      const targetPlayers = entity.playerOrder.filter(
        (name) => name !== playerName && (entity.hands[name] ?? []).length > 0,
      );

      if (targetPlayers.length === 0) {
        entity.lastAction = {
          playerName,
          action: 'power-peek-opponent',
          detail: 'Power used: no opponent card available to peek.',
        };
        this.completeBlindFourTurn(entity, playerName);
      } else {
        entity.pendingPeekChoice = {
          playerName,
          source: 'joker-peek-opponent',
          targetPlayers,
        };
        entity.lastAction = {
          playerName,
          action: 'power-peek-opponent',
          detail: 'Choose one opponent card to see for 7 seconds.',
        };
      }
    }

    entity.pendingJokerChoice = null;

    if (!entity.lastAction || !entity.lastAction.action.startsWith('power-')) {
      entity.lastAction = {
        playerName,
        action: 'power-joker',
        detail: `Joker power used: ${power}.`,
      };
    }

    await this.blindFourStateRepository.save(entity);
    this.server
      ?.to(roomCode)
      .emit('blind4:state', this.buildBlindFourStateFromEntity(entity));
  }

  @SubscribeMessage('blind4:choose-peek-target')
  async handleBlindFourChoosePeekTarget(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: BlindFourChoosePeekTargetPayload,
  ) {
    const roomCode = this.getRoomCode(client);
    const playerName =
      typeof payload?.playerName === 'string' ? payload.playerName.trim() : '';
    const targetPlayerName =
      typeof payload?.targetPlayerName === 'string'
        ? payload.targetPlayerName.trim()
        : '';
    const slotIndex =
      typeof payload?.slotIndex === 'number' &&
      Number.isInteger(payload.slotIndex)
        ? payload.slotIndex
        : -1;

    if (!roomCode || !playerName || !targetPlayerName) {
      return;
    }

    const entity = await this.loadBlindFourStateEntity(roomCode);

    if (!entity) {
      client.emit('blind4:error', {
        roomCode,
        message: 'Game state not found.',
      });
      return;
    }

    const pendingPeek = entity.pendingPeekChoice;

    if (!pendingPeek) {
      client.emit('blind4:error', {
        roomCode,
        message: 'There is no pending opponent card choice.',
      });
      return;
    }

    if (pendingPeek.playerName !== playerName) {
      client.emit('blind4:error', {
        roomCode,
        message: 'Only the active player can choose an opponent card.',
      });
      return;
    }

    const currentPlayer = entity.playerOrder[entity.currentTurnIndex] ?? '';

    if (currentPlayer !== playerName) {
      client.emit('blind4:error', {
        roomCode,
        message: `It is ${currentPlayer}'s turn.`,
      });
      return;
    }

    if (!pendingPeek.targetPlayers.includes(targetPlayerName)) {
      client.emit('blind4:error', {
        roomCode,
        message: 'Choose a valid opponent player.',
      });
      return;
    }

    if (targetPlayerName === playerName) {
      client.emit('blind4:error', {
        roomCode,
        message: 'Choose an opponent card, not your own.',
      });
      return;
    }

    const targetCards = entity.hands[targetPlayerName] ?? [];

    if (slotIndex < 0 || slotIndex >= targetCards.length) {
      client.emit('blind4:error', {
        roomCode,
        message: 'Choose a valid opponent card slot.',
      });
      return;
    }

    entity.pendingPeekChoice = null;
    entity.activePeekReveal = {
      playerName,
      targetPlayerName,
      slotIndex,
      startedAt: new Date().toISOString(),
      durationMs: BLIND_FOUR_PEEK_OPPONENT_DURATION_MS,
    };
    entity.lastAction = {
      playerName,
      action: 'power-peek-opponent',
      detail: `Seeing ${targetPlayerName} card ${slotIndex + 1} for 7 seconds.`,
    };

    this.completeBlindFourTurn(entity, playerName);
    await this.blindFourStateRepository.save(entity);
    this.server
      ?.to(roomCode)
      .emit('blind4:state', this.buildBlindFourStateFromEntity(entity));
  }

  @SubscribeMessage('blind4:choose-ten-power')
  async handleBlindFourChooseTenPower(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: BlindFourChooseTenPayload,
  ) {
    const roomCode = this.getRoomCode(client);
    const playerName =
      typeof payload?.playerName === 'string' ? payload.playerName.trim() : '';
    const power =
      typeof payload?.power === 'string' ? payload.power.trim() : '';

    if (!roomCode || !playerName) {
      return;
    }

    const entity = await this.loadBlindFourStateEntity(roomCode);

    if (!entity) {
      client.emit('blind4:error', {
        roomCode,
        message: 'Game state not found.',
      });
      return;
    }

    if (entity.status === 'finished') {
      client.emit('blind4:error', {
        roomCode,
        message: 'Game already finished.',
      });
      return;
    }

    const pendingChoice = entity.pendingTenChoice;

    if (!pendingChoice) {
      client.emit('blind4:error', {
        roomCode,
        message: 'There is no pending 10 power choice.',
      });
      return;
    }

    if (pendingChoice.playerName !== playerName) {
      client.emit('blind4:error', {
        roomCode,
        message: 'Only the current player can choose 10 power.',
      });
      return;
    }

    const currentPlayer = entity.playerOrder[entity.currentTurnIndex] ?? '';

    if (currentPlayer !== playerName) {
      client.emit('blind4:error', {
        roomCode,
        message: `It is ${currentPlayer}'s turn.`,
      });
      return;
    }

    if (power !== 'pick-your-cards' && power !== 'see-opponent-card') {
      client.emit('blind4:error', {
        roomCode,
        message: 'Choose a valid 10 power option before continuing your turn.',
      });
      return;
    }

    if (power === 'pick-your-cards') {
      this.applyBlindFourTenPower(entity, playerName);
      this.completeBlindFourTurn(entity, playerName);
    } else {
      const targetPlayers = entity.playerOrder.filter(
        (name) => name !== playerName && (entity.hands[name] ?? []).length > 0,
      );

      if (targetPlayers.length === 0) {
        entity.lastAction = {
          playerName,
          action: 'power-peek-opponent',
          detail: 'Power used: no opponent card available to peek.',
        };
        this.completeBlindFourTurn(entity, playerName);
      } else {
        entity.pendingPeekChoice = {
          playerName,
          source: 'ten-peek-opponent',
          targetPlayers,
        };
        entity.lastAction = {
          playerName,
          action: 'power-peek-opponent',
          detail: 'Choose one opponent card to see for 7 seconds.',
        };
      }
    }

    entity.pendingTenChoice = null;

    await this.blindFourStateRepository.save(entity);
    this.server
      ?.to(roomCode)
      .emit('blind4:state', this.buildBlindFourStateFromEntity(entity));
  }

  @SubscribeMessage('blind4:choose-shuffle-target')
  async handleBlindFourChooseShuffleTarget(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: BlindFourChooseShuffleTargetPayload,
  ) {
    const roomCode = this.getRoomCode(client);
    const playerName =
      typeof payload?.playerName === 'string' ? payload.playerName.trim() : '';
    const targetPlayerName =
      typeof payload?.targetPlayerName === 'string'
        ? payload.targetPlayerName.trim()
        : '';

    if (!roomCode || !playerName || !targetPlayerName) {
      return;
    }

    const entity = await this.loadBlindFourStateEntity(roomCode);

    if (!entity) {
      client.emit('blind4:error', {
        roomCode,
        message: 'Game state not found.',
      });
      return;
    }

    const pendingShuffle = entity.pendingShuffleChoice;

    if (!pendingShuffle) {
      client.emit('blind4:error', {
        roomCode,
        message: 'There is no pending shuffle target choice.',
      });
      return;
    }

    if (pendingShuffle.playerName !== playerName) {
      client.emit('blind4:error', {
        roomCode,
        message: 'Only the active player can choose shuffle target.',
      });
      return;
    }

    const currentPlayer = entity.playerOrder[entity.currentTurnIndex] ?? '';

    if (currentPlayer !== playerName) {
      client.emit('blind4:error', {
        roomCode,
        message: `It is ${currentPlayer}'s turn.`,
      });
      return;
    }

    if (!pendingShuffle.targetPlayers.includes(targetPlayerName)) {
      client.emit('blind4:error', {
        roomCode,
        message: 'Choose a valid target player to shuffle.',
      });
      return;
    }

    this.applyBlindFourJackPowerToTarget(entity, playerName, targetPlayerName);
    entity.pendingShuffleChoice = null;

    this.completeBlindFourTurn(entity, playerName);
    await this.blindFourStateRepository.save(entity);
    this.server
      ?.to(roomCode)
      .emit('blind4:state', this.buildBlindFourStateFromEntity(entity));
  }

  @SubscribeMessage('blind4:choose-swap-target')
  async handleBlindFourChooseSwapTarget(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: BlindFourChooseSwapTargetPayload,
  ) {
    const roomCode = this.getRoomCode(client);
    const playerName =
      typeof payload?.playerName === 'string' ? payload.playerName.trim() : '';
    const fromPlayerName =
      typeof payload?.fromPlayerName === 'string'
        ? payload.fromPlayerName.trim()
        : '';
    const toPlayerName =
      typeof payload?.toPlayerName === 'string'
        ? payload.toPlayerName.trim()
        : '';
    const fromSlotIndex =
      typeof payload?.fromSlotIndex === 'number' &&
      Number.isInteger(payload.fromSlotIndex)
        ? payload.fromSlotIndex
        : -1;
    const toSlotIndex =
      typeof payload?.toSlotIndex === 'number' &&
      Number.isInteger(payload.toSlotIndex)
        ? payload.toSlotIndex
        : -1;

    if (!roomCode || !playerName || !fromPlayerName || !toPlayerName) {
      return;
    }

    const entity = await this.loadBlindFourStateEntity(roomCode);

    if (!entity) {
      client.emit('blind4:error', {
        roomCode,
        message: 'Game state not found.',
      });
      return;
    }

    const pendingSwap = entity.pendingSwapChoice;

    if (!pendingSwap) {
      client.emit('blind4:error', {
        roomCode,
        message: 'There is no pending swap target choice.',
      });
      return;
    }

    if (pendingSwap.playerName !== playerName) {
      client.emit('blind4:error', {
        roomCode,
        message: 'Only the active player can choose swap targets.',
      });
      return;
    }

    const currentPlayer = entity.playerOrder[entity.currentTurnIndex] ?? '';

    if (currentPlayer !== playerName) {
      client.emit('blind4:error', {
        roomCode,
        message: `It is ${currentPlayer}'s turn.`,
      });
      return;
    }

    if (fromPlayerName === toPlayerName) {
      client.emit('blind4:error', {
        roomCode,
        message: 'Choose cards from different players to swap.',
      });
      return;
    }

    if (
      !entity.playerOrder.includes(fromPlayerName) ||
      !entity.playerOrder.includes(toPlayerName)
    ) {
      client.emit('blind4:error', {
        roomCode,
        message: 'Choose valid players for swap.',
      });
      return;
    }

    const fromCards = entity.hands[fromPlayerName] ?? [];
    const toCards = entity.hands[toPlayerName] ?? [];

    if (
      fromSlotIndex < 0 ||
      fromSlotIndex >= fromCards.length ||
      toSlotIndex < 0 ||
      toSlotIndex >= toCards.length
    ) {
      client.emit('blind4:error', {
        roomCode,
        message: 'Choose valid card indexes for swap.',
      });
      return;
    }

    const fromCard = fromCards[fromSlotIndex];
    const toCard = toCards[toSlotIndex];

    if (!fromCard || !toCard || fromCard.locked || toCard.locked) {
      client.emit('blind4:error', {
        roomCode,
        message: 'Locked cards cannot be swapped.',
      });
      return;
    }

    fromCards[fromSlotIndex] = { ...toCard, locked: false };
    toCards[toSlotIndex] = { ...fromCard, locked: false };
    entity.hands[fromPlayerName] = fromCards;
    entity.hands[toPlayerName] = toCards;
    entity.pendingSwapChoice = null;
    entity.lastAction = {
      playerName,
      action: 'power-q',
      detail: `Swapped ${fromPlayerName} card ${fromSlotIndex + 1} with ${toPlayerName} card ${toSlotIndex + 1}.`,
    };

    this.completeBlindFourTurn(entity, playerName);
    await this.blindFourStateRepository.save(entity);
    this.server
      ?.to(roomCode)
      .emit('blind4:state', this.buildBlindFourStateFromEntity(entity));
  }

  @SubscribeMessage('blind4:choose-lock-target')
  async handleBlindFourChooseLockTarget(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: BlindFourChooseLockTargetPayload,
  ) {
    const roomCode = this.getRoomCode(client);
    const playerName =
      typeof payload?.playerName === 'string' ? payload.playerName.trim() : '';
    const targetPlayerName =
      typeof payload?.targetPlayerName === 'string'
        ? payload.targetPlayerName.trim()
        : '';
    const slotIndex =
      typeof payload?.slotIndex === 'number' &&
      Number.isInteger(payload.slotIndex)
        ? payload.slotIndex
        : -1;

    if (!roomCode || !playerName || !targetPlayerName) {
      return;
    }

    const entity = await this.loadBlindFourStateEntity(roomCode);

    if (!entity) {
      client.emit('blind4:error', {
        roomCode,
        message: 'Game state not found.',
      });
      return;
    }

    const pendingLock = entity.pendingLockChoice;

    if (!pendingLock) {
      client.emit('blind4:error', {
        roomCode,
        message: 'There is no pending lock target choice.',
      });
      return;
    }

    if (pendingLock.playerName !== playerName) {
      client.emit('blind4:error', {
        roomCode,
        message: 'Only the active player can choose lock target.',
      });
      return;
    }

    const currentPlayer = entity.playerOrder[entity.currentTurnIndex] ?? '';

    if (currentPlayer !== playerName) {
      client.emit('blind4:error', {
        roomCode,
        message: `It is ${currentPlayer}'s turn.`,
      });
      return;
    }

    if (!entity.playerOrder.includes(targetPlayerName)) {
      client.emit('blind4:error', {
        roomCode,
        message: 'Choose a valid target player.',
      });
      return;
    }

    const cards = entity.hands[targetPlayerName] ?? [];

    if (slotIndex < 0 || slotIndex >= cards.length) {
      client.emit('blind4:error', {
        roomCode,
        message: 'Choose a valid target card.',
      });
      return;
    }

    const targetCard = cards[slotIndex];

    if (!targetCard || targetCard.locked) {
      client.emit('blind4:error', {
        roomCode,
        message: 'Selected card is already locked or invalid.',
      });
      return;
    }

    cards[slotIndex] = {
      ...targetCard,
      locked: true,
      lockedByCard: pendingLock.lockingCard
        ? {
            id: pendingLock.lockingCard.id,
            rank: pendingLock.lockingCard.rank,
            suit: pendingLock.lockingCard.suit,
          }
        : (targetCard.lockedByCard ?? null),
    };
    entity.hands[targetPlayerName] = cards;
    entity.pendingLockChoice = null;
    entity.lastAction = {
      playerName,
      action: 'power-k',
      detail: `Locked card ${slotIndex + 1} of ${targetPlayerName}.`,
    };

    this.completeBlindFourTurn(entity, playerName);
    await this.blindFourStateRepository.save(entity);
    this.server
      ?.to(roomCode)
      .emit('blind4:state', this.buildBlindFourStateFromEntity(entity));
  }

  @SubscribeMessage('blind4:knock')
  async handleBlindFourKnock(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: BlindFourBasePayload,
  ) {
    const roomCode = this.getRoomCode(client);
    const playerName =
      typeof payload?.playerName === 'string' ? payload.playerName.trim() : '';

    if (!roomCode || !playerName) {
      return;
    }

    const entity = await this.getBlindFourEntityForTurn(
      roomCode,
      playerName,
      client,
    );

    if (!entity) {
      return;
    }

    if (entity.pendingDrawCard) {
      client.emit('blind4:error', {
        roomCode,
        message: 'Resolve your drawn card first.',
      });
      return;
    }

    if (!entity.knocker) {
      entity.knocker = playerName;
      entity.turnsAfterKnock = Math.max(0, entity.playerOrder.length - 1);
      entity.lastAction = {
        playerName,
        action: 'knock',
        detail: 'Called Knock. Others get one final turn.',
      };
    }

    this.completeBlindFourTurn(entity, playerName);
    await this.blindFourStateRepository.save(entity);
    this.server
      ?.to(roomCode)
      .emit('blind4:state', this.buildBlindFourStateFromEntity(entity));
  }

  @SubscribeMessage('chess:sync')
  async handleChessSync(@ConnectedSocket() client: Socket) {
    const roomCode = this.getRoomCode(client);

    if (!roomCode) {
      return;
    }

    const state = await this.getOrCreateChessState(roomCode, client);

    if (!state) {
      return;
    }

    client.emit('chess:state', state);
  }

  @SubscribeMessage('chess:move')
  async handleChessMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ChessMovePayload,
  ) {
    const roomCode = this.getRoomCode(client);
    const playerName =
      typeof payload?.playerName === 'string' ? payload.playerName.trim() : '';
    const from =
      typeof payload?.from === 'string'
        ? payload.from.trim().toLowerCase()
        : '';
    const to =
      typeof payload?.to === 'string' ? payload.to.trim().toLowerCase() : '';
    const promotion =
      typeof payload?.promotion === 'string'
        ? payload.promotion.trim().toLowerCase()
        : undefined;

    if (!roomCode || !playerName) {
      return;
    }

    const state = await this.getOrCreateChessState(roomCode, client);

    if (!state) {
      return;
    }

    if (state.status === 'finished') {
      client.emit('chess:error', {
        roomCode,
        message: `Game already finished. Winner: ${state.winner ?? 'draw'}.`,
      });
      client.emit('chess:state', state);
      return;
    }

    if (!/^[a-h][1-8]$/.test(from) || !/^[a-h][1-8]$/.test(to)) {
      client.emit('chess:error', {
        roomCode,
        message: 'Invalid move coordinates.',
      });
      return;
    }

    const playerColor = state.colors[playerName];

    if (!playerColor) {
      client.emit('chess:error', {
        roomCode,
        message: 'You are not an active player in this game.',
      });
      return;
    }

    if (playerColor !== state.currentTurnColor) {
      client.emit('chess:error', {
        roomCode,
        message: `It is ${state.currentTurnPlayer ?? state.currentTurnColor}'s turn.`,
      });
      return;
    }

    const chess = new Chess(state.fen);

    const move = chess.move({
      from,
      to,
      promotion:
        promotion === 'q' ||
        promotion === 'r' ||
        promotion === 'b' ||
        promotion === 'n'
          ? promotion
          : undefined,
    });

    if (!move) {
      client.emit('chess:error', {
        roomCode,
        message: 'Illegal move.',
      });
      return;
    }

    const persistedState = await this.loadChessStateEntity(roomCode);

    if (!persistedState) {
      client.emit('chess:error', {
        roomCode,
        message: 'Game state not found.',
      });
      return;
    }

    persistedState.fen = chess.fen();
    persistedState.lastMove = {
      playerName,
      from: move.from,
      to: move.to,
      promotion: move.promotion ?? null,
      san: move.san,
      piece: move.piece,
      captured: move.captured ?? null,
    };

    if (chess.isCheckmate()) {
      persistedState.status = 'finished';
      persistedState.winner = playerName;
      persistedState.isDraw = false;
    } else if (
      chess.isDraw() ||
      chess.isStalemate() ||
      chess.isThreefoldRepetition() ||
      chess.isInsufficientMaterial()
    ) {
      persistedState.status = 'finished';
      persistedState.winner = null;
      persistedState.isDraw = true;
    } else {
      persistedState.status = 'running';
      persistedState.winner = null;
      persistedState.isDraw = false;
    }

    await this.chessStateRepository.save(persistedState);
    const nextState = this.buildChessStateFromEntity(persistedState);
    this.server?.to(roomCode).emit('chess:state', nextState);
  }

  private async getOrCreateSnakesAndLaddersState(
    roomCode: string,
    client?: Socket,
  ) {
    const existingState = await this.loadSnakesAndLaddersState(roomCode);

    if (existingState) {
      return existingState;
    }

    const room = await this.roomsService.findOne(roomCode).catch(() => null);

    if (!room) {
      client?.emit('snl:error', {
        roomCode,
        message: 'Room not found.',
      });
      return null;
    }

    if (room.status !== RoomStatus.LIVE) {
      client?.emit('snl:error', {
        roomCode,
        message: 'Game has not started yet.',
      });
      return null;
    }

    if (room.game.trim().toLowerCase() !== 'snakes and ladders') {
      client?.emit('snl:error', {
        roomCode,
        message: 'This room is not a Snakes and Ladders game.',
      });
      return null;
    }

    const playerOrder = room.players.map((player) => player.playerName.trim());

    if (playerOrder.length < 2) {
      client?.emit('snl:error', {
        roomCode,
        message: 'Need at least two players to play.',
      });
      return null;
    }

    const positions = playerOrder.reduce<Record<string, number>>(
      (accumulator, playerName) => {
        accumulator[playerName] = 0;
        return accumulator;
      },
      {},
    );

    const state: SnakesAndLaddersState = {
      roomCode,
      playerOrder,
      positions,
      currentTurnIndex: 0,
      status: 'running',
      winner: null,
      lastMove: null,
    };

    await this.saveSnakesAndLaddersState(state);
    return state;
  }

  private async loadSnakesAndLaddersState(roomCode: string) {
    const stateEntity = await this.snakesAndLaddersStateRepository.findOne({
      where: {
        roomCode,
      },
    });

    if (!stateEntity) {
      return null;
    }

    return {
      roomCode: stateEntity.roomCode,
      playerOrder: stateEntity.playerOrder,
      positions: stateEntity.positions,
      currentTurnIndex: stateEntity.currentTurnIndex,
      status: stateEntity.status,
      winner: stateEntity.winner,
      lastMove: stateEntity.lastMove,
    } satisfies SnakesAndLaddersState;
  }

  private async saveSnakesAndLaddersState(state: SnakesAndLaddersState) {
    const stateEntity = this.snakesAndLaddersStateRepository.create({
      roomCode: state.roomCode,
      playerOrder: state.playerOrder,
      positions: state.positions,
      currentTurnIndex: state.currentTurnIndex,
      status: state.status,
      winner: state.winner,
      lastMove: state.lastMove,
    });

    await this.snakesAndLaddersStateRepository.save(stateEntity);
  }

  @SubscribeMessage('ttt:sync')
  async handleTicTacToeSync(@ConnectedSocket() client: Socket) {
    const roomCode = this.getRoomCode(client);

    if (!roomCode) {
      return;
    }

    const state = await this.getOrCreateTicTacToeState(roomCode, client);

    if (!state) {
      return;
    }

    client.emit('ttt:state', state);
  }

  @SubscribeMessage('ttt:move')
  async handleTicTacToeMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: TicTacToeMovePayload,
  ) {
    const roomCode = this.getRoomCode(client);
    const playerName =
      typeof payload?.playerName === 'string' ? payload.playerName.trim() : '';
    const index =
      typeof payload?.index === 'number' && Number.isInteger(payload.index)
        ? payload.index
        : -1;

    if (!roomCode || !playerName) {
      return;
    }

    const state = await this.getOrCreateTicTacToeState(roomCode, client);

    if (!state) {
      return;
    }

    if (state.status === 'finished') {
      client.emit('ttt:error', {
        roomCode,
        message: `Game already finished. Winner: ${state.winner ?? 'draw'}.`,
      });
      client.emit('ttt:state', state);
      return;
    }

    const currentPlayer = state.playerOrder[state.currentTurnIndex];

    if (currentPlayer !== playerName) {
      client.emit('ttt:error', {
        roomCode,
        message: `It is ${currentPlayer}'s turn.`,
      });
      return;
    }

    if (index < 0 || index > 8) {
      client.emit('ttt:error', {
        roomCode,
        message: 'Choose a valid cell.',
      });
      return;
    }

    if (state.board[index] !== '') {
      client.emit('ttt:error', {
        roomCode,
        message: 'Cell already occupied.',
      });
      return;
    }

    const mark = state.marks[playerName] ?? 'X';

    state.board[index] = mark;
    state.lastMove = {
      playerName,
      mark,
      index,
    };

    if (this.isTicTacToeWinner(state.board, mark)) {
      state.status = 'finished';
      state.winner = playerName;
      state.isDraw = false;
    } else if (state.board.every((cell) => cell !== '')) {
      state.status = 'finished';
      state.winner = null;
      state.isDraw = true;
    } else {
      state.currentTurnIndex =
        (state.currentTurnIndex + 1) % state.playerOrder.length;
    }

    await this.saveTicTacToeState(state);
    this.server?.to(roomCode).emit('ttt:state', state);
  }

  private async getOrCreateTicTacToeState(roomCode: string, client?: Socket) {
    const existingState = await this.loadTicTacToeState(roomCode);

    if (existingState) {
      return existingState;
    }

    const room = await this.roomsService.findOne(roomCode).catch(() => null);

    if (!room) {
      client?.emit('ttt:error', {
        roomCode,
        message: 'Room not found.',
      });
      return null;
    }

    if (room.status !== RoomStatus.LIVE) {
      client?.emit('ttt:error', {
        roomCode,
        message: 'Game has not started yet.',
      });
      return null;
    }

    if (room.game.trim().toLowerCase() !== 'tic tac toe') {
      client?.emit('ttt:error', {
        roomCode,
        message: 'This room is not a Tic Tac Toe game.',
      });
      return null;
    }

    const playerOrder = room.players
      .map((player) => player.playerName.trim())
      .slice(0, 2);

    if (playerOrder.length < 2) {
      client?.emit('ttt:error', {
        roomCode,
        message: 'Need exactly two players to play.',
      });
      return null;
    }

    const marks: Record<string, TicTacToeMark> = {
      [playerOrder[0]]: 'X',
      [playerOrder[1]]: 'O',
    };

    const state: TicTacToeState = {
      roomCode,
      playerOrder,
      marks,
      board: Array.from({ length: 9 }, () => ''),
      currentTurnIndex: 0,
      status: 'running',
      winner: null,
      isDraw: false,
      lastMove: null,
    };

    await this.saveTicTacToeState(state);
    return state;
  }

  private async loadTicTacToeState(roomCode: string) {
    const stateEntity = await this.ticTacToeStateRepository.findOne({
      where: {
        roomCode,
      },
    });

    if (!stateEntity) {
      return null;
    }

    return {
      roomCode: stateEntity.roomCode,
      playerOrder: stateEntity.playerOrder,
      marks: stateEntity.marks,
      board: stateEntity.board,
      currentTurnIndex: stateEntity.currentTurnIndex,
      status: stateEntity.status,
      winner: stateEntity.winner,
      isDraw: stateEntity.isDraw,
      lastMove: stateEntity.lastMove,
    } satisfies TicTacToeState;
  }

  private async saveTicTacToeState(state: TicTacToeState) {
    const stateEntity = this.ticTacToeStateRepository.create({
      roomCode: state.roomCode,
      playerOrder: state.playerOrder,
      marks: state.marks,
      board: state.board,
      currentTurnIndex: state.currentTurnIndex,
      status: state.status,
      winner: state.winner,
      isDraw: state.isDraw,
      lastMove: state.lastMove,
    });

    await this.ticTacToeStateRepository.save(stateEntity);
  }

  private async getOrCreateChessState(roomCode: string, client?: Socket) {
    const existingState = await this.loadChessState(roomCode);

    if (existingState) {
      return existingState;
    }

    const room = await this.roomsService.findOne(roomCode).catch(() => null);

    if (!room) {
      client?.emit('chess:error', {
        roomCode,
        message: 'Room not found.',
      });
      return null;
    }

    if (room.status !== RoomStatus.LIVE) {
      client?.emit('chess:error', {
        roomCode,
        message: 'Game has not started yet.',
      });
      return null;
    }

    if (room.game.trim().toLowerCase() !== 'chess') {
      client?.emit('chess:error', {
        roomCode,
        message: 'This room is not a Chess game.',
      });
      return null;
    }

    const playerOrder = room.players
      .map((player) => player.playerName.trim())
      .slice(0, 2);

    if (playerOrder.length < 2) {
      client?.emit('chess:error', {
        roomCode,
        message: 'Need exactly two players to play.',
      });
      return null;
    }

    const stateEntity = this.chessStateRepository.create({
      roomCode,
      playerOrder,
      colors: {
        [playerOrder[0]]: 'white',
        [playerOrder[1]]: 'black',
      },
      fen: new Chess().fen(),
      status: 'running',
      winner: null,
      isDraw: false,
      lastMove: null,
    });

    await this.chessStateRepository.save(stateEntity);
    return this.buildChessStateFromEntity(stateEntity);
  }

  private async loadChessStateEntity(roomCode: string) {
    return this.chessStateRepository.findOne({
      where: {
        roomCode,
      },
    });
  }

  private async loadChessState(roomCode: string) {
    const stateEntity = await this.loadChessStateEntity(roomCode);

    if (!stateEntity) {
      return null;
    }

    return this.buildChessStateFromEntity(stateEntity);
  }

  private buildChessStateFromEntity(stateEntity: ChessStateEntity) {
    const chess = new Chess(stateEntity.fen);
    const currentTurnColor: ChessColor =
      chess.turn() === 'w' ? 'white' : 'black';
    const currentTurnPlayer =
      Object.entries(stateEntity.colors).find(
        ([, color]) => color === currentTurnColor,
      )?.[0] ?? null;

    const legalMovesByFrom = chess
      .moves({ verbose: true })
      .reduce<Record<string, string[]>>((accumulator, move) => {
        const from = move.from;
        accumulator[from] = accumulator[from] ?? [];
        accumulator[from].push(move.to);
        return accumulator;
      }, {});

    return {
      roomCode: stateEntity.roomCode,
      playerOrder: stateEntity.playerOrder,
      colors: stateEntity.colors,
      fen: stateEntity.fen,
      currentTurnColor,
      currentTurnPlayer,
      legalMovesByFrom,
      status: stateEntity.status,
      winner: stateEntity.winner,
      isDraw: stateEntity.isDraw,
      isCheck: chess.isCheck(),
      lastMove: stateEntity.lastMove,
    } satisfies ChessState;
  }

  private async getOrCreateBlindFourState(roomCode: string, client?: Socket) {
    const existingState = await this.loadBlindFourState(roomCode);

    if (existingState) {
      return existingState;
    }

    const room = await this.roomsService.findOne(roomCode).catch(() => null);

    if (!room) {
      client?.emit('blind4:error', {
        roomCode,
        message: 'Room not found.',
      });
      return null;
    }

    if (room.status !== RoomStatus.LIVE) {
      client?.emit('blind4:error', {
        roomCode,
        message: 'Game has not started yet.',
      });
      return null;
    }

    if (room.game.trim().toLowerCase() !== 'blind four') {
      client?.emit('blind4:error', {
        roomCode,
        message: 'This room is not a Blind Four game.',
      });
      return null;
    }

    const playerOrder = room.players.map((player) => player.playerName.trim());

    if (playerOrder.length < 2) {
      client?.emit('blind4:error', {
        roomCode,
        message: 'Need at least two players to play.',
      });
      return null;
    }

    const deck = this.createBlindFourDeck();
    const hands: Record<string, BlindFourCard[]> = {};
    const initialPeekIndexes: Record<string, number[]> = {};
    const setupReady: Record<string, boolean> = {};

    for (const playerName of playerOrder) {
      hands[playerName] = [
        deck.pop()!,
        deck.pop()!,
        deck.pop()!,
        deck.pop()!,
      ].map((card) => ({ ...card, locked: false }));
      initialPeekIndexes[playerName] = [0, 3];
      setupReady[playerName] = false;
    }

    const discardFirst = deck.pop();

    if (!discardFirst) {
      client?.emit('blind4:error', {
        roomCode,
        message: 'Unable to initialize deck.',
      });
      return null;
    }

    const stateEntity = this.blindFourStateRepository.create({
      roomCode,
      playerOrder,
      hands,
      deck,
      discardPile: [discardFirst],
      pendingDrawCard: null,
      initialPeekIndexes,
      setupReady,
      phase: 'setup',
      currentTurnIndex: 0,
      status: 'running',
      winner: null,
      scores: null,
      knocker: null,
      turnsAfterKnock: 0,
      lastAction: null,
      pendingJokerChoice: null,
      pendingLockChoice: null,
      pendingSwapChoice: null,
      pendingShuffleChoice: null,
      pendingTenChoice: null,
      pendingSeeOwnCards: null,
      pendingPeekChoice: null,
      activePeekReveal: null,
    });

    await this.blindFourStateRepository.save(stateEntity);
    return this.buildBlindFourStateFromEntity(stateEntity);
  }

  private async loadBlindFourStateEntity(roomCode: string) {
    return this.blindFourStateRepository.findOne({
      where: {
        roomCode,
      },
    });
  }

  private async loadBlindFourState(roomCode: string) {
    const entity = await this.loadBlindFourStateEntity(roomCode);

    if (!entity) {
      return null;
    }

    return this.buildBlindFourStateFromEntity(entity);
  }

  private buildBlindFourStateFromEntity(entity: BlindFourStateEntity) {
    const setupReady = entity.setupReady ?? {};
    const phase = entity.phase ?? 'running';

    const pendingSeeOwnCards = this.getActiveBlindFourSeeOwnCards(entity);
    const activePeekReveal = this.getActiveBlindFourPeekReveal(entity);

    return {
      roomCode: entity.roomCode,
      playerOrder: entity.playerOrder,
      hands: entity.hands,
      deckCount: entity.deck.length,
      discardTop: entity.discardPile[entity.discardPile.length - 1] ?? null,
      pendingDrawCard: entity.pendingDrawCard,
      initialPeekIndexes: entity.initialPeekIndexes,
      setupReady,
      phase,
      currentTurnIndex: entity.currentTurnIndex,
      currentTurnPlayer: entity.playerOrder[entity.currentTurnIndex] ?? null,
      status: entity.status,
      winner: entity.winner,
      scores: entity.scores,
      knocker: entity.knocker,
      turnsAfterKnock: entity.turnsAfterKnock,
      lastAction: entity.lastAction,
      pendingJokerChoice: entity.pendingJokerChoice ?? null,
      pendingLockChoice: entity.pendingLockChoice ?? null,
      pendingSwapChoice: entity.pendingSwapChoice ?? null,
      pendingShuffleChoice: entity.pendingShuffleChoice ?? null,
      pendingTenChoice: entity.pendingTenChoice ?? null,
      pendingSeeOwnCards,
      pendingPeekChoice: entity.pendingPeekChoice ?? null,
      activePeekReveal,
    } satisfies BlindFourState;
  }

  private getActiveBlindFourSeeOwnCards(entity: BlindFourStateEntity) {
    const pending = entity.pendingSeeOwnCards;

    if (!pending) {
      return null;
    }

    const startedAtMs = Date.parse(pending.startedAt);

    if (!Number.isFinite(startedAtMs)) {
      entity.pendingSeeOwnCards = null;
      return null;
    }

    const isStillActive =
      Date.now() - startedAtMs < Math.max(0, pending.durationMs);

    if (!isStillActive) {
      entity.pendingSeeOwnCards = null;
      return null;
    }

    return pending;
  }

  private getActiveBlindFourPeekReveal(entity: BlindFourStateEntity) {
    const active = entity.activePeekReveal;

    if (!active) {
      return null;
    }

    const startedAtMs = Date.parse(active.startedAt);

    if (!Number.isFinite(startedAtMs)) {
      entity.activePeekReveal = null;
      return null;
    }

    const isStillActive =
      Date.now() - startedAtMs < Math.max(0, active.durationMs);

    if (!isStillActive) {
      entity.activePeekReveal = null;
      return null;
    }

    return active;
  }

  private async getBlindFourEntityForTurn(
    roomCode: string,
    playerName: string,
    client?: Socket,
  ) {
    const entity = await this.loadBlindFourStateEntity(roomCode);

    if (!entity) {
      client?.emit('blind4:error', {
        roomCode,
        message: 'Game state not found.',
      });
      return null;
    }

    if (entity.status === 'finished') {
      client?.emit('blind4:error', {
        roomCode,
        message: 'Game already finished.',
      });
      return null;
    }

    const activeSeeOwnCards = this.getActiveBlindFourSeeOwnCards(entity);
    const activePeekReveal = this.getActiveBlindFourPeekReveal(entity);

    if (activeSeeOwnCards && activeSeeOwnCards.playerName !== playerName) {
      client?.emit('blind4:error', {
        roomCode,
        message: `${activeSeeOwnCards.playerName} is seeing cards. Please wait.`,
      });
      return null;
    }

    if (activePeekReveal && activePeekReveal.playerName !== playerName) {
      client?.emit('blind4:error', {
        roomCode,
        message: `${activePeekReveal.playerName} is seeing an opponent card. Please wait.`,
      });
      return null;
    }

    if (entity.phase !== 'running') {
      client?.emit('blind4:error', {
        roomCode,
        message: 'Waiting for all players to finish setup and press ready.',
      });
      return null;
    }

    if (
      entity.pendingJokerChoice &&
      entity.pendingJokerChoice.playerName === playerName
    ) {
      client?.emit('blind4:error', {
        roomCode,
        message: 'Choose Joker power before continuing your turn.',
      });
      return null;
    }

    if (
      entity.pendingLockChoice &&
      entity.pendingLockChoice.playerName === playerName
    ) {
      client?.emit('blind4:error', {
        roomCode,
        message: 'Choose lock target before continuing your turn.',
      });
      return null;
    }

    if (
      entity.pendingSwapChoice &&
      entity.pendingSwapChoice.playerName === playerName
    ) {
      client?.emit('blind4:error', {
        roomCode,
        message: 'Choose swap targets before continuing your turn.',
      });
      return null;
    }

    if (
      entity.pendingShuffleChoice &&
      entity.pendingShuffleChoice.playerName === playerName
    ) {
      client?.emit('blind4:error', {
        roomCode,
        message: 'Choose shuffle target before continuing your turn.',
      });
      return null;
    }

    if (
      entity.pendingTenChoice &&
      entity.pendingTenChoice.playerName === playerName
    ) {
      client?.emit('blind4:error', {
        roomCode,
        message: 'Choose 10 power option before continuing your turn.',
      });
      return null;
    }

    if (
      entity.pendingPeekChoice &&
      entity.pendingPeekChoice.playerName === playerName
    ) {
      client?.emit('blind4:error', {
        roomCode,
        message: 'Choose an opponent card to see before continuing your turn.',
      });
      return null;
    }

    const currentPlayer = entity.playerOrder[entity.currentTurnIndex] ?? '';

    if (currentPlayer !== playerName) {
      client?.emit('blind4:error', {
        roomCode,
        message: `It is ${currentPlayer}'s turn.`,
      });
      return null;
    }

    return entity;
  }

  private completeBlindFourTurn(
    entity: BlindFourStateEntity,
    playerName: string,
  ) {
    if (entity.status === 'finished') {
      return;
    }

    if (
      entity.knocker &&
      playerName !== entity.knocker &&
      entity.turnsAfterKnock > 0
    ) {
      entity.turnsAfterKnock -= 1;
    }

    if (entity.knocker && entity.turnsAfterKnock <= 0) {
      this.finishBlindFourRound(entity);
      return;
    }

    entity.currentTurnIndex =
      (entity.currentTurnIndex + 1) % entity.playerOrder.length;
  }

  private finishBlindFourRound(entity: BlindFourStateEntity) {
    const scores = entity.playerOrder.reduce<Record<string, number>>(
      (accumulator, playerName) => {
        const cards = entity.hands[playerName] ?? [];
        accumulator[playerName] = cards.reduce(
          (sum, card) => sum + this.getBlindFourCardPoints(card),
          0,
        );
        return accumulator;
      },
      {},
    );

    let winner: string | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const playerName of entity.playerOrder) {
      const score = scores[playerName] ?? Number.POSITIVE_INFINITY;

      if (score < bestScore) {
        bestScore = score;
        winner = playerName;
      }
    }

    entity.status = 'finished';
    entity.scores = scores;
    entity.winner = winner;
    entity.pendingDrawCard = null;
    entity.pendingJokerChoice = null;
    entity.pendingLockChoice = null;
    entity.pendingSwapChoice = null;
    entity.pendingShuffleChoice = null;
    entity.pendingTenChoice = null;
    entity.pendingSeeOwnCards = null;
    entity.pendingPeekChoice = null;
    entity.activePeekReveal = null;
  }

  private getBlindFourCardPoints(card: BlindFourCard) {
    if (card.rank === 'A') {
      return 1;
    }

    if (card.rank === '7') {
      return 0;
    }

    if (card.rank === 'JKR') {
      return 20;
    }

    if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') {
      return 10;
    }

    return Number(card.rank);
  }

  private applyBlindFourDiscardPower(
    entity: BlindFourStateEntity,
    playerName: string,
    discardedCard: BlindFourCard,
  ) {
    const rank = discardedCard.rank;

    if (rank === '10') {
      entity.pendingTenChoice = {
        playerName,
        options: ['pick-your-cards', 'see-opponent-card'],
      };
      entity.lastAction = {
        playerName,
        action: 'power-10',
        detail: '10 used: choose to see your cards or one opponent card.',
      };
      return false;
    }

    if (rank === 'Q') {
      const playersWithUnlockedCards = entity.playerOrder.filter((name) =>
        (entity.hands[name] ?? []).some((card) => !!card && !card.locked),
      );

      if (playersWithUnlockedCards.length < 2) {
        entity.lastAction = {
          playerName,
          action: 'power-q',
          detail: 'Power used: no valid players/cards available for swap.',
        };
        return true;
      }

      entity.pendingSwapChoice = {
        playerName,
        source: 'queen-discard',
      };
      entity.lastAction = {
        playerName,
        action: 'power-q',
        detail: 'Queen used: drag a card onto another player card to swap.',
      };
      return false;
    }

    if (rank === 'J') {
      const targetPlayers = entity.playerOrder.filter(
        (name) => name !== playerName,
      );

      if (targetPlayers.length === 0) {
        entity.lastAction = {
          playerName,
          action: 'power-j',
          detail: 'Power used: no opponent available to shuffle.',
        };
        return true;
      }

      entity.pendingShuffleChoice = {
        playerName,
        source: 'jack-discard',
        targetPlayers,
      };
      entity.lastAction = {
        playerName,
        action: 'power-j',
        detail: 'Jack used: choose opponent to shuffle cards.',
      };
      return false;
    }

    if (rank === 'K') {
      const hasLockableTarget = entity.playerOrder.some((name) =>
        (entity.hands[name] ?? []).some((card) => !!card && !card.locked),
      );

      if (!hasLockableTarget) {
        entity.lastAction = {
          playerName,
          action: 'power-k',
          detail: 'Power used: no available card to lock.',
        };
        return true;
      }

      const discardTop = entity.discardPile[entity.discardPile.length - 1];
      const lockingCard =
        discardTop?.id === discardedCard.id
          ? (entity.discardPile.pop() ?? discardedCard)
          : discardedCard;

      entity.pendingLockChoice = {
        playerName,
        source: 'king-discard',
        lockingCard: {
          ...lockingCard,
          locked: false,
          lockedByCard: null,
        },
      };
      entity.lastAction = {
        playerName,
        action: 'power-k',
        detail: 'King used: click any card (yours or opponent) to lock.',
      };
      return false;
    }

    if (rank === 'JKR') {
      entity.pendingJokerChoice = {
        playerName,
        options: [
          'lock-card',
          'swap-card',
          'shuffle-cards',
          'pick-your-cards',
          'see-opponent-card',
        ],
      };

      entity.lastAction = {
        playerName,
        action: 'power-joker',
        detail: 'Joker discarded: choose one of the 5 power options.',
      };

      return false;
    }

    return true;
  }

  private applyBlindFourQueenPower(
    entity: BlindFourStateEntity,
    playerName: string,
  ) {
    const opponent = entity.playerOrder.find((name) => name !== playerName);

    if (!opponent) {
      return;
    }

    const ownCards = entity.hands[playerName] ?? [];
    const oppCards = entity.hands[opponent] ?? [];

    const ownIndexes = ownCards
      .map((card, index) => ({ card, index }))
      .filter(({ card }) => !!card && !card.locked)
      .map(({ index }) => index);
    const oppIndexes = oppCards
      .map((card, index) => ({ card, index }))
      .filter(({ card }) => !!card && !card.locked)
      .map(({ index }) => index);

    if (ownIndexes.length === 0 || oppIndexes.length === 0) {
      return;
    }

    const ownIndex = ownIndexes[Math.floor(Math.random() * ownIndexes.length)];
    const oppIndex = oppIndexes[Math.floor(Math.random() * oppIndexes.length)];
    const ownCard = ownCards[ownIndex];
    ownCards[ownIndex] = oppCards[oppIndex];
    oppCards[oppIndex] = ownCard;
    entity.hands[playerName] = ownCards;
    entity.hands[opponent] = oppCards;
    entity.lastAction = {
      playerName,
      action: 'power-q',
      detail: `Power used: swapped one card with ${opponent}.`,
    };
  }

  private applyBlindFourTenPower(
    entity: BlindFourStateEntity,
    playerName: string,
  ) {
    entity.pendingSeeOwnCards = {
      playerName,
      startedAt: new Date().toISOString(),
      durationMs: BLIND_FOUR_SEE_OWN_CARDS_DURATION_MS,
    };

    entity.lastAction = {
      playerName,
      action: 'power-10',
      detail: 'Power used: seeing own cards for 10 seconds.',
    };
  }

  private applyBlindFourJackPower(
    entity: BlindFourStateEntity,
    playerName: string,
  ) {
    const opponent = entity.playerOrder.find((name) => name !== playerName);

    if (!opponent) {
      return;
    }

    const cards = [...(entity.hands[opponent] ?? [])];

    this.shuffleBlindFourCardsPreservingLockedSlots(cards);

    entity.hands[opponent] = cards;
    entity.lastAction = {
      playerName,
      action: 'power-j',
      detail: `Power used: shuffled ${opponent}'s cards.`,
    };
  }

  private applyBlindFourJackPowerToTarget(
    entity: BlindFourStateEntity,
    playerName: string,
    targetPlayerName: string,
  ) {
    const cards = [...(entity.hands[targetPlayerName] ?? [])];

    this.shuffleBlindFourCardsPreservingLockedSlots(cards);

    entity.hands[targetPlayerName] = cards;
    entity.lastAction = {
      playerName,
      action: 'power-j',
      detail: `Power used: shuffled ${targetPlayerName}'s cards.`,
    };
  }

  private shuffleBlindFourCardsPreservingLockedSlots(cards: BlindFourCard[]) {
    const unlockedIndexes = cards
      .map((card, index) => ({ card, index }))
      .filter(({ card }) => !!card && !card.locked)
      .map(({ index }) => index);

    const unlockedCards = unlockedIndexes.map((index) => cards[index]);

    for (let index = unlockedCards.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      const temp = unlockedCards[index];
      unlockedCards[index] = unlockedCards[randomIndex];
      unlockedCards[randomIndex] = temp;
    }

    unlockedIndexes.forEach((slotIndex, position) => {
      cards[slotIndex] = unlockedCards[position];
    });
  }

  private applyBlindFourKingPower(
    entity: BlindFourStateEntity,
    playerName: string,
  ) {
    const allTargets = entity.playerOrder.flatMap((name) =>
      (entity.hands[name] ?? [])
        .map((card, index) => ({ name, index, card }))
        .filter(({ card }) => !!card && !card.locked),
    );

    if (allTargets.length === 0) {
      return;
    }

    const randomTarget =
      allTargets[Math.floor(Math.random() * allTargets.length)];
    const cards = entity.hands[randomTarget.name] ?? [];
    const targetCard = cards[randomTarget.index];

    if (!targetCard) {
      return;
    }

    cards[randomTarget.index] = {
      ...targetCard,
      locked: true,
    };
    entity.hands[randomTarget.name] = cards;
    entity.lastAction = {
      playerName,
      action: 'power-k',
      detail: `Power used: locked one card of ${randomTarget.name}.`,
    };
  }

  private applyBlindFourPeekOpponentPower(
    entity: BlindFourStateEntity,
    playerName: string,
  ) {
    const opponent = entity.playerOrder.find((name) => name !== playerName);

    if (!opponent) {
      entity.lastAction = {
        playerName,
        action: 'power-peek-opponent',
        detail: 'Power used: no opponent card available to peek.',
      };
      return;
    }

    entity.lastAction = {
      playerName,
      action: 'power-peek-opponent',
      detail: `Power used: saw one card of ${opponent}.`,
    };
  }

  private createBlindFourDeck() {
    const deck: BlindFourCard[] = [];

    for (const suit of BLIND_FOUR_SUITS) {
      for (const rank of BLIND_FOUR_RANKS) {
        deck.push({
          id: `${rank}-${suit}-${deck.length + 1}`,
          rank,
          suit,
          locked: false,
        });
      }
    }

    deck.push({ id: 'JKR-1', rank: 'JKR', suit: '*', locked: false });
    deck.push({ id: 'JKR-2', rank: 'JKR', suit: '*', locked: false });

    for (let index = deck.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      const temp = deck[index];
      deck[index] = deck[randomIndex];
      deck[randomIndex] = temp;
    }

    return deck;
  }

  private isTicTacToeWinner(
    board: Array<'' | TicTacToeMark>,
    mark: TicTacToeMark,
  ) {
    return TIC_TAC_TOE_WIN_LINES.some(
      ([a, b, c]) =>
        board[a] === mark && board[b] === mark && board[c] === mark,
    );
  }

  @SubscribeMessage('ludo:sync')
  async handleLudoSync(@ConnectedSocket() client: Socket) {
    const roomCode = this.getRoomCode(client);

    if (!roomCode) {
      return;
    }

    const state = await this.getOrCreateLudoState(roomCode, client);

    if (!state) {
      return;
    }

    client.emit('ludo:state', state);
  }

  @SubscribeMessage('ludo:roll')
  async handleLudoRoll(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: LudoRollPayload,
  ) {
    const roomCode = this.getRoomCode(client);
    const playerName =
      typeof payload?.playerName === 'string' ? payload.playerName.trim() : '';
    const requestedTokenIndex =
      typeof payload?.tokenIndex === 'number' &&
      Number.isInteger(payload.tokenIndex)
        ? payload.tokenIndex
        : null;

    if (!roomCode || !playerName) {
      return;
    }

    const state = await this.getOrCreateLudoState(roomCode, client);

    if (!state) {
      return;
    }

    if (state.status === 'finished') {
      client.emit('ludo:error', {
        roomCode,
        message: `Game already finished. Winner: ${state.winner ?? 'unknown'}.`,
      });
      client.emit('ludo:state', state);
      return;
    }

    const currentPlayer = state.playerOrder[state.currentTurnIndex];
    const currentPlayerIndex = state.playerOrder.indexOf(currentPlayer);

    if (currentPlayer !== playerName) {
      this.pendingLudoChoices.delete(roomCode);
      client.emit('ludo:error', {
        roomCode,
        message: `It is ${currentPlayer}'s turn.`,
      });
      return;
    }

    const tokenProgress = state.tokenProgress[playerName] ?? [];
    const pendingChoice = this.pendingLudoChoices.get(roomCode);

    let roll = this.rollDice();
    let movableTokenIndexes = this.getMovableLudoTokenIndexes(
      state,
      playerName,
      currentPlayerIndex,
      tokenProgress,
      roll,
    );

    if (pendingChoice?.playerName === playerName) {
      roll = pendingChoice.roll;
      movableTokenIndexes = pendingChoice.movableTokenIndexes;
    }

    if (movableTokenIndexes.length === 0) {
      this.pendingLudoChoices.delete(roomCode);
      state.lastMove = {
        playerName,
        roll,
        tokenIndex: -1,
        from: 0,
        to: 0,
        kind: 'blocked',
        capturedPlayers: [],
      };

      state.currentTurnIndex =
        (state.currentTurnIndex + 1) % state.playerOrder.length;

      await this.saveLudoState(state);
      this.server?.to(roomCode).emit('ludo:state', state);
      return;
    }

    const requiresChoice = movableTokenIndexes.length > 1;

    if (requiresChoice) {
      const tokenIndexIsValidChoice =
        requestedTokenIndex !== null &&
        movableTokenIndexes.includes(requestedTokenIndex);

      if (!tokenIndexIsValidChoice) {
        this.pendingLudoChoices.set(roomCode, {
          playerName,
          roll,
          movableTokenIndexes,
        });

        client.emit('ludo:choice-required', {
          roomCode,
          playerName,
          roll,
          movableTokenIndexes,
        } satisfies LudoChoiceRequiredPayload);
        return;
      }
    }

    this.pendingLudoChoices.delete(roomCode);

    const tokenIndex =
      requestedTokenIndex !== null &&
      movableTokenIndexes.includes(requestedTokenIndex)
        ? requestedTokenIndex
        : this.chooseLudoTokenIndex(tokenProgress, movableTokenIndexes);

    if (tokenIndex === -1) {
      state.lastMove = {
        playerName,
        roll,
        tokenIndex: -1,
        from: 0,
        to: 0,
        kind: 'blocked',
        capturedPlayers: [],
      };

      state.currentTurnIndex =
        (state.currentTurnIndex + 1) % state.playerOrder.length;

      await this.saveLudoState(state);
      this.server?.to(roomCode).emit('ludo:state', state);
      return;
    }

    const from = tokenProgress[tokenIndex] ?? 0;
    const to = from === 0 ? 1 : from + roll;
    const landingProgress = Math.min(to, LUDO_MAX_PROGRESS);
    const landingTrackIndex =
      landingProgress <= LUDO_HOME_ENTRY_PROGRESS
        ? this.getLudoTrackIndex(
            state.playerOrder.length,
            currentPlayerIndex,
            landingProgress,
          )
        : -1;
    const capturedPlayers = this.captureLudoTokens(
      state,
      playerName,
      currentPlayerIndex,
      landingTrackIndex,
    );

    state.tokenProgress[playerName][tokenIndex] = landingProgress;

    const tokenReachedEnd =
      landingProgress === LUDO_MAX_PROGRESS && from < LUDO_MAX_PROGRESS;
    const isWinningMove = this.isLudoWinner(state, playerName);

    state.lastMove = {
      playerName,
      roll,
      tokenIndex,
      from,
      to: landingProgress,
      kind: tokenReachedEnd
        ? 'finished'
        : capturedPlayers.length > 0
          ? 'capture'
          : 'move',
      capturedPlayers,
    };

    if (isWinningMove) {
      state.status = 'finished';
      state.winner = playerName;
    } else if (roll !== 6 && !tokenReachedEnd && capturedPlayers.length === 0) {
      state.currentTurnIndex =
        (state.currentTurnIndex + 1) % state.playerOrder.length;
    }

    await this.saveLudoState(state);
    this.server?.to(roomCode).emit('ludo:state', state);
  }

  private getMovableLudoTokenIndexes(
    state: LudoState,
    playerName: string,
    playerIndex: number,
    tokenProgress: number[],
    roll: number,
  ) {
    const movableIndexes: number[] = [];

    for (let index = 0; index < tokenProgress.length; index += 1) {
      const progress = tokenProgress[index] ?? 0;
      const canMoveByDistance =
        progress === 0 ? roll === 6 : progress + roll <= LUDO_MAX_PROGRESS;

      if (!canMoveByDistance) {
        continue;
      }

      const landingProgress = progress === 0 ? 1 : progress + roll;
      const isOwnStackBlocked = this.isLudoOwnStackBlocked(
        state,
        playerName,
        playerIndex,
        tokenProgress,
        index,
        landingProgress,
      );

      if (!isOwnStackBlocked) {
        movableIndexes.push(index);
      }
    }

    return movableIndexes;
  }

  private async getOrCreateLudoState(roomCode: string, client?: Socket) {
    const existingState = await this.loadLudoState(roomCode);

    if (existingState) {
      return existingState;
    }

    const room = await this.roomsService.findOne(roomCode).catch(() => null);

    if (!room) {
      client?.emit('ludo:error', {
        roomCode,
        message: 'Room not found.',
      });
      return null;
    }

    if (room.status !== RoomStatus.LIVE) {
      client?.emit('ludo:error', {
        roomCode,
        message: 'Game has not started yet.',
      });
      return null;
    }

    if (room.game.trim().toLowerCase() !== 'ludo') {
      client?.emit('ludo:error', {
        roomCode,
        message: 'This room is not a Ludo game.',
      });
      return null;
    }

    const playerOrder = room.players
      .map((player) => player.playerName.trim())
      .slice(0, 4);

    if (playerOrder.length < 2) {
      client?.emit('ludo:error', {
        roomCode,
        message: 'Need at least two players to play.',
      });
      return null;
    }

    const tokenProgress = playerOrder.reduce<Record<string, number[]>>(
      (accumulator, playerName) => {
        accumulator[playerName] = Array.from(
          { length: LUDO_TOKEN_COUNT },
          () => 0,
        );
        return accumulator;
      },
      {},
    );

    const state: LudoState = {
      roomCode,
      playerOrder,
      tokenProgress,
      currentTurnIndex: 0,
      status: 'running',
      winner: null,
      lastMove: null,
    };

    await this.saveLudoState(state);
    return state;
  }

  private async loadLudoState(roomCode: string) {
    const stateEntity = await this.ludoStateRepository.findOne({
      where: {
        roomCode,
      },
    });

    if (!stateEntity) {
      return null;
    }

    return {
      roomCode: stateEntity.roomCode,
      playerOrder: stateEntity.playerOrder,
      tokenProgress: stateEntity.tokenProgress,
      currentTurnIndex: stateEntity.currentTurnIndex,
      status: stateEntity.status,
      winner: stateEntity.winner,
      lastMove: stateEntity.lastMove,
    } satisfies LudoState;
  }

  private async saveLudoState(state: LudoState) {
    const stateEntity = this.ludoStateRepository.create({
      roomCode: state.roomCode,
      playerOrder: state.playerOrder,
      tokenProgress: state.tokenProgress,
      currentTurnIndex: state.currentTurnIndex,
      status: state.status,
      winner: state.winner,
      lastMove: state.lastMove,
    });

    await this.ludoStateRepository.save(stateEntity);
  }

  private chooseLudoTokenIndex(
    tokenProgress: number[],
    movableTokenIndexes: number[],
  ) {
    let selectedIndex = -1;
    let selectedProgress = -1;

    for (const index of movableTokenIndexes) {
      const progress = tokenProgress[index] ?? 0;

      if (progress > selectedProgress) {
        selectedIndex = index;
        selectedProgress = progress;
      }
    }

    return selectedIndex;
  }

  private isLudoOwnStackBlocked(
    state: LudoState,
    playerName: string,
    playerIndex: number,
    tokenProgress: number[],
    movingTokenIndex: number,
    landingProgress: number,
  ) {
    if (landingProgress >= LUDO_MAX_PROGRESS) {
      return false;
    }

    if (landingProgress > LUDO_HOME_ENTRY_PROGRESS) {
      return tokenProgress.some(
        (progress, tokenIndex) =>
          tokenIndex !== movingTokenIndex && progress === landingProgress,
      );
    }

    const landingTrackIndex = this.getLudoTrackIndex(
      state.playerOrder.length,
      playerIndex,
      landingProgress,
    );

    if (LUDO_SAFE_TRACK_INDEXES.has(landingTrackIndex)) {
      return false;
    }

    return tokenProgress.some((progress, tokenIndex) => {
      if (
        tokenIndex === movingTokenIndex ||
        progress <= 0 ||
        progress > LUDO_HOME_ENTRY_PROGRESS
      ) {
        return false;
      }

      const tokenTrackIndex = this.getLudoTrackIndex(
        state.playerOrder.length,
        playerIndex,
        progress,
      );

      return tokenTrackIndex === landingTrackIndex;
    });
  }

  private captureLudoTokens(
    state: LudoState,
    currentPlayerName: string,
    currentPlayerIndex: number,
    landingTrackIndex: number,
  ) {
    if (
      landingTrackIndex < 0 ||
      LUDO_SAFE_TRACK_INDEXES.has(landingTrackIndex)
    ) {
      return [] as string[];
    }

    const capturedPlayers: string[] = [];

    state.playerOrder.forEach((playerName, playerIndex) => {
      if (playerName === currentPlayerName) {
        return;
      }

      const boardSlotIndex = getLudoBoardSlotIndex(
        state.playerOrder.length,
        playerIndex,
      );
      const startOffset = LUDO_ENTRY_OFFSETS[boardSlotIndex] ?? 0;
      const progressValues = state.tokenProgress[playerName] ?? [];
      let captured = false;

      state.tokenProgress[playerName] = progressValues.map((progress) => {
        if (progress <= 0 || progress > LUDO_HOME_ENTRY_PROGRESS) {
          return progress;
        }

        const tokenTrackIndex =
          (startOffset + progress - 1) % LUDO_BOARD_TRACK_LENGTH;

        if (tokenTrackIndex !== landingTrackIndex) {
          return progress;
        }

        captured = true;
        return 0;
      });

      if (captured) {
        capturedPlayers.push(playerName);
      }
    });

    return capturedPlayers;
  }

  private isLudoWinner(state: LudoState, playerName: string) {
    return (state.tokenProgress[playerName] ?? []).every(
      (progress) => progress === LUDO_MAX_PROGRESS,
    );
  }

  private getLudoTrackIndex(
    playerCount: number,
    playerIndex: number,
    progress: number,
  ) {
    const boardSlotIndex = getLudoBoardSlotIndex(playerCount, playerIndex);
    const startOffset = LUDO_ENTRY_OFFSETS[boardSlotIndex] ?? 0;

    return (startOffset + progress - 1) % LUDO_BOARD_TRACK_LENGTH;
  }

  private rollDice() {
    return Math.floor(Math.random() * 6) + 1;
  }

  private getRoomCode(client: Socket) {
    const { roomCode } = client.handshake.query;

    if (typeof roomCode !== 'string') {
      return '';
    }

    return roomCode.trim().toUpperCase();
  }

  private getPlayerName(client: Socket) {
    const { playerName } = client.handshake.query;

    if (typeof playerName !== 'string') {
      return '';
    }

    return playerName.trim();
  }
}

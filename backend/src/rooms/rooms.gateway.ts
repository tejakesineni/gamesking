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
import { Server, Socket } from 'socket.io';
import { Repository } from 'typeorm';
import { RoomsService } from './rooms.service';
import { RoomStatus } from './room.entity';
import { LudoStateEntity } from './ludo-state.entity';
import { SnakesAndLaddersStateEntity } from './snl-state.entity';

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
const LUDO_SAFE_TRACK_INDEXES = new Set(LUDO_ENTRY_OFFSETS);

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
    }
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
        : this.chooseLudoTokenIndex(tokenProgress, roll);

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
    } else if (roll !== 6 && !tokenReachedEnd) {
      state.currentTurnIndex =
        (state.currentTurnIndex + 1) % state.playerOrder.length;
    }

    await this.saveLudoState(state);
    this.server?.to(roomCode).emit('ludo:state', state);
  }

  private getMovableLudoTokenIndexes(tokenProgress: number[], roll: number) {
    const movableIndexes: number[] = [];

    for (let index = 0; index < tokenProgress.length; index += 1) {
      const progress = tokenProgress[index] ?? 0;
      const canMove =
        progress === 0 ? roll === 6 : progress + roll <= LUDO_MAX_PROGRESS;

      if (canMove) {
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

  private chooseLudoTokenIndex(tokenProgress: number[], roll: number) {
    let selectedIndex = -1;
    let selectedProgress = -1;

    for (let index = 0; index < tokenProgress.length; index += 1) {
      const progress = tokenProgress[index] ?? 0;
      const canMove =
        progress === 0 ? roll === 6 : progress + roll <= LUDO_MAX_PROGRESS;

      if (!canMove) {
        continue;
      }

      if (progress > selectedProgress) {
        selectedIndex = index;
        selectedProgress = progress;
      }
    }

    return selectedIndex;
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

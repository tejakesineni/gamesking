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

@WebSocketGateway({
  cors: {
    origin: true,
  },
})
export class RoomsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RoomsGateway.name);

  constructor(
    @Inject(forwardRef(() => RoomsService))
    private readonly roomsService: RoomsService,
    @InjectRepository(SnakesAndLaddersStateEntity)
    private readonly snakesAndLaddersStateRepository: Repository<SnakesAndLaddersStateEntity>,
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
      void this.ensureSnakesAndLaddersStarted(roomCode);
    }
  }

  private async ensureSnakesAndLaddersStarted(roomCode: string) {
    const existingState = await this.loadSnakesAndLaddersState(roomCode);

    if (existingState) {
      this.server?.to(roomCode).emit('snl:state', existingState);
      return;
    }

    const state = await this.getOrCreateSnakesAndLaddersState(roomCode);

    if (state) {
      this.server?.to(roomCode).emit('snl:state', state);
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

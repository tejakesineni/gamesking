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
import { Server, Socket } from 'socket.io';
import { RoomsService } from './rooms.service';

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

type RoomStartedPayload = {
  roomCode: string;
  status: string;
};

type RoomStartPayload = {
  hostName?: string;
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
  ) {}

  @WebSocketServer()
  private server?: Server;

  handleConnection(client: Socket) {
    const roomCode = this.getRoomCode(client);
    const playerName = this.getPlayerName(client);

    if (!roomCode) {
      client.disconnect(true);
      return;
    }

    void client.join(roomCode);
    client.emit('room:connected', { roomCode });
    client.to(roomCode).emit('room:user-connected', { roomCode });

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

  emitRoomCreated(roomCode: string, payload: RoomCreatedPayload) {
    if (!this.server) {
      return;
    }

    this.server.to(roomCode).emit('room:created', payload);
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

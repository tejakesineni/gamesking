import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

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

@WebSocketGateway({
  cors: {
    origin: true,
  },
})
export class RoomsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server?: Server;

  handleConnection(client: Socket) {
    const roomCode = this.getRoomCode(client);
    const playerName = this.getPlayerName(client);

    if (!roomCode) {
      client.disconnect(true);
      return;
    }

    client.join(roomCode);
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

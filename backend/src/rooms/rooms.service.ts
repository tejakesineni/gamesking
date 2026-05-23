import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CreateRoomDto } from './dto/create-room.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { StartRoomDto } from './dto/start-room.dto';
import { RoomUser } from './room-user.entity';
import { Room, RoomStatus } from './room.entity';
import { RoomsGateway } from './rooms.gateway';

@Injectable()
export class RoomsService implements OnModuleInit {
  constructor(
    @InjectRepository(Room)
    private readonly roomsRepository: Repository<Room>,
    @InjectRepository(RoomUser)
    private readonly roomUsersRepository: Repository<RoomUser>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly roomsGateway: RoomsGateway,
  ) {}

  async onModuleInit() {
    await this.removeLegacyRoomIdColumns();

    const roomCount = await this.roomsRepository.count();

    if (roomCount === 0) {
      await this.roomsRepository.save([
        this.roomsRepository.create({
          hostName: 'Luna',
          game: 'Bingo',
          roomCode: this.generateRoomCode(),
          status: RoomStatus.WAITING,
        }),
        this.roomsRepository.create({
          hostName: 'Marcus',
          game: 'Tambola',
          roomCode: this.generateRoomCode(),
          status: RoomStatus.LIVE,
        }),
      ]);
    }
  }

  async findAll() {
    return this.roomsRepository.find({
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async findOne(roomCode: string) {
    const normalizedRoomCode = roomCode.trim().toUpperCase();
    const room = await this.roomsRepository.findOne({
      where: {
        roomCode: normalizedRoomCode,
      },
    });

    if (!room) {
      throw new NotFoundException('Room not found.');
    }

    const players = await this.roomUsersRepository.find({
      where: {
        roomCode: normalizedRoomCode,
      },
      order: {
        joinedAt: 'ASC',
      },
    });

    return {
      ...room,
      players,
    };
  }

  async create(createRoomDto: CreateRoomDto) {
    const room = await this.dataSource.transaction(async (manager) => {
      const roomRepository = manager.getRepository(Room);
      const roomUsersRepository = manager.getRepository(RoomUser);

      const createdRoom = roomRepository.create({
        ...createRoomDto,
        roomCode: this.generateRoomCode(),
        status: RoomStatus.WAITING,
      });

      const savedRoom = await roomRepository.save(createdRoom);

      await roomUsersRepository.save(
        roomUsersRepository.create({
          roomCode: savedRoom.roomCode,
          playerName: savedRoom.hostName,
        }),
      );

      return savedRoom;
    });

    try {
      this.roomsGateway.emitRoomCreated(room.roomCode, {
        roomCode: room.roomCode,
        hostName: room.hostName,
        game: room.game,
        status: room.status,
      });
    } catch {
      // Room creation should still succeed even if websocket broadcasting is unavailable.
    }

    return room;
  }

  async joinRoom(joinRoomDto: JoinRoomDto) {
    const room = await this.roomsRepository.findOne({
      where: {
        roomCode: joinRoomDto.roomCode.trim().toUpperCase(),
      },
    });

    if (!room) {
      throw new NotFoundException('Room not found.');
    }

    const roomUser = this.roomUsersRepository.create({
      roomCode: room.roomCode,
      playerName: joinRoomDto.playerName.trim(),
    });

    const savedRoomUser = await this.roomUsersRepository.save(roomUser);

    try {
      this.roomsGateway.emitRoomUserJoined(room.roomCode, {
        roomCode: room.roomCode,
        playerName: savedRoomUser.playerName,
        joinedAt: savedRoomUser.joinedAt,
      });
    } catch {
      // Room join should still succeed even if websocket broadcasting is unavailable.
    }

    return savedRoomUser;
  }

  async startRoom(roomCode: string, startRoomDto: StartRoomDto) {
    const normalizedRoomCode = roomCode.trim().toUpperCase();
    const room = await this.roomsRepository.findOne({
      where: {
        roomCode: normalizedRoomCode,
      },
    });

    if (!room) {
      throw new NotFoundException('Room not found.');
    }

    if (room.hostName.trim() !== startRoomDto.hostName.trim()) {
      throw new NotFoundException('Only the host can start this room.');
    }

    const joinedPlayers = await this.roomUsersRepository.count({
      where: {
        roomCode: normalizedRoomCode,
      },
    });

    if (joinedPlayers < 2) {
      throw new NotFoundException('At least one other player must join first.');
    }

    room.status = RoomStatus.LIVE;
    const startedRoom = await this.roomsRepository.save(room);

    try {
      this.roomsGateway.emitRoomStarted(startedRoom.roomCode, {
        roomCode: startedRoom.roomCode,
        status: startedRoom.status,
      });
    } catch {
      // Starting the room should still succeed even if websocket broadcasting is unavailable.
    }

    return startedRoom;
  }

  private generateRoomCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    return Array.from({ length: 6 }, () => {
      const index = Math.floor(Math.random() * alphabet.length);
      return alphabet[index];
    }).join('');
  }

  private async removeLegacyRoomIdColumns() {
    await this.dataSource.query(
      'ALTER TABLE IF EXISTS "roomusers" DROP COLUMN IF EXISTS "roomId";',
    );

    await this.dataSource.query(
      'ALTER TABLE IF EXISTS "rooms" DROP COLUMN IF EXISTS "id" CASCADE;',
    );
  }
}

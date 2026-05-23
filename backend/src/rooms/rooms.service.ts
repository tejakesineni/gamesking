import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateRoomDto } from './dto/create-room.dto';
import { Room, RoomStatus } from './room.entity';

@Injectable()
export class RoomsService implements OnModuleInit {
  constructor(
    @InjectRepository(Room)
    private readonly roomsRepository: Repository<Room>,
  ) {}

  async onModuleInit() {
    const roomCount = await this.roomsRepository.count();

    if (roomCount === 0) {
      await this.roomsRepository.save([
        this.roomsRepository.create({
          name: 'Friday Night Bingo',
          hostName: 'Luna',
          roomCode: this.generateRoomCode(),
          maxPlayers: 8,
          playersJoined: 3,
          status: RoomStatus.WAITING,
        }),
        this.roomsRepository.create({
          name: 'Quick Cash Sprint',
          hostName: 'Marcus',
          roomCode: this.generateRoomCode(),
          maxPlayers: 12,
          playersJoined: 7,
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

  async create(createRoomDto: CreateRoomDto) {
    const room = this.roomsRepository.create({
      ...createRoomDto,
      playersJoined: 1,
      roomCode: this.generateRoomCode(),
      status: RoomStatus.WAITING,
    });

    return this.roomsRepository.save(room);
  }

  private generateRoomCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    return Array.from({ length: 6 }, () => {
      const index = Math.floor(Math.random() * alphabet.length);
      return alphabet[index];
    }).join('');
  }
}

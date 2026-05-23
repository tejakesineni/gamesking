import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomUser } from './room-user.entity';
import { Room } from './room.entity';
import { RoomsGateway } from './rooms.gateway';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { SnakesAndLaddersStateEntity } from './snl-state.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Room, RoomUser, SnakesAndLaddersStateEntity]),
  ],
  controllers: [RoomsController],
  providers: [RoomsService, RoomsGateway],
})
export class RoomsModule {}

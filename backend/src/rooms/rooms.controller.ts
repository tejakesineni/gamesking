import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { CreateRoomDto } from './dto/create-room.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { StartRoomDto } from './dto/start-room.dto';
import { RoomsService } from './rooms.service';

@Controller('rooms')
export class RoomsController {
  constructor(
    @Inject(RoomsService) private readonly roomsService: RoomsService,
  ) {}

  @Get()
  findAll() {
    return this.roomsService.findAll();
  }

  @Get(':roomCode')
  findOne(@Param('roomCode') roomCode: string) {
    return this.roomsService.findOne(roomCode);
  }

  @Post()
  create(@Body() createRoomDto: CreateRoomDto) {
    return this.roomsService.create(createRoomDto);
  }

  @Post(':roomCode/start')
  startRoom(
    @Param('roomCode') roomCode: string,
    @Body() startRoomDto: StartRoomDto,
  ) {
    return this.roomsService.startRoom(roomCode, startRoomDto);
  }

  @Post('join')
  joinRoom(@Body() joinRoomDto: JoinRoomDto) {
    return this.roomsService.joinRoom(joinRoomDto);
  }
}

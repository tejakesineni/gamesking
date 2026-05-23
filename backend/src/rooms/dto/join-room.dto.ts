import { IsString, MaxLength, MinLength } from 'class-validator';

export class JoinRoomDto {
  @IsString()
  @MinLength(6)
  @MaxLength(8)
  roomCode: string;

  @IsString()
  @MinLength(2)
  @MaxLength(40)
  playerName: string;
}

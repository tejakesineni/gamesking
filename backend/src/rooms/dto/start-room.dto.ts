import { IsString, MaxLength, MinLength } from 'class-validator';

export class StartRoomDto {
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  hostName: string;
}

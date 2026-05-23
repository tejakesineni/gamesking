import {
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateRoomDto {
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  name: string;

  @IsString()
  @MinLength(2)
  @MaxLength(40)
  hostName: string;

  @IsInt()
  @Min(2)
  @Max(20)
  maxPlayers: number;
}

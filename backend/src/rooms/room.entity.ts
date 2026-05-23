import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum RoomStatus {
  WAITING = 'waiting',
  LIVE = 'live',
  FINISHED = 'finished',
}

@Entity({ name: 'rooms' })
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 80 })
  name!: string;

  @Column({ length: 40 })
  hostName!: string;

  @Column({ unique: true, length: 8 })
  roomCode!: string;

  @Column({
    type: 'enum',
    enum: RoomStatus,
    default: RoomStatus.WAITING,
  })
  status!: RoomStatus;

  @Column({ type: 'int', default: 6 })
  maxPlayers!: number;

  @Column({ type: 'int', default: 1 })
  playersJoined!: number;

  @CreateDateColumn()
  createdAt!: Date;
}

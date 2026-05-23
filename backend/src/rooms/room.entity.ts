import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

export enum RoomStatus {
  WAITING = 'waiting',
  LIVE = 'live',
  FINISHED = 'finished',
}

@Entity({ name: 'rooms' })
export class Room {
  @PrimaryColumn({ type: 'varchar', length: 8 })
  roomCode!: string;

  @Column({ type: 'varchar', length: 40 })
  hostName!: string;

  @Column({ type: 'varchar', length: 40, default: 'Bingo' })
  game!: string;

  @Column({
    type: 'enum',
    enum: RoomStatus,
    default: RoomStatus.WAITING,
  })
  status!: RoomStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}

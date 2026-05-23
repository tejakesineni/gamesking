import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Room } from './room.entity';

@Entity({ name: 'roomusers' })
export class RoomUser {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 8 })
  roomCode!: string;

  @ManyToOne(() => Room, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roomCode' })
  room!: Room;

  @Column({ type: 'varchar', length: 40 })
  playerName!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  joinedAt!: Date;
}

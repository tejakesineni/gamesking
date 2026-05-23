import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Room } from './room.entity';

@Entity({ name: 'snakesandladdersstates' })
export class SnakesAndLaddersStateEntity {
  @PrimaryColumn({ type: 'varchar', length: 8 })
  roomCode!: string;

  @ManyToOne(() => Room, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roomCode' })
  room!: Room;

  @Column({ type: 'text', array: true })
  playerOrder!: string[];

  @Column({ type: 'jsonb', default: () => "'{}'" })
  positions!: Record<string, number>;

  @Column({ type: 'integer', default: 0 })
  currentTurnIndex!: number;

  @Column({ type: 'varchar', length: 16, default: 'running' })
  status!: 'running' | 'finished';

  @Column({ type: 'varchar', length: 40, nullable: true })
  winner!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  lastMove!: {
    playerName: string;
    roll: number;
    from: number;
    to: number;
    kind: 'normal' | 'snake' | 'ladder' | 'blocked';
  } | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}

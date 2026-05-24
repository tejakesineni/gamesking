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

@Entity({ name: 'tictactoestates' })
export class TicTacToeStateEntity {
  @PrimaryColumn({ type: 'varchar', length: 8 })
  roomCode!: string;

  @ManyToOne(() => Room, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roomCode' })
  room!: Room;

  @Column({ type: 'text', array: true })
  playerOrder!: string[];

  @Column({ type: 'jsonb', default: () => "'{}'" })
  marks!: Record<string, 'X' | 'O'>;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  board!: Array<'' | 'X' | 'O'>;

  @Column({ type: 'integer', default: 0 })
  currentTurnIndex!: number;

  @Column({ type: 'varchar', length: 16, default: 'running' })
  status!: 'running' | 'finished';

  @Column({ type: 'varchar', length: 40, nullable: true })
  winner!: string | null;

  @Column({ type: 'boolean', default: false })
  isDraw!: boolean;

  @Column({ type: 'jsonb', nullable: true })
  lastMove!: {
    playerName: string;
    mark: 'X' | 'O';
    index: number;
  } | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}

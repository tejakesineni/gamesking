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

@Entity({ name: 'chessstates' })
export class ChessStateEntity {
  @PrimaryColumn({ type: 'varchar', length: 8 })
  roomCode!: string;

  @ManyToOne(() => Room, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roomCode' })
  room!: Room;

  @Column({ type: 'text', array: true })
  playerOrder!: string[];

  @Column({ type: 'jsonb', default: () => "'{}'" })
  colors!: Record<string, 'white' | 'black'>;

  @Column({ type: 'text' })
  fen!: string;

  @Column({ type: 'varchar', length: 16, default: 'running' })
  status!: 'running' | 'finished';

  @Column({ type: 'varchar', length: 40, nullable: true })
  winner!: string | null;

  @Column({ type: 'boolean', default: false })
  isDraw!: boolean;

  @Column({ type: 'jsonb', nullable: true })
  lastMove!: {
    playerName: string;
    from: string;
    to: string;
    promotion: string | null;
    san: string;
    piece: string;
    captured: string | null;
  } | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}

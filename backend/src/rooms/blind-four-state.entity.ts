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

type BlindFourCard = {
  id: string;
  rank: string;
  suit: string;
  locked?: boolean;
  lockedByCard?: {
    id: string;
    rank: string;
    suit: string;
  } | null;
};

type BlindFourLastAction = {
  playerName: string;
  action: string;
  detail: string;
};

type BlindFourPendingJokerChoice = {
  playerName: string;
  options: Array<
    | 'lock-card'
    | 'swap-card'
    | 'shuffle-cards'
    | 'pick-your-cards'
    | 'see-opponent-card'
  >;
};

type BlindFourPendingLockChoice = {
  playerName: string;
  source: 'joker-lock' | 'king-discard';
  lockingCard?: BlindFourCard | null;
};

type BlindFourPendingSwapChoice = {
  playerName: string;
  source: 'joker-swap' | 'queen-discard';
};

type BlindFourPendingShuffleChoice = {
  playerName: string;
  source: 'joker-shuffle' | 'jack-discard';
  targetPlayers: string[];
};

type BlindFourPendingTenChoice = {
  playerName: string;
  options: Array<'pick-your-cards' | 'see-opponent-card'>;
};

type BlindFourPendingSeeOwnCards = {
  playerName: string;
  startedAt: string;
  durationMs: number;
};

type BlindFourPendingPeekChoice = {
  playerName: string;
  source: 'joker-peek-opponent' | 'ten-peek-opponent';
  targetPlayers: string[];
};

type BlindFourActivePeekReveal = {
  playerName: string;
  targetPlayerName: string;
  slotIndex: number;
  startedAt: string;
  durationMs: number;
};

@Entity({ name: 'blindfourstates' })
export class BlindFourStateEntity {
  @PrimaryColumn({ type: 'varchar', length: 8 })
  roomCode!: string;

  @ManyToOne(() => Room, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roomCode' })
  room!: Room;

  @Column({ type: 'text', array: true })
  playerOrder!: string[];

  @Column({ type: 'jsonb', default: () => "'{}'" })
  hands!: Record<string, BlindFourCard[]>;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  deck!: BlindFourCard[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  discardPile!: BlindFourCard[];

  @Column({ type: 'jsonb', nullable: true })
  pendingDrawCard!: BlindFourCard | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  initialPeekIndexes!: Record<string, number[]>;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  setupReady!: Record<string, boolean>;

  @Column({ type: 'varchar', length: 16, default: 'setup' })
  phase!: 'setup' | 'running';

  @Column({ type: 'integer', default: 0 })
  currentTurnIndex!: number;

  @Column({ type: 'varchar', length: 16, default: 'running' })
  status!: 'running' | 'finished';

  @Column({ type: 'varchar', length: 40, nullable: true })
  winner!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  scores!: Record<string, number> | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  knocker!: string | null;

  @Column({ type: 'integer', default: 0 })
  turnsAfterKnock!: number;

  @Column({ type: 'jsonb', nullable: true })
  lastAction!: BlindFourLastAction | null;

  @Column({ type: 'jsonb', nullable: true })
  pendingJokerChoice!: BlindFourPendingJokerChoice | null;

  @Column({ type: 'jsonb', nullable: true })
  pendingLockChoice!: BlindFourPendingLockChoice | null;

  @Column({ type: 'jsonb', nullable: true })
  pendingSwapChoice!: BlindFourPendingSwapChoice | null;

  @Column({ type: 'jsonb', nullable: true })
  pendingShuffleChoice!: BlindFourPendingShuffleChoice | null;

  @Column({ type: 'jsonb', nullable: true })
  pendingTenChoice!: BlindFourPendingTenChoice | null;

  @Column({ type: 'jsonb', nullable: true })
  pendingSeeOwnCards!: BlindFourPendingSeeOwnCards | null;

  @Column({ type: 'jsonb', nullable: true })
  pendingPeekChoice!: BlindFourPendingPeekChoice | null;

  @Column({ type: 'jsonb', nullable: true })
  activePeekReveal!: BlindFourActivePeekReveal | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}

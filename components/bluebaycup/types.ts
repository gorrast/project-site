

import type { RowData } from '@tanstack/react-table'

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    className?: string
  }
}

export interface PlayerOverallStats {
  playerId: string;
  playerName: string;
  rank: number;
  appearances: number;
  totalPoints: number;
  goldMedals: number;
  silverMedals: number;
  bronzeMedals: number;
  avgPointsTotal: number;
  avgPointsFor: number;
  avgPointsAgainst: number;
  totPrizeMoney: number;
}

export interface FormEntry {
  gameweek: number;
  result: 'W' | 'D' | 'L';
  opponentTeamId: number | null;
  opponentPlayerName: string;
  myScore: number;
  oppScore: number;
}

export interface PlayerSeasonStats {
  playerId: string;
  playerName: string;
  rank: number;
  totalPoints: number;
  wins: number;
  draws: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  luckFactor: number;
  form: FormEntry[];
}

export interface GameweekData {
  gameweek: number;
  rank: number | null;
  totalPoints: number;
  pointsFor: number;
  pointsAgainst: number;
  opponentName: string | null;
  opponentTeamId: number | null;
}

export interface PlayerProgressData {
  playerId: string;
  playerName: string;
  teamId: string;
  gameweeks: GameweekData[];
}

export interface TeamGameweekData {
  gameweek: number;
  pointsFor: number;
  pointsAgainst: number;
  opponentName?: string | null;
}

export interface Season {
  seasonId: string;
  seasonName: string;
  startYear: number;
  endYear: number;
  prizePool: number;
  isFinished: boolean;
}

export interface HighScoreData {
  playerName: string;
  score: number;
  gameweek: number;
}

export interface HeadToHeadFormEntry {
  gameweek: number;
  result: 'W' | 'D' | 'L';
  myScore: number;
  oppScore: number;
}

export interface HeadToHeadOpponent {
  opponentPlayerId: string;
  opponentPlayerName: string;
  wins: number;
  draws: number;
  losses: number;
  winPct: number;
  form: HeadToHeadFormEntry[];
}

export type HeadToHeadData = Record<string, HeadToHeadOpponent[]>;

export interface TrophySeasonEntry {
  seasonId: string;
  seasonName: string;
  winner: { playerName: string; points: number };
  runnerUp: { playerName: string; points: number } | null;
  third: { playerName: string; points: number } | null;
  margin: number | null;
}

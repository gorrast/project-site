// Types for BlueBayCup data structures

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
  pointsDifference: number;
}

export interface GameweekData {
  gameweek: number;
  rank: number | null;
  totalPoints: number;
  pointsFor: number;
  pointsAgainst: number;
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
}

export interface Season {
  seasonId: string;
  seasonName: string;
  startYear: number;
  endYear: number;
}

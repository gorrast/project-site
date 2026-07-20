export interface PlayPilotRating {
  title: string;
  score: number;
  type: 'movie' | 'series' | null;
  year: number | null;
  genres: string[];
}

export interface PlayPilotRatingsResponse {
  username: string;
  uuid: string;
  ratings: PlayPilotRating[];
  totalRatings: number | null;
}

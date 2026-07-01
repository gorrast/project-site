export interface PlayPilotRating {
  title: string;
  score: number;
}

export interface PlayPilotRatingsResponse {
  username: string;
  uuid: string;
  ratings: PlayPilotRating[];
}

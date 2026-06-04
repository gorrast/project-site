import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/bluebaycup';

export const revalidate = 3600; // Cache for 1 hour

// Scoring for overall rank
const PointsFor1st = 5
const PointsFor2nd = 2
const PointsFor3rd = 1

// The following dictates the order of ranking priority
const AvgPoints = 0.1
const AvgPointsFor = 0.01
const AvgPointsAgainst = 0.001


export async function GET() {
  try {
    // 1. Get all players
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('player_id, name');

    // console.log('Supabase client:', supabase);
    // console.log('Players response:', { data: players, error: playersError });

    if (playersError) throw playersError;

    // 2. Get all seasons with prize pool and year
    const { data: seasons, error: seasonsError } = await supabase
      .from('seasons')
      .select('season_id, year, prize_pool, high_score_prize')
      .order('season_id', { ascending: false });

    if (seasonsError) throw seasonsError;

    // 3. Get all teams
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('team_id, player_id, season_id');

    if (teamsError) throw teamsError;

    // 4. Get gameweek 38 stats for all teams (final standings)
    const { data: finalStats, error: statsError } = await supabase
      .from('team_stats')
      .select('team_id, total_points, points_for, points_against, teams(season_id)')
      .eq('gameweek', 38);

    if (statsError) throw statsError;

    // 5. Get the season IDs that have gameweek 38 data (finished seasons)
    const finishedSeasonIds = new Set<number>();
    finalStats?.forEach(stat => {
      const seasonId = (stat.teams as any)?.season_id;
      if (seasonId) finishedSeasonIds.add(seasonId);
    });

    // 6. Filter seasons to only include finished seasons
    const finishedSeasons = seasons?.filter(season => finishedSeasonIds.has(season.season_id)) || [];

    // 6b. Fetch all gameweek stats for teams in finished seasons (to compute per-GW scores)
    const finishedTeamIds = (teams?.filter(t => finishedSeasonIds.has(t.season_id)) || []).map(t => t.team_id);

    const { data: allGwStats, error: allGwStatsError } = await supabase
      .from('team_stats')
      .select('team_id, gameweek, points_for')
      .in('team_id', finishedTeamIds)
      .order('gameweek', { ascending: true });

    if (allGwStatsError) throw allGwStatsError;

    // 6c. Determine highest single-GW scorer per finished season
    const highScoreWinners: Record<number, number> = {}; // seasonId -> playerId

    finishedSeasons.forEach(season => {
      const seasonTeams = teams?.filter(t => t.season_id === season.season_id) || [];
      const seasonTeamIds = new Set(seasonTeams.map(t => t.team_id));

      // Group stats by team, sorted by gameweek
      const byTeam: Record<number, Array<{ gameweek: number; points_for: number }>> = {};
      (allGwStats || [])
        .filter(s => seasonTeamIds.has(s.team_id))
        .forEach(s => {
          if (!byTeam[s.team_id]) byTeam[s.team_id] = [];
          byTeam[s.team_id].push({ gameweek: s.gameweek, points_for: s.points_for });
        });
      Object.values(byTeam).forEach(stats => stats.sort((a, b) => a.gameweek - b.gameweek));

      // points_for is cumulative — compute per-GW score as the diff from the previous GW
      let maxScore = -1;
      let maxTeamId = -1;

      Object.entries(byTeam).forEach(([teamIdStr, stats]) => {
        stats.forEach((stat, i) => {
          const prevPointsFor = i === 0 ? 0 : stats[i - 1].points_for;
          const gwScore = stat.points_for - prevPointsFor;
          if (gwScore > maxScore) {
            maxScore = gwScore;
            maxTeamId = parseInt(teamIdStr);
          }
        });
      });

      if (maxTeamId !== -1) {
        const winningTeam = seasonTeams.find(t => t.team_id === maxTeamId);
        if (winningTeam) highScoreWinners[season.season_id] = winningTeam.player_id;
      }
    });

    // 7. Build season winners map
    const seasonWinners: Record<number, Array<{
      playerId: number;
      totalPoints: number;
      pointsFor: number;
      pointsAgainst: number;
    }>> = {};

    finishedSeasons.forEach(season => {
      const seasonTeams = teams?.filter(t => t.season_id === season.season_id) || [];
      const standings = seasonTeams
        .map(team => {
          const stats = finalStats?.find(s => s.team_id === team.team_id);
          return {
            playerId: team.player_id,
            totalPoints: stats?.total_points || 0,
            pointsFor: stats?.points_for || 0,
            pointsAgainst: stats?.points_against || 0
          };
        })
        .sort((a, b) => b.totalPoints - a.totalPoints);

      seasonWinners[season.season_id] = standings;
    });

    // 8. Calculate overall stats for each player
    const overallStats = players?.map(player => {
      const playerSeasons: Array<{
        rank: number;
        seasonId: number;
        totalPoints: number;
        pointsFor: number;
        pointsAgainst: number;
        prizePool: number;
        highScorePrize: number;
        overallPoints: number;
      }> = [];

      finishedSeasons.forEach(season => {
        const standings = seasonWinners[season.season_id];
        if (!standings) return;

        const playerIndex = standings.findIndex(s => s.playerId === player.player_id);
        if (playerIndex === -1) return; // Player didn't participate

        const rank = playerIndex + 1;
        const playerData = standings[playerIndex];

        // Calculate overall points based on rank
        let overallPoints = 0;
        if (rank === 1) overallPoints = PointsFor1st;
        else if (rank === 2) overallPoints = PointsFor2nd;
        else if (rank === 3) overallPoints = PointsFor3rd;

        playerSeasons.push({
          rank,
          seasonId: season.season_id,
          totalPoints: playerData.totalPoints,
          pointsFor: playerData.pointsFor,
          pointsAgainst: playerData.pointsAgainst,
          prizePool: Math.max(0, (season.prize_pool ?? 0) - (season.high_score_prize ?? 0)),
          highScorePrize: season.high_score_prize || 0,
          overallPoints
        });
      });

      // Calculate medals
      const goldMedals = playerSeasons.filter(s => s.rank === 1).length;
      const silverMedals = playerSeasons.filter(s => s.rank === 2).length;
      const bronzeMedals = playerSeasons.filter(s => s.rank === 3).length;

      // Calculate overall total points
      const totalOverallPoints = playerSeasons.reduce((sum, s) => sum + s.overallPoints, 0);

      // Calculate averages
      const appearances = playerSeasons.length;
      const avgPointsTotal = appearances > 0
        ? Math.round((playerSeasons.reduce((sum, s) => sum + s.totalPoints, 0) / appearances) * 10) / 10
        : 0;
      const avgPointsFor = appearances > 0
        ? Math.round((playerSeasons.reduce((sum, s) => sum + s.pointsFor, 0) / appearances) * 10) / 10
        : 0;
      const avgPointsAgainst = appearances > 0
        ? Math.round((playerSeasons.reduce((sum, s) => sum + s.pointsAgainst, 0) / appearances) * 10) / 10
        : 0;

      // Calculate total prize money (standings + highest GW score award)
      const totPrizeMoney = playerSeasons.reduce((sum, s) => {
        let prize = 0;
        if (s.rank === 1) prize = s.prizePool * 0.5;
        else if (s.rank === 2) prize = s.prizePool * 0.3;
        else if (s.rank === 3) prize = s.prizePool * 0.2;
        if (highScoreWinners[s.seasonId] === player.player_id) prize += s.highScorePrize;
        return sum + prize;
      }, 0);

      return {
        playerId: player.player_id.toString(),
        playerName: player.name,
        rank: 0, // Will be set after sorting
        appearances,
        goldMedals,
        silverMedals,
        bronzeMedals,
        totalOverallPoints,
        avgPointsTotal,
        avgPointsFor,
        avgPointsAgainst,
        totPrizeMoney: Math.round(totPrizeMoney)
      };
    }) || [];

    // 7. Sort by total overall points, then by average points
    overallStats.sort((a, b) => {
      if (b.totalOverallPoints !== a.totalOverallPoints) return b.totalOverallPoints - a.totalOverallPoints;
      return b.avgPointsTotal - a.avgPointsTotal;
    });

    // 8. Add rank
    overallStats.forEach((stat, index) => {
      stat.rank = index + 1;
    });

    // 9. Format all seasons for frontend
    const formattedSeasons = seasons?.map(season => ({
      seasonId: season.season_id.toString(),
      seasonName: season.year,
      startYear: parseInt(season.year.split('/')[0]),
      endYear: parseInt(season.year.split('/')[1]),
      prizePool: season.prize_pool,
      isFinished: finishedSeasonIds.has(season.season_id)
    })) || [];

    // 10. Get latest season (already sorted descending by season_id)
    const latestSeason = formattedSeasons[0] || null;

    return NextResponse.json({
      overallStats,
      seasons: formattedSeasons,
      latestSeason
    });
  } catch (error) {
    console.error('Error fetching overall stats:', error);
    return NextResponse.json({ error: 'Failed to fetch overall stats' }, { status: 500 });
  }
}

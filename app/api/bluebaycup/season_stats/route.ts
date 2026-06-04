import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/bluebaycup';

export const revalidate = 3600; // Cache for 1 hour

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { seasonId } = body;

    if (!seasonId) {
      return NextResponse.json({ error: 'seasonId is required' }, { status: 400 });
    }

    const seasonIdInt = parseInt(seasonId);

    // 1. Get teams for this season
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('team_id, player_id, team_name')
      .eq('season_id', seasonIdInt);

    if (teamsError) throw teamsError;
    if (!teams || teams.length === 0) {
      return NextResponse.json({ error: 'No teams found for this season' }, { status: 404 });
    }

    // 2. Get player names
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('player_id, name')
      .in('player_id', teams.map(t => t.player_id));

    if (playersError) throw playersError;

    // 3. Get ALL team_stats for all teams in this season
    const teamIds = teams.map(t => t.team_id);
    const { data: allStats, error: statsError } = await supabase
      .from('team_stats')
      .select('*')
      .in('team_id', teamIds)
      .order('gameweek', { ascending: true });

    if (statsError) throw statsError;
    if (!allStats || allStats.length === 0) {
      return NextResponse.json({ error: 'No stats found for this season' }, { status: 404 });
    }

    // 4. Compute luck factor for each team (needed before building standings)
    // Group cumulative stats by team and sort by gameweek
    const statsByTeam: Record<number, typeof allStats> = {};
    allStats.forEach(stat => {
      if (!statsByTeam[stat.team_id]) statsByTeam[stat.team_id] = [];
      statsByTeam[stat.team_id].push(stat);
    });
    Object.values(statsByTeam).forEach(s => s.sort((a, b) => a.gameweek - b.gameweek));

    // Derive per-GW FPL scores and W/D/L points from cumulative rows
    const perGwData: Record<number, Record<number, { fplScore: number; leaguePoints: number }>> = {};
    Object.entries(statsByTeam).forEach(([tidStr, stats]) => {
      const tid = parseInt(tidStr);
      perGwData[tid] = {};
      stats.forEach((stat, i) => {
        const prev = stats[i - 1];
        perGwData[tid][stat.gameweek] = {
          fplScore: prev ? stat.points_for - prev.points_for : stat.points_for,
          leaguePoints: prev ? stat.total_points - prev.total_points : stat.total_points,
        };
      });
    });

    // For each team: E[pts] per GW = 3*p_win + 1*p_draw vs. all other teams' FPL scores
    const luckFactors: Record<number, number> = {};
    teamIds.forEach(teamId => {
      const otherIds = teamIds.filter(id => id !== teamId);
      let sumExpected = 0;
      let sumActual = 0;

      Object.entries(perGwData[teamId] ?? {}).forEach(([gwStr, { fplScore, leaguePoints }]) => {
        const gw = parseInt(gwStr);
        const others = otherIds
          .map(id => perGwData[id]?.[gw]?.fplScore)
          .filter((s): s is number => s !== undefined);

        if (others.length === 0) return;

        const p_win = others.filter(s => s < fplScore).length / others.length;
        const p_draw = others.filter(s => s === fplScore).length / others.length;
        sumExpected += 3 * p_win + 1 * p_draw;
        sumActual += leaguePoints;
      });

      luckFactors[teamId] = sumExpected > 0
        ? Math.round((sumActual / sumExpected) * 100) / 100
        : 1;
    });

    // 5. Calculate standings table (using latest gameweek data)
    const maxGameweek = Math.max(...allStats.map(s => s.gameweek));
    const latestStats = allStats.filter(s => s.gameweek === maxGameweek);

    const standings = latestStats.map(stat => {
      const team = teams.find(t => t.team_id === stat.team_id);
      const player = players?.find(p => p.player_id === team?.player_id);

      return {
        playerId: team?.player_id.toString() || '',
        playerName: player?.name || '',
        teamName: team?.team_name || '',
        totalPoints: stat.total_points,
        wins: stat.wins,
        draws: stat.draws,
        losses: stat.losses,
        pointsFor: stat.points_for,
        pointsAgainst: stat.points_against,
        luckFactor: luckFactors[stat.team_id] ?? 1,
      };
    });

    // Sort by total points, then by points for
    standings.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      else if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
      return b.pointsAgainst - a.pointsAgainst;
    });

    // Add rank
    standings.forEach((s, index) => {
      (s as any).rank = index + 1;
    });

    // 6. Calculate progress data (rank progression per gameweek)
    const gameweeks = Array.from(new Set(allStats.map(s => s.gameweek))).sort((a, b) => a - b);

    const progressData = teams.map(team => {
      const player = players?.find(p => p.player_id === team.player_id);
      const teamStats = allStats.filter(s => s.team_id === team.team_id);

      const gameweekData = gameweeks.map(gw => {
        const stat = teamStats.find(s => s.gameweek === gw);

        if (!stat) {
          return {
            gameweek: gw,
            rank: null,
            totalPoints: 0,
            pointsFor: 0,
            pointsAgainst: 0
          };
        }

        // Calculate rank for this gameweek
        const gwStats = allStats.filter(s => s.gameweek === gw);
        const sorted = gwStats.sort((a, b) => b.total_points - a.total_points);
        const rank = sorted.findIndex(s => s.team_id === team.team_id) + 1;

        return {
          gameweek: gw,
          rank,
          totalPoints: stat.total_points,
          pointsFor: stat.points_for,
          pointsAgainst: stat.points_against
        };
      });

      return {
        playerId: team.player_id.toString(),
        playerName: player?.name || team.team_name,
        teamId: team.team_id.toString(),
        gameweeks: gameweekData
      };
    });

    // 6. Compute highest single-GW score (points_for is cumulative — diff from previous GW)
    let maxGwScore = -1;
    let maxGwPlayerName = '';
    let maxGwGameweek = -1;

    teams.forEach(team => {
      const player = players?.find(p => p.player_id === team.player_id);
      const teamStats = allStats
        .filter(s => s.team_id === team.team_id)
        .sort((a, b) => a.gameweek - b.gameweek);

      teamStats.forEach((stat, i) => {
        const prevPointsFor = i === 0 ? 0 : teamStats[i - 1].points_for;
        const gwScore = stat.points_for - prevPointsFor;
        if (gwScore > maxGwScore) {
          maxGwScore = gwScore;
          maxGwGameweek = stat.gameweek;
          maxGwPlayerName = player?.name || team.team_name;
        }
      });
    });

    const highScoreData = maxGwScore >= 0
      ? { playerName: maxGwPlayerName, score: maxGwScore, gameweek: maxGwGameweek }
      : null;

    // 7. Return combined data
    return NextResponse.json({
      standings,
      progressData,
      maxGameweek,
      highScoreData
    });
  } catch (error) {
    console.error('Error fetching season stats:', error);
    return NextResponse.json({ error: 'Failed to fetch season stats' }, { status: 500 });
  }
}

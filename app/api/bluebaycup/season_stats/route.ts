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

    // 4. Calculate standings table (using latest gameweek data)
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
        pointsFor: stat.goals_for,
        pointsAgainst: stat.goals_against,
        pointsDifference: stat.goals_for - stat.goals_against
      };
    });

    // Sort by total points, then by goal difference
    standings.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      return b.pointsDifference - a.pointsDifference;
    });

    // Add rank
    standings.forEach((s, index) => {
      (s as any).rank = index + 1;
    });

    // 5. Calculate progress data (rank progression per gameweek)
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
          pointsFor: stat.goals_for,
          pointsAgainst: stat.goals_against
        };
      });

      return {
        playerId: team.player_id.toString(),
        playerName: player?.name || team.team_name,
        teamId: team.team_id.toString(),
        gameweeks: gameweekData
      };
    });

    // 6. Return combined data
    return NextResponse.json({
      standings,
      progressData,
      maxGameweek
    });
  } catch (error) {
    console.error('Error fetching season stats:', error);
    return NextResponse.json({ error: 'Failed to fetch season stats' }, { status: 500 });
  }
}

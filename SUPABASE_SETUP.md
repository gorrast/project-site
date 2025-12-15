# Blue Bay Cup - Supabase Setup Guide

## Overview
This guide walks you through integrating your Supabase PostgreSQL database with the Next.js Blue Bay Cup application.

## Database Schema
Your database has the following tables:
- **players**: `player_id` (PK), `name`
- **seasons**: `season_id` (PK), `year`, `prize_pool`
- **teams**: `team_id` (PK), `player_id` (FK), `season_id` (FK), `team_name`
- **team_stats**: `team_id` (FK), `gameweek`, `rank`, `total_points`, `wins`, `draws`, `losses`, `goals_for`, `goals_against`

## Setup Steps

### 1. Get Supabase Credentials
1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **Settings** > **API**
4. Copy these values:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon public key** (starts with `eyJ...`)

### 2. Create Environment Variables
Create a `.env.local` file in your project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

⚠️ **Important**: Never commit this file to Git. It's already in `.gitignore`.

### 3. Database Setup
Ensure your Supabase database tables are created with the schema above. If not already done:

1. Go to **SQL Editor** in Supabase
2. Run the SQL from `lib/supabase/modify_data.sql` (if you have one)
3. Verify tables exist in **Table Editor**

### 4. API Routes
The following API routes are already created:

- `GET /api/bluebaycup/seasons` - List all seasons
- `GET /api/bluebaycup/overall` - Overall player statistics
- `GET /api/bluebaycup/season/[seasonId]` - Season standings
- `GET /api/bluebaycup/season/[seasonId]/progress` - Gameweek progression
- `GET /api/bluebaycup/season/[seasonId]/team/[teamId]` - Team gameweek data

### 5. Component Integration
The `BlueBayCup` component now fetches real data:
- `fetchSeasons()` - Loads seasons from database
- `fetchOverallData()` - Calculates overall stats
- `fetchSeasonData(seasonId)` - Gets season-specific standings
- `fetchProgressData(seasonId)` - Gets rank/points progression per gameweek
- `fetchTeamGameweekData(seasonId, teamId)` - Gets points for/against per gameweek

### 6. Test the Integration
1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to `/bluebaycup`
3. Check browser console for errors
4. Verify data loads from your database

## Troubleshooting

### "Failed to fetch" errors
- Check `.env.local` has correct Supabase URL and key
- Verify environment variables don't have quotes or extra spaces
- Restart development server after changing `.env.local`

### Empty data / No seasons showing
- Check that your database has data in all tables
- Verify foreign key relationships are correct (player_id, season_id, team_id)
- Check Supabase logs in dashboard under **Logs** > **Postgres**

### API route errors
- Check browser network tab for API response errors
- Check terminal for server-side errors
- Verify table names match exactly (case-sensitive)

### Type errors
- Database types are defined in `lib/supabase/bluebaycup.ts`
- If schema changes, update interfaces there
- Frontend types are in `components/bluebaycup/types.ts`

## Sample Data Format

### Expected table structure:

**players:**
```
player_id | name
----------|--------
1         | Hugo
2         | Alice
```

**seasons:**
```
season_id | year      | prize_pool
----------|-----------|----------
1         | 2023/24   | 1000
```

**teams:**
```
team_id | player_id | season_id | team_name
--------|-----------|-----------|------------
1       | 1         | 1         | Hugo's Team
```

**team_stats:**
```
team_id | gameweek | rank | total_points | wins | draws | losses | goals_for | goals_against
--------|----------|------|--------------|------|-------|--------|-----------|---------------
1       | 1        | 1    | 3            | 1    | 0     | 0      | 75        | 50
1       | 2        | 2    | 4            | 1    | 1     | 0      | 68        | 68
```

## Next Steps

1. Add sample data to your database
2. Test each API endpoint individually
3. Navigate to `/bluebaycup` to see the dashboard
4. Monitor for any errors in console/network tabs

## Deployment to Vercel

When deploying to Vercel:
1. Go to your Vercel project settings
2. Navigate to **Environment Variables**
3. Add both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Redeploy your application

The environment variables will be automatically available to your Next.js app.

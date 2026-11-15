# Tips master plan (wigh.nu/tips)

> Planning document, written 15 November 2026. Nothing here is implemented yet. The build follows the milestones in section 11.

## 1. Context

A football prediction pool ("tips") at `wigh.nu/tips`, replacing the Excel form the group has used for Euros and World Cups (`docs/tips/VM-tips 2026 - Formulär.xlsm`). The first tournament is a trial: the FIFA Women's World Cup 2027 in Brazil (32 teams, 8 groups of 4, top two to a round of 16, 64 matches, third-place match, 24 June to 25 July 2027). Later tournaments use other formats (24-team Euros, 48-team World Cups), so schema and routes are multi-tournament and multi-format from the start.

The work is split in two stages:

- **Stage 1, the pool itself:** accounts, joining, predictions, results, scoring, leaderboard, status, career table, admin, archive, social.
- **Stage 2, analysis:** odds, Monte Carlo win probabilities, "recalculate now". Built after Stage 1 works. Stage 1 contains the seams Stage 2 needs (section 9.1) so nothing has to be reworked.

## 2. Decisions

### 2.1 Changed or added after review (these override the original list)

| # | Topic | Decision |
|---|---|---|
| A | Late-decided matches | **Spreadsheet rule.** A match counts iff the outcome at 85:00 (home lead / level / away lead) differs from the final outcome including extra time and penalties. One rule for group and knockout matches. Replaces decision 18's "any knockout match that goes to extra time counts". |
| B | Numeric bonus scoring | Base `B = 0.75 × N`. Exact answer = `B`. Otherwise `0.75 × B × max(0, 1 − error/T)` with a tolerance `T` per question. Independent of other players, so no tie rule is needed. |
| C | Retention | **No purge, no tiers.** One tournament is about 2,500 rows (under 1 MB); 0.5 GB holds hundreds. Archiving freezes the tournament and snapshots final ranks. Archived tournaments stay fully browsable read-only. Excel export is a download button generated on demand, so `archive_file_url` is dropped. Replaces decisions 6, 19 (tiering) and 20 (purge). |
| D | Supabase | Same project, new `tips` schema next to `fpl` and `ica`. **Before sign-up is enabled the ICA policies must be fixed** (section 3). |
| E | Joining | Anyone can create an account. Joining a tournament needs a per-tournament join code, checked in the database. Admin can remove a participant; scores recompute because they are views. |
| F | Stage picks | Free picks like the spreadsheet: only the number of teams per stage is enforced, not consistency between stages. |
| G | Language | Swedish and English, switchable. Team names and bonus question texts exist in both. |
| H | Last match with 4+ goals | Kept, as a **choice** question (final / bronze match / a semi-final / a quarter-final / earlier or none), exact match, like the spreadsheet. In Stage 2 it is simulated with one historical base rate per knockout match, so it needs no scoreline model. |
| I | Bonus definitions | Texts and hints stay in code (`lib/tournaments/<slug>/bonusQuestions.ts`). **Answer type, tolerance, active flag and correct answer live in the database** (`tips.bonus_questions`), because the SQL scoring views (decision 14) and the Python simulation both need them. This merges the planned `tournament_bonus_answers` table into one. |
| J | API placement | Player-facing reads and writes go straight from the browser to Supabase with the user's session, so RLS is the enforcement. Admin actions go through the existing FastAPI app with the shared admin cookie pattern. |

### 2.2 Assumptions (say so if any is wrong)

1. **Medal bonus with free picks:** awarded iff the champion pick is the real champion, the bronze pick is the real third-place winner, and both real finalists are among the player's two finalist picks.
2. **Doubling:** picks for quarter-final, semi-final, final, bronze winner and champion all score double. Only the first knockout round (and the round of 16 in 48-team formats) is single.
3. **N** = everyone who has joined the tournament. Missing picks score 0. No-shows are removed by the admin.
4. **Ties** share a rank (1, 1, 3), so two players can both get gold.
5. **After the deadline** everyone's picks are readable by anyone, logged in or not. The public leaderboard needs them, and display names are public there anyway.
6. **Money** (stake, 50/30/20 split) stays outside the site.
7. **Goals** in bonus questions include extra time and exclude penalty shootouts, as in the spreadsheet.
8. **Team-answer questions can have several correct answers** (two teams tied for most goals). All tied answers score full points.

### 2.3 Unchanged from the original list

Routes and tabs (1 to 5), Supabase Auth with email, display name, password and verification through our own SMTP (7), shared admin login reused from BlueBayCup (8), one global deadline with editable picks (9), RLS-enforced secrecy before the deadline (10), prediction types (11), scoring formulas (12), per-tournament stage config (13), scoring as SQL views (14), per-competition baselines (17), the WWC 2027 question set minus "total QF goals" (18), no historical import (21), per-tournament feed with posts, replies, likes (22), manual result override always available (23), simulation in GitHub Actions with two modes (27).

## 3. Problems found in the original decisions

1. **ICA data would be exposed.** `docs/schemas/ica-schema.sql` grants full read/write on the grocery tables to any `authenticated` user. Today nobody can sign up; with public sign-up every tips user could read and edit them. Fix before enabling sign-up: drop the three `authenticated_all` policies and revoke the `authenticated` grants (the FastAPI ICA router already uses the service key, `api/ica_tracking.py:201`). Also check that RLS is on for every `public` table, `admin_credentials` in particular.
2. **Vercel's 10 s timeout is outdated.** Hobby functions now run up to 300 s. Cron is still once per day, within a ±59 minute window.
3. **the-odds-api has no stage markets.** Its `outrights` market is "final outcome of a tournament" only; there are no "reach the quarter-final/semi-final/final" odds. It lists `soccer_fifa_world_cup_womens` (match odds) but no women's winner key today. Decision 24's "devigged outright stage odds, renormalised among survivors" cannot be built as written. Stage 2 uses a team-strength model instead (section 9.3).
4. **Supabase's built-in email is unusable**, not just rate limited: 2 emails per hour and only to addresses on the project team. Custom SMTP is mandatory.
5. **Two scoring implementations.** The leaderboard is SQL, the simulation is numpy. They will drift unless checked. Every simulation run first scores the real results with the numpy scorer and fails if it differs from `tips.leaderboard`.
6. **football-data.org:** confirmed. The Women's World Cup is `TIER_TWO` (paid); the men's World Cup and Euros are `TIER_ONE` (free), so future men's tournaments can use it.
7. **The draw will contain placeholders.** Three places are decided in the inter-confederation play-offs in February 2027, and the UEFA play-offs end on 5 December 2026. Placeholder teams are seeded as normal team rows and renamed in place later; picks point at the team id, so nothing breaks. Sweden's own place is still open, which is what the `active` flag on the Sweden question is for.
8. **Euros have no third-place match.** `has_third_place_match` exists in the config; the bronze pick and the medal bonus need a rule for that format when the first Euros is set up. Not needed for 2027.
9. **Best-third formats** need the official third-place allocation table for bracket wiring. Stage 1 does not need it (the admin or the sync fills in real knockout fixtures); the Stage 2 simulation does for those formats.
10. **GitHub cron is best effort.** Runs are often delayed 10 to 30 minutes and can be dropped at the top of the hour. Results will appear with a lag; manual entry is the instant path.
11. **Draw day is 26 days away, but nothing forces predictions to open that day.** Picks are editable until June and three teams are unknown until February. The real hard date is the lock on 24 June 2027. Milestones below aim at a soft opening in December and the invite to friends in March.

## 4. Verified limits (November 2026)

| Service | Fact |
|---|---|
| Vercel Hobby | Function duration 300 s. Cron at most once per day, ±59 min, 100 jobs per project; a more frequent expression fails the deploy. |
| Supabase Free | 0.5 GB database, 2 active projects. Paused after low activity over 7 days. Docs state a 1-year restore window (the dashboard screenshot shows 90 days; plan for 90). Backups are not reliably downloadable on Free. |
| Supabase Auth email | Built-in: 2 per hour, team addresses only. With custom SMTP: 30 per hour by default, adjustable. |
| GitHub Actions | Repo is public: free minutes, but scheduled workflows are disabled after 60 days without repository activity. Shortest interval 5 minutes. |
| the-odds-api | Free: 500 credits per month. Cost = markets × regions per call. `/v4/sports` is free but needs a key. 25 bookmakers in `eu`. |
| Resend | Free: 3,000 emails per month, 100 per day. |
| ESPN (unofficial) | `site.api.espn.com/apis/site/v2/sports/soccer/fifa.wwc/scoreboard?dates=YYYYMMDD` returns Women's World Cup results with goal minutes. Checked against the 2023 final. No key, no guarantee. |

## 5. Architecture

```
Browser ── supabase-js (user session, RLS) ──► Supabase  schema `tips`
   │                                               ▲   ▲
   └── /api/tips/admin/* ─► FastAPI (admin cookie, service key)
                                                       │
GitHub Actions ── scripts/tips/*.py (service key) ─────┘   results sync, Stage 2 simulation
Vercel cron (daily) ─► /api/tips/keepalive                 keeps Supabase awake
```

- **Player side:** client components using `createSupabaseBrowserClient()` (`lib/supabase/client.ts`, exists, currently unused) with `.schema('tips')`. No `proxy.ts`; the session lives and refreshes in the browser. One server route handler exchanges email-confirmation and password-reset tokens.
- **Admin side:** new `api/tips.py` `APIRouter(prefix="/api/tips")`, included in `api/index.py`, with a rewrite in `vercel.json`, exactly as CLAUDE.md prescribes. Auth reuses `require_admin_cookie`, `authenticate_admin`, `set_admin_cookie` from `api/admin_auth.py` with its own cookie name `tips_admin_session` (same shape as `api/ica_tracking.py:24`). Data access through `admin_client()` from `api/clients.py`.
- **Scripts:** `scripts/tips/*.py` use `from api import admin_client`, run by GitHub Actions modelled on `.github/workflows/bluebaycup-update.yml` (uv, concurrency group, ntfy push).
- **Before writing Next.js code:** read `node_modules/next/dist/docs/` as `AGENTS.md` requires (Next 16).

## 6. Database schema (`docs/schemas/tips-schema.sql`)

Add `tips` to the exposed schemas in Supabase API settings.

### 6.1 Tables

```sql
create schema if not exists tips;

create table tips.profiles (
  user_id      uuid primary key references auth.users on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 2 and 40),
  created_at   timestamptz not null default now()
);
create unique index profiles_display_name_key on tips.profiles (lower(display_name));

create table tips.tournaments (
  id                    bigint generated always as identity primary key,
  slug                  text not null unique check (slug ~ '^[a-z0-9]+$'),
  name                  text not null,
  competition_type      text not null check (competition_type in ('wwc','wc','euro','weuro')),
  status                text not null default 'draft' check (status in ('draft','active','archived')),
  prediction_deadline   timestamptz not null,
  -- format config
  groups_count          int not null,
  advance_per_group     int not null default 2,
  best_thirds           int not null default 0,          -- 0 for WWC 2027
  has_third_place_match boolean not null default true,
  external_refs         jsonb not null default '{}',     -- e.g. {"espn":"fifa.wwc","odds":"soccer_fifa_world_cup_womens"}
  archived_at           timestamptz
);

-- No policies and no grants: service role only.
create table tips.tournament_secrets (
  tournament_id bigint primary key references tips.tournaments on delete cascade,
  join_code     text not null
);

-- One row per advancement stage a player picks. The first row (lowest sort_order)
-- is the first knockout round, which is picked per group.
create table tips.tournament_stages (
  tournament_id bigint  not null references tips.tournaments on delete cascade,
  stage         text    not null check (stage in ('r32','r16','qf','sf','final','bronze','champion')),
  sort_order    int     not null,
  slots         int     not null,             -- number of teams to pick
  multiplier    numeric not null default 1,   -- 2 from the quarter-final on
  primary key (tournament_id, stage)
);
-- wwc2027: r16 16 ×1 | qf 8 ×2 | sf 4 ×2 | final 2 ×2 | bronze 1 ×2 | champion 1 ×2
-- wc 48:   r32 32 ×1 | r16 16 ×1 | qf 8 ×2 | ...
-- euro 24: r16 16 ×1 | qf 8 ×2 | sf 4 ×2 | final 2 ×2 | champion 1 ×2

create table tips.tournament_participants (
  tournament_id bigint not null references tips.tournaments on delete cascade,
  user_id       uuid   not null references tips.profiles on delete cascade,
  joined_at     timestamptz not null default now(),
  primary key (tournament_id, user_id)
);

-- Frozen final standings; the career table reads only this.
create table tips.tournament_history (
  tournament_id bigint  not null references tips.tournaments on delete cascade,
  user_id       uuid    not null references tips.profiles on delete cascade,
  final_rank    int     not null,
  final_points  numeric not null,
  primary key (tournament_id, user_id)
);

create table tips.teams (
  id      bigint generated always as identity primary key,
  code    text not null unique,     -- FIFA code, or a placeholder code such as 'IC1'
  name_sv text not null,
  name_en text not null
);

create table tips.tournament_teams (
  tournament_id bigint not null references tips.tournaments on delete cascade,
  team_id       bigint not null references tips.teams,
  group_letter  char(1) not null,
  fifa_rank     int,                              -- as shown to players; no edits after the deadline
  external_refs jsonb not null default '{}',      -- provider team names/ids
  primary key (tournament_id, team_id)
);

create table tips.matches (
  id            bigint generated always as identity primary key,
  tournament_id bigint not null references tips.tournaments on delete cascade,
  match_no      int    not null,
  stage         text   not null check (stage in ('group','r32','r16','qf','sf','bronze','final')),
  group_letter  char(1),
  kickoff       timestamptz not null,
  home_team_id  bigint,
  away_team_id  bigint,
  home_source   text,        -- bracket wiring: '1A', '2B', 'W49', 'L61'
  away_source   text,
  home_score    int,         -- end of play incl. extra time, excl. shootout; null = not played
  away_score    int,
  home_pens     int,
  away_pens     int,
  late_decided  boolean,     -- decision A
  result_locked boolean not null default false,   -- set by a manual edit; the sync skips locked rows
  external_refs jsonb not null default '{}',
  unique (tournament_id, match_no),
  unique (tournament_id, id),                      -- target for the composite FK from predictions_match
  foreign key (tournament_id, home_team_id) references tips.tournament_teams (tournament_id, team_id),
  foreign key (tournament_id, away_team_id) references tips.tournament_teams (tournament_id, team_id),
  check ((home_score is null) = (away_score is null))
);

create table tips.predictions_match (
  tournament_id bigint not null,
  user_id       uuid   not null,
  match_id      bigint not null,
  pick          char(1) not null check (pick in ('1','X','2')),
  updated_at    timestamptz not null default now(),
  primary key (user_id, match_id),
  -- Composite on purpose: the lock check uses tournament_id, so a pick must not be able to
  -- name an open tournament while pointing at a locked tournament's match.
  foreign key (tournament_id, match_id) references tips.matches (tournament_id, id) on delete cascade,
  foreign key (tournament_id, user_id) references tips.tournament_participants on delete cascade
);

create table tips.predictions_advancement (
  tournament_id bigint not null,
  user_id       uuid   not null,
  stage         text   not null,
  team_id       bigint not null,
  primary key (tournament_id, user_id, stage, team_id),
  foreign key (tournament_id, user_id)  references tips.tournament_participants on delete cascade,
  foreign key (tournament_id, stage)    references tips.tournament_stages,
  foreign key (tournament_id, team_id)  references tips.tournament_teams
);

-- Decision I: type, tolerance and the admin-entered answer. Text lives in code by question_key.
create table tips.bonus_questions (
  tournament_id   bigint not null references tips.tournaments on delete cascade,
  question_key    text   not null,
  answer_type     text   not null check (answer_type in ('number','team','choice')),
  tolerance       numeric check ((answer_type = 'number') = (tolerance is not null)),
  sort_order      int    not null,
  active          boolean not null default true,   -- false = dropped (Sweden not qualified)
  correct_number  numeric,
  correct_teams   bigint[],                        -- several if tied
  correct_choices text[],
  primary key (tournament_id, question_key)
);

create table tips.predictions_bonus (
  tournament_id  bigint not null,
  user_id        uuid   not null,
  question_key   text   not null,
  answer_number  numeric,
  answer_team_id bigint,
  answer_choice  text,
  primary key (tournament_id, user_id, question_key),
  foreign key (tournament_id, user_id)      references tips.tournament_participants on delete cascade,
  foreign key (tournament_id, question_key) references tips.bonus_questions
);

create table tips.posts (
  id            bigint generated always as identity primary key,
  tournament_id bigint not null references tips.tournaments on delete cascade,
  user_id       uuid   not null references tips.profiles on delete cascade,
  parent_id     bigint references tips.posts on delete cascade,
  body          text   not null check (char_length(btrim(body)) between 1 and 2000),
  created_at    timestamptz not null default now()
);
create table tips.post_likes (
  post_id bigint not null references tips.posts on delete cascade,
  user_id uuid   not null references tips.profiles on delete cascade,
  primary key (post_id, user_id)
);
```

### 6.2 Functions and triggers

```sql
-- Predictions are frozen once the deadline has passed or the tournament is archived.
create function tips.is_locked(p_tournament bigint) returns boolean
language sql stable set search_path = '' as $$
  select coalesce((select now() >= prediction_deadline or status = 'archived'
                   from tips.tournaments where id = p_tournament), true)
$$;

-- Profile row from sign-up metadata. Guarded so other features can use Auth in this project.
create function tips.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.raw_user_meta_data ? 'display_name' then
    insert into tips.profiles (user_id, display_name)
    values (new.id, btrim(new.raw_user_meta_data->>'display_name'));
  end if;
  return new;
end $$;
create trigger tips_on_auth_user_created after insert on auth.users
  for each row execute function tips.handle_new_user();

-- Decision E: the only way to become a participant.
create function tips.join_tournament(p_slug text, p_code text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_id bigint;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select t.id into v_id
  from tips.tournaments t join tips.tournament_secrets s on s.tournament_id = t.id
  where t.slug = p_slug and t.status = 'active'
    and now() < t.prediction_deadline and s.join_code = p_code;
  if v_id is null then raise exception 'invalid code or tournament closed'; end if;
  insert into tips.tournament_participants (tournament_id, user_id)
  values (v_id, auth.uid()) on conflict do nothing;
end $$;
revoke execute on function tips.join_tournament(text, text) from public, anon;
grant  execute on function tips.join_tournament(text, text) to authenticated;

-- Decision F: only counts are enforced. Total per stage, and per group for the first knockout stage.
create function tips.check_stage_pick() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select count(*) from tips.predictions_advancement a
      where a.tournament_id = new.tournament_id and a.user_id = new.user_id and a.stage = new.stage)
     > (select slots from tips.tournament_stages s
        where s.tournament_id = new.tournament_id and s.stage = new.stage) then
    raise exception 'too many picks for stage %', new.stage;
  end if;
  if new.stage = (select stage from tips.tournament_stages s
                  where s.tournament_id = new.tournament_id order by sort_order limit 1)
     and (select count(*) from tips.predictions_advancement a
          join tips.tournament_teams tt using (tournament_id, team_id)
          where a.tournament_id = new.tournament_id and a.user_id = new.user_id and a.stage = new.stage
            and tt.group_letter = (select group_letter from tips.tournament_teams x
                                   where x.tournament_id = new.tournament_id and x.team_id = new.team_id))
         > (select advance_per_group + (best_thirds > 0)::int from tips.tournaments t
            where t.id = new.tournament_id) then
    raise exception 'too many picks from one group';
  end if;
  return new;
end $$;
create trigger check_stage_pick after insert or update on tips.predictions_advancement
  for each row execute function tips.check_stage_pick();
```

### 6.3 RLS and grants

RLS is enabled on every table in `tips`.

| Table | select | write |
|---|---|---|
| `tournaments` | anyone, `status <> 'draft'` | service role |
| `tournament_secrets` | nobody | service role |
| `tournament_stages`, `teams`, `tournament_teams`, `matches`, `bonus_questions`, `tournament_history`, `tournament_participants`, `profiles` | anyone | service role, except: `profiles` owner may update `display_name`; `tournament_participants` owner may delete their own row before lock (leaving also deletes their picks) |
| `predictions_match`, `predictions_advancement`, `predictions_bonus` | own rows, or everyone once `tips.is_locked(tournament_id)` | owner only, only while not locked |
| `posts`, `post_likes` | signed-in users | insert as yourself if you are a participant; delete your own |

```sql
-- The three prediction tables share this pair of policies.
create policy read_own_or_locked on tips.predictions_match for select to anon, authenticated
  using (user_id = (select auth.uid()) or tips.is_locked(tournament_id));
create policy write_own_until_locked on tips.predictions_match for all to authenticated
  using      (user_id = (select auth.uid()) and not tips.is_locked(tournament_id))
  with check (user_id = (select auth.uid()) and not tips.is_locked(tournament_id));

create policy post_as_participant on tips.posts for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from tips.tournament_participants p
    where p.tournament_id = posts.tournament_id and p.user_id = (select auth.uid())));

grant usage on schema tips to anon, authenticated, service_role;
grant select on all tables in schema tips to anon, authenticated;
revoke all on tips.tournament_secrets from anon, authenticated;
grant insert, update, delete on tips.predictions_match, tips.predictions_advancement,
      tips.predictions_bonus, tips.posts, tips.post_likes to authenticated;
grant delete on tips.tournament_participants to authenticated;
grant update (display_name) on tips.profiles to authenticated;
grant all on all tables in schema tips to service_role;
```

The deadline is checked against the database clock, never the browser's. Being a participant is enforced by the foreign key from each prediction table to `tournament_participants`.

### 6.4 Scoring views

All views are `security_invoker`, so RLS still applies: before the deadline a caller sees only their own picks (no match has been played, so no points exist yet), afterwards everyone sees everything.

```sql
create view tips.v_n with (security_invoker = true) as
  select tournament_id, count(*)::numeric as n from tips.tournament_participants group by 1;

-- (a) Group 1X2: 0.5 × (1 + 2N − C), C = players with the same correct pick
create view tips.v_match_points with (security_invoker = true) as
  select p.tournament_id, p.user_id, p.match_id,
         0.5 * (1 + 2 * n.n - count(*) over (partition by p.match_id)) as points
  from tips.predictions_match p
  join tips.matches m on m.id = p.match_id and m.stage = 'group' and m.home_score is not null
  join tips.v_n n using (tournament_id)
  where p.pick = case when m.home_score > m.away_score then '1'
                      when m.home_score < m.away_score then '2' else 'X' end;

-- Fact table: team reached stage. Presence in a knockout fixture = reached that round;
-- winner of the final = champion; winner of the third-place match = bronze.
create view tips.v_team_stage with (security_invoker = true) as
  select tournament_id, stage, home_team_id as team_id from tips.matches
   where stage in ('r32','r16','qf','sf','final') and home_team_id is not null
  union
  select tournament_id, stage, away_team_id from tips.matches
   where stage in ('r32','r16','qf','sf','final') and away_team_id is not null
  union
  select tournament_id, case stage when 'final' then 'champion' else 'bronze' end,
         case when home_score > away_score or home_pens > away_pens then home_team_id
              when home_score < away_score or home_pens < away_pens then away_team_id end
  from tips.matches where stage in ('final','bronze') and home_score is not null;

-- (b) Advancement: same formula × stage multiplier
create view tips.v_advancement_points with (security_invoker = true) as
  select a.tournament_id, a.user_id, a.stage, a.team_id,
         s.multiplier * 0.5 * (1 + 2 * n.n
           - count(*) over (partition by a.tournament_id, a.stage, a.team_id)) as points
  from tips.predictions_advancement a
  join tips.v_team_stage r      using (tournament_id, stage, team_id)
  join tips.tournament_stages s using (tournament_id, stage)
  join tips.v_n n               using (tournament_id);

-- (c) Bonus: decision B for numbers, exact match for team and choice
create view tips.v_bonus_points with (security_invoker = true) as
  select b.tournament_id, b.user_id, b.question_key,
         0.75 * n.n * case q.answer_type
           when 'number' then case
             when b.answer_number = q.correct_number then 1
             else 0.75 * greatest(0, 1 - abs(b.answer_number - q.correct_number) / q.tolerance) end
           when 'team'   then (b.answer_team_id = any (q.correct_teams))::int
           when 'choice' then (b.answer_choice  = any (q.correct_choices))::int
         end as points
  from tips.predictions_bonus b
  join tips.bonus_questions q using (tournament_id, question_key)
  join tips.v_n n             using (tournament_id)
  where q.active
    and coalesce(q.correct_number::text, q.correct_teams::text, q.correct_choices::text) is not null;

-- (d) Medal bonus, assumption 1
create view tips.v_medal_points with (security_invoker = true) as
  select p.tournament_id, p.user_id, 0.75 * n.n as points
  from tips.tournament_participants p join tips.v_n n using (tournament_id)
  where (select count(*) from tips.predictions_advancement a
         join tips.v_team_stage r using (tournament_id, stage, team_id)
         where a.tournament_id = p.tournament_id and a.user_id = p.user_id
           and a.stage in ('champion','bronze')) = 2
    and (select count(*) from tips.predictions_advancement a
         join tips.v_team_stage r using (tournament_id, stage, team_id)
         where a.tournament_id = p.tournament_id and a.user_id = p.user_id
           and a.stage = 'final') = 2;

create view tips.leaderboard with (security_invoker = true) as
  with t as (
    select p.tournament_id, p.user_id,
      coalesce((select sum(points) from tips.v_match_points x
                where x.tournament_id = p.tournament_id and x.user_id = p.user_id), 0) as match_points,
      coalesce((select sum(points) from tips.v_advancement_points x
                where x.tournament_id = p.tournament_id and x.user_id = p.user_id), 0) as advancement_points,
      coalesce((select sum(points) from tips.v_bonus_points x
                where x.tournament_id = p.tournament_id and x.user_id = p.user_id), 0) as bonus_points,
      coalesce((select sum(points) from tips.v_medal_points x
                where x.tournament_id = p.tournament_id and x.user_id = p.user_id), 0) as medal_points
    from tips.tournament_participants p)
  select t.*, pr.display_name,
         match_points + advancement_points + bonus_points + medal_points as total,
         rank() over (partition by tournament_id
                      order by match_points + advancement_points + bonus_points + medal_points desc) as rank
  from t join tips.profiles pr using (user_id);

create view tips.career with (security_invoker = true) as
  select h.user_id, pr.display_name,
         count(*)                               as appearances,
         count(*) filter (where final_rank = 1) as gold,
         count(*) filter (where final_rank = 2) as silver,
         count(*) filter (where final_rank = 3) as bronze,
         min(final_rank)                        as best_finish
  from tips.tournament_history h join tips.profiles pr using (user_id)
  group by 1, 2;
```

The per-pick views return one row per scoring pick, so the UI can show points next to each pick and Stage 2 can compare component by component.

### 6.5 WWC 2027 bonus questions (seed)

| `question_key` | Type | T | Note |
|---|---|---|---|
| `sweden_goals` | number | 4 | `active = false` if Sweden does not qualify |
| `top_scoring_team` | team | – | several correct answers if tied |
| `top_scorer_goals` | number | 3 | |
| `late_decided_matches` | number | 6 | rule in decision A; answer = count of `matches.late_decided` |
| `group_matches_5plus_goals` | number | 4 | |
| `lowest_rank_in_qf` | number | 15 | the largest FIFA ranking number among the eight quarter-finalists, from `tournament_teams.fifa_rank` |
| `last_match_4plus_goals` | choice | – | `final`, `bronze`, `sf`, `qf`, `earlier_or_none` |

Tolerances are seed data and can be tuned before predictions open.

## 7. Routes and components

```
app/tips/layout.tsx                    data-project="tips" (new pop colour: add --a-tips to DESIGN.md first, then globals.css)
app/tips/page.tsx                      career table + tournament list
app/tips/login/page.tsx                sign in / sign up / forgot password
app/tips/account/page.tsx              display name, new password
app/tips/auth/confirm/route.ts         email-confirm and recovery token exchange, then redirect
app/tips/[slug]/layout.tsx             tournament header, tab links, language switch, "archived" banner
app/tips/[slug]/page.tsx               redirect: predictions before the deadline, leaderboard after
app/tips/[slug]/predictions/page.tsx   account required
app/tips/[slug]/status/page.tsx        public; groups / bracket toggle
app/tips/[slug]/leaderboard/page.tsx   public
app/tips/[slug]/social/page.tsx        account required
app/tips/[slug]/admin/page.tsx         shared admin login
```

`components/tips/`

| Component | Does | Reuses |
|---|---|---|
| `TipsAuthGate` | Session check; shows sign-in link, then the join-code card if not a participant | shape of `components/ica-tracking/AuthGate.tsx` |
| `PredictionsForm` → `MatchPicks`, `StagePicks`, `BonusPicks` | 1/X/2 per group match, team pickers per stage with slot counters (first knockout stage grouped by group), bonus inputs. Each change is one upsert/delete; a progress counter shows "62/71". After lock: read-only with points per pick, and a participant selector to view anyone's picks | `Segmented`, `NativeSelect`, `Input`, `Button` from `components/ui` |
| `GroupTables`, `Bracket` | Standings computed in the browser from `matches`; bracket from `home_source`/`away_source` | `Table` |
| `Leaderboard` | Rank, name, four point columns, total. Row click opens that player's picks | `Table`, `MedalBadge` (`components/bluebaycup/MedalBadge.tsx`) |
| `CareerTable` | From `tips.career` | `Table`, `MedalBadge` |
| `Feed` | Posts, one level of replies, likes | |
| `admin/*` | Tabs: Results, Bonus answers, Participants, Tournament | `LoginCard`, patterns from `app/bluebaycup/admin/page.tsx` |

`lib/tips/queries.ts` (typed queries), `lib/tips/i18n.ts` (one `{ sv, en }` dictionary, a `useT()` hook, choice stored in a `tips_lang` cookie, default Swedish; no i18n library), `lib/tournaments/<slug>/bonusQuestions.ts` (text and hints in both languages, choice options), `lib/tournaments/index.ts` (registry by slug).

Shortcuts taken on purpose: group standings use points, goal difference, goals scored only (the admin or the sync sets the real knockout fixtures, so a wrong tie-break in the table cannot affect scoring); a non-blocking warning, not an error, when stage picks are inconsistent.

### Admin API (`api/tips.py`)

| Route | Purpose |
|---|---|
| `POST /api/tips/admin/login`, `GET /check`, `POST /logout` | Same as the ICA and BlueBayCup trio |
| `GET /api/tips/admin/{slug}` | Tournament, join code, participants with pick-completion counts |
| `PATCH /api/tips/admin/{slug}` | Deadline, status, join code |
| `PATCH /api/tips/admin/matches/{id}` | Scores, penalties, `late_decided`, knockout teams; sets `result_locked` |
| `PATCH /api/tips/admin/{slug}/teams/{team_id}` | Rename a placeholder, set FIFA rank (refused after the deadline) |
| `PUT /api/tips/admin/{slug}/bonus/{question_key}` | Correct answer, `active` |
| `DELETE /api/tips/admin/{slug}/participants/{user_id}` | Remove a participant and their picks |
| `POST /api/tips/admin/{slug}/archive` | Section 8.3 |
| `GET /api/tips/{slug}/export.xlsx` | Public, on demand, built with the **anon** client so RLS decides what it may contain |
| `GET /api/tips/keepalive` | One trivial select, called by Vercel cron |

New tournaments are created by a seed script, not an admin form: `scripts/tips/seed.py <slug>` reads `scripts/tips/data/<slug>.json` (tournament, stages, teams, groups, matches with bracket sources, bonus questions) and upserts. It is safe to re-run, which is how placeholders and FIFA ranks get updated. It refuses a deadline later than the first kickoff.

## 8. Pipelines and operations

### 8.1 Accounts and email

Provider: **Resend** (free tier covers this many times over).

1. Resend: add the domain `wigh.nu`. Add the DNS records it shows: an MX and an SPF TXT on `send.wigh.nu`, a DKIM TXT on `resend._domainkey.wigh.nu`. These do not touch the root MX that the existing mailbox uses. Add a `_dmarc` TXT if none exists.
2. Resend: create an API key limited to sending.
3. Supabase → Authentication → SMTP: host `smtp.resend.com`, port 465, user `resend`, password = the API key, sender `tips@wigh.nu`.
4. Supabase → Authentication → URL configuration: site URL `https://wigh.nu`; redirect URLs `https://wigh.nu/tips/**` and `http://localhost:3000/tips/**`.
5. Turn on "Confirm email". Change the confirm and recovery templates to link to `/tips/auth/confirm?token_hash=…&type=…`, with Swedish and English text in the same mail.
6. Send test mails to a Gmail and a Hotmail address and check they are not in spam.
7. Only now enable sign-ups, and only after the ICA fix in section 3.

### 8.2 Results

1. **Manual entry first** (milestone M3). It must exist anyway and is enough to run the tournament: 64 matches, a score and one checkbox each.
2. **Automatic sync second** (M5): `scripts/tips/sync_results.py`, run by `.github/workflows/tips-results-sync.yml` every 15 minutes in June and July plus `workflow_dispatch`.
   - Exits without calling anything unless some match kicked off more than 105 minutes ago, has no score and is not locked.
   - Reads the ESPN scoreboard for those dates. For finished matches it writes the score, penalties, the knockout teams once known, and `late_decided` computed from goal minutes (state after all goals up to and including minute 85 versus the final outcome).
   - Sends an ntfy push per recorded match, as the BlueBayCup workflow does, so the flag can be checked.
   - Never touches a row with `result_locked`.
   - The late-decided function is pure and ships with a test containing the spreadsheet's two worked examples.
3. Future men's tournaments can read football-data.org instead; that is a second fetch function when needed, not an abstraction now.

### 8.3 Archive

`POST /api/tips/admin/{slug}/archive`:

1. Refuse if any match lacks a score or any active bonus question lacks an answer.
2. Copy `rank` and `total` from `tips.leaderboard` into `tournament_history`.
3. Set `status = 'archived'`, `archived_at = now()`. `is_locked` now holds permanently; all tabs keep working read-only and show an "archived" banner with the Excel download.
4. By hand: download the export and commit it to `docs/tips/archive/<slug>.xlsx`. That file is the offline backup of the permanent data.

Export workbook sheets: Standings, Match picks (players × matches), Stage picks, Bonus answers, Results. No social posts. Needs `openpyxl` added to `pyproject.toml`.

### 8.4 Idle periods

- **Supabase:** a daily Vercel cron calls `/api/tips/keepalive` (`"crons"` in `vercel.json`). Vercel cron does not depend on repository activity, unlike the two daily GitHub workflows that keep the project awake today.
- **GitHub:** after 60 quiet days the scheduled workflows are disabled and must be re-enabled by hand in the Actions tab. They only matter during a tournament, so this goes on the new-tournament checklist rather than being automated.
- **If Supabase is paused anyway:** restore from the dashboard (plan on a 90-day window).

### 8.5 New-tournament checklist

Write `scripts/tips/data/<slug>.json` and `lib/tournaments/<slug>/bonusQuestions.ts` → run the seed → re-enable workflows → set the cron months in the two workflow files → set the join code → set status `active`.

## 9. Stage 2: analysis

### 9.1 What Stage 1 already provides for it

| Seam | Where |
|---|---|
| Bracket wiring and stable match numbers | `matches.home_source`, `away_source`, `match_no` |
| Provider ids | `external_refs` on tournaments, tournament_teams, matches |
| Baseline selection | `tournaments.competition_type` |
| Bonus types and tolerances readable from Python | `tips.bonus_questions` |
| Scoring as per-pick views to compare against | section 6.4 |
| Service-key scripts and workflow pattern | `scripts/tips/`, existing workflows |
| Room for more leaderboard columns | `Leaderboard` component |

Stage 2 adds tables and code; it changes no Stage 1 table.

### 9.2 Tables (Stage 2 migration)

```sql
create table tips.odds_cache (
  tournament_id bigint not null references tips.tournaments on delete cascade,
  market        text   not null check (market in ('h2h','outrights')),
  fetched_at    timestamptz not null default now(),
  payload       jsonb  not null,
  primary key (tournament_id, market, fetched_at)
);  -- keep the newest few rows per market
create table tips.simulation_runs (
  id            bigint generated always as identity primary key,
  tournament_id bigint not null references tips.tournaments on delete cascade,
  created_at    timestamptz not null default now(),
  mode          text not null check (mode in ('refresh_and_simulate','simulate_only')),
  iterations    int  not null,
  odds_fetched_at timestamptz
);
create table tips.simulation_results (
  run_id  bigint not null references tips.simulation_runs on delete cascade,
  user_id uuid   not null references tips.profiles on delete cascade,
  p_win numeric not null, p_top3 numeric not null, expected_points numeric not null,
  primary key (run_id, user_id)
);
```
Public read, service-role write.

### 9.3 Model (replaces "outright stage odds")

- **Team ratings** start from FIFA ranking points, which are an Elo-type rating for both the women's and the men's list, giving a win expectancy for any pairing. Draw probability is a function of the rating gap, fitted per competition type.
- **Market correction:** for matches with `h2h` odds, the devigged odds are used as they are, and the ratings are shifted so the model reproduces them; the corrected ratings drive the later rounds. If a winner market exists for the tournament, ratings are also tuned until simulated title chances match it.
- **Group ties** on points are broken at random weighted by rating, because there is no scoreline model.
- **Bonus questions:** goal counts for Sweden and for "top-scoring team" use a goals-per-match rate derived from rating, times simulated matches played. Top scorer tally, 5+ goal matches, late decisions and "last match with 4+ goals" use historical base rates per `competition_type`, kept in `scripts/tips/baselines.py`. Lowest rank in the quarter-finals comes straight from the simulated quarter-finalists.
- **Scoring each iteration:** picks are fixed after the deadline, so points per player for every possible outcome are precomputed into arrays (`[match, outcome, player]`, `[stage, team, player]`); an iteration is then a lookup and a sum.
- **Parity gate:** before simulating, the numpy scorer scores the real results so far and must equal `tips.leaderboard` exactly, or the run fails.

### 9.4 Pipeline

- `scripts/tips/simulate.py`, run by `.github/workflows/tips-simulate.yml` with a `mode` input.
- `refresh_and_simulate`: scheduled twice daily during the tournament. One call for match odds (1 credit) and one for the winner market if it exists (1 credit): at most about 130 credits over the tournament, against 500 per month.
- `simulate_only`: reuses `odds_cache`. Triggered by an admin button → `POST /api/tips/admin/{slug}/simulate` → GitHub `workflow_dispatch` using a fine-grained token (this repo, Actions read/write) in a Vercel env var. Those tokens expire after at most a year; renewing it is on the new-tournament checklist.
- Runs only after the deadline, when all picks are final.
- UI: a "win %" column and a chance-over-time chart on the leaderboard tab (`recharts` is already installed).

### 9.5 To check when Stage 2 starts

Get an API key and call `/v4/sports?all=true` to confirm the women's keys and whether a winner market appears nearer the tournament.

## 10. Verification

- **Scoring:** a script seeds a small fake tournament (4 players, hand-picked results) and asserts `tips.leaderboard` against hand-calculated numbers, including the spreadsheet's own table (N = 25, C = 1 → 25 points) and the numeric bonus table from decision B.
- **RLS:** as player A before the deadline, selecting B's picks returns nothing; after the deadline it returns them and any write is rejected; joining with a wrong code fails; a direct insert into `tournament_participants` fails; `tournament_secrets` is unreadable; an anonymous client can read the leaderboard.
- **Replay:** a draft tournament `test2023` seeded from the 2023 Women's World Cup (ESPN), with a few fake players, run from open → lock → results → archive. This exercises the sync, the late-decided logic, the bracket and the export.
- **Build:** `npm run lint`, `npm run build`, and the admin routes under `npm run dev:vercel` (CLAUDE.md: a plain local import does not prove the Vercel loader is happy).
- **Email:** confirmation and reset mails arrive at Gmail and Hotmail.
- **Stage 2:** the parity gate in 9.3.

## 11. Build order

Today is 15 November 2026.

| Milestone | Target | Contents |
|---|---|---|
| **M0 Foundations** | 22 Nov 2026 | ICA policy fix and RLS audit. Resend and Supabase Auth setup. `tips-schema.sql` applied, `tips` exposed. Scoring and RLS test script passing. |
| **M1 Accounts** | 6 Dec 2026 | Sign up, verify, sign in, reset, account page. `/tips` shell, tournament layout and tabs, join by code, language switch. |
| **M2 Predictions** | 20 Dec 2026 | After the draw on 11 Dec: seed `wwc2027` with three placeholder teams. Predictions form, lock behaviour. Soft opening for you and a few testers. |
| **M3 Tournament view** | 31 Jan 2027 | Admin panel with manual results, bonus answers, participants. Leaderboard, status (groups and bracket), viewing others' picks after lock. `/tips` career table. 2023 replay passes. |
| **M4 Invite** | Mar 2027 | Placeholders renamed after the February play-offs, FIFA ranks updated, Sweden question switched on or off. Join code sent to the group. |
| **M5 Operations** | 15 May 2027 | Results sync workflow with push notices. Archive action and Excel export. Keep-alive cron. Social feed. |
| **M6 Freeze** | 10 Jun 2027 | Final FIFA ranks, deadline set to the first kickoff on 24 June, full dress rehearsal on the replay tournament. Only fixes after this. |
| **S2-M1 Simulation** | June 2027, may slip into the tournament | Odds fetch and cache, model, simulator with parity gate, workflow. |
| **S2-M2 Analysis UI** | after S2-M1 | Win % column, chart, "recalculate now". |
| **Archive** | late July 2027 | Enter bonus answers, archive, commit the export. |

Social sits last in Stage 1 because nothing depends on it; it can also land during the tournament.

## 12. Not verified

- The draw date (11 December 2026, Rio) and Sweden's play-off against Scotland on 1 and 5 December come from page summaries and search snippets, not from FIFA or UEFA directly.
- Whether the-odds-api will offer a women's winner market in 2027 (needs a key to check).
- Whether ESPN will carry the 2027 fixtures under the same `fifa.wwc` path, and when.
- The current RLS state of the `public` BlueBayCup tables (no database access during planning).
- Brevo's free limits (the page did not load); it is only the fallback SMTP provider.

## Sources

- [the-odds-api sports list](https://the-odds-api.com/sports-odds-data/sports-apis.html), [markets](https://the-odds-api.com/sports-odds-data/betting-markets.html), [v4 guide](https://the-odds-api.com/liveapi/guides/v4/), [bookmakers](https://the-odds-api.com/sports-odds-data/bookmaker-apis.html)
- [football-data.org competitions](https://api.football-data.org/v4/competitions)
- [Vercel cron usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing), [Vercel function limits](https://vercel.com/docs/functions/limitations)
- [Supabase paused projects](https://supabase.com/docs/guides/platform/upgrading), [production checklist](https://supabase.com/docs/guides/deployment/going-into-prod), [auth rate limits](https://supabase.com/docs/guides/auth/rate-limits), [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [project pausing FAQ](https://supabase.com/kb/faqs/platform/free-project-pausing)
- [GitHub: disabling and enabling workflows](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows)
- [Resend pricing](https://resend.com/pricing)
- [2027 FIFA Women's World Cup](https://en.wikipedia.org/wiki/2027_FIFA_Women%27s_World_Cup), [qualification](https://en.wikipedia.org/wiki/2027_FIFA_Women%27s_World_Cup_qualification), [UEFA qualification](https://en.wikipedia.org/wiki/2027_FIFA_Women's_World_Cup_qualification_(UEFA)), [FIFA qualifiers page](https://www.fifa.com/en/tournaments/womens/womensworldcup/brazil-2027/qualifiers)

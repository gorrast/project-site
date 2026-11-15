# wigh.nu design rules

These rules apply to every page in `gorrast/project-site`. Reference designs: `Design System.dc.html` (foundations and components), `Blue Bay Cup.dc.html`, `FPL Predictions.dc.html` and `Food Expenses.dc.html` (full data pages built with them). When the code and this file disagree, this file wins. Update this file first if a rule needs to change.

## Principles

1. **One shell, many projects.** All pages share the header, content width, type, spacing and controls. A project gets its character from one pop colour and its own data, not from a custom layout.
2. **Two colours and a pop.** Charcoal `#1E1E1C` and Sand `#D8CBB3` build every page, and every neutral token is a mix of those two. Electric Blue is the site's own pop. Each project replaces it with its own pop for the current selection, the primary action and the highlighted series. Green and red are only for win/loss, up/down and savings/overspend. No gradients: no gradient text, backgrounds, table headers or underline bars.
3. **Numbers are the content.** Figures use Geist Mono with tabular digits and are right-aligned in tables. Units are one size smaller and muted. A missing value shows as `–`, never `0`.
4. **Highlight one, mute the rest.** A chart with many series draws every series in `--series-muted` and one series in `--accent`. The user picks which one. Don't use multi-colour legends for more than three series. **One exception:** Blue Bay Cup's season development chart shows every manager in their own fixed colour (the manager palette below), because comparing the whole league at once is the point of that chart. Picking a name in its legend still brings one line forward and fades the rest.
5. **Flat until it floats.** A card is a surface step plus a 1px `--line` border, with no shadow. Shadows (`--shadow-pop`) are only for menus, tooltips and dialogs. Cards never lift or glow on hover. Only buttons move: every button presses to `scale(0.965)`, the primary button grows to `scale(1.035)` on hover.
6. **Two densities.** Showcase pages (home, project intros) use display type and generous space. Data views use 14px rows, hairline rules, and a caption under each heading that says what the figures cover.
7. **Motion arrives, then gets out of the way.** Headings rise out of a mask, sections settle in as the reader reaches them, groups follow in a quiet stagger. Each plays once on one calm curve. Nothing loops, nothing waits on a click, and `prefers-reduced-motion` turns all of it off. See Motion below.

## Tokens

Replace the `:root` / `.dark` blocks and the hand-copied Tailwind palette in `app/globals.css` with the tokens below. The site is dark by default. Use `next-themes` with `defaultTheme="dark"` and `attribute="class"`, and keep the existing `@custom-variant dark`.

Every text pairing below was checked at 4.5:1 or better on `--page`, `--surface` and `--surface-2` (`--ink-3` also on `--surface-3`), and `--line-strong` at 3:1 against `--page` and `--surface` so field and control borders read as boundaries.

```css
:root, .dark {
  color-scheme: dark;
  --charcoal:#1E1E1C; --sand:#D8CBB3;
  --page:#1E1E1C; --surface:#252522; --surface-2:#2D2C28; --surface-3:#363430;
  --line:#312F2B;          /* hairlines, card edges */
  --line-strong:#746E61;   /* field, select and icon-button borders (3:1) */
  --series-muted:#47443D;  /* muted chart series */
  --ink:#D8CBB3; --ink-2:#B7AC98; --ink-3:#A89E8C;
  --control-track:#181816; --control-thumb:#3E3B36; --shadow-thumb:0 1px 2px rgb(0 0 0/.4);
  --shadow-pop:0 16px 48px rgb(0 0 0/.5);
  /* pop: fill · text · ink on fill */
  --a-home:#2B65F7;      --a-home-t:#5E92FF;      --a-home-on:#fff;      /* Electric Blue, site-wide */
  --a-bbc:#19C3E6;       --a-bbc-t:#19C3E6;       --a-bbc-on:#1E1E1C;    /* Bay Cyan */
  --a-fpl:#F32AA4;       --a-fpl-t:#FF49BA;       --a-fpl-on:#1E1E1C;    /* Hot Magenta */
  --a-playpilot:#8E37E2; --a-playpilot-t:#B778FF; --a-playpilot-on:#fff; /* Ultraviolet */
  --a-food:#F5B700;      --a-food-t:#F5B700;      --a-food-on:#1E1E1C;   /* Saffron */
  /* Food Expenses consumers */
  --c-shared:#F5B700; --c-hugo:#5E92FF; --c-benjamin:#FF49BA; --c-on:#1E1E1C;
  --pos:oklch(.79 .12 150); --neg:oklch(.75 .13 25); --warn:oklch(.82 .11 80);
  --gold:oklch(.80 .11 85); --silver:oklch(.78 .01 80); --bronze:oklch(.68 .09 50);
  --ease-calm:cubic-bezier(.22,.61,.36,1); --ease-out:cubic-bezier(.165,.84,.44,1);
}
.light {
  color-scheme: light;
  --page:#EDE8DD; --surface:#F5F2EC; --surface-2:#E7DFD0; --surface-3:#DED3BE;
  --line:#D8CBB3; --line-strong:#7B7468; --series-muted:#B7AC98;
  --ink:#1E1E1C; --ink-2:#4C4942; --ink-3:#5A554C;
  --control-track:#E4DBCA; --control-thumb:#F9F7F4; --shadow-thumb:0 1px 2px rgb(30 30 28/.16);
  --shadow-pop:0 16px 40px rgb(30 30 28/.16);
  --a-home:#1B53E6;      --a-home-t:#1B53E6;      --a-home-on:#fff;
  --a-bbc:#006A81;       --a-bbc-t:#006A81;       --a-bbc-on:#fff;
  --a-fpl:#BC007B;       --a-fpl-t:#BC007B;       --a-fpl-on:#fff;
  --a-playpilot:#852AD8; --a-playpilot-t:#852AD8; --a-playpilot-on:#fff;
  --a-food:#7D5A00;      --a-food-t:#7D5A00;      --a-food-on:#fff;
  --c-shared:#7D5A00; --c-hugo:#1B53E6; --c-benjamin:#BC007B; --c-on:#fff;
  --pos:oklch(.46 .12 150); --neg:oklch(.49 .16 25); --warn:oklch(.47 .12 75);
  --gold:oklch(.60 .12 80); --silver:oklch(.58 .01 80); --bronze:oklch(.56 .10 50);
}
[data-project]            { --accent: var(--a-home);      --accent-text: var(--a-home-t);      --accent-ink: var(--a-home-on); }
[data-project="bbc"]      { --accent: var(--a-bbc);       --accent-text: var(--a-bbc-t);       --accent-ink: var(--a-bbc-on); }
[data-project="fpl"]      { --accent: var(--a-fpl);       --accent-text: var(--a-fpl-t);       --accent-ink: var(--a-fpl-on); }
[data-project="playpilot"]{ --accent: var(--a-playpilot); --accent-text: var(--a-playpilot-t); --accent-ink: var(--a-playpilot-on); }
[data-project="food"]     { --accent: var(--a-food);      --accent-text: var(--a-food-t);      --accent-ink: var(--a-food-on); }
/* Anything derived from --accent is declared per [data-project], never on :root:
   var() resolves on the element that declares it, so a :root mapping would never
   see a project's pop. <body> carries data-project="home" as the site default. */
[data-project] {
  --accent-soft: color-mix(in srgb, var(--accent) 16%, transparent);
  --primary: var(--accent); --primary-foreground: var(--accent-ink); --ring: var(--accent);
}

/* shadcn mapping so components/ui/* pick up the system */
:root, .dark, .light {
  --background: var(--page); --foreground: var(--ink);
  --card: var(--surface); --card-foreground: var(--ink);
  --popover: var(--surface); --popover-foreground: var(--ink);
  --primary: var(--ink); --primary-foreground: var(--page); /* outside any data-project */
  --secondary: var(--surface-2); --secondary-foreground: var(--ink);
  --muted: var(--surface-2); --muted-foreground: var(--ink-3);
  --border: var(--line); --input: var(--line-strong); --ring: var(--ink-3);
  --destructive: var(--neg);
  --radius: 0.625rem;
}

/* Sections waiting to animate in must still print */
@media print {
  [data-reveal], [data-reveal-heading], [data-stagger] > *, [data-wipe] { opacity:1 !important; transform:none !important; clip-path:none !important; }
  header { position:static !important; backdrop-filter:none !important; }
}
```

**Mix in sRGB, never oklch, when one side is `transparent`.** `color-mix(in oklch, X, transparent)` drags the hue toward 0 in some browsers and tints sand pink. Every wash (`--accent-soft`, the 18% W/L washes, the header background) uses `in srgb`.

**Name clash:** shadcn uses `--accent` for neutral hover backgrounds. This system takes `--accent` for the project colour. When you restyle `components/ui/*`, change `bg-accent` / `hover:bg-accent` / `text-accent-foreground` to `bg-muted` / `hover:bg-muted` / `text-foreground`. Check this again after any `npx shadcn add`.

Expose these to Tailwind under `@theme inline` (`--color-page`, `--color-surface`, `--color-ink-2`, `--color-accent`, …) so the markup reads `bg-surface text-ink-2 border-line`. Don't use raw Tailwind palette classes (`gray-*`, `blue-*`, `purple-*`) or `dark:` pairs in feature code. The tokens already switch with the theme.

Every project's `layout.tsx` wraps its page in `<div data-project="bbc">` (or `fpl`, `playpilot`, `food`). The home page, the index, admin and login use `data-project="home"`, which is Electric Blue.

### Pop colours

| Where | Pop | Brand hex |
|---|---|---|
| Site (home, index, admin) | Electric Blue | `#2F6BFF` (filled as `#2B65F7` so white button text passes 4.5:1) |
| Blue Bay Cup | Bay Cyan | `#19C3E6` |
| FPL Predictions | Hot Magenta | `#F32AA4` |
| PlayPilot | Ultraviolet | `#8E37E2` |
| Food Expenses | Saffron | `#F5B700` |

Use `--accent` for fills, dots, borders and chart series; `--accent-text` for any text in the project colour (links, a highlighted figure); `--accent-ink` for text sitting on an `--accent` fill. Mid-lightness pops fail as text on charcoal, so `--accent` is never a text colour. The pops are designed against charcoal; in light mode each one is a deeper shade of the same hue so it stays readable on sand.

To add a project: pick a saturated hue at least 35° from every existing pop and outside 130–170 and 15–40 (win/loss green and red). Hues between 40 and 120 sit on sand's own hue, so they read as a richer sand rather than a pop; Saffron is the one accepted exception. Then derive `-t` (dark: raise lightness until 4.5:1 on `--surface-2`; light: lower it until 4.5:1 on `--surface-2`) and `-on` (white or charcoal, whichever passes 4.5:1 on the fill). Ultraviolet sits only 36° from Electric Blue; don't add anything between them.

### Manager palette (Blue Bay Cup)

Twelve fixed colours, one per manager, assigned by `player_id` (never by array position) so a manager has the same colour in every chart and season. They replace `PLAYER_COLORS` in `MultiPlayerLineChart.tsx`. Each passes 4.5:1 on `--surface` in dark mode and 3.8:1+ in light mode (they're lines and dots, so 3:1 is the bar).

```css
:root, .dark { --p1:#F97770; --p2:#F2823B; --p3:#D89700; --p4:#B4A900; --p5:#76BA4B; --p6:#12C281;
               --p7:#00BFB7; --p8:#00B8E1; --p9:#59A6FF; --p10:#9C93FF; --p11:#CA83E9; --p12:#E977BB; }
.light       { --p1:#C04442; --p2:#BB5000; --p3:#9A6A00; --p4:#807700; --p5:#478809; --p6:#008C57;
               --p7:#008782; --p8:#0083A3; --p9:#2474CF; --p10:#6E62CD; --p11:#9752B4; --p12:#B2468A; }
```

Use them only where every manager is drawn at once. Everywhere else a manager is `--accent` (selected) or `--series-muted`.

### Food Expenses consumers

Person colours are data identities and mean the same thing in every view: shared is Saffron (the page's own pop, since shared spending is what the page is about), Hugo is Electric Blue, Benjamin is Hot Magenta. Benjamin was green; green is `--pos`, which this page uses for discounts, so it can't also be a person. Total lines use `--ink`, the target line is a dashed `--neg`. Use the `--c-*` tokens, never literal hex, so they switch with the theme.

## Motion

Port `components/ui/Motion.tsx` from `gorrast/DH2465` as-is (`motion` and `gsap` with `SplitText`). It already respects `useReducedMotion` and finishes animations when content takes focus. The design files use `motion.js`, a dependency-free copy with the same timings, driven by `data-reveal`, `data-reveal-heading`, `data-stagger` and `data-wipe` attributes.

| Pattern | Use on | Spec |
|---|---|---|
| `RevealHeading` | Page h1 and every section h2 | Masked line rise, `yPercent 110 → 0`, 1.2s, `power3.out`, lines 0.14s apart, starts at 25% in view |
| `RevealSection` | Each section below the fold | Opacity 0 → 1, y 28 → 0, 1.0s, `--ease-calm`, once, `-8%` bottom margin. Sections already in view on load don't animate |
| `MetricGroup` (stagger) | Stat and champion cards, card grids, pitch rows (0.08s), table rows (0.03–0.04s) | Opacity 0 → 1, y 16 → 0, 0.6s, `--ease-calm`, 0.11s apart unless noted |
| `ActionButton` | Primary buttons | Hover 1.035, press 0.965, 0.26s `--ease-calm`. Other buttons press only |
| Chart entry | Line and bar charts | Recharts' own animation, tuned (below) |
| View switch | All-time ↔ Season, Food Expenses tabs | Incoming view rises 12px and fades in, 0.5s |
| Theme switch | Theme toggle | View-transition cross-fade, 0.45s |

Don't animate: hover states beyond colour, table sorting, tooltips, anything on a timer or loop.

**Charts: use Recharts' animation, not a custom wipe.** Recharts already draws lines left to right and grows bars from the baseline (from zero for negative margins too). Configure it rather than adding a clip-path layer on top:

```tsx
// Highlighted series only; muted series appear without animation.
<Line dataKey={focus} isAnimationActive={!reduced} animationDuration={1200} animationEasing="ease-out" />
<Line dataKey={other} isAnimationActive={false} />
<Bar dataKey="margin" isAnimationActive={!reduced} animationDuration={600} animationEasing="ease-out" />
```

Give the highlighted `<Line>` a `key={focus}` so picking another manager remounts it and redraws only that line.

**Theme switch:** wrap next-themes' `setTheme` in a view transition, and flush the DOM change inside it.

```tsx
const { setTheme, resolvedTheme } = useTheme()
const toggle = () => {
  const next = resolvedTheme === 'dark' ? 'light' : 'dark'
  if (reduced || !document.startViewTransition) return setTheme(next)
  document.startViewTransition(() => flushSync(() => setTheme(next)))
}
```

The CSS side is `::view-transition-old(root), ::view-transition-new(root) { animation-duration: .45s; animation-timing-function: var(--ease-calm) }`, switched off under `prefers-reduced-motion`.

**View switch:** `<AnimatePresence mode="wait" initial={false}>` around the view, keyed by the view id, with `initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}` and `calmTransition` at 0.5s.

**Motion density.** Data pages get the same motion as showcase pages for now. If table-row staggers or bar growth start to feel slow on pages you open every week, drop them first and keep the headings.

## Type

Fonts: Space Grotesk 500/600/700 (`--font-display`), IBM Plex Sans 400/500/600 (`--font-body`), Geist Mono 400/500/600 (`--font-mono`). These are already loaded in `app/layout.tsx`.

| Role | Spec |
|---|---|
| Display (page h1) | Space Grotesk 600, `clamp(40px, 9vw, 60px)`, line-height 1, −0.035em |
| Section (h2) | Space Grotesk 600, 26px, −0.02em, followed by a 14px `--ink-3` caption |
| Card title | Space Grotesk 600, 18–24px, −0.01em to −0.02em |
| Lead | Plex 400, 18px / 1.6, `--ink-2`, max 640px wide |
| Body / row | Plex 400–500, 14–15px / 1.6 |
| Numbers | Geist Mono 400/500, 13–14px in rows, 20–32px in stats |
| Label / eyebrow / table header | Geist Mono 400, 11px, +0.06–0.08em, uppercase, `--ink-3` |

Use sentence case everywhere except mono labels. Don't use weights 800/900, `font-extrabold` or emoji.

## Spacing, radius, layout

- Spacing steps: 4, 8, 12, 16, 20, 24, 40, 64, 80, 96.
- Radius: 6 for chips and result marks, 8 for small segmented controls (S/H/B), 10 for fields and list items, 12 for floating panels, 16 for cards, 999 for buttons, segmented controls and filter chips.
- Content: `max-width: 1200px`, side gutters `clamp(16px, 5vw, 40px)`, hero top `clamp(40px, 8vw, 72px)`. Data pages put 80px between sections; showcase pages 96px.
- Grids use `repeat(auto-fit, minmax(min(100%, …), 1fr))` and `minmax(0, 1fr)` tracks. Tables wrap in `overflow-x:auto; overflow-y:hidden` with a `min-width` on the inner grid.

## Mobile

Same principles, no separate design. Phones get the same components, reflowed:

- Gutters and the h1 scale with the `clamp()` values above. Nothing else changes size.
- Card grids drop to one or two columns through `auto-fit`. Stat cards use `minmax(min(100%, 150px), 1fr)` so they pair up on a phone instead of stacking five high.
- Two-pane layouts (receipt list + detail, pitch + pitch) use `flex-wrap` or `auto-fit` and stack, list first.
- Tables keep their columns and scroll sideways inside their card. Don't hide columns.
- Tab bars and segmented controls get `overflow-x: auto` and `white-space: nowrap`; they never wrap a label onto two lines.
- In tight rows, let names wrap to two lines rather than truncate when the name is the thing being acted on (receipt lines). Truncate when it's reference text (store names, meta lines).
- Blue Bay Cup keeps its current mobile behaviour.

## Page shell

`components/SiteHeader.tsx` replaces `GlobalNavIcons`, `HomeButton`, the floating `ThemeToggle` and Blue Bay Cup's own `Header.tsx`.

- Sticky, 64px tall, background `color-mix(in srgb, var(--page) 86%, transparent)` with a 12px backdrop blur. This header is the only place blur is allowed. 1px `--line` bottom border.
- Left: `wigh.nu` (Space Grotesk 600, 16px) linking to `/`, then a `/` in `--line-strong`, then an 8px accent dot and the project name (14px/500). The home page shows only `wigh.nu`.
- Right: a "Projects" ghost link and a 36px round theme toggle (lucide `Sun` / `Moon`, 16px, stroke 1.75).
- Project navigation (All-time / Season, tabs, month stepper) lives in the page hero, never in the shell.

## Components

All sizes are in px. Use the shadcn primitives in `components/ui/` and restyle their variants to match.

- **Button, primary:** 40 tall, pill, `--accent` fill, `--accent-ink` text, 14/600. Hover mixes 14% `--ink` into the fill and grows to 1.035; press is scale 0.965 (see Motion). One primary button per view.
- **Button, secondary:** `--surface-2` fill, 1px `--line-strong` border, `--ink` text, 14/500. Hover `--surface-3`.
- **Button, ghost:** transparent, `--ink-2` text, hover `--surface-2`.
- **Icon button:** 36 round, 1px `--line-strong` border, transparent fill.
- **Disabled:** `--ink-3` text, `--line` border, no hover.
- **Segmented control** (switches a view in place): track in `--control-track` with a 1px `--line` border, 3px padding, pill shape. Options are 32–34 tall with 14–18 horizontal padding at 13–14/500. The active option has a `--control-thumb` fill with `--shadow-thumb`. Inactive text is `--ink-3`.
- **Assign control (S/H/B):** the segmented control at 30×24 per option, radius 8 track and 6 option, mono 12/600. The active option fills with that person's `--c-*` colour and `--c-on` text; inactive is `--ink-3` on the track.
- **Tabs** (split a page into sections): 14/500 text on a 1px `--line` baseline. The active tab gets a 2px `--accent` underline and `--ink` text. Inactive text is `--ink-3`.
- **Field:** 40 tall, radius 10, `--page` fill, 1px `--line-strong` border, focus border `--accent`. Always use a visible label at 13/500, never a placeholder alone. Error text goes below in 13px `--neg`.
- **Select:** a native `<select>` with `appearance:none`, styled like a field, with a lucide `ChevronDown` icon at 14px.
- **Filter chip:** 32 tall pill, 13px. Idle: 1px `--line-strong` border, `--ink-2` text. Active: `--accent` border, `--accent-soft` fill, `--ink` text.
- **Result mark (W/D/L):** 20×20, radius 6, mono 10/600. W is `--pos` text on a 18% `--pos` wash; L is the same with `--neg`; D is `--ink-3` on `--surface-3`. Empty slots show a `–` in `--line-strong`.
- **Discount chip:** mono 11, radius 6, `--pos` text on a 18% `--pos` wash.
- **Medal:** 8px dot in `--gold`, `--silver` or `--bronze`, plus a mono count. A zero shows a `--surface-3` dot and a `–`.
- **Stat:** 12px `--ink-3` label (or a mono 11 caps label with a coloured dot), a mono 24–32/500 value with a −0.02em unit set at 13px `--ink-3`, then a 12px scope or delta line.
- **Card:** `--surface` fill, 1px `--line` border, radius 16, padding 20–24, no shadow.
- **Data table:** a CSS grid, or a shadcn `Table` restyled. Header row is 44 tall in mono 11 caps `--ink-3`; sortable headers are buttons that turn `--ink` with a ↓/↑ when active. Rows are 48–52 tall with a 1px `--line` top border; hover `--surface-2`. The selected or "yours" row gets an `--accent-soft` wash and an accent dot. Rank 1–3 uses `--ink`, the rest `--ink-3`. No zebra stripes, no coloured header, no left-border accents.
- **Tooltip / menu:** `--surface` fill, 1px `--line-strong` border, radius 12, `--shadow-pop`. Tooltip rows are a swatch, a muted label and a right-aligned mono value. On data pages, prefer a readout line above the chart that follows hover and defaults to the selected item; it works on touch.
- **Charts (recharts):** no chart title inside the card; use the section heading plus caption. Axis ticks are mono 10px `--ink-3`. Grid lines are `--line` or none. Highlight one series in `--accent` at 2.5px and draw the rest in `--series-muted` at 1.25px. Win/loss bars use `--pos` / `--neg`.
- **Pitch (FPL):** flat `--surface` with markings in `--line`, never green. Players are a 40px `--surface-2` circle with the club code in mono, the name, an xPts pill (`--accent-soft` on your XI, `--surface-3` on the opponent's) and the fixture. A `--warn` dot on the circle means under 100% to play; the title says the raw and discounted figures.

## Copy

Sentence case. Plain statements of what a figure is: "Gameweek 9 of 38", "Ranked by titles, then 2nd and 3rd places, then average points." No "Overview", "Dashboard" or "Insights" headings. Errors say what failed and what to do next. No exclamation marks or emoji. See `.claude/skills/stop-slop` for prose.

## Per-page migration

- **Home:** follow `Home.dc.html`. Shell with only `wigh.nu`, a Projects anchor and the theme toggle. A showcase hero: eyebrow, a larger display h1 (`clamp(44px, 9vw, 76px)`, −0.04em; the one place the h1 goes above 60px), a lead, and beside it a numbered project index where each row carries its own pop dot. Then a two-column grid of project cards, each wrapped in its own `data-project` so the dot, the preview and the call to action take that project's pop. The whole card is one link; on hover the border turns `--accent`, the fill steps to `--surface-2` and the arrow moves 4px. No lift, no shadow. Footer with name, email and a link to the design system.
  - **Card images: keep the existing project images** (`bluebaycup_project.png`, `fpl-pred.png`, `playpilot_raw.png`, `kivra-sync.png`). The drawn chart tiles in `Home.dc.html` are placeholders only; build the real card with the image instead. Put each image in a 16:10 tile with `--surface-2` behind it, `object-fit: cover`, a 1px `--line` bottom border and no rounding of its own (the card's 16px radius clips it). No hover zoom or filter on the image. The card's dot, title and call to action still take the project's pop.
  - Remove the gradient background, gradient title and underline, `shadow-2xl`, `hover:-translate-y-1` and the blue tag pills; tags become one mono caps line.
- **Blue Bay Cup:** follow `Blue Bay Cup.dc.html`. Shared header, hero with an All-time/Season segmented control and a season select.
  - **All-time:** a one-line "this season" strip at the top (live season and gameweek, who leads and by how much, an "Open this season" button), then overall standings, head-to-head as a list plus table, and **past champions at the bottom** as cards, newest first.
  - **Season:** standings with row selection; then the **season development chart**, which keeps the live `MultiPlayerLineChart` behaviour: Rank / Total points / Avg points for / Avg points against as a segmented control, every manager drawn as a monotone line with dots in their manager-palette colour, rank axis reversed, a hover guide with a panel listing all managers sorted for that gameweek, and the legend under the chart (here the legend items are buttons that bring one manager forward). Then **match by match**, which keeps the live `ClusteredColumnChart`: manager chips, then points for (`--accent`) and points against (`--neg`) as clustered columns per gameweek, with a readout line above showing the result, both managers and the score for the hovered gameweek. The table, the chips and the match-by-match chart share one selected manager.
- **FPL Predictions:** follow `FPL Predictions.dc.html`. Left-aligned hero with League ID field, "Load league" primary button and My team select; three stat cards (your XI, opponent, projected edge) plus the roster-staleness note; your XI and the opponent's XI as two pitches side by side with benches in auto-sub order; the players table with position segmented control, club select, "Available only" chip, sortable Player/Chance/xPts, and your players highlighted. Replaces `Pitch.tsx`'s green gradient and the stacked my-team/opponent pitch.
- **PlayPilot:** shared shell, a username field with a "Generate" primary button, an All/Movies/TV segmented control, and histogram bars in `--accent` with the selected bar full strength and the others at 35%. Design it from these rules as you go.
- **Food Expenses:** follow `Food Expenses.dc.html`. Hero with month stepper and Export CSV (only on This month and Receipts), four tabs, consumer colours from the `--c-*` tokens, stat cards in mono, the fair-share bar, reports with a This month / All time scope, the trends chart with a readout line instead of a floating tooltip, receipts with S/H/B assign controls and keyboard hints, and products with defaults that only affect future imports. Replaces every hardcoded hex in `components/ica-tracking/colors.ts`.
- **Admin / login:** a centered 400px card with fields and one primary button, using `data-project="home"`.

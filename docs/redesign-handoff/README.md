# Handoff: wigh.nu redesign (charcoal + sand, one pop per project, motion)

## What this is

A site-wide restyle of `gorrast/project-site`: new colour tokens, one shared page shell, restyled components, and a motion layer ported from `gorrast/DH2465`. Pages: Home, Blue Bay Cup, FPL Predictions, Food Expenses. PlayPilot is not designed; restyle it from the rules as you go.

**`DESIGN.md` is the spec and wins over everything else in this folder.** Read it fully before writing code.

## About the design files

The `.dc.html` files are design references, built in HTML on a small in-house template runtime (`support.js`, bundled so they open in a browser: serve this folder, e.g. `python3 -m http.server`, and open a file). They show intended layout, states and exact values. They are **not** production code: don't copy their inline styles or the `class Component extends DCLogic` logic, and don't port their mock data (seeded RNG, invented player names, generated receipts). Rebuild each page in the repo's own stack: Next.js App Router, TypeScript, Tailwind v4 (`@theme inline`), shadcn/ui in `components/ui/`, Recharts, `next-themes`.

`motion.js` is a dependency-free stand-in that lets the mocks animate. Don't port it. Use `Motion.from-DH2465.tsx` (a copy of `DH2465/components/ui/Motion.tsx`) instead.

| File | Use it for |
|---|---|
| `DESIGN.md` | Tokens, rules, component specs, motion, mobile, per-page migration |
| `Design System.dc.html` | Every token and component in one place, both themes |
| `Home.dc.html` | Home layout. **Its drawn card previews are placeholders: keep the existing project images** (see DESIGN.md) |
| `Blue Bay Cup.dc.html` | All-time and Season views |
| `FPL Predictions.dc.html` | Matchup, two pitches, players table |
| `Food Expenses.dc.html` | All four tabs |
| `Motion.from-DH2465.tsx` | The motion components to add as `components/ui/Motion.tsx` |

## Order of work

Do it as five PRs, in order, each one shippable on its own. Run `npm run lint` and `npm run build` before each.

1. **Foundations.** Replace the token blocks in `app/globals.css` with DESIGN.md's (both themes, the shadcn mapping, the manager palette, the print rule). Point `--font-display` / `--font-body` / `--font-mono` at the existing `next/font` variables in `app/layout.tsx` (`--font-space-grotesk`, `--font-ibm-plex-sans`, `--font-geist-mono`). Expose tokens under `@theme inline`. Restyle `components/ui/button.tsx`, `input.tsx`, `table.tsx` and `chart.tsx` to the component specs and fix the shadcn `--accent` name clash. Add `components/SiteHeader.tsx` and remove `GlobalNavIcons`, `HomeButton`, the floating theme toggle and Blue Bay Cup's `Header.tsx`. Install `motion` and `gsap` (DH2465 uses `motion@^14.6.0`, `gsap@^3.15.0`), add `components/ui/Motion.tsx`, and the view-transition theme toggle from DESIGN.md › Motion.
2. **Blue Bay Cup.** Per DESIGN.md › Per-page migration. Keep `MultiPlayerLineChart` and `ClusteredColumnChart` behaviour; change their styling, swap `PLAYER_COLORS` for the `--p1…--p12` tokens (still keyed by `player_id`), and add the legend-click highlight.
3. **FPL Predictions.** Replace `Pitch.tsx`'s green gradient with the flat pitch; show the two XIs side by side; keep the existing API calls and the roster-staleness note.
4. **Food Expenses.** Replace every hex in `components/ica-tracking/colors.ts` with the `--c-*` tokens (Benjamin moves from green to magenta; green stays `--pos` for discounts). Keep the shipped behaviour (no inherited/default resolution at read time; see `docs/ica-frontend-handoff/README.md`'s amendment).
5. **Home.** Restyle `components/home/HomePage.tsx` per the mock, keeping the four existing images.

## Things that will bite

- **`color-mix(in oklch, X, transparent)` tints sand pink in Chromium.** Always mix `in srgb`.
- **shadcn's `--accent`** means a neutral hover background; ours is the project colour. Fix `bg-accent` / `hover:bg-accent` usages in `components/ui/*`.
- **`--accent` is never a text colour.** Use `--accent-text` for text and `--accent-ink` on fills. Several pops fail 4.5:1 as text.
- **`--line-strong` is now a 3:1 control border**, not a chart colour. Muted chart series use `--series-muted`.
- **Recharts animation, not a clip wipe:** see DESIGN.md › Motion for the props. Turn it off under reduced motion.
- **Every `data-project`** wrapper sets the pop: each project's `layout.tsx`, and each home card individually.
- **Reveal-on-scroll must not hide content from print or keyboard users:** keep the print rule, and keep Motion.tsx's finish-on-focus behaviour.

## Done means

- Both themes match the mocks at desktop and phone width (390px), with no horizontal page scroll.
- No raw Tailwind palette classes (`gray-*`, `blue-*`, …) or `dark:` pairs left in feature code, and no literal hex outside `globals.css`.
- Text contrast 4.5:1, control borders 3:1, in both themes (the token values already pass; don't introduce new colours).
- With `prefers-reduced-motion: reduce`, nothing animates and nothing is hidden.

## Context

Jason is a React + Vite + TypeScript app styled with Tailwind v4. All current color classes are hard-coded to the light palette (e.g., `bg-gray-50`, `bg-white`, `text-gray-900`). There is no theme concept in the store or CSS today. The app persists state to `localStorage` via `loadLocalState` / `saveLocalState` in `src/store/storage.ts`.

## Goals / Non-Goals

**Goals:**
- Allow users to pick Light, Dark, or System (OS preference) theme
- Persist selection across sessions via `localStorage`
- React to OS preference changes in real time when System is active
- Apply theme by toggling a `dark` class on `<html>`
- Update all existing components to render correctly in dark mode

**Non-Goals:**
- Custom color themes beyond light/dark
- Per-view or per-component theme overrides
- Server-side theme persistence

## Decisions

### 1. Tailwind `class` dark-mode strategy (not `media`)

Tailwind v4 supports `darkMode: 'class'` via `@custom-variant` in CSS. Using `class` strategy gives explicit user control — System mode is implemented in JS by watching `prefers-color-scheme` and toggling the class accordingly.

**Alternative**: `media` strategy — simpler but removes user override ability.

### 2. Theme stored in `AppSettings`, not `AppState`

`AppSettings` is the natural home for user preferences (it already holds column visibility, etc.). Adding `theme: 'light' | 'dark' | 'system'` there means it is persisted automatically via the existing `saveLocalState` path with no new storage code.

**Alternative**: Store in a separate `localStorage` key — avoids coupling but duplicates persistence logic.

### 3. Apply dark class in `App.tsx` with a `useEffect`

`App.tsx` already owns top-level layout. A single `useEffect` that watches `settings.theme` and the OS media query applies or removes the `dark` class on `document.documentElement`. No new context or provider needed.

**Alternative**: Move to `main.tsx` before React renders — avoids flash of wrong theme but adds complexity outside the component tree.

### 4. Theme toggle UI in `SettingsPanel`

Dark mode is a settings-level preference. Adding a segmented control (Light / Dark / System) in `SettingsPanel` keeps all user preferences in one place.

## Risks / Trade-offs

- **Flash of light theme on load** → Mitigation: add an inline `<script>` in `index.html` that reads `localStorage` and sets the `dark` class before React hydrates; this is a follow-up optimization and not required for initial release.
- **Tailwind v4 dark variant syntax differs from v3** → Mitigation: Tailwind v4 requires `@custom-variant dark (&:where(.dark, .dark *));` in CSS instead of a `tailwind.config.js` entry. Document this clearly in tasks.
- **Large number of component edits** → Mitigation: systematic file-by-file update; scope is bounded to existing files with no new external dependencies.

## Migration Plan

1. Deploy is a static frontend update — no server changes, no database migration.
2. Existing `localStorage` state without a `theme` key will default to `'system'` via the `loadLocalState` fallback.
3. Rollback: revert the CSS `@custom-variant` line and remove `dark:` classes; theme toggle disappears and app returns to light-only.

## Why

Jason's UI is hard-coded to a light color scheme, making it uncomfortable for users who work in low-light environments or prefer dark interfaces. Adding dark mode improves usability and aligns with modern app expectations.

## What Changes

- Introduce a theme toggle (light / dark / system) in the Settings panel
- Persist the theme preference to `localStorage`
- Apply a `dark` class on `<html>` so Tailwind dark-mode variants activate
- Update all components to include `dark:` variant classes for backgrounds, borders, text, and interactive states

## Capabilities

### New Capabilities

- `theme-switcher`: User-facing control and runtime logic for selecting and persisting light/dark/system theme, applying the `dark` class to the document root, and reacting to OS preference changes

### Modified Capabilities

<!-- No existing spec files exist yet, so no delta specs required -->

## Impact

- `src/index.css`: enable Tailwind's `darkMode: 'class'` strategy (Tailwind v4 config)
- `src/store/useAppStore.ts`: add `theme` field to persisted state
- `src/App.tsx`: apply dark class on mount and on theme change
- `src/components/SettingsPanel.tsx`: add theme toggle UI
- All components (`ListView`, `KanbanView`, `BlockView`, `DetailPanel`, `ItemForm`, `ConfirmDialog`, `*Badge`, `cells`): add `dark:` Tailwind variants
- No external dependencies required; Tailwind v4 dark mode is built-in

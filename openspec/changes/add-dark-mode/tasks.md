## 1. Tailwind Dark Mode Configuration

- [x] 1.1 Add `@custom-variant dark (&:where(.dark, .dark *));` to `src/index.css` to enable Tailwind v4 class-based dark mode strategy

## 2. Store & Types

- [x] 2.1 Add `theme: 'light' | 'dark' | 'system'` to the `AppSettings` type in `src/types/index.ts`
- [x] 2.2 Update `loadLocalState` in `src/store/storage.ts` to default `theme` to `'system'` when missing from stored data

## 3. Theme Application Logic

- [x] 3.1 In `App.tsx`, add a `useEffect` that watches `store.state.settings.theme` and the OS `prefers-color-scheme` media query, toggling the `dark` class on `document.documentElement` accordingly
- [x] 3.2 Ensure the `matchMedia` listener is cleaned up on unmount and only active when theme is `'system'`

## 4. Settings UI

- [x] 4.1 Add a segmented control (Light / Dark / System) to `SettingsPanel.tsx` that reads and writes `settings.theme` via the store
- [x] 4.2 Wire up the store action to update `settings.theme` (add `setTheme` or extend existing settings update action)

## 5. Component Dark Mode Styling

- [x] 5.1 Update `App.tsx` shell: header (`bg-white` → `dark:bg-gray-900`), background (`bg-gray-50` → `dark:bg-gray-950`), border and text colors
- [x] 5.2 Update `ListView.tsx`: row backgrounds, hover states, column headers, text colors
- [x] 5.3 Update `KanbanView.tsx`: column backgrounds, card backgrounds, card borders, text
- [x] 5.4 Update `BlockView.tsx`: block card backgrounds, borders, text
- [x] 5.5 Update `DetailPanel.tsx`: panel background, header, labels, dividers, text
- [x] 5.6 Update `ItemForm.tsx`: modal background, input fields, labels, focus rings, buttons
- [x] 5.7 Update `ConfirmDialog.tsx`: dialog background, button styles, text
- [x] 5.8 Update `SettingsPanel.tsx`: panel background, section headings, input and select fields
- [x] 5.9 Update `StatusBadge.tsx`, `PriorityBadge.tsx`, `TagBadge.tsx`: ensure badge colors are legible on dark surfaces
- [x] 5.10 Update `cells.tsx`: any inline cell renderers that use hard-coded light colors

## 6. Verification

- [x] 6.1 Visually verify Light, Dark, and System modes in the browser across all three views (list, kanban, blocks)
- [x] 6.2 Confirm theme persists after page reload
- [x] 6.3 Confirm System mode reacts to OS dark/light toggle without reload

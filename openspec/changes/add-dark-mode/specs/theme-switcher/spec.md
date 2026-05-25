## ADDED Requirements

### Requirement: User can select a theme
The system SHALL provide a theme selector in the Settings panel with three options: Light, Dark, and System. The selected theme SHALL be persisted to `localStorage` as part of `AppSettings`.

#### Scenario: Select Light theme
- **WHEN** the user selects "Light" in the theme selector
- **THEN** the `dark` class is removed from `<html>` and all UI renders in the light color scheme

#### Scenario: Select Dark theme
- **WHEN** the user selects "Dark" in the theme selector
- **THEN** the `dark` class is added to `<html>` and all UI renders in the dark color scheme

#### Scenario: Select System theme
- **WHEN** the user selects "System" in the theme selector
- **THEN** the app matches the operating system's `prefers-color-scheme` setting

#### Scenario: Theme persists across sessions
- **WHEN** the user selects a theme and reloads the app
- **THEN** the previously selected theme is restored from `localStorage`

### Requirement: App defaults to System theme
The system SHALL default to the `system` theme when no saved preference exists (e.g., first load or cleared storage).

#### Scenario: First load with no saved preference
- **WHEN** the app loads and no theme preference is found in `localStorage`
- **THEN** the app applies the OS `prefers-color-scheme` setting

### Requirement: System theme reacts to OS changes
When the `system` theme is active, the app SHALL update the active color scheme in real time when the OS `prefers-color-scheme` changes (e.g., macOS auto-schedule or manual toggle).

#### Scenario: OS switches to dark while System is selected
- **WHEN** the OS switches to dark mode and the user has "System" selected
- **THEN** the `dark` class is added to `<html>` without a page reload

#### Scenario: OS switches to light while System is selected
- **WHEN** the OS switches to light mode and the user has "System" selected
- **THEN** the `dark` class is removed from `<html>` without a page reload

### Requirement: All UI surfaces support dark mode
Every component SHALL render legibly in dark mode using Tailwind `dark:` variant classes. Backgrounds, borders, text, badges, inputs, modals, and interactive states SHALL all have appropriate dark-mode counterparts.

#### Scenario: Header in dark mode
- **WHEN** dark mode is active
- **THEN** the header background is dark (not white) and text is light (not dark gray)

#### Scenario: Kanban cards in dark mode
- **WHEN** dark mode is active
- **THEN** kanban column backgrounds and task cards use dark surface colors with legible text

#### Scenario: Form inputs in dark mode
- **WHEN** dark mode is active and a form is open (ItemForm or SettingsPanel)
- **THEN** input fields and labels are styled with dark backgrounds and light text, with visible focus rings

# Gemini Context: GTD Flow (Vue 3)

This `GEMINI.md` provides context for the AI agent working on the **GTD Flow** project.

## 1. Project Overview

**GTD Flow** is a Getting Things Done (GTD) schedule management application that prioritizes **data transparency**. It uses standard **Markdown** as its underlying data model. Users can manage tasks via a rich UI (List/Calendar views) or by directly editing the Markdown text.

*   **Framework**: Vue 3 (Composition API)
*   **Build Tool**: Vite
*   **Styling**: TailwindCSS
*   **Icons**: Lucide Vue Next
*   **State Management**: Local component state (ref/reactive) within `App.vue`.
*   **Persistence**: `localStorage` (default) + File System Access API (for local `.md` file sync).

## 2. Architecture & Data Flow

### Data Model
The application state is driven by a single string of Markdown text (`markdown` ref in `App.vue`).
*   **Parsing**: The `parsedData` computed property parses the Markdown into a tree structure of Projects (Headings) and Tasks (List items).
*   **Two-Way Binding**:
    *   **UI to Markdown**: Actions like adding tasks, toggling checkboxes, or dragging events in the calendar directly manipulate the Markdown string.
    *   **Markdown to UI**: Changes to the Markdown string automatically trigger re-parsing and update the UI.

### Storage Strategy
1.  **Browser Storage**: Auto-saves to `localStorage` ('gtd-markdown').
2.  **Local File System**: Uses the **File System Access API** to open, save, and watch a local `.md` file. File handles are persisted in IndexedDB via `utils/fileStorage.js`.

### Views
*   **List View**: Standard task list organized by GTD categories (Inbox, Next Action, etc.) and Projects.
*   **Calendar View**: Day, Week, and Month views. Supports dragging tasks to reschedule (modifies the `@date` tag in Markdown).
*   **Code View**: Raw textarea to edit the Markdown directly.

## 3. Key Files

### Active Application (`gtd-vue-app/`)
*   **`src/App.vue`**: **CORE FILE**. Contains almost all application logic, including:
    *   Markdown parsing logic (`parsedData`).
    *   State management (`markdown`, `activeView`, `fileHandle`).
    *   UI rendering for all views.
    *   File System Access API integration.
*   **`src/utils/fileStorage.js`**: Helper functions to save/retrieve file handles from IndexedDB.
*   **`src/components/TaskCard.vue`**: Component for individual task items.
*   **`src/components/ProjectItem.vue`**: Component for the sidebar project tree.

### Legacy / Reference
*   **`ListandGDT.vue`**: A **React** prototype of the application. **Do not modify this file** when working on the Vue app. It serves as a reference for the original logic.

## 4. Build & Development

The project is located in `gtd-vue-app/`.

### Commands
```bash
cd gtd-vue-app
npm install         # Install dependencies
npm run dev         # Start local development server
npm run build       # Build for production
```

## 5. Markdown Data Protocol

The parser relies on specific Markdown conventions:

*   **Projects/Categories**: Headings (`#`, `##`, etc.). Nested headings create nested projects.
    *   Standard GTD categories: `# 📥 收件箱`, `# ⚡ 下一步行动`, etc.
*   **Tasks**: List items (`- [ ]` or `- [x]`).
*   **Metadata**:
    *   **Date/Time**: `@YYYY-MM-DD` or `@YYYY-MM-DD HH:mm` or `@YYYY-MM-DD HH:mm~HH:mm` appended to the task text.

## 6. Current Status & Roadmap

*   **Current Version**: V0.0.2
*   **Implemented**: Basic views, Markdown parsing, Local file sync, File watching.
*   **TODOs** (from `Todo.md`):
    *   Enhanced parser (multi-line notes, links).
    *   Mobile adaptation.
    *   Priorities and Tags.

## 7. Development Guidelines
*   **ChangeLog**:every version release must do change the `ChangeLog.md`
*   **Conventions**: Follow the existing Composition API style in `App.vue`. Use TailwindCSS for all styling.
*   **Safety**: When modifying the parsing logic in `App.vue`, ensure it handles edge cases to prevent data loss in the Markdown string.
*   **File System**: Testing File System Access API features usually requires a secure context (HTTPS or localhost).

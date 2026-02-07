# Changelog

All notable changes to this project will be documented in this file.

## [0.3.0.10] - 2026-02-07

### Fix: Task reminder at scheduled time not firing
- **Await permission before first check**: On mount, `await requestNotificationPermission()` runs first, then the first reminder check and polling start, so the initial check is not skipped when permission is still pending.
- **Polling interval**: Reduced from 60s to **30s** so system notifications are more likely to fire near the set time.
- **Timezone fallback**: Timezones not in `TZ_OFFSET_MINUTES` now use the current system timezone via `getTimezoneOffset()` instead of being treated as UTC, fixing wrong reminder times.
- **Always request permission**: Removed the `innerWidth > 768` guard so notification permission is requested regardless of window size.
- **Permission-denied hint**: If permission is still not granted after request (e.g. on Tauri), a one-time toast prompts the user to allow GTD Flow in System Settings → Notifications.

## [0.3.0.9] - 2026-02-07

### Bug: Reminders as system notifications (Tauri)
- **Issue**: Reminders at the set time did not show as system notifications.
- **Implementation**:
  - **tauri-plugin-notification**: Added to backend `Cargo.toml` and `lib.rs`; capabilities include `notification:default`; frontend uses `@tauri-apps/plugin-notification`.
  - **Permission**: On Tauri, use the plugin’s `isPermissionGranted` / `requestPermission` and store state in `notificationGrantedRef`; on web, keep using the Web `Notification` API.
  - **Sending**: At reminder time, on Tauri call `sendNotification({ title, body })` for system notifications; otherwise use `new Notification(...)`.
  - **Trigger window**: Notify once when within 10 minutes before or 15 minutes after the target time; first check runs on mount, then every 60s (later tightened to 30s in 0.3.0.10).

## [0.3.0.8] - 2026-02-07

### Tauri: Window and dock icon
- **Window icon**: In `lib.rs` `setup()`, get the main window and load `icons/32x32.png` (or `icon.ico` on Windows) from the resource dir via `tauri::image::Image::from_path`, then `window.set_icon(img)` so the title bar and dev window show the app icon.
- **Dependencies**: Enabled tauri features `image-png` and `image-ico` for path-based icon loading; use `tauri::Manager` for `get_webview_window` and `path().resource_dir()`.
- **Bundle**: Added `icons/icon.icns` and `icons/icon.ico` to `tauri.conf.json` `bundle.icon` so the built .app (macOS) and installers use the same icon in the dock and taskbar.

## [0.3.0.7] - 2026-02-07

### UI: Compact tasks, subtask zone on demand
- **Task height**: Main row `min-h` 40px→32px, padding reduced (py-2→py-1.5, px-2.5→px-2); subtask row 36px→28px; card spacing mb-1→mb-0.5, rounded-xl→rounded-lg; title 13px→12px.
- **Subtask drop zone**: No longer always tall. Default is a thin hit area (~3px); it expands when dragging or hovering. Tauri uses `isDraggingAnyTask={isSubtaskDragging || pointerDragActive}`, React uses `isDraggingAnyTask={isSubtaskDragging}`. TaskCard logic aligned in gtd-tauri and gtd-react-app.

## [0.3.0.6] - 2026-02-07

### Bug: Toast “Converted to subtask” never dismisses
- **Cause**: Toast used `id = Date.now()`. In Tauri/WebView, multiple updates in the same millisecond or timer not firing could make `filter(t => t.id !== id)` fail to remove the toast after 3s.
- **Change** (gtd-tauri GtdContext): (1) Toast `id` is now a string `\`${Date.now()}-${random}\`` for uniqueness; (2) added `createdAt`, and new toasts also remove toasts older than 4s as a fallback; (3) setTimeout handles stored in a ref and cleared on Provider unmount.

## [0.3.0.5] - 2026-02-07

### Tauri: Pointer drag and performance
- **No HTML5 DnD**: In Tauri, drag is implemented with pointer events. Drag handle uses `onPointerDown`; `document` listens for `pointermove`/`pointerup`; drop target is resolved via `elementsFromPoint` and `data-drop`/`data-drop-path`/`data-drop-target-line`, then move or convert to subtask. Avoids WebView `dataTransfer` being empty or unresponsive.
- **No re-render while dragging**: Only the overlay position is updated (`overlayRef.current.style.transform`); highlight is done by mutating target `classList`, so React state is not updated during drag and the tree does not re-render.
- **Drop zones**: Sidebar workflows, project items, task rows, and subtask drop zone have `data-drop*`; in Tauri their HTML5 `onDragOver`/`onDrop` are disabled and handled by the pointer logic.

## [0.3.0.4] - 2026-02-07

### Tauri: Reliable drag in WebView (ref fallback)
- **Issue**: In Tauri’s WebView (e.g. macOS WKWebView), `dataTransfer.getData()` in `drop` often returns empty, so “drag to sidebar list” and “drag to subtask” did not work.
- **Implementation**: (1) Added `dragPayloadRef` in App; on `onDragStart` store `{ lineIndex, lineCount, isSubtask }`, clear on `onDragEnd`. (2) `getTaskDataFromTransfer(dt)` tries `dt.getData('task'|'text/plain'|'application/json')`, then falls back to `dragPayloadRef.current` so drop always has data. (3) TaskCard and ProjectItem accept optional `getDraggedTaskData` from App; their `onDrop` uses this getter so “convert to subtask” and “drop on sidebar project” work in WebView.

## [0.3.0.3] - 2026-02-07

### Drag-and-drop aligned with React
- **Unified drop targets**: All drop targets set `e.dataTransfer.dropEffect = 'move'` in `onDragOver` (sidebar workflows, ProjectItem, task card subtask zone) so WebView/browser accept drops.
- **MIME fallbacks**: Drag sets `task`, `text/plain`, and `application/json`; drop reads in that order so data is available in Tauri and strict environments.
- **Subtask zone**: Same as React: `min-h-[24px]` and default border for easier hit target.
- **gtd-react-app**: Same drag logic (getTaskDataFromTransfer, dropEffect, multi-type fallback, subtask zone style).

## [0.3.0.2] - 2026-02-07

### Tauri: Drag to subtask + app icon
- **Drag to subtask**: In Tauri/WebView some environments only expose `text/plain` on drop. `onDragStart` now sets both `task` and `text/plain`; drop reads `task` first, then `text/plain`, so dropping on the “convert to subtask” zone works. Subtask zone has min height and default border.
- **App icon**: Added `gtd-tauri/icon.svg` (blue background, white check) and ran `npx tauri icon icon.svg` to generate icons in `src-tauri/icons/` (macOS, Windows, iOS, Android, etc.).

## [0.3.0.1] - 2026-02-07

### Performance (Tauri / gtd-tauri) — Todo V0.3.0 Debug
- **Drag-over throttling**: `setDragOverTaskId` is now updated at most once per animation frame (via `requestAnimationFrame`) during drag, avoiding hundreds of full App re-renders per second when moving over many task cards. This fixes the issue where the app was too slow to drag a task into a subtask.
- **Non-blocking save**: Markdown updates from `saveToDisk` are wrapped in `React.startTransition` so that the heavy re-parse and list re-render do not block the UI; the drop feedback remains immediate.
- **List animation**: Removed `layout` from the task list `motion.div` to reduce layout thrashing during drag and reorder.

## [0.2.10] - 2026-02-04

### Timed reminder (Todo V0.2.6)
- **Task reminder**: Tasks now support an optional **reminder** date/time, separate from the schedule date. In the Inspector, a "Reminder" section (Bell icon) with date and time inputs lets you set when to be notified. Stored in markdown as `@remind(YYYY-MM-DD HH:mm)`.
- **Notifications**: If a reminder is set, the app shows a browser notification when that time is within the next 10 minutes (same 1‑minute polling as before). If no reminder is set, the existing behaviour remains: notification when the task’s schedule time (date+time) is within 10 minutes. Reminder time is interpreted using the task’s timezone (or app default).

## [0.2.9] - 2026-02-04

### Subtask drag-to-promote: blue insertion line
- When dragging a subtask to promote it, a **blue horizontal line** appears between two parent tasks at the current drop target (above the card under the cursor). The line indicates exactly where the subtask will be inserted when released. Styled with `bg-blue-500` and a soft glow so it stays visible.

## [0.2.8] - 2026-02-04

### Subtask attributes: priority, date, tags, recurrence, timezone
- **Subtask type** (gtd.ts): Extended with optional `date`, `doneDate`, `priority`, `tags`, `recurrence`, `timezone`. Parser (useGtdParser) now parses indented task lines with the same metadata as top-level tasks.
- **TaskCard**: Subtask rows show P1/P2/P3, date, tags, and recurrence icon when set. Clicking the subtask row opens the Inspector for that subtask (same property panel as parent tasks).
- **App**: `selectedSubtaskLineIndex` state and synthetic task resolution so Inspector receives a full Task for the selected subtask. `handleUpdateTask` preserves leading indent when updating a line (subtask lines stay indented). Parent card is highlighted when its subtask is selected in Inspector.

## [0.2.7] - 2026-02-04

### Subtask drag-to-promote: clearer visual feedback
- When **dragging a subtask**, the app now tracks “subtask being dragged” and highlights valid drop targets. Any task card you hover over shows a clear band: **“松开即可提升为独立任务”** / **“Drop to promote to task”** with a blue border and icon, so it’s obvious where to release to promote.
- `onDragEnd` clears the state so the hint disappears after drop. Drop target is cleared on `onDragLeave` and `onDrop`.

## [0.2.6] - 2026-02-04

### Subtask → parent: visible promote action
- **Promote to task**: Subtask rows now have an explicit “Promote to task” (提升为独立任务) button (CornerUpLeft icon). Clicking it promotes that subtask to a top-level task directly under the parent, with toast “Promoted to task”.
- **UI**: Button is always visible (opacity-80) so it works on touch; tooltip and touch-manipulation for mobile. Delete subtask button aligned with same visibility.

## [0.2.5] - 2026-02-04

### LAN, mobile UX & sync (Todo V0.2.5)

- **LAN performance**: Production build now uses code-splitting (vendor, ui, date chunks) and `target: es2020` for smaller, cache-friendly assets. Use `npm run build` then `npm run serve:sync` for best LAN/mobile load.
- **Sync server**: New Node server (`server.mjs`) serves the built app and GET/POST `/api/markdown` so MacBook and phone on the same Wi‑Fi share one task list. Run `npm run build:sync` or `npm run build && npm run serve:sync`; open `http://<MacBook-IP>:3000` on both devices. Data is stored in `data/store.json`. App auto-detects sync mode when `/api/markdown` is available and polls every 30s on the client.
- **Mobile UI/UX**: Sidebar is an overlay on small screens (≤768px) with a backdrop; default closed on mobile. Touch targets: main menu and workflow buttons use `min-h-[44px]` and `touch-manipulation`. Safe-area insets and theme-color meta added; 16px base font on mobile to reduce zoom on focus.
- **Docs**: DEPLOY.md updated with “Sync server (LAN + mobile)” section. Todo.md V0.2.5 items marked done.

## [0.2.3] - 2026-02-01

### 🔧 UI & Pomodoro
- **Search**: Moved to the main area after the "All Tasks" title; the sidebar no longer reserves space for search, saving room. Still an icon + expandable input, shown only in the task list view.
- **Task cards**: Six-dot grip uses the same color family as the card (slate background, slightly darker on hover); subtasks no longer use blue. Row height reduced (main task min-h 40px, subtask 36px) with tighter rounding and spacing. Checkbox colors strengthened (unchecked slate-500, checked emerald-600) for better visibility.
- **Pomodoro**: Fixed play button not starting the timer; added countdown logic and live time display (MM:SS). Play/Pause toggle (Pause icon when running). New Reset button to restore the current mode default (25 min work / 5 min break) while the timer is running or paused, with a "Pomodoro reset" toast.

## [0.2.2] - 2026-02-01

### ⏰ Natural language time
- **Task add**: Quick-add now supports simple natural-language time; time is parsed from the content and written into the task date/time.
- **Chinese**: e.g. 早上/早晨/上午 9 点, 9 点半, 9 点 30 分; 下午 2 点, 下午 2:00, 下午 2 点半; 晚上/傍晚 8 点; 中午; and standalone "9 点", "2:00", etc.
- **English**: morning/am 9, afternoon/pm 2:00, and 24h form 14:00.
- Time is combined with existing date logic (today, tomorrow, current view date); if no date is given, today is used. Parsed time phrases are stripped from the task title.

## [0.2.1] - 2026-02-01

### 📐 Review stats typography & release prep
- **Review Statistics**: Sidebar "Review" button and Achievement Center card labels (Total Completed, Completion Rate, Active Days) font size increased from 10px to 14px for readability.
- **Last 7 days trend**: Bar chart hover tooltip and date labels font size increased from 10px to 12px.
- Synced Todo.md, TaskCard, GtdContext, gtd types and related changes; release after tests passed.

## [0.2.0] - 2026-02-01

### 🧠 Subtask Logic Optimization & Metadata Stripping
A specialized update focused on refining the subtask experience by ensuring clean display content and smarter data handling during task nesting.

### ✨ Features
- **Clean Subtask Display**:
  - Re-engineered the parser for both Vue and React versions to automatically strip metadata tags (dates, priorities, recurring rules, and tags) from subtask content display.
  - Subtasks now present a focused, text-only view while retaining full data integrity in the underlying Markdown file.
- **Smarter Task Conversion**:
  - The "Convert to Subtask" (Indent) action now automatically removes date tags (`@YYYY-MM-DD`) from the indented lines.
  - This prevents subtasks from cluttering scheduled views (Today/Tomorrow) with inherited dates that are often irrelevant for individual steps.

### 🛠 UI & Release
- **Unified Versioning**: Both Vue and React applications synchronized to version **V0.2.0**.
- **Visual Feedback**: Updated version labels in the UI header to reflect the current release state.

## [0.0.9] - 2026-02-01

### 💎 UI Overhaul & Master-Detail Layout
A massive visual and structural transformation focused on information density and professional task management workflows.

### ✨ Features
- **3-Column Professional Layout**:
  - **Master Sidebar**: Narrowed by 33% to maximize focus on tasks.
  - **Compact Master List**: Redesigned task cards with significantly reduced height and padding, allowing 2-3x more tasks per screen.
  - **Right-Side Detail Inspector**: New slide-out panel for in-depth task property management.
- **Enhanced Task Detail Control**:
  - Direct title editing within the inspector.
  - Quick property toggles for Priority, Recurrence, Date, and Tags.
  - Integrated subtask checklist progress and multi-line notes display.
- **Interaction Polish**:
  - Hover-triggered action buttons to keep the interface clean during browsing.
  - Real-time auto-save integration within the Detail Inspector.

### 🛠 Debugging & Stability Improvements
Extensive cleanup after the major structural migration:
- **Reference Fixes**: Restored missing `requestNotificationPermission`, `currentFileHandle`, and other critical state variables lost during refactoring.
- **Drag & Drop Logic**: Fixed `onTaskDrop` and `onSubtaskDropOnZone` handlers to ensure reordering and subtask conversion work seamlessly in the new layout.
- **Core Interactions**: 
  - Fixed broken task checkbox regex (escaped `[` and `]` properly) to restore toggling functionality.
  - Restored `addTask` (Quick Add) feature.
  - Fixed Project management (Add/Delete project buttons) within the sidebar.
- **Visual Accuracy**: Corrected the parser to prioritize indentation detection, fixing the bug where subtasks failed to render with proper horizontal offset.

## [0.0.8] - 2026-02-01

### 🍅 Focus & Bulk Management
This release introduces core execution tools and powerful bulk manipulation features to streamline the GTD workflow.

### ✨ Features
- **Pomodoro Timer**:
  - Fully redesigned, high-visibility "Capsule" UI.
  - One-click mode switching (Focus/Break) by clicking the timer.
  - Automated system notifications and toast alerts upon session completion.
  - Glowing breathing effect for active timers.
- **Batch Operations**:
  - Multi-select mode enabled via the "Batch" button or `B` key.
  - Floating action bar for bulk deletion and bulk due-date setting.
  - Visual selection feedback with specialized card styling.
- **Enhanced UI Polish**:
  - Integrated `TransitionGroup` for smooth task entry, removal, and reordering animations.
  - Refined "Drag to Indent" subtask interaction with non-jittering indicators.
  - Version indicator updated to V0.0.8.

## [0.0.7] - 2026-01-31

### 💎 Full Experience & Cloud Synchronization
This major update focuses on data mobility, proactive alerting, and a highly polished user interface.

### ✨ Features
- **Advanced Cloud Sync**:
  - Seamless iCloud Drive integration with silent background synchronization.
  - Real-time sync status indicator in the header (Synced, Syncing, Conflict, Error).
  - Conflict detection to protect local and remote data integrity.
- **System-Level Notifications**:
  - Browser-native Web Notifications for upcoming tasks (10-minute lead time).
  - Visual "Overdue" alerts with pulsing icons for delayed tasks.
- **Fluid UI & Polish**:
  - **Smooth Reordering**: Integrated `v-move` animations for a tactile feel during task dragging and sorting.
  - **Global Toast System**: High-quality feedback messages for every major action (save, delete, sync).
  - **Collapsible Sidebar**: Toggle sidebar with `S` key or UI button to maximize focus area.
- **Keyboard Power User Shortcuts**:
  - `Ctrl/Cmd + K` for instant global search focus.
  - `N` for rapid task creation.
  - `Esc` for clearing searches and exiting inputs.

## [0.0.6] - 2026-01-31

### 🚀 Efficiency & Advanced Features
This version transforms the application into a high-performance GTD tool with advanced task management and productivity insights.

### ✨ Features
- **Achievement Center (Review Statistics)**:
  - New statistics dashboard showing completion counts, success rates, and active streaks.
  - Weekly productivity trend visualization with interactive CSS bar charts.
  - Top projects distribution tracking via @done(date) automated tagging.
- **Advanced Task Management**:
  - **Task Reordering**: Drag and drop tasks in List View to physically reorder lines in the Markdown file.
  - **Subtask Checklist**: Full support for nested checklist items using standard Markdown indentation.
  - **Intuitive Subtask Conversion**: Drag a task to the "indent zone" of another task to instantly convert it into a subtask.
  - **Recurring Tasks**: New `@every(day/week/month)` syntax. Toggling a task auto-generates the next occurrence with precise date calculation.
- **UX Refinements**:
  - **Context-Aware Quick Add**: Adding tasks from "Today" or "Tomorrow" views now auto-assigns the relevant date.
  - **Jitter-Free Dragging**: Re-engineered drag-and-drop indicators to prevent layout shifts during interaction.
  - **Subtask UI**: Enhanced visual hierarchy with vertical connecting lines and horizontal indentation.

## [0.0.5] - 2026-01-31

### 🌑 Dark Mode & Efficiency Update
This release brings highly requested visual and efficiency improvements, focusing on user comfort and task input precision.

### ✨ Features
- **Dark Mode Support**:
  - Full application-wide dark theme integration.
  - Automatic system preference detection and manual toggle via the logo dropdown.
  - Persistent theme settings saved to local storage.
- **Enhanced Task Scheduling (V0.0.4.1)**:
  - Integrated native Date and Time pickers in the task edit modal.
  - Bi-directional sync between UI controls and Markdown `@YYYY-MM-DD` syntax.
- **UI & Localization Stability**:
  - Fully localized system workflow categories (Inbox, Next Actions, etc.) based on UI language.
  - Standardized Lucide icon integration and property syntax.

### 🐛 Bug Fixes
- Fixed critical `null` pointer errors in task filtering and calendar view.
- Resolved project renaming issues by ensuring robust heading level detection.
- Fixed checkbox interaction bugs during drag-and-drop operations.

## [0.0.4] - 2026-01-31

### 🚀 UX Refinement & Internationalization
This release introduces multi-language support and a more focused UI by moving advanced settings to a dedicated modal.

### ✨ Features
- **Internationalization (i18n)**: 
  - Added support for **English** and **Chinese** languages.
  - New language switch dropdown in the top-left logo area.
- **Improved Workspace Views**:
  - Added **Today**, **Tomorrow**, and **Next 7 Days** smart views to the sidebar.
  - Dynamically updates task counts and header titles based on the selected time period.
- **Settings Modal**:
  - Consolidated file management actions (Open, Save, Default) into a centralized Settings dialog.
  - Added language preferences selection within the modal.
- **UI & UX Refinement**:
  - Clickable logo area with dropdown menu for quick access to settings and language.
  - Improved header titles that clearly reflect the active filter or project.
  - Enhanced search feedback and real-time task statistics.

## [0.0.3.3] - 2026-01-31

### 🚀 Feature Enhancements & UI Optimization
A massive update focusing on task management flexibility, data richness, and a refined user interface.

### ✨ Features
- **Enhanced Data Protocol**:
  - Added support for **Multi-line Notes** (indented text below tasks).
  - Integrated **Priority System** (`!1`, `!2`, `!3`).
  - Added **Tagging System** (`#tagname`) with support for international characters.
  - Automatic **URL detection** and clickable links in tasks and notes.
- **Advanced Editing**:
  - **In-place Task Editing**: Modify content, priority, tags, and dates directly in List and Calendar views.
  - **Project Management**: Support for renaming, deleting, and creating new projects from the sidebar.
  - **Task-to-Project Conversion**: Quickly turn any task into a project heading.
- **Workflow & Organization**:
  - **Drag-and-Drop 2.0**: Drag tasks between List/Calendar views and Sidebar projects or GTD categories.
  - **Global Search**: Search across all tasks, projects, and tags.
  - **Smart Filtering**: Filter by tags and toggle visibility of completed tasks (Eye icon).
  - **Real-time Stats**: Recursive incomplete task counts for all sidebar items.
- **UI & UX Refinement**:
  - Compact sidebar design with improved font readability.
  - Responsive layout optimized for mobile and touch interactions.
  - Standardized icons and cleaner visual hierarchy.

## [0.0.2] - 2026-01-31

### 🚀 File System Integration
Introduced native local file management, allowing users to own their data completely by editing local Markdown files directly.

### ✨ Features
- **Local File Access**: Integrated Web File System Access API for direct reading and writing of local `.md` files.
- **Auto-Save System**:
  - Implemented smart auto-save with debounce (saves 2s after last edit) to minimize disk I/O.
  - Added visual "SAVING..." indicator.
- **External Change Detection**: Real-time monitoring of the file on disk, prompting the user to reload if changes are detected externally.
- **Default File Setup**: Capability to pin a file as default for auto-loading on startup (permission persistence handled).
- **UI Enhancements**: Consolidated file operations (Open, Save, Set Default) into a compact icon toolbar in the sidebar.

## [0.0.1] - 2026-01-31

### 🚀 Initial Release
This is the first usable version of the GTD Flow application, featuring a pure Markdown-driven architecture.

### ✨ Features
- **Markdown Core**: Data is stored and parsed directly from a Markdown string structure (currently synchronized with LocalStorage).
- **Dual Views**:
  - **List View**: GTD-style lists (Inbox, Next Actions, Waiting For, Someday) with project filtering.
  - **Calendar View**: Supports Day, Week, and Month modes.
- **Interactive Calendar**:
  - Drag & Drop tasks to reschedule specific times.
  - "Click & Drag" on the time grid to quick-add tasks with specific time ranges.
- **Source Mode**: Direct editing access to the underlying Markdown text.
- **Architecture**: Migrated from React prototype to a robust Vue 3 + Vite implementation.

### 🛠 Tech Stack
- Vue 3 (Composition API)
- Vite
- TailwindCSS
- Lucide Vue Next

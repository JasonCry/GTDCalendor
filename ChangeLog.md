# Changelog

All notable changes to this project will be documented in this file.

## [0.2.3] - 2026-02-01

### 🔧 UI 与番茄钟
- **搜索框**：移至主区域「所有任务」标题后，左侧栏不再占用搜索区域，节省空间；仍为图标 + 可展开输入框，仅在任务列表视图显示。
- **任务卡片**：六点抓手与卡片同色系（灰底、悬停略深），子任务不用蓝色；行高压缩（主任务 min-h 40px、子任务 36px），圆角与间距收紧；左侧勾选框颜色加强（未勾选 slate-500、已勾选 emerald-600），更醒目。
- **番茄钟**：修复点击播放不启动的问题，增加倒计时逻辑与真实时间显示（MM:SS）；播放/暂停切换（运行中显示暂停钮）；新增复位按钮，在计时中或已走时未结束时可将时间恢复为当前模式默认值（25 分钟/5 分钟），并提示「番茄钟已重置」。

## [0.2.2] - 2026-02-01

### ⏰ 自然语言时间识别
- **任务添加**：支持在快速添加任务时使用简单自然语言时间，从内容中解析并自动写入任务日期时间。
- **中文**：早上/早晨/上午 9 点、9 点半、9 点 30 分；下午 2 点、下午 2:00、下午 2 点半；晚上/傍晚 8 点；中午；以及单独的「9 点」「2:00」等。
- **英文**：morning/am 9、afternoon/pm 2:00，以及 24 小时制 14:00。
- 时间会与已有日期逻辑结合（今天、明天、当前视图日期），若未写日期则默认为今天；解析到的时间关键词会从任务标题中剥离。

## [0.2.1] - 2026-02-01

### 📐 回顾统计字号与发布准备
- **回顾统计 (Review Statistics)**：侧栏「回顾统计」按钮及成就中心三张卡片标签（累计完成、完成率、活跃天数）字号由 10px 调整为 14px，提升可读性。
- **最近 7 天趋势图**：柱状图悬停提示与日期标签字号由 10px 调整为 12px。
- 同步 Todo.md、TaskCard、GtdContext、gtd 类型等相关改动，测试通过后发布。

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
  - **Right-Side Detail Inspector**: New滑出式 (Slide-out) panel for in-depth task property management.
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

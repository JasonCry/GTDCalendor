# Markdown GTD Task System (GTD Flow)

A task and schedule manager based on **GTD (Getting Things Done)** and **Markdown** storage.

## Core Principles

- **Data transparency**: All data lives in standard Markdown files; no private database.
- **GTD workflow**: Built-in buckets — Inbox, Next Actions, Waiting For, Someday/Maybe.
- **Visual planning**: Calendar and list views while keeping plain-text flexibility.

---

## Tech Stack

- **Framework**: React (Vue 3 variant in repo; React is the current focus)
- **UI**: TailwindCSS, minimal modern style
- **Icons**: Lucide React
- **Data**: Parser-driven UI; real-time parsing of Markdown into tasks and projects

---

## Features

### 1. List View
- Quick capture (inbox-first).
- Filter and organize by project hierarchy.
- Live task state sync.

### 2. Calendar View (planned)
- **Day**: 15-minute timeline, drag-to-schedule.
- **Week**: Week overview, multi-day tasks.
- **Month**: Task density at a glance.
- **Interaction**: Click/drag on timeline to create time-blocked tasks.

### 3. Code / Source View
- Edit the underlying Markdown directly.
- Changes reflect in the app in real time.

---

## Data Format (Storage Protocol)

The app parses Markdown headings and task lists into a structured model. Tasks are standard list items (`- [ ]` / `- [x]`) with optional metadata (dates, tags, priority).

---

## Development

- Before committing to git, update **ChangeLog.md** with the list of changes.

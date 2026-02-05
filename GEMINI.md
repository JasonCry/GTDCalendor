# GEMINI Context: GTD Flow

## Project Overview
GTD Flow is a high-performance productivity application based on the **Getting Things Done (GTD)** methodology. It uses **Markdown** as its primary data storage format, ensuring data transparency and portability. The project features a modern, minimal UI with Material Design principles and is implemented in both **React** and **Vue 3** for cross-platform flexibility (currently focused on web/desktop via browser).

### Key Technologies
- **Frontend Frameworks**: React 18+ and Vue 3 (Composition API).
- **Build Tool**: Vite.
- **Styling**: Tailwind CSS with PostCSS.
- **Icons**: Lucide (React/Vue versions).
- **Date Handling**: `date-fns`.
- **Animations**: Framer Motion (React version).

### Core Architecture
- **Parser-Driven UI**: The application parses Markdown strings in real-time to build its internal task and project model.
- **Local File System Access**: Uses the Web File System Access API to read and write directly to local `.md` files.
- **Master-Detail Layout**: A 3-column professional layout with a sidebar, task list, and a detailed property inspector.

## Building and Running

### Common Prerequisites
- **Node.js**: v18.0 or higher.
- **npm**: Standard package manager.

### gtd-vue-app (Primary/Original Implementation)
1.  **Navigate**: `cd gtd-vue-app`
2.  **Install**: `npm install`
3.  **Dev**: `npm run dev`
4.  **Build**: `npm run build`

### gtd-react-app (Modern Prototype)
1.  **Navigate**: `cd gtd-react-app`
2.  **Install**: `npm install`
3.  **Dev**: `npm run dev`
4.  **Build**: `npm run build`

## Development Conventions

### Markdown Protocol
- **Projects**: Defined by Markdown headings (`#`, `##`, etc.).
- **Tasks**: Defined by `- [ ]` or `- [x]`.
- **Subtasks**: Indented `- [ ]` lists under a parent task.
- **Metadata Tags**:
  - **Date/Time**: `@YYYY-MM-DD [HH:mm[~HH:mm]]`
  - **Done Date**: `@done(YYYY-MM-DD)`
  - **Recurrence**: `@every(day|week|month)`
  - **Priority**: `!1` (High), `!2` (Medium), `!3` (Low)
  - **Tags**: `#tagname`

### Coding Style
- **Components**: Reusable UI components are located in `src/components`.
- **State Management**: React version uses Context API (`GtdContext.tsx`); Vue version uses Composition API within `App.vue`.
- **Styling**: Utility-first CSS using Tailwind. Avoid custom CSS unless necessary (use `index.css` or `style.css` for globals).

### Deployment
- Static builds generated in `dist/` folders.
- Compatible with Nginx, Vercel, Netlify, and GitHub Pages.

## Key Files
- `readme.md`: Project philosophy and storage protocol.
- `Todo.md`: Current development roadmap and task status.
- `ChangeLog.md`: Version history and detailed feature notes.
- `gtd-react-app/src/App.tsx`: Main logic for the React version.
- `gtd-vue-app/src/App.vue`: Main logic for the Vue version.
- `gtd-react-app/src/hooks/useGtdParser.ts`: Core Markdown parsing logic for React.

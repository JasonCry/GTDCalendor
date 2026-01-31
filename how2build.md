# How to Build GTD Flow (Vue + Node.js)

This project is a Vue 3 application built with Vite. Follow these steps to set up, run, and deploy the project.

## Prerequisites

- **Node.js**: Version 18.0 or higher recommended.
- **npm**: Included with Node.js.

## Project Structure

```
gtd-vue-app/
├── src/
│   ├── components/  # Vue components (TaskCard, ProjectItem)
│   ├── App.vue      # Main application logic
│   └── main.js      # Entry point
├── package.json     # Dependencies and scripts
└── vite.config.js   # Vite configuration
```

## Setup & Installation

1.  Navigate to the project directory:
    ```bash
    cd gtd-vue-app
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

## Development

To start the local development server with hot-reload:

```bash
npm run dev
```

Open your browser and navigate to the URL shown (usually `http://localhost:5173`).

## Building for Production

To create a production-ready build:

1.  Run the build command:
    ```bash
    npm run build
    ```

2.  The output will be generated in the `dist/` folder.
    - You can deploy the contents of `dist/` to any static site host (Nginx, Vercel, Netlify, GitHub Pages).

## Troubleshooting

- **Style Issues**: Ensure Tailwind CSS is processing correctly. If styles look broken, check that `npm run dev` or `npm run build` completed without PostCSS errors.
- **Node Version**: If you encounter errors during install, try updating Node.js to the latest LTS version.

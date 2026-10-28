# zebpomo

A calm Pomodoro timer and week/month challenge planner. The static app has no build step or third-party runtime dependencies.

## Features

- Ask the AI planner to turn a goal into tailored daily actions and progressive milestones for a week or month.
- Build a quick 7-day or 30-day timetable when the AI service is not connected.
- Get simple daily milestones, focus-session counts, and recovery days.
- Check off completed days; plans and timer progress are saved in the browser on that device.
- Use the focus, short-break, and long-break Pomodoro timer.
- Copy a plan or print it / save it as a PDF.
- Responsive glassmorphism interface for desktop, tablet, and mobile.

Quick plans use a local, rule-based framework and stay on the device. AI plans send the goal and schedule to the zebpomo Node service, which forwards the request to OpenAI's Responses API. The service does not store the goal or response; API requests set `store: false`. Treat generated steps as a flexible starting point and edit them for your challenge.

## Run locally

Open `index.html` in a browser, or serve this folder with any static file server.

## GitHub Pages

The `main` branch is configured as the publishing source, using the repository root. GitHub Pages republishes the site when source files are pushed to `main`. The site is available at:

`https://mdshazeb9963-code.github.io/zebpomo/`

The contact link opens the repository's GitHub Issues page.

## Connect the AI planner

GitHub Pages serves the static frontend. The OpenAI call runs through the Node service in `server/`, deployed separately on Render. The API key belongs in a server environment variable, never in the website source.

The Render Blueprint is in `render.yaml`. It creates the `zebpomo-ai` web service and prompts for `OPENAI_API_KEY` as a secret. After deployment, copy the service URL into `ai-config.js`, adding `/plan` at the end, then commit and push that file to `main`.

The service accepts requests only from the GitHub Pages origin, limits each IP to 8 plan requests per minute, validates the generated timetable, and returns a concise plan. Until the service is deployed and its URL is configured, the **Make a quick plan without AI** action remains available.

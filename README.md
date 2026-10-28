# zebpomo

A calm Pomodoro timer and week/month challenge planner. The static app has no build step or third-party runtime dependencies.

## Features

- Build a 7-day or 30-day timetable from a goal, focus time, and days per week.
- Get simple daily milestones, focus-session counts, and recovery days.
- Check off completed days; plans and timer progress are saved in the browser on that device.
- Use the focus, short-break, and long-break Pomodoro timer.
- Copy a plan or print it / save it as a PDF.
- Responsive glassmorphism interface for desktop, tablet, and mobile.

The planner uses a local, rule-based planning framework. It does not send goals to a server or use a cloud AI service. Treat generated steps as a flexible starting point and edit them for your challenge.

## Run locally

Open `index.html` in a browser, or serve this folder with any static file server.

## GitHub Pages

The workflow in `.github/workflows/pages.yml` publishes the site from the repository root whenever changes are pushed to `main`. After the first workflow run, the site is available at:

`https://mdshazeb9963-code.github.io/zebpomo/`

The contact link opens the repository's GitHub Issues page.

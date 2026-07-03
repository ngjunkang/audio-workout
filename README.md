# Audio Workout PWA

A lightweight Progressive Web App for building timed audio workouts with overlays such as a metronome, interval beeps, countdowns, and optional voice prompts.

## Live demo

Open the app at https://audio-workout-xqvh.vercel.app/

## What it does

- Set a workout duration from 30 seconds up to 1 hour
- Add and configure overlays such as:
  - Metronome
  - Interval beeps
  - Countdown cues
  - Audio overlays with uploaded audio files
- Add voice prompts at custom time offsets
- Play and stop workouts from a simple mobile-friendly interface
- Install as a PWA on supported devices

## Development

Install dependencies:

```bash
npm install
```

Start the local development server:

```bash
npm run dev
```

Then open http://localhost:3000 in your browser.

## Build

```bash
npm run build
```

## Mobile audio note

Mobile browsers may require a direct tap before audio playback starts. When using iOS or Android, tap the Play button once and allow the page to begin audio. Voice prompts can also be limited by the browser or WebView environment, so some devices may need a native text-to-speech fallback.

## Deployment

This project is designed for deployment on Vercel. The app includes a PWA manifest and service worker for installable/offline-friendly behavior.

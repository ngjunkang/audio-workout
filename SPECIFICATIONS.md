# Audio Workout PWA Specifications

## Overview

This project is a Progressive Web App for building, sharing, and playing audio workouts. The experience is designed to be simple on mobile, with a timeline-based editor that renders a single offline audio track before playback.

## Goals

- Let users create workout plans with multiple segments.
- Support simple overlays such as metronome, interval, countdown, and voice cues.
- Render the full workout into one audio buffer for more reliable playback.
- Allow workouts to be shared through a readable URL.
- Keep the experience lightweight and usable on mobile browsers.

## Core Concepts

### Workout Plan

A workout plan is composed of one or more segments.

Each segment includes:

- `label`: display name for the segment
- `durationSeconds`: length of the segment
- `overlays`: list of audio cues attached to the segment

### Overlay Types

The editor supports the following overlay types:

- `metronome`: recurring beat based on BPM
- `interval`: recurring beep based on an interval in seconds
- `countdown`: countdown cues leading up to a target time
- `voice`: simple prompt cue

## User Flow

1. Open the app and see a default workout with one segment.
2. Adjust segment name and duration.
3. Add overlays to a segment.
4. Click “Render & Play” to create a single offline audio track.
5. Use “Stop” to halt playback.
6. Copy a share link to send the current workout to another user.

## Share Link Format

Workout plans are encoded into the `plan` query parameter using a human-readable JSON string.

### How to form the URL

1. Start with a workout object that matches the app structure.
2. Include one or more segments, each with a label, duration, and overlays.
3. Convert the object to a JSON string.
4. Put that string into the `plan` query parameter.
5. URL-encode the string so the browser can safely include it in the address bar.
6. Append it to the app URL using `?plan=...`.

Minimal example structure:

```json
{
  "segments": [
    {
      "label": "Warmup",
      "durationSeconds": 60,
      "overlays": []
    }
  ]
}
```

Example payload:

```json
{
  "segments": [
    {
      "label": "Warmup",
      "durationSeconds": 60,
      "overlays": [
        {
          "type": "metronome",
          "bpm": 120
        }
      ]
    }
  ]
}
```

Example URL:

```text
https://your-app-url/?plan=%7B%22segments%22%3A%5B%7B%22label%22%3A%22Warmup%22%2C%22durationSeconds%22%3A60%2C%22overlays%22%3A%5B%7B%22type%22%3A%22metronome%22%2C%22bpm%22%3A120%7D%5D%7D%5D%7D
```

The app reads this value on load and restores the workout state when possible.

## Audio Rendering Model

The app uses an offline audio rendering pipeline:

- Build a timeline from the segment list and overlays.
- Render all cues into one audio buffer.
- Play the rendered buffer from a single source.

This avoids live scheduling issues and improves consistency across browsers and devices.

## Technical Notes

- Built with Next.js and React.
- Uses the Web Audio API and OfflineAudioContext.
- Includes PWA support via manifest and service worker.
- Designed to work as a mobile-friendly standalone experience.

## Current Constraints

- Voice prompts are currently simplified and not fully speech-based.
- The editor focuses on lightweight audio cues rather than complex mixing or uploaded audio.
- The URL-based plan format is intended to be simple and easy for AI tools to generate.

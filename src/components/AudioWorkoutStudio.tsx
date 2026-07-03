"use client";

import { useMemo, useState } from "react";
import {
  AudioWorkoutEngine,
  OverlayConfig,
  OverlayType,
  VoicePrompt,
  WorkoutConfig,
} from "@/lib/audioEngine";

const DEFAULT_PROMPTS: VoicePrompt[] = [
  { timeSec: 60, text: "Halfway there." },
  { timeSec: 120, text: "Final stretch." },
];

const formatDuration = (durationSeconds: number) => {
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const createOverlayId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createOverlay = (type: OverlayType): OverlayConfig => {
  if (type === "metronome") {
    return { id: createOverlayId(), type, bpm: 120, startAtSec: 0 };
  }

  if (type === "interval") {
    return { id: createOverlayId(), type, intervalSeconds: 30, startAtSec: 0 };
  }

  if (type === "countdown") {
    return { id: createOverlayId(), type, startAtSec: 0 };
  }

  return { id: createOverlayId(), type, startAtSec: 0, repeatEverySec: 30 };
};

export default function AudioWorkoutStudio() {
  const engine = useMemo(() => new AudioWorkoutEngine(), []);
  const [durationSeconds, setDurationSeconds] = useState(180);
  const [isPlaying, setIsPlaying] = useState(false);
  const [status, setStatus] = useState(
    "Set a duration and add an overlay to begin.",
  );
  const [overlays, setOverlays] = useState<OverlayConfig[]>([
    createOverlay("metronome"),
  ]);
  const [overlayTypeToAdd, setOverlayTypeToAdd] =
    useState<OverlayType>("interval");
  const [voicePrompts, setVoicePrompts] =
    useState<VoicePrompt[]>(DEFAULT_PROMPTS);

  const config: WorkoutConfig = {
    durationSeconds,
    overlays,
    voicePrompts,
  };

  const handleOverlayFileUpload = async (
    overlayId: string,
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setStatus(`Loading ${file.name} for the audio overlay...`);
    const arrayBuffer = await file.arrayBuffer();
    const decoded = await engine.decodeAudioData(arrayBuffer);

    setOverlays((prev) =>
      prev.map((overlay) =>
        overlay.id === overlayId
          ? { ...overlay, audioBuffer: decoded, label: file.name }
          : overlay,
      ),
    );
    setStatus(`${file.name} is ready as an audio overlay.`);
  };

  const handlePlay = async () => {
    setIsPlaying(true);
    setStatus("Starting workout with your overlays...");

    try {
      const buffer = await engine.createSilentBuffer(durationSeconds);
      await engine.play(buffer, config);
      setStatus("Workout finished.");
    } catch (error) {
      setStatus("Playback failed. Please try again.");
      console.error(error);
    } finally {
      setIsPlaying(false);
    }
  };

  const handleStop = () => {
    engine.stop();
    setIsPlaying(false);
    setStatus("Playback stopped.");
  };

  const addOverlay = () => {
    setOverlays((prev) => [...prev, createOverlay(overlayTypeToAdd)]);
  };

  const updateOverlay = (overlayId: string, patch: Partial<OverlayConfig>) => {
    setOverlays((prev) =>
      prev.map((overlay) =>
        overlay.id === overlayId ? { ...overlay, ...patch } : overlay,
      ),
    );
  };

  const removeOverlay = (overlayId: string) => {
    setOverlays((prev) => prev.filter((overlay) => overlay.id !== overlayId));
  };

  const addPrompt = () => {
    setVoicePrompts((prev) => [
      ...prev,
      { timeSec: Math.max(0, durationSeconds / 2), text: "New voice prompt." },
    ]);
  };

  const updatePrompt = (
    index: number,
    field: keyof VoicePrompt,
    value: string,
  ) => {
    setVoicePrompts((prev) =>
      prev.map((prompt, indexToUpdate) =>
        indexToUpdate === index
          ? { ...prompt, [field]: field === "timeSec" ? Number(value) : value }
          : prompt,
      ),
    );
  };

  const removePrompt = (index: number) => {
    setVoicePrompts((prev) =>
      prev.filter((_, promptIndex) => promptIndex !== index),
    );
  };

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-4 rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-sm shadow-slate-200/40 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-sky-700 dark:text-sky-400">
              Audio Workout PWA
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 dark:text-white">
              Build a timed workout with overlays you can play instantly.
            </h1>
          </div>
          <div className="rounded-3xl bg-slate-100 p-4 text-slate-700 shadow-sm shadow-slate-200/60 dark:bg-slate-900 dark:text-slate-100 dark:shadow-slate-950/40">
            <p className="text-sm">Status</p>
            <p className="mt-1 text-lg font-medium">{status}</p>
          </div>
        </div>
      </header>

      <div className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6 rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-sm shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-950/90 dark:shadow-slate-950/40">
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-slate-950 dark:text-white">
              Workout timing
            </h2>
            <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
              Set the workout length to anything you want, then layer overlays
              that trigger at the start or on a repeating interval.
            </p>
          </div>

          <label className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-5 text-slate-900 shadow-sm shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:shadow-slate-950/40">
            <span className="text-sm font-medium">Duration</span>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] items-center">
              <input
                type="range"
                min={30}
                max={3600}
                step={15}
                value={durationSeconds}
                onChange={(event) =>
                  setDurationSeconds(Number(event.target.value))
                }
                className="min-w-0 w-full accent-sky-600"
              />
              <input
                type="number"
                min={30}
                max={3600}
                step={15}
                value={durationSeconds}
                onChange={(event) =>
                  setDurationSeconds(Number(event.target.value))
                }
                className="w-full max-w-[7rem] rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Current length: {formatDuration(durationSeconds)}
            </p>
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-3xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handlePlay}
              disabled={isPlaying}
            >
              Play Workout
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-3xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              onClick={handleStop}
              disabled={!isPlaying}
            >
              Stop
            </button>
          </div>
        </div>

        <div className="space-y-6 rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-sm shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-950/90 dark:shadow-slate-950/40">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xl font-semibold text-slate-950 dark:text-white">
                Overlay builder
              </h3>
              <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
                Start with a metronome overlay and add another one such as an
                audio cue or interval beep.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={overlayTypeToAdd}
                onChange={(event) =>
                  setOverlayTypeToAdd(event.target.value as OverlayType)
                }
                className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="metronome">Metronome</option>
                <option value="interval">Interval beeps</option>
                <option value="countdown">Countdown</option>
                <option value="audio">Audio overlay</option>
              </select>
              <button
                type="button"
                onClick={addOverlay}
                className="inline-flex items-center justify-center rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500"
              >
                Add overlay
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {overlays.map((overlay) => (
              <div
                key={overlay.id}
                className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-slate-900 shadow-sm shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:shadow-slate-950/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold capitalize">
                      {overlay.type.replace(/([A-Z])/g, " $1")}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                      {overlay.label
                        ? overlay.label
                        : "Configured for this session"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeOverlay(overlay.id)}
                    className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white transition hover:bg-slate-700"
                  >
                    Remove
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {overlay.type === "metronome" ? (
                    <label className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                      BPM
                      <input
                        type="number"
                        min={40}
                        max={220}
                        value={overlay.bpm ?? 120}
                        onChange={(event) =>
                          updateOverlay(overlay.id, {
                            bpm: Number(event.target.value),
                          })
                        }
                        className="w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />
                    </label>
                  ) : null}

                  {overlay.type === "interval" ? (
                    <label className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                      Repeat every (seconds)
                      <input
                        type="number"
                        min={5}
                        max={600}
                        value={overlay.intervalSeconds ?? 30}
                        onChange={(event) =>
                          updateOverlay(overlay.id, {
                            intervalSeconds: Number(event.target.value),
                          })
                        }
                        className="w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />
                    </label>
                  ) : null}

                  {overlay.type === "audio" ? (
                    <div className="space-y-3">
                      <label className="block rounded-3xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                        Upload an audio cue
                        <input
                          type="file"
                          accept="audio/*"
                          className="mt-3 w-full cursor-pointer text-sm"
                          onChange={(event) =>
                            handleOverlayFileUpload(overlay.id, event)
                          }
                        />
                      </label>
                      <label className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                        Trigger at (seconds)
                        <input
                          type="number"
                          min={0}
                          max={durationSeconds}
                          value={overlay.startAtSec ?? 0}
                          onChange={(event) =>
                            updateOverlay(overlay.id, {
                              startAtSec: Number(event.target.value),
                            })
                          }
                          className="w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                        />
                      </label>
                      <label className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                        Repeat every (seconds)
                        <input
                          type="number"
                          min={0}
                          max={durationSeconds}
                          value={overlay.repeatEverySec ?? 30}
                          onChange={(event) =>
                            updateOverlay(overlay.id, {
                              repeatEverySec: Number(event.target.value),
                            })
                          }
                          className="w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                        />
                      </label>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-sm shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-950/90 dark:shadow-slate-950/40">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-slate-950 dark:text-white">
              Voice prompts
            </h3>
            <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
              Add spoken cues at specific times during the workout.
            </p>
          </div>
          <button
            type="button"
            onClick={addPrompt}
            className="inline-flex items-center justify-center rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500"
          >
            Add prompt
          </button>
        </div>

        <div className="mt-6 space-y-4">
          {voicePrompts.map((prompt, index) => (
            <div
              key={`${prompt.text}-${index}`}
              className="grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-5 text-slate-900 shadow-sm shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:shadow-slate-950/40 sm:grid-cols-[140px_1fr_auto]"
            >
              <label className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                Time (sec)
                <input
                  type="number"
                  min={0}
                  value={prompt.timeSec}
                  onChange={(event) =>
                    updatePrompt(index, "timeSec", event.target.value)
                  }
                  className="w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>
              <label className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                Prompt text
                <input
                  value={prompt.text}
                  onChange={(event) =>
                    updatePrompt(index, "text", event.target.value)
                  }
                  className="w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>
              <button
                type="button"
                onClick={() => removePrompt(index)}
                className="inline-flex items-center justify-center rounded-3xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

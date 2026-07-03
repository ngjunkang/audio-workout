"use client";

import { useMemo, useState } from "react";
import { AudioWorkoutEngine, VoicePrompt, WorkoutConfig } from "@/lib/audioEngine";

const DEFAULT_PROMPTS: VoicePrompt[] = [
  { timeSec: 15, text: "Keep going, you're doing great." },
  { timeSec: 30, text: "Halfway there." },
];

export default function AudioWorkoutStudio() {
  const engine = useMemo(() => new AudioWorkoutEngine(), []);
  const [fileName, setFileName] = useState<string>("");
  const [duration, setDuration] = useState<number>(0);
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [status, setStatus] = useState("Upload an audio file to start.");
  const [bpm, setBpm] = useState(120);
  const [metronomeEnabled, setMetronomeEnabled] = useState(true);
  const [intervalEnabled, setIntervalEnabled] = useState(false);
  const [intervalSeconds, setIntervalSeconds] = useState(60);
  const [countdownEnabled, setCountdownEnabled] = useState(true);
  const [voicePrompts, setVoicePrompts] = useState<VoicePrompt[]>(DEFAULT_PROMPTS);

  const config: WorkoutConfig = {
    bpm,
    metronomeEnabled,
    intervalEnabled,
    intervalSeconds,
    countdownEnabled,
    voicePrompts,
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setStatus("Loading audio file...");
    setFileName(file.name);

    const arrayBuffer = await file.arrayBuffer();
    const decoded = await engine.decodeAudioData(arrayBuffer);
    setBuffer(decoded);
    setDuration(decoded.duration);
    setStatus(`Ready to play. Duration: ${decoded.duration.toFixed(1)} seconds.`);
  };

  const handlePlay = async () => {
    if (!buffer) {
      setStatus("Please upload audio first.");
      return;
    }
    setIsPlaying(true);
    setStatus("Starting playback with overlays...");

    try {
      await engine.play(buffer, config);
      setStatus("Playback ended.");
    } catch (error) {
      setStatus("Audio playback failed. Please try again.");
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

  const addPrompt = () => {
    setVoicePrompts((prev) => [...prev, { timeSec: Math.max(0, duration / 2), text: "New voice prompt." }]);
  };

  const updatePrompt = (index: number, field: keyof VoicePrompt, value: string) => {
    setVoicePrompts((prev) =>
      prev.map((prompt, indexToUpdate) =>
        indexToUpdate === index ? { ...prompt, [field]: field === "timeSec" ? Number(value) : value } : prompt,
      ),
    );
  };

  const removePrompt = (index: number) => {
    setVoicePrompts((prev) => prev.filter((_, promptIndex) => promptIndex !== index));
  };

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-4 rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-sm shadow-slate-200/40 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-sky-700 dark:text-sky-400">Audio Workout PWA</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 dark:text-white">
              Create and play audio workouts with timed overlays.
            </h1>
          </div>
          <div className="rounded-3xl bg-slate-100 p-4 text-slate-700 shadow-sm shadow-slate-200/60 dark:bg-slate-900 dark:text-slate-100 dark:shadow-slate-950/40">
            <p className="text-sm">Status</p>
            <p className="mt-1 text-lg font-medium">{status}</p>
          </div>
        </div>
      </header>

      <div className="grid gap-8 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-6 rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-sm shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-950/90 dark:shadow-slate-950/40">
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-slate-950 dark:text-white">Upload your workout track</h2>
            <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
              Use a recorded session or music track, then layer in metronome ticks, timed beeps, countdowns, and voice prompts.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <label className="block rounded-3xl border border-slate-200 bg-slate-50 p-5 text-center text-slate-900 shadow-sm shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:shadow-slate-950/40">
              <span className="text-sm font-medium">Choose audio file</span>
              <input
                type="file"
                accept="audio/*"
                className="mt-4 w-full cursor-pointer rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition hover:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                onChange={handleFileUpload}
              />
            </label>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-slate-900 shadow-sm shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:shadow-slate-950/40">
              <p className="text-sm text-slate-500 dark:text-slate-400">Selected file</p>
              <p className="mt-3 text-base font-medium">{fileName || "No file selected"}</p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{duration ? `${duration.toFixed(1)} seconds` : "Upload audio to see duration."}</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-3xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handlePlay}
              disabled={!buffer || isPlaying}
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
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-slate-950 dark:text-white">Overlay settings</h3>
            <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
              Configure timing and prompts before you launch the audio session.
            </p>
          </div>

          <fieldset className="space-y-4">
            <label className="flex items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-800 shadow-sm shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:shadow-slate-950/40">
              <span>Metronome</span>
              <input
                type="checkbox"
                checked={metronomeEnabled}
                onChange={(event) => setMetronomeEnabled(event.target.checked)}
                className="h-5 w-5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                BPM
                <input
                  type="number"
                  min={40}
                  max={220}
                  value={bpm}
                  onChange={(event) => setBpm(Number(event.target.value))}
                  className="w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>
              <label className="flex items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-800 shadow-sm shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:shadow-slate-950/40">
                <span>Countdown</span>
                <input
                  type="checkbox"
                  checked={countdownEnabled}
                  onChange={(event) => setCountdownEnabled(event.target.checked)}
                  className="h-5 w-5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
              </label>
            </div>

            <label className="flex items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-800 shadow-sm shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:shadow-slate-950/40">
              <span>Interval beeps</span>
              <input
                type="checkbox"
                checked={intervalEnabled}
                onChange={(event) => setIntervalEnabled(event.target.checked)}
                className="h-5 w-5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
            </label>
            {intervalEnabled ? (
              <label className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                Interval seconds
                <input
                  type="number"
                  min={5}
                  max={600}
                  value={intervalSeconds}
                  onChange={(event) => setIntervalSeconds(Number(event.target.value))}
                  className="w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>
            ) : null}
          </fieldset>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-sm shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-950/90 dark:shadow-slate-950/40">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-slate-950 dark:text-white">Voice prompts</h3>
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
            <div key={`${prompt.text}-${index}`} className="grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-5 text-slate-900 shadow-sm shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:shadow-slate-950/40 sm:grid-cols-[140px_1fr_auto]">
              <label className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                Time (sec)
                <input
                  type="number"
                  min={0}
                  value={prompt.timeSec}
                  onChange={(event) => updatePrompt(index, "timeSec", event.target.value)}
                  className="w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>
              <label className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                Prompt text
                <input
                  value={prompt.text}
                  onChange={(event) => updatePrompt(index, "text", event.target.value)}
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

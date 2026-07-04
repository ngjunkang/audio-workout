"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AudioWorkoutEngine,
  OverlayConfig,
  OverlayType,
  SegmentConfig,
  WorkoutPlan,
} from "@/lib/audioEngine";

let overlayIdCounter = 0;
const createOverlayId = () => {
  overlayIdCounter += 1;
  return `overlay-${overlayIdCounter}`;
};

const createOverlay = (type: OverlayType): OverlayConfig => {
  if (type === "metronome") {
    return { id: createOverlayId(), type, bpm: 120, startAtSec: 0 };
  }

  if (type === "interval") {
    return { id: createOverlayId(), type, intervalSeconds: 30, startAtSec: 0 };
  }

  if (type === "countdown") {
    return {
      id: createOverlayId(),
      type,
      targetTimeSec: 45,
      leadSeconds: 5,
      startAtSec: 0,
    };
  }

  return { id: createOverlayId(), type, text: "Go!", startAtSec: 0 };
};

const createSegment = (): SegmentConfig => ({
  id: createOverlayId(),
  label: "Segment 1",
  durationSeconds: 60,
  overlays: [createOverlay("metronome")],
});

const encodeWorkoutPlan = (plan: WorkoutPlan) => JSON.stringify(plan);

const decodeWorkoutPlan = (value: string): WorkoutPlan => {
  if (!value) {
    return { segments: [createSegment()] };
  }

  try {
    return JSON.parse(value) as WorkoutPlan;
  } catch {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json) as WorkoutPlan;
  }
};

const getInitialSegments = (encodedPlan?: string) => {
  if (!encodedPlan) {
    return [createSegment()];
  }

  try {
    const parsedPlan = decodeWorkoutPlan(encodedPlan);
    if (parsedPlan.segments?.length) {
      return parsedPlan.segments;
    }
  } catch (error) {
    console.warn("Could not load workout from URL", error);
  }

  return [createSegment()];
};

type AudioWorkoutStudioProps = {
  initialEncodedPlan?: string;
};

export default function AudioWorkoutStudio({
  initialEncodedPlan,
}: AudioWorkoutStudioProps) {
  const engine = useMemo(() => new AudioWorkoutEngine(), []);
  const [segments, setSegments] = useState<SegmentConfig[]>(() =>
    getInitialSegments(initialEncodedPlan),
  );
  const [overlayTypeToAdd, setOverlayTypeToAdd] =
    useState<OverlayType>("interval");
  const [isRendering, setIsRendering] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [status, setStatus] = useState(
    "Build a timeline, then render and play your workout.",
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    params.set("plan", encodeWorkoutPlan({ segments }));
    const nextUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, "", nextUrl);
  }, [segments]);

  const plan: WorkoutPlan = { segments };

  const updateSegment = (segmentId: string, patch: Partial<SegmentConfig>) => {
    setSegments((prev) =>
      prev.map((segment) =>
        segment.id === segmentId ? { ...segment, ...patch } : segment,
      ),
    );
  };

  const addSegment = () => {
    setSegments((prev) => [...prev, createSegment()]);
  };

  const removeSegment = (segmentId: string) => {
    setSegments((prev) => prev.filter((segment) => segment.id !== segmentId));
  };

  const addOverlay = (segmentId: string) => {
    setSegments((prev) =>
      prev.map((segment) =>
        segment.id === segmentId
          ? {
              ...segment,
              overlays: [...segment.overlays, createOverlay(overlayTypeToAdd)],
            }
          : segment,
      ),
    );
  };

  const updateOverlay = (
    segmentId: string,
    overlayId: string,
    patch: Partial<OverlayConfig>,
  ) => {
    setSegments((prev) =>
      prev.map((segment) =>
        segment.id === segmentId
          ? {
              ...segment,
              overlays: segment.overlays.map((overlay) =>
                overlay.id === overlayId ? { ...overlay, ...patch } : overlay,
              ),
            }
          : segment,
      ),
    );
  };

  const removeOverlay = (segmentId: string, overlayId: string) => {
    setSegments((prev) =>
      prev.map((segment) =>
        segment.id === segmentId
          ? {
              ...segment,
              overlays: segment.overlays.filter(
                (overlay) => overlay.id !== overlayId,
              ),
            }
          : segment,
      ),
    );
  };

  const handleRenderAndPlay = async () => {
    setIsRendering(true);
    setStatus("Rendering your workout into one audio track...");

    try {
      const buffer = await engine.renderWorkout(plan);
      setStatus("Playback ready. Starting your rendered workout...");
      setIsPlaying(true);
      await engine.playRenderedBuffer(buffer);
      setStatus("Workout finished.");
    } catch (error) {
      console.error("Render/playback error:", error);
      setStatus(
        `Render failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsRendering(false);
      setIsPlaying(false);
    }
  };

  const handleStop = () => {
    engine.stop();
    setIsPlaying(false);
    setStatus("Playback stopped.");
  };

  const handleCopyLink = async () => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    url.searchParams.set("plan", encodeWorkoutPlan(plan));
    await navigator.clipboard.writeText(url.toString());
    setStatus("Share link copied.");
  };

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-4 rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-sm shadow-slate-200/40 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-sky-700 dark:text-sky-400">
              Offline workout renderer
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 dark:text-white">
              Build a timeline, render one audio track, and play it back.
            </h1>
          </div>
          <div className="rounded-3xl bg-slate-100 p-4 text-slate-700 shadow-sm shadow-slate-200/60 dark:bg-slate-900 dark:text-slate-100 dark:shadow-slate-950/40">
            <p className="text-sm">Status</p>
            <p className="mt-1 text-lg font-medium">{status}</p>
          </div>
        </div>
      </header>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleRenderAndPlay}
          disabled={isRendering || isPlaying}
          className="inline-flex items-center justify-center rounded-3xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isRendering ? "Rendering..." : "Render & Play"}
        </button>
        <button
          type="button"
          onClick={handleStop}
          disabled={isRendering}
          className="inline-flex items-center justify-center rounded-3xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          Stop
        </button>
        <button
          type="button"
          onClick={handleCopyLink}
          className="inline-flex items-center justify-center rounded-3xl border border-sky-200 bg-sky-50 px-5 py-3 text-sm font-semibold text-sky-700 transition hover:bg-sky-100 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300"
        >
          Copy share link
        </button>
      </div>

      <div className="space-y-6">
        {segments.map((segment) => (
          <div
            key={segment.id}
            className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-950/90 dark:shadow-slate-950/40"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1">
                <label className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                  Segment name
                  <input
                    value={segment.label}
                    onChange={(event) =>
                      updateSegment(segment.id, { label: event.target.value })
                    }
                    className="w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </label>
              </div>
              <div className="flex items-center gap-3">
                <label className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                  Duration (sec)
                  <input
                    type="number"
                    min={5}
                    max={3600}
                    value={segment.durationSeconds}
                    onChange={(event) =>
                      updateSegment(segment.id, {
                        durationSeconds: Number(event.target.value),
                      })
                    }
                    className="w-32 rounded-3xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => removeSegment(segment.id)}
                  className="rounded-3xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                  Remove
                </button>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {segment.overlays.map((overlay) => (
                <div
                  key={overlay.id}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-slate-900 shadow-sm shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:shadow-slate-950/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold capitalize">
                        {overlay.type.replace(/([A-Z])/g, " $1")}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                        {overlay.type === "voice"
                          ? "Prompt cue"
                          : "Rendered into the final audio track"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeOverlay(segment.id, overlay.id)}
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
                            updateOverlay(segment.id, overlay.id, {
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
                            updateOverlay(segment.id, overlay.id, {
                              intervalSeconds: Number(event.target.value),
                            })
                          }
                          className="w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                        />
                      </label>
                    ) : null}

                    {overlay.type === "countdown" ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                          Target time (sec)
                          <input
                            type="number"
                            min={0}
                            max={segment.durationSeconds}
                            value={overlay.targetTimeSec ?? 45}
                            onChange={(event) =>
                              updateOverlay(segment.id, overlay.id, {
                                targetTimeSec: Number(event.target.value),
                              })
                            }
                            className="w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                          />
                        </label>
                        <label className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                          Lead-in (sec)
                          <input
                            type="number"
                            min={1}
                            max={30}
                            value={overlay.leadSeconds ?? 5}
                            onChange={(event) =>
                              updateOverlay(segment.id, overlay.id, {
                                leadSeconds: Number(event.target.value),
                              })
                            }
                            className="w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                          />
                        </label>
                      </div>
                    ) : null}

                    {overlay.type === "voice" ? (
                      <label className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                        Prompt text
                        <input
                          value={overlay.text ?? "Go!"}
                          onChange={(event) =>
                            updateOverlay(segment.id, overlay.id, {
                              text: event.target.value,
                            })
                          }
                          className="w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                        />
                      </label>
                    ) : null}
                  </div>
                </div>
              ))}

              <div className="flex flex-wrap items-center gap-3">
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
                  <option value="voice">Voice cue</option>
                </select>
                <button
                  type="button"
                  onClick={() => addOverlay(segment.id)}
                  className="inline-flex items-center justify-center rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500"
                >
                  Add overlay
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addSegment}
        className="inline-flex items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      >
        + Add segment
      </button>
    </section>
  );
}

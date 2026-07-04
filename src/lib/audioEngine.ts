export interface VoicePrompt {
  timeSec: number;
  text: string;
}

export type OverlayType = "metronome" | "interval" | "countdown" | "voice";

export interface OverlayConfig {
  id: string;
  type: OverlayType;
  bpm?: number;
  intervalSeconds?: number;
  targetTimeSec?: number;
  leadSeconds?: number;
  text?: string;
  startAtSec?: number;
}

export interface SegmentConfig {
  id: string;
  label: string;
  durationSeconds: number;
  overlays: OverlayConfig[];
}

export interface WorkoutPlan {
  segments: SegmentConfig[];
}

type KokoroTTS = import("kokoro-js").KokoroTTS;
type GeneratedVoiceCue = {
  samples: Float32Array<ArrayBuffer>;
  sampleRate: number;
};

export class AudioWorkoutEngine {
  private context: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private kokoroPromise: Promise<KokoroTTS> | null = null;
  private voiceCueCache = new Map<string, Promise<GeneratedVoiceCue>>();

  private getContext() {
    if (!this.context) {
      const AudioContextCtor =
        (typeof window !== "undefined" && "AudioContext" in window
          ? window.AudioContext
          : undefined) ??
        (typeof window !== "undefined" && "webkitAudioContext" in window
          ? (
              window as Window &
                typeof globalThis & { webkitAudioContext?: typeof AudioContext }
            ).webkitAudioContext
          : undefined) ??
        (typeof globalThis !== "undefined" && "AudioContext" in globalThis
          ? (
              globalThis as typeof globalThis & {
                AudioContext?: typeof AudioContext;
              }
            ).AudioContext
          : undefined);

      if (!AudioContextCtor) {
        throw new Error("AudioContext is not supported on this device.");
      }

      this.context = new AudioContextCtor();
    }

    return this.context;
  }

  async resumeContext() {
    const ctx = this.getContext();
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch (error) {
        console.warn("Failed to resume audio context:", error);
      }
    }
  }

  private createMasterGain(ctx: AudioContext | OfflineAudioContext) {
    const gain = ctx.createGain();
    gain.gain.value = 1;
    gain.connect(ctx.destination);
    return gain;
  }

  private scheduleTone(
    ctx: AudioContext | OfflineAudioContext,
    startTime: number,
    duration: number,
    frequency: number,
    volume: number,
  ) {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const masterGain = this.createMasterGain(ctx);

    oscillator.type = "sine";
    oscillator.frequency.value = frequency;

    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.004);
    gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(masterGain);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
  }

  private scheduleMetronome(
    ctx: AudioContext | OfflineAudioContext,
    startTime: number,
    endTime: number,
    bpm: number,
  ) {
    const interval = 60 / bpm;
    let current = startTime;
    while (current < endTime) {
      this.scheduleTone(ctx, current, 0.06, 880, 0.1);
      current += interval;
    }
  }

  private scheduleIntervalBeep(
    ctx: AudioContext | OfflineAudioContext,
    startTime: number,
    endTime: number,
    intervalSeconds: number,
  ) {
    if (intervalSeconds <= 0) return;
    let current = startTime + intervalSeconds;
    while (current < endTime) {
      this.scheduleTone(ctx, current, 0.1, 620, 0.12);
      current += intervalSeconds;
    }
  }

  private scheduleCountdown(
    ctx: AudioContext | OfflineAudioContext,
    startTime: number,
    targetTimeSec: number,
    leadSeconds: number,
  ) {
    const countdownStart = Math.max(
      startTime,
      startTime + targetTimeSec - leadSeconds,
    );
    for (let count = leadSeconds; count >= 1; count -= 1) {
      const tickTime = countdownStart + (leadSeconds - count);
      this.scheduleTone(ctx, tickTime, 0.12, 880 - count * 60, 0.16);
    }
  }

  private async getKokoroTTS() {
    if (!this.kokoroPromise) {
      this.kokoroPromise = import("kokoro-js").then(({ KokoroTTS }) =>
        KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
          dtype: "q8",
          device: "wasm",
        }),
      );
    }

    return this.kokoroPromise;
  }

  private async scheduleVoiceOverlay(
    ctx: OfflineAudioContext,
    startTime: number,
    text: string,
  ) {
    const voice = "af_heart";
    const speed = 1.08;
    const cacheKey = `${voice}:${speed}:${text}`;

    let voiceCuePromise = this.voiceCueCache.get(cacheKey);
    if (!voiceCuePromise) {
      voiceCuePromise = this.getKokoroTTS().then(async (tts) => {
        const audio = await tts.generate(text, { voice, speed });
        return {
          samples: Float32Array.from(audio.audio),
          sampleRate: audio.sampling_rate,
        };
      });
      this.voiceCueCache.set(cacheKey, voiceCuePromise);
    }

    const { samples, sampleRate } = await voiceCuePromise;
    const buffer = ctx.createBuffer(1, samples.length, sampleRate);
    buffer.copyToChannel(samples, 0);

    const source = ctx.createBufferSource();
    const gainNode = ctx.createGain();
    const masterGain = this.createMasterGain(ctx);

    source.buffer = buffer;
    gainNode.gain.value = 1;
    source.connect(gainNode);
    gainNode.connect(masterGain);
    source.start(startTime);
  }

  async renderWorkout(plan: WorkoutPlan) {
    await this.resumeContext();

    const sampleRate = this.getContext().sampleRate;
    const totalDuration = plan.segments.reduce(
      (sum, segment) => sum + segment.durationSeconds,
      0,
    );
    const totalFrames = Math.max(1, Math.floor(totalDuration * sampleRate));
    const offlineContext = new OfflineAudioContext(2, totalFrames, sampleRate);

    let timelineOffset = 0;
    for (const segment of plan.segments) {
      const segmentStartTime = timelineOffset;
      const segmentEndTime = timelineOffset + segment.durationSeconds;

      for (const overlay of segment.overlays) {
        const overlayStartTime = segmentStartTime + (overlay.startAtSec ?? 0);
        switch (overlay.type) {
          case "metronome":
            this.scheduleMetronome(
              offlineContext,
              overlayStartTime,
              segmentEndTime,
              overlay.bpm ?? 120,
            );
            break;
          case "interval":
            this.scheduleIntervalBeep(
              offlineContext,
              overlayStartTime,
              segmentEndTime,
              overlay.intervalSeconds ?? 30,
            );
            break;
          case "countdown":
            this.scheduleCountdown(
              offlineContext,
              overlayStartTime,
              overlay.targetTimeSec ?? segment.durationSeconds,
              overlay.leadSeconds ?? 5,
            );
            break;
          case "voice":
            if (overlayStartTime < segmentEndTime) {
              await this.scheduleVoiceOverlay(
                offlineContext,
                overlayStartTime,
                overlay.text?.trim() || "Prompt",
              );
            }
            break;
        }
      }

      timelineOffset = segmentEndTime;
    }

    return offlineContext.startRendering();
  }

  async playRenderedBuffer(buffer: AudioBuffer) {
    await this.resumeContext();
    this.stop();

    const ctx = this.getContext();
    const source = ctx.createBufferSource();
    const masterGain = this.createMasterGain(ctx);

    source.buffer = buffer;
    source.connect(masterGain);
    source.start(0);
    this.source = source;

    return new Promise<void>((resolve) => {
      source.onended = () => {
        this.source = null;
        resolve();
      };
    });
  }

  stop() {
    if (this.source) {
      try {
        this.source.stop();
      } catch {
        // ignore invalid stop calls
      }
      this.source = null;
    }
  }
}

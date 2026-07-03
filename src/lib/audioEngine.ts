export interface VoicePrompt {
  timeSec: number;
  text: string;
}

export type OverlayType = "metronome" | "interval" | "countdown" | "audio";

export interface OverlayConfig {
  id: string;
  type: OverlayType;
  bpm?: number;
  intervalSeconds?: number;
  startAtSec?: number;
  repeatEverySec?: number;
  label?: string;
  audioBuffer?: AudioBuffer | null;
}

export interface WorkoutConfig {
  durationSeconds: number;
  overlays: OverlayConfig[];
  voicePrompts: VoicePrompt[];
}

export class AudioWorkoutEngine {
  private context: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private scheduledNodes: AudioScheduledSourceNode[] = [];
  private speechTimeouts: number[] = [];
  private speechReady = false;
  private masterGain: GainNode | null = null;

  private getContext() {
    if (!this.context) {
      const AudioContextCtor =
        (typeof window !== "undefined" && "AudioContext" in window
          ? window.AudioContext
          : undefined) ??
        (typeof window !== "undefined" && "webkitAudioContext" in window
          ? (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
          : undefined) ??
        (typeof globalThis !== "undefined" && "AudioContext" in globalThis
          ? (globalThis as typeof globalThis & { AudioContext?: typeof AudioContext }).AudioContext
          : undefined);

      if (!AudioContextCtor) {
        throw new Error("AudioContext is not supported on this device.");
      }

      this.context = new AudioContextCtor();
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = 1;
      this.masterGain.connect(this.context.destination);
    }
    return this.context;
  }

  private ensureMasterGain(ctx: AudioContext) {
    if (!this.masterGain) {
      this.masterGain = ctx.createGain();
      this.masterGain.gain.value = 1;
      this.masterGain.connect(ctx.destination);
    }
    return this.masterGain;
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

  async decodeAudioData(arrayBuffer: ArrayBuffer) {
    const ctx = this.getContext();
    return await ctx.decodeAudioData(arrayBuffer);
  }

  async createSilentBuffer(durationSeconds: number) {
    await this.resumeContext();
    const ctx = this.getContext();
    const length = Math.max(1, Math.floor(durationSeconds * ctx.sampleRate));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const channelData = buffer.getChannelData(0);
    channelData.fill(0);
    return buffer;
  }

  private scheduleOscillatorAtTime(
    startTime: number,
    frequency = 880,
    duration = 0.12,
  ) {
    const ctx = this.getContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const masterGain = this.ensureMasterGain(ctx);

    oscillator.type = "sine";
    oscillator.frequency.value = frequency;

    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.008);
    gainNode.gain.setValueAtTime(0.3, startTime + duration - 0.02);
    gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(masterGain);
    oscillator.start(Math.max(startTime, ctx.currentTime + 0.02));
    oscillator.stop(startTime + duration);
    this.scheduledNodes.push(oscillator);
  }

  private scheduleWarmupBeep(startTime: number) {
    const ctx = this.getContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const masterGain = this.ensureMasterGain(ctx);

    oscillator.type = "sine";
    oscillator.frequency.value = 1046.5;

    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(0.2, startTime + 0.01);
    gainNode.gain.linearRampToValueAtTime(0, startTime + 0.12);

    oscillator.connect(gainNode);
    gainNode.connect(masterGain);
    oscillator.start(Math.max(startTime, ctx.currentTime + 0.02));
    oscillator.stop(startTime + 0.12);
    this.scheduledNodes.push(oscillator);
  }

  private scheduleCountdown(startTime: number) {
    const speeds = [3, 2, 1];
    speeds.forEach((count, index) => {
      const eventTime = startTime + index * 1.0;
      this.scheduleOscillatorAtTime(eventTime, 880 - index * 120, 0.18);
      this.scheduleVoicePromptAtTime(eventTime + 0.05, String(count));
    });
  }

  private scheduleMetronome(startTime: number, duration: number, bpm: number) {
    const interval = 60 / bpm;
    let current = startTime;
    while (current < startTime + duration) {
      this.scheduleOscillatorAtTime(current, 880, 0.08);
      current += interval;
    }
  }

  private scheduleIntervalBeep(
    startTime: number,
    duration: number,
    intervalSeconds: number,
  ) {
    if (intervalSeconds <= 0) return;
    let current = startTime + intervalSeconds;
    while (current < startTime + duration) {
      this.scheduleOscillatorAtTime(current, 620, 0.12);
      current += intervalSeconds;
    }
  }

  private scheduleAudioOverlay(
    startTime: number,
    duration: number,
    overlay: OverlayConfig,
  ) {
    if (!overlay.audioBuffer) return;

    const ctx = this.getContext();
    const offset = overlay.startAtSec ?? 0;
    const repeatEverySec =
      overlay.repeatEverySec && overlay.repeatEverySec > 0
        ? overlay.repeatEverySec
        : 0;
    let current = startTime + offset;

    while (current < startTime + duration) {
      const source = ctx.createBufferSource();
      source.buffer = overlay.audioBuffer;
      source.connect(ctx.destination);
      source.start(current);
      this.scheduledNodes.push(source);
      current += repeatEverySec > 0 ? repeatEverySec : duration + 1;
    }
  }

  private prepareSpeechSynthesis() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    try {
      const synth = window.speechSynthesis;
      synth.cancel();
      if (synth.paused) {
        synth.resume();
      }
      this.speechReady = true;
    } catch (error) {
      console.warn("Speech synthesis could not be prepared:", error);
      this.speechReady = false;
    }
  }

  private speakVoicePrompt(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return false;
    }

    try {
      const synth = window.speechSynthesis;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;
      utterance.onerror = (event) => {
        console.warn("Speech synthesis failed:", event.error);
      };

      if (!this.speechReady) {
        this.prepareSpeechSynthesis();
      }

      synth.speak(utterance);
      return true;
    } catch (error) {
      console.warn("Speech synthesis could not speak:", error);
      return false;
    }
  }

  private scheduleVoicePromptAtTime(startTime: number, text: string) {
    const now = this.getContext().currentTime;
    const delayMs = Math.max(0, (startTime - now) * 1000);

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const timeoutId = window.setTimeout(() => {
        const spoke = this.speakVoicePrompt(text);
        if (!spoke) {
          this.scheduleOscillatorAtTime(startTime, 440, 0.12);
        }
      }, delayMs);
      this.speechTimeouts.push(timeoutId);
    } else {
      this.scheduleOscillatorAtTime(startTime, 440, 0.12);
    }
  }

  private scheduleVoicePrompts(startTime: number, prompts: VoicePrompt[]) {
    prompts.forEach((prompt) => {
      if (prompt.timeSec >= 0) {
        this.scheduleVoicePromptAtTime(startTime + prompt.timeSec, prompt.text);
      }
    });
  }

  async play(audioBuffer: AudioBuffer, config: WorkoutConfig) {
    await this.resumeContext();
    await new Promise((resolve) => window.setTimeout(resolve, 120));
    this.prepareSpeechSynthesis();

    this.stop();

    const ctx = this.getContext();
    const now = ctx.currentTime;
    const playbackStartTime = Math.max(now + 0.1, now + 0.5);
    this.scheduleWarmupBeep(playbackStartTime);

    for (const overlay of config.overlays) {
      const overlayStartTime = playbackStartTime + (overlay.startAtSec ?? 0);
      switch (overlay.type) {
        case "metronome":
          this.scheduleMetronome(
            overlayStartTime,
            config.durationSeconds,
            overlay.bpm ?? 120,
          );
          break;
        case "interval":
          this.scheduleIntervalBeep(
            overlayStartTime,
            config.durationSeconds,
            overlay.intervalSeconds ?? 30,
          );
          break;
        case "countdown":
          this.scheduleCountdown(playbackStartTime - 0.5);
          break;
        case "audio":
          this.scheduleAudioOverlay(
            overlayStartTime,
            config.durationSeconds,
            overlay,
          );
          break;
      }
    }

    if (config.voicePrompts.length > 0) {
      this.scheduleVoicePrompts(playbackStartTime, config.voicePrompts);
    }

    return new Promise<void>((resolve) => {
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => {
        this.clearScheduledEvents();
        resolve();
      };
      source.start(playbackStartTime);
      this.source = source;
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

    this.scheduledNodes.forEach((node) => {
      try {
        node.stop();
      } catch {
        // ignore if already stopped or not yet scheduled
      }
    });
    this.scheduledNodes = [];

    this.clearScheduledEvents();
  }

  private clearScheduledEvents() {
    this.speechTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
    this.speechTimeouts = [];
  }
}

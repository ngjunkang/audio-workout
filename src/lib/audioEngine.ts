export interface VoicePrompt {
  timeSec: number;
  text: string;
}

export interface WorkoutConfig {
  bpm: number;
  metronomeEnabled: boolean;
  intervalEnabled: boolean;
  intervalSeconds: number;
  countdownEnabled: boolean;
  voicePrompts: VoicePrompt[];
}

export class AudioWorkoutEngine {
  private context: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private scheduledTimeouts: number[] = [];
  private speechTimeouts: number[] = [];
  private endResolver: (() => void) | null = null;

  private getContext() {
    if (!this.context) {
      this.context = new AudioContext();
    }
    return this.context;
  }

  async resumeContext() {
    const ctx = this.getContext();
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
  }

  async decodeAudioData(arrayBuffer: ArrayBuffer) {
    const ctx = this.getContext();
    return await ctx.decodeAudioData(arrayBuffer);
  }

  private scheduleOscillatorAtTime(startTime: number, frequency = 880, duration = 0.12) {
    const ctx = this.getContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(0.2, startTime + 0.008);
    gainNode.gain.setValueAtTime(0.2, startTime + duration - 0.02);
    gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

    oscillator.connect(gainNode).connect(ctx.destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
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

  private scheduleIntervalBeep(startTime: number, duration: number, intervalSeconds: number) {
    if (intervalSeconds <= 0) return;
    let current = startTime + intervalSeconds;
    while (current < startTime + duration) {
      this.scheduleOscillatorAtTime(current, 620, 0.12);
      current += intervalSeconds;
    }
  }

  private scheduleVoicePromptAtTime(startTime: number, text: string) {
    const now = this.getContext().currentTime;
    const delayMs = Math.max(0, (startTime - now) * 1000);

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const timeoutId = window.setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1;
        utterance.pitch = 1;
        window.speechSynthesis.speak(utterance);
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

    const ctx = this.getContext();
    const now = ctx.currentTime;
    const countdownOffset = config.countdownEnabled ? 3.2 : 0;
    const playbackStartTime = now + 0.5 + countdownOffset;

    if (config.countdownEnabled) {
      this.scheduleCountdown(now + 0.5);
    }

    if (config.metronomeEnabled) {
      this.scheduleMetronome(playbackStartTime, audioBuffer.duration, config.bpm);
    }

    if (config.intervalEnabled) {
      this.scheduleIntervalBeep(playbackStartTime, audioBuffer.duration, config.intervalSeconds);
    }

    if (config.voicePrompts.length > 0) {
      this.scheduleVoicePrompts(playbackStartTime, config.voicePrompts);
    }

    return new Promise<void>((resolve) => {
      this.stop();
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
    window.clearTimeouts?.(this.scheduledTimeouts);
    this.clearScheduledEvents();
  }

  private clearScheduledEvents() {
    this.scheduledTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
    this.scheduledTimeouts = [];
    this.speechTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
    this.speechTimeouts = [];
  }
}

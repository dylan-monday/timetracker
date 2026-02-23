// Deep crystalline bell sounds using Web Audio API
// Inspired by Björk's "Frosti" - soft, resonant, contemplative

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }

  return audioContext;
}

interface BellOptions {
  frequency?: number;
  duration?: number;
  volume?: number;
  detune?: number;
}

function playBell(options: BellOptions = {}): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  // Resume context if suspended (browser autoplay policy)
  if (ctx.state === "suspended") {
    void ctx.resume();
  }

  const {
    frequency = 440,
    duration = 2.5,
    volume = 0.12,
    detune = 0
  } = options;

  const now = ctx.currentTime;

  // Main bell tone
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = "sine";
  osc1.frequency.value = frequency;
  osc1.detune.value = detune;

  // Soft attack, long decay (bell-like envelope)
  gain1.gain.setValueAtTime(0, now);
  gain1.gain.linearRampToValueAtTime(volume, now + 0.008);
  gain1.gain.exponentialRampToValueAtTime(volume * 0.6, now + 0.15);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc1.connect(gain1);
  gain1.connect(ctx.destination);

  osc1.start(now);
  osc1.stop(now + duration);

  // First overtone (octave + fifth, quieter)
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = "sine";
  osc2.frequency.value = frequency * 3; // Third harmonic
  osc2.detune.value = detune + 2; // Slight shimmer

  gain2.gain.setValueAtTime(0, now);
  gain2.gain.linearRampToValueAtTime(volume * 0.15, now + 0.004);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.5);

  osc2.connect(gain2);
  gain2.connect(ctx.destination);

  osc2.start(now);
  osc2.stop(now + duration * 0.5);

  // Sub-bass undertone for depth
  const osc3 = ctx.createOscillator();
  const gain3 = ctx.createGain();
  osc3.type = "sine";
  osc3.frequency.value = frequency * 0.5; // Octave below

  gain3.gain.setValueAtTime(0, now);
  gain3.gain.linearRampToValueAtTime(volume * 0.25, now + 0.02);
  gain3.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.8);

  osc3.connect(gain3);
  gain3.connect(ctx.destination);

  osc3.start(now);
  osc3.stop(now + duration * 0.8);
}

// Preset sounds for different interactions
export const sounds = {
  // Soft high bell - for successful saves, confirmations
  save: () => playBell({ frequency: 698, duration: 2.0, volume: 0.10 }), // F5

  // Medium warm bell - for navigation, selections
  navigate: () => playBell({ frequency: 523, duration: 1.5, volume: 0.08 }), // C5

  // Deep resonant bell - for adding new items
  add: () => playBell({ frequency: 349, duration: 2.5, volume: 0.12 }), // F4

  // Two-note chime - for completing/checking items
  complete: () => {
    playBell({ frequency: 523, duration: 1.8, volume: 0.08 }); // C5
    setTimeout(() => playBell({ frequency: 659, duration: 2.0, volume: 0.09 }), 120); // E5
  },

  // Gentle low tone - for closing/dismissing
  close: () => playBell({ frequency: 262, duration: 1.2, volume: 0.06, detune: -5 }), // C4

  // Soft error/warning - slightly dissonant
  error: () => playBell({ frequency: 311, duration: 1.5, volume: 0.08, detune: 15 }), // Eb4 slightly sharp
};

// Sound preference (persisted in localStorage)
const SOUND_ENABLED_KEY = "mp-time-sounds-enabled";

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const stored = window.localStorage.getItem(SOUND_ENABLED_KEY);
  // Default to enabled
  return stored !== "false";
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SOUND_ENABLED_KEY, String(enabled));
}

// Play sound only if enabled
export function playSound(sound: keyof typeof sounds): void {
  if (isSoundEnabled()) {
    sounds[sound]();
  }
}

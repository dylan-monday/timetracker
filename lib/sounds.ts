// Warm, organic bell sounds using Web Audio API
// Inspired by Björk's "Frosti" - soft, resonant, contemplative
// With subtle detuning and harmonic complexity for warmth

let audioContext: AudioContext | null = null;
let isUnlocked = false;
let unlockListenersAdded = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } catch {
      return null;
    }
  }

  return audioContext;
}

// Unlock AudioContext - must be called during a user gesture
function unlockAudioContext(): void {
  if (isUnlocked) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === "suspended") {
    // On iOS, we need to play a silent buffer to unlock
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);

    ctx.resume().then(() => {
      isUnlocked = true;
    }).catch(() => {
      // Ignore - will retry
    });
  } else if (ctx.state === "running") {
    isUnlocked = true;
  }
}

// Set up listeners for user gestures to unlock AudioContext
function setupAudioUnlock(): void {
  if (typeof window === "undefined" || unlockListenersAdded) return;
  unlockListenersAdded = true;

  const events = ["touchstart", "touchend", "click", "keydown"];

  const unlockHandler = () => {
    unlockAudioContext();
    // Remove listeners once unlocked
    if (isUnlocked) {
      events.forEach((event) => {
        document.removeEventListener(event, unlockHandler, true);
      });
    }
  };

  events.forEach((event) => {
    document.addEventListener(event, unlockHandler, {
      capture: true,
      passive: true
    });
  });
}

// Export for components to call on mount
export function initAudioContext(): void {
  setupAudioUnlock();
}

// Initialize audio unlock on module load (client-side only)
if (typeof window !== "undefined") {
  if (document.readyState === "complete" || document.readyState === "interactive") {
    setupAudioUnlock();
  } else {
    document.addEventListener("DOMContentLoaded", setupAudioUnlock);
  }
}

interface BellOptions {
  frequency?: number;
  duration?: number;
  volume?: number;
  warmth?: number; // 0-1, adds detuning and harmonics
}

function playBell(options: BellOptions = {}): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  // Try to unlock/resume context if suspended
  if (ctx.state === "suspended") {
    void ctx.resume();
    // Don't return early - the sound might play if we're in a user gesture
  }

  // Still try to play even if suspended - it might work if we're in a gesture handler
  if (ctx.state !== "running" && ctx.state !== "suspended") {
    return;
  }

  const {
    frequency = 220,
    duration = 3.0,
    volume = 0.11,
    warmth = 0.6
  } = options;

  const now = ctx.currentTime;

  // Slight random detune for organic feel (different each strike)
  const drift = (Math.random() - 0.5) * 4 * warmth;

  // Main bell tone - slightly detuned pair for warmth
  const osc1a = ctx.createOscillator();
  const osc1b = ctx.createOscillator();
  const gain1 = ctx.createGain();

  osc1a.type = "sine";
  osc1a.frequency.value = frequency;
  osc1a.detune.value = drift - 3 * warmth;

  osc1b.type = "sine";
  osc1b.frequency.value = frequency;
  osc1b.detune.value = drift + 3 * warmth;

  // Soft attack, long decay with slight pitch drop (cooling metal)
  gain1.gain.setValueAtTime(0, now);
  gain1.gain.linearRampToValueAtTime(volume, now + 0.012);
  gain1.gain.exponentialRampToValueAtTime(volume * 0.5, now + 0.2);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + duration);

  // Subtle pitch drift down during decay
  osc1a.frequency.setValueAtTime(frequency, now);
  osc1a.frequency.exponentialRampToValueAtTime(frequency * 0.995, now + duration);
  osc1b.frequency.setValueAtTime(frequency, now);
  osc1b.frequency.exponentialRampToValueAtTime(frequency * 0.993, now + duration);

  osc1a.connect(gain1);
  osc1b.connect(gain1);
  gain1.connect(ctx.destination);

  osc1a.start(now);
  osc1b.start(now);
  osc1a.stop(now + duration);
  osc1b.stop(now + duration);

  // Second harmonic (octave) - detuned pair
  const osc2a = ctx.createOscillator();
  const osc2b = ctx.createOscillator();
  const gain2 = ctx.createGain();

  osc2a.type = "sine";
  osc2a.frequency.value = frequency * 2;
  osc2a.detune.value = drift + 5 * warmth;

  osc2b.type = "sine";
  osc2b.frequency.value = frequency * 2;
  osc2b.detune.value = drift - 4 * warmth;

  gain2.gain.setValueAtTime(0, now);
  gain2.gain.linearRampToValueAtTime(volume * 0.18, now + 0.006);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.6);

  osc2a.connect(gain2);
  osc2b.connect(gain2);
  gain2.connect(ctx.destination);

  osc2a.start(now);
  osc2b.start(now);
  osc2a.stop(now + duration * 0.6);
  osc2b.stop(now + duration * 0.6);

  // Sub undertone for depth and warmth
  const osc3 = ctx.createOscillator();
  const gain3 = ctx.createGain();
  osc3.type = "sine";
  osc3.frequency.value = frequency * 0.5;
  osc3.detune.value = drift * 0.5;

  gain3.gain.setValueAtTime(0, now);
  gain3.gain.linearRampToValueAtTime(volume * 0.3, now + 0.025);
  gain3.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.9);

  osc3.connect(gain3);
  gain3.connect(ctx.destination);

  osc3.start(now);
  osc3.stop(now + duration * 0.9);

  // Touch of fifth harmonic for shimmer (very quiet)
  if (warmth > 0.3) {
    const osc4 = ctx.createOscillator();
    const gain4 = ctx.createGain();
    osc4.type = "sine";
    osc4.frequency.value = frequency * 3;
    osc4.detune.value = drift + 8;

    gain4.gain.setValueAtTime(0, now);
    gain4.gain.linearRampToValueAtTime(volume * 0.06 * warmth, now + 0.003);
    gain4.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.3);

    osc4.connect(gain4);
    gain4.connect(ctx.destination);

    osc4.start(now);
    osc4.stop(now + duration * 0.3);
  }
}

// Preset sounds for different interactions
// Lower pitches, warmer character
export const sounds = {
  // Warm mid bell - for successful saves, confirmations
  save: () => playBell({ frequency: 294, duration: 2.5, volume: 0.10, warmth: 0.7 }), // D4

  // Soft low bell - generic navigation/selections
  navigate: () => playBell({ frequency: 220, duration: 2.0, volume: 0.08, warmth: 0.5 }), // A3

  // Navigation: Week - grounded, present (where you work)
  navWeek: () => playBell({ frequency: 196, duration: 2.2, volume: 0.09, warmth: 0.6 }), // G3

  // Navigation: Trends - slightly higher, reflective (looking at patterns)
  navTrends: () => playBell({ frequency: 262, duration: 2.4, volume: 0.08, warmth: 0.7 }), // C4

  // Navigation: Settings - neutral, practical
  navSettings: () => playBell({ frequency: 175, duration: 1.8, volume: 0.07, warmth: 0.4 }), // F3

  // Deep resonant bell - for adding new items
  add: () => playBell({ frequency: 175, duration: 3.0, volume: 0.11, warmth: 0.8 }), // F3

  // Two-note chime - for completing/checking items
  complete: () => {
    playBell({ frequency: 262, duration: 2.2, volume: 0.08, warmth: 0.6 }); // C4
    setTimeout(() => playBell({ frequency: 330, duration: 2.5, volume: 0.09, warmth: 0.7 }), 150); // E4
  },

  // Gentle low tone - for closing/dismissing
  close: () => playBell({ frequency: 147, duration: 1.8, volume: 0.07, warmth: 0.4 }), // D3

  // Soft error/warning - slightly darker
  error: () => playBell({ frequency: 156, duration: 2.0, volume: 0.08, warmth: 0.3 }), // Eb3
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

// Type for sound names
export type SoundName = keyof typeof sounds;

// Play sound only if enabled
export function playSound(sound: SoundName): void {
  if (isSoundEnabled()) {
    sounds[sound]();
  }
}

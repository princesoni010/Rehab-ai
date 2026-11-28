/**
 * ElevenLabs TTS Service — Drop-in replacement for BhashiniTTSService
 * ─────────────────────────────────────────────────────────────────────
 * - Calls the backend proxy POST /api/v1/tts/speak (API key stays server-side)
 * - In-memory audio cache: same phrase -> no extra network call
 * - Sequential prewarm + cooldown circuit-breaker on quota/network errors
 * - Falls back to Web Speech API smoothly if ElevenLabs fails
 */

import { VOICE_PHRASES, SUPPORTED_LANGUAGES } from "./bhashiniTTS";

export { VOICE_PHRASES, SUPPORTED_LANGUAGES };
export { buildRepSpeech, buildSetSpeech } from "./bhashiniTTS";

type ExercisePhraseMap = Record<string, Record<string, Record<string, string>>>;

const EXERCISE_PHRASES: ExercisePhraseMap = {
  // ── ARM exercises ──
  "forward arm raises": {
    hi: { up: "हाथ ऊपर उठाएं।", down: "हाथ नीचे लाएं।" },
    en: { up: "Raise your arms up.", down: "Lower your arms down." },
  },
  "side arm raises": {
    hi: { up: "हाथ बाजू में उठाएं।", down: "हाथ नीचे लाएं।" },
    en: { up: "Raise arms to the side.", down: "Lower your arms." },
  },
  "wall push-ups": {
    hi: { up: "पीछे हटें।", down: "दीवार की तरफ झुकें।" },
    en: { up: "Push back.", down: "Lean towards the wall." },
  },
  // ── HEEL exercises ──
  "heel raises": {
    hi: { up: "एड़ी ऊपर उठाएं।", down: "एड़ी नीचे रखें।" },
    en: { up: "Rise on your toes.", down: "Lower your heels." },
  },
  // ── MARCHING ──
  "marching": {
    hi: {
      up: "घुटना ऊपर उठाएं।",
      down: "पैर नीचे रखें।",
      "left lifted": "बाएं घुटने को ऊपर रखें।",
      "right lifted": "दाएं घुटने को ऊपर रखें।",
    },
    en: {
      up: "Lift your knee up.",
      down: "Step down.",
      "left lifted": "Hold left knee up.",
      "right lifted": "Hold right knee up.",
    },
  },
  // ── HIP exercises ──
  "standing hip abduction": {
    hi: {
      up: "पैर बाहर उठाएं।",
      down: "पैर वापस लाएं।",
      "left lifted": "बायां पैर उठाएं।",
      "right lifted": "दायां पैर उठाएं।",
    },
    en: {
      up: "Lift leg to the side.",
      down: "Lower your leg.",
      "left lifted": "Lift left leg.",
      "right lifted": "Lift right leg.",
    },
  },
  "standing hip extension": {
    hi: { up: "पैर पीछे उठाएं।", down: "पैर वापस लाएं।" },
    en: { up: "Lift leg backward.", down: "Lower your leg." },
  },
  // ── SQUATS (default "up"/"down") ──
  "squats": {
    hi: { up: "खड़े हों।", down: "नीचे बैठें।" },
    en: { up: "Stand up.", down: "Squat down." },
  },
};

const LANG_CODES: Record<string, string> = {
  hi: "hi-IN",
  en: "en-IN",
  ta: "ta-IN",
  te: "te-IN",
  mr: "mr-IN",
  bn: "bn-IN",
  gu: "gu-IN",
  pa: "pa-IN",
  kn: "kn-IN",
  ml: "ml-IN",
};

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";
const REMOTE_TTS_COOLDOWN_MS = 60_000;

function normalizeExerciseName(name: string): string {
  return name.toLowerCase().trim();
}

function getExercisePhrase(stageKey: string, exerciseName: string, lang: string): string | null {
  const normalized = normalizeExerciseName(exerciseName);
  if (!normalized) return null;
  for (const [key, langMap] of Object.entries(EXERCISE_PHRASES)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return langMap[lang]?.[stageKey] ?? langMap["en"]?.[stageKey] ?? null;
    }
  }
  return null;
}

function getToken(): string {
  return localStorage.getItem("rehab_access_token") ?? "";
}

function pickWebVoice(langCode: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const prefix = langCode.split("-")[0];
  return (
    voices.find((v) => v.lang === langCode) ??
    voices.find((v) => v.lang.startsWith(prefix)) ??
    null
  );
}

function webSpeechFallback(text: string, lang: string): void {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = LANG_CODES[lang] ?? "hi-IN";
  utter.rate = 0.92;
  const best = pickWebVoice(utter.lang);
  if (best) utter.voice = best;

  const resumeGuard = setInterval(() => {
    if (window.speechSynthesis.paused) window.speechSynthesis.resume();
  }, 2000);
  utter.onend = () => clearInterval(resumeGuard);
  utter.onerror = () => clearInterval(resumeGuard);

  window.speechSynthesis.speak(utter);
}

export class ElevenLabsTTSService {
  private lang: string;
  private cache = new Map<string, ArrayBuffer>();
  private audioCtx: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private playbackId = 0;
  private remoteCooldownUntil = 0;

  constructor(
    _apiKey = "",
    _userId = "",
    lang = "hi",
    _gender: "male" | "female" = "female",
  ) {
    this.lang = lang;
  }

  setLanguage(lang: string) {
    this.lang = lang;
  }

  setGender(_g: "male" | "female") {
    /* ElevenLabs voice is chosen by language */
  }

  phrase(key: string): string {
    return (
      VOICE_PHRASES[this.lang]?.[key] ??
      VOICE_PHRASES["en"]?.[key] ??
      key
    );
  }

  async sayPhrase(key: string): Promise<void> {
    await this.speak(this.phrase(key));
  }

  /** Exercise-aware stage phrase — picks the right words based on exercise type */
  async sayPhraseForExercise(stageKey: string, exerciseName: string): Promise<void> {
    const exerciseText = getExercisePhrase(stageKey, exerciseName, this.lang);
    await this.speak(exerciseText ?? this.phrase(stageKey));
  }

  async speak(text: string): Promise<void> {
    const clean = text.trim();
    if (!clean) return;

    this.stop();
    const myPlaybackId = this.playbackId;

    if (Date.now() < this.remoteCooldownUntil) {
      webSpeechFallback(clean, this.lang);
      return;
    }

    try {
      const audioData = await this._fetchAudio(clean);
      if (myPlaybackId !== this.playbackId) return; // superseded by newer call
      await this._playBuffer(audioData, myPlaybackId);
    } catch (err) {
      if (myPlaybackId !== this.playbackId) return;
      console.warn("[ElevenLabs] Falling back to Web Speech API:", err);
      webSpeechFallback(clean, this.lang);
    }
  }

  stop(): void {
    this.playbackId += 1;
    try {
      this.currentSource?.stop();
    } catch {
      /* already stopped */
    }
    this.currentSource = null;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }

  /** Sequentially pre-fetch common phrases without tripping ElevenLabs concurrency limits */
  async prewarm(keys: string[]): Promise<void> {
    for (const k of keys) {
      if (Date.now() < this.remoteCooldownUntil) break;
      try {
        await this._fetchAudio(this.phrase(k));
      } catch {
        break;
      }
    }
  }

  private async _fetchAudio(text: string): Promise<ArrayBuffer> {
    const cacheKey = `${this.lang}:${text}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const token = getToken();
    const res = await fetch(`${API_BASE}/tts/speak`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ text, lang: this.lang }),
    });

    if (!res.ok) {
      if (res.status >= 500 || res.status === 401 || res.status === 402 || res.status === 429) {
        this.remoteCooldownUntil = Date.now() + REMOTE_TTS_COOLDOWN_MS;
      }
      throw new Error(`TTS API error ${res.status}: ${await res.text()}`);
    }

    const buffer = await res.arrayBuffer();
    this.cache.set(cacheKey, buffer);
    return buffer;
  }

  private async _playBuffer(data: ArrayBuffer, expectedId: number): Promise<void> {
    if (!this.audioCtx) {
      this.audioCtx = new AudioContext();
    }
    if (this.audioCtx.state === "suspended") {
      await this.audioCtx.resume();
    }
    if (expectedId !== this.playbackId) return;

    const decoded = await this.audioCtx.decodeAudioData(data.slice(0));
    if (expectedId !== this.playbackId) return;

    const source = this.audioCtx.createBufferSource();
    source.buffer = decoded;
    source.connect(this.audioCtx.destination);

    await new Promise<void>((resolve) => {
      source.onended = () => {
        if (this.currentSource === source) {
          this.currentSource = null;
        }
        resolve();
      };
      this.currentSource = source;
      source.start(0);
    });
  }
}

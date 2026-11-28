/**
 * Voice Assistant — Web Speech API (Browser built-in, 100% free, no API key)
 * Supports Hindi, English, and other Indian languages natively.
 * Works in Chrome, Edge, Safari. Best Hindi voice on Chrome/Windows.
 *
 * Interface kept identical to the previous Bhashini version
 * so PatientExercisePage.tsx needs no structural changes.
 */

// ─── Language Code Mapping ───────────────────────────────────────────────────

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

// ─── Exercise Phrases (Hindi + English) ──────────────────────────────────────

export const VOICE_PHRASES: Record<string, Record<string, string>> = {
  hi: {
    // Session lifecycle
    session_started: "व्यायाम शुरू हुआ। तैयार हो जाएं।",
    all_done:        "शाबाश! बहुत अच्छा किया।",
    rest_time:       "आराम करें।",
    get_ready:       "तैयार हो जाएं। अगला सेट शुरू होगा।",
    connecting:      "सर्वर से जुड़ रहे हैं।",
    // Stage transitions
    up:              "खड़े हों।",
    down:            "नीचे बैठें।",
    "left lifted":   "अब दाहिना पैर उठाएं।",
    "right lifted":  "अब बायां पैर उठाएं।",
    // Generic coaching
    keep_going:      "जारी रखें।",
    good_form:       "बढ़िया फॉर्म!",
    slow_down:       "धीरे करें।",
    stand_straight:  "सीधे खड़े रहें।",
  },
  en: {
    session_started: "Session started. Get ready.",
    all_done:        "Great job! All sets complete.",
    rest_time:       "Rest now.",
    get_ready:       "Get ready. Next set starting.",
    connecting:      "Connecting to server.",
    up:              "Stand up.",
    down:            "Squat down.",
    "left lifted":   "Now lift right leg.",
    "right lifted":  "Now lift left leg.",
    keep_going:      "Keep going.",
    good_form:       "Good form!",
    slow_down:       "Slow down.",
    stand_straight:  "Stand straight.",
  },
  ta: {
    session_started: "அமர்வு தொடங்கியது. தயாராகுங்கள்.",
    all_done:        "சாபாஷ்! அனைத்தும் முடிந்தது.",
    rest_time:       "ஓய்வெடுங்கள்.",
    get_ready:       "தயாராகுங்கள்.",
    up:              "நிமிர்ந்து நில்லுங்கள்.",
    down:            "கீழே உட்காருங்கள்.",
    keep_going:      "தொடர்ந்து செய்யுங்கள்.",
  },
  te: {
    session_started: "సెషన్ ప్రారంభమైంది. సిద్ధంగా ఉండండి.",
    all_done:        "అభినందనలు! పూర్తయింది.",
    rest_time:       "విశ్రాంతి తీసుకోండి.",
    get_ready:       "సిద్ధంగా ఉండండి.",
    up:              "నిటారుగా నిల్చోండి.",
    down:            "కింద కూర్చోండి.",
    keep_going:      "కొనసాగించండి.",
  },
  mr: {
    session_started: "सत्र सुरू झाले. तयार व्हा.",
    all_done:        "शाब्बास! सर्व सेट पूर्ण झाले.",
    rest_time:       "आराम करा.",
    get_ready:       "तयार व्हा.",
    up:              "उभे राहा.",
    down:            "खाली बसा.",
    keep_going:      "चालू ठेवा.",
  },
};

// ─── Rep / Set Speech Builders ───────────────────────────────────────────────

export function buildRepSpeech(lang: string, repNumber: number, score: number): string {
  const s = Math.round(score);
  if (lang === "hi") return `रेप ${repNumber} पूरा। स्कोर ${s}।`;
  if (lang === "ta") return `ரெப் ${repNumber} முடிந்தது. ஸ்கோர் ${s}.`;
  if (lang === "te") return `రెప్ ${repNumber} పూర్తయింది. స్కోర్ ${s}.`;
  if (lang === "mr") return `रेप ${repNumber} पूर्ण. स्कोर ${s}.`;
  return `Rep ${repNumber} done. Score ${s}.`;
}

export function buildSetSpeech(lang: string, setNumber: number): string {
  if (lang === "hi") return `सेट ${setNumber} पूरा। अब आराम करें।`;
  if (lang === "ta") return `செட் ${setNumber} முடிந்தது. ஓய்வெடுங்கள்.`;
  if (lang === "te") return `సెట్ ${setNumber} పూర్తయింది. విశ్రాంతి.`;
  if (lang === "mr") return `सेट ${setNumber} पूर्ण. आराम करा.`;
  return `Set ${setNumber} complete. Rest now.`;
}

// ─── Supported Languages ─────────────────────────────────────────────────────

export const SUPPORTED_LANGUAGES = [
  { code: "hi", label: "हिंदी" },
  { code: "en", label: "English" },
  { code: "ta", label: "தமிழ்" },
  { code: "te", label: "తెలుగు" },
  { code: "mr", label: "मराठी" },
  { code: "bn", label: "বাংলা" },
  { code: "gu", label: "ગુજરાતી" },
  { code: "pa", label: "ਪੰਜਾਬੀ" },
  { code: "kn", label: "ಕನ್ನಡ" },
  { code: "ml", label: "മലയാളം" },
];

// ─── TTS Service (Web Speech API) ────────────────────────────────────────────

export class BhashiniTTSService {
  private language: string;
  private gender: "male" | "female";
  private voicesReady = false;

  constructor(
    _apiKey = "",       // unused — kept for interface compatibility
    _userId  = "",      // unused
    language = "hi",
    gender: "male" | "female" = "female"
  ) {
    this.language = language;
    this.gender   = gender;
    this._preloadVoices();
  }

  /** Trigger voice list population (Chrome loads voices async on first call) */
  private _preloadVoices() {
    if (!("speechSynthesis" in window)) return;
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      this.voicesReady = true;
    } else {
      window.speechSynthesis.addEventListener("voiceschanged", () => {
        this.voicesReady = true;
      }, { once: true });
    }
  }

  setLanguage(lang: string) {
    this.language = lang;
  }

  setGender(g: "male" | "female") {
    this.gender = g;
  }

  /** Translate a phrase key → text in current language */
  phrase(key: string): string {
    return (
      VOICE_PHRASES[this.language]?.[key] ??
      VOICE_PHRASES["en"]?.[key] ??
      key
    );
  }

  /** Speak a named phrase key */
  async sayPhrase(key: string): Promise<void> {
    await this.speak(this.phrase(key));
  }

  /** Exercise-aware stage phrase — picks right words for arm raises, heel raises etc. */
  async sayPhraseForExercise(stageKey: string, _exerciseName: string): Promise<void> {
    // bhashiniTTS (fallback) uses generic phrases — ElevenLabs handles the smart mapping
    await this.sayPhrase(stageKey);
  }

  /** Speak arbitrary text using the browser's Speech Synthesis */
  async speak(text: string): Promise<void> {
    if (!text.trim() || !("speechSynthesis" in window)) return;

    // Cancel any ongoing speech immediately
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang   = LANG_CODES[this.language] ?? "hi-IN";
    utterance.rate   = 0.92;                        // slightly slower for clarity
    utterance.pitch  = this.gender === "female" ? 1.1 : 0.85;
    utterance.volume = 1.0;

    // Pick the best available voice for the target language
    const best = this._pickVoice(utterance.lang);
    if (best) utterance.voice = best;

    // Chrome bug: synthesis stalls after ~15s of silence — resume guard
    const resumeGuard = setInterval(() => {
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    }, 2000);
    utterance.onend = () => clearInterval(resumeGuard);
    utterance.onerror = () => clearInterval(resumeGuard);

    window.speechSynthesis.speak(utterance);
  }

  stop() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private _pickVoice(langCode: string): SpeechSynthesisVoice | null {
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;

    const prefix = langCode.split("-")[0]; // "hi" from "hi-IN"

    // Priority: exact lang match → prefix match → first available
    return (
      voices.find(v => v.lang === langCode) ??
      voices.find(v => v.lang.startsWith(prefix)) ??
      null
    );
  }
}

/** Utility: list all voices available in this browser */
export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (!("speechSynthesis" in window)) return [];
  return window.speechSynthesis.getVoices();
}

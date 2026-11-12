/**
 * Form Fault Detection Engine
 *
 * Analyses raw MediaPipe landmarks on the client-side (runs every frame)
 * to detect compensatory movement patterns and common form errors.
 *
 * MediaPipe Pose Landmark indices (relevant subset):
 *   11/12 – left/right shoulder
 *   13/14 – left/right elbow
 *   15/16 – left/right wrist
 *   23/24 – left/right hip
 *   25/26 – left/right knee
 *   27/28 – left/right ankle
 */

// ─── Types ──────────────────────────────────────────────────────────────

export type FaultSeverity = "ok" | "warning" | "error";

export interface FormFaultResult {
  isValid: boolean;
  faultCode: string | null;
  faultMessage: string | null;
  severity: FaultSeverity;
  /** Coaching cue to speak aloud (shorter than faultMessage). */
  voiceCue: string | null;
}

interface Landmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────

const OK_RESULT: FormFaultResult = {
  isValid: true,
  faultCode: null,
  faultMessage: null,
  severity: "ok",
  voiceCue: null,
};

/** Euclidean distance in the X-Y plane between two landmarks. */
function dist2D(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** 3-point angle in degrees (vertex at `b`). */
function angle3pt(a: Landmark, b: Landmark, c: Landmark): number {
  const ba = { x: a.x - b.x, y: a.y - b.y };
  const bc = { x: c.x - b.x, y: c.y - b.y };
  const dot = ba.x * bc.x + ba.y * bc.y;
  const magBA = Math.hypot(ba.x, ba.y);
  const magBC = Math.hypot(bc.x, bc.y);
  if (magBA === 0 || magBC === 0) return 0;
  const cosAngle = Math.max(-1, Math.min(1, dot / (magBA * magBC)));
  return (Math.acos(cosAngle) * 180) / Math.PI;
}

/** Returns true when both landmarks are sufficiently visible. */
function visible(a: Landmark, b: Landmark, threshold = 0.4): boolean {
  return (a.visibility ?? 1) >= threshold && (b.visibility ?? 1) >= threshold;
}

function fault(
  code: string,
  message: string,
  voiceCue: string,
  severity: FaultSeverity = "warning"
): FormFaultResult {
  return { isValid: false, faultCode: code, faultMessage: message, severity, voiceCue };
}

// ─── Exercise-specific checkers ─────────────────────────────────────────

/**
 * **Squats**
 *   1. Knee Valgus – knees collapsing inward (knee distance < 0.65 × ankle distance)
 *   2. Excessive Forward Lean – torso tilts too far forward (shoulder X well ahead of hip X)
 */
function checkSquats(lm: Landmark[]): FormFaultResult {
  const lKnee = lm[25], rKnee = lm[26];
  const lAnkle = lm[27], rAnkle = lm[28];
  const lShoulder = lm[11], rShoulder = lm[12];
  const lHip = lm[23], rHip = lm[24];

  // --- Knee Valgus ---
  if (visible(lKnee, rKnee) && visible(lAnkle, rAnkle)) {
    const kneeDist = dist2D(lKnee, rKnee);
    const ankleDist = dist2D(lAnkle, rAnkle);

    // Only check when we're actually in a squat (knees are bent)
    const kneeAngleLeft = angle3pt(lHip, lKnee, lAnkle);
    const isBent = kneeAngleLeft < 155; // some knee flexion

    if (isBent && ankleDist > 0.01 && kneeDist / ankleDist < 0.60) {
      return fault(
        "SQUAT_KNEE_VALGUS",
        "Knees are collapsing inward — push them out over your toes.",
        "Push your knees out. Keep them aligned with your toes.",
        "error"
      );
    }
  }

  // --- Excessive Forward Lean ---
  if (visible(lShoulder, lHip) && visible(rShoulder, rHip)) {
    const midShoulderY = (lShoulder.y + rShoulder.y) / 2;
    const midHipY = (lHip.y + rHip.y) / 2;
    const torsoLen = Math.abs(midHipY - midShoulderY);

    // Use the z-axis if available for depth, otherwise fall back to x-axis proxy
    // In a front-facing camera, forward lean shows shoulders moving significantly
    // lower relative to hips compared to standing
    const midShoulderX = (lShoulder.x + rShoulder.x) / 2;
    const midHipX = (lHip.x + rHip.x) / 2;
    const forwardShift = Math.abs(midShoulderX - midHipX);

    if (torsoLen > 0.01 && forwardShift / torsoLen > 0.45) {
      return fault(
        "SQUAT_FORWARD_LEAN",
        "Leaning too far forward — keep your chest up and back straight.",
        "Keep your chest up. Sit back into the squat.",
        "warning"
      );
    }
  }

  return OK_RESULT;
}

/**
 * **Heel Raises**
 *   1. Knee Bend – knees should stay almost straight during calf raises
 *   2. Lateral Lean – torso leaning to one side
 */
function checkHeelRaises(lm: Landmark[]): FormFaultResult {
  const lHip = lm[23], lKnee = lm[25], lAnkle = lm[27];
  const rHip = lm[24], rKnee = lm[26], rAnkle = lm[28];
  const lShoulder = lm[11], rShoulder = lm[12];

  // --- Knee Bend ---
  if (visible(lKnee, lAnkle) && visible(rKnee, rAnkle)) {
    const leftAngle = angle3pt(lHip, lKnee, lAnkle);
    const rightAngle = angle3pt(rHip, rKnee, rAnkle);

    if (leftAngle < 155 || rightAngle < 155) {
      return fault(
        "HEEL_RAISE_KNEE_BEND",
        "Keep your knees straight — don't bend them during heel raises.",
        "Straighten your knees. Only rise on your toes.",
        "warning"
      );
    }
  }

  // --- Lateral Lean ---
  if (visible(lShoulder, rShoulder) && visible(lHip, rHip)) {
    const shoulderMidX = (lShoulder.x + rShoulder.x) / 2;
    const hipMidX = (lHip.x + rHip.x) / 2;
    const shoulderWidth = dist2D(lShoulder, rShoulder);

    if (shoulderWidth > 0.01 && Math.abs(shoulderMidX - hipMidX) / shoulderWidth > 0.35) {
      return fault(
        "HEEL_RAISE_LATERAL_LEAN",
        "You're leaning to one side — center your weight evenly.",
        "Center your balance. Keep your weight even on both feet.",
        "warning"
      );
    }
  }

  return OK_RESULT;
}

/**
 * **Marching**
 *   1. Trunk Sway – excessive side-to-side sway (shoulder midpoint vs hip midpoint)
 *   2. Hip Drop – non-lifting hip drops too far during single-leg stance
 */
function checkMarching(lm: Landmark[]): FormFaultResult {
  const lShoulder = lm[11], rShoulder = lm[12];
  const lHip = lm[23], rHip = lm[24];

  // --- Trunk Sway ---
  if (visible(lShoulder, rShoulder) && visible(lHip, rHip)) {
    const shoulderMidX = (lShoulder.x + rShoulder.x) / 2;
    const hipMidX = (lHip.x + rHip.x) / 2;
    const shoulderWidth = dist2D(lShoulder, rShoulder);

    if (shoulderWidth > 0.01 && Math.abs(shoulderMidX - hipMidX) / shoulderWidth > 0.30) {
      return fault(
        "MARCH_TRUNK_SWAY",
        "Too much upper body sway — keep your core tight and stable.",
        "Tighten your core. Reduce upper body sway.",
        "warning"
      );
    }
  }

  // --- Hip Drop (Trendelenburg) ---
  if (visible(lHip, rHip)) {
    const hipDiff = Math.abs(lHip.y - rHip.y);
    const hipWidth = dist2D(lHip, rHip);

    if (hipWidth > 0.01 && hipDiff / hipWidth > 0.35) {
      return fault(
        "MARCH_HIP_DROP",
        "Your hip is dropping — keep both hips level while marching.",
        "Keep your hips level. Engage your glutes.",
        "warning"
      );
    }
  }

  return OK_RESULT;
}

/**
 * **Arm Raises (Forward / Side)**
 *   1. Shoulder Hiking – shoulder rises toward ear on the working side
 *   2. Trunk Compensation – body leaning away from the raising arm
 */
function checkArmRaises(lm: Landmark[]): FormFaultResult {
  const lShoulder = lm[11], rShoulder = lm[12];
  const lHip = lm[23], rHip = lm[24];
  const lElbow = lm[13], rElbow = lm[14];

  // --- Shoulder Hiking ---
  if (visible(lShoulder, rShoulder)) {
    const shoulderDiff = Math.abs(lShoulder.y - rShoulder.y);
    const shoulderWidth = dist2D(lShoulder, rShoulder);

    // If one arm is raised (elbow above shoulder)
    const armRaised =
      (visible(lElbow, lShoulder) && lElbow.y < lShoulder.y - 0.05) ||
      (visible(rElbow, rShoulder) && rElbow.y < rShoulder.y - 0.05);

    if (armRaised && shoulderWidth > 0.01 && shoulderDiff / shoulderWidth > 0.30) {
      return fault(
        "ARM_SHOULDER_HIKE",
        "Your shoulder is hiking up — relax it and use your arm muscles.",
        "Relax your shoulder down. Don't shrug.",
        "warning"
      );
    }
  }

  // --- Trunk Compensation ---
  if (visible(lShoulder, rShoulder) && visible(lHip, rHip)) {
    const shoulderMidX = (lShoulder.x + rShoulder.x) / 2;
    const hipMidX = (lHip.x + rHip.x) / 2;
    const shoulderWidth = dist2D(lShoulder, rShoulder);

    if (shoulderWidth > 0.01 && Math.abs(shoulderMidX - hipMidX) / shoulderWidth > 0.35) {
      return fault(
        "ARM_TRUNK_LEAN",
        "You're leaning — keep your trunk upright while raising your arm.",
        "Stay upright. Don't lean to the side.",
        "warning"
      );
    }
  }

  return OK_RESULT;
}

/**
 * **Wall Push-ups**
 *   1. Elbow Flare – elbows splay outward (angle between shoulder-elbow-wrist too wide)
 *   2. Head Drop – head drops below shoulders
 */
function checkWallPushups(lm: Landmark[]): FormFaultResult {
  const lShoulder = lm[11], rShoulder = lm[12];
  const lElbow = lm[13], rElbow = lm[14];
  const lWrist = lm[15], rWrist = lm[16];
  const lHip = lm[23], rHip = lm[24];

  // --- Elbow Flare ---
  if (visible(lElbow, lWrist) && visible(rElbow, rWrist)) {
    // Check if elbows are significantly wider than shoulders
    const elbowWidth = dist2D(lElbow, rElbow);
    const shoulderWidth = dist2D(lShoulder, rShoulder);

    if (shoulderWidth > 0.01 && elbowWidth / shoulderWidth > 1.6) {
      return fault(
        "PUSHUP_ELBOW_FLARE",
        "Elbows are flaring out — tuck them closer to your body.",
        "Tuck your elbows in. About 45 degrees from your body.",
        "warning"
      );
    }
  }

  // --- Saggy Hips (body not in a straight line) ---
  if (visible(lShoulder, lHip) && visible(rShoulder, rHip)) {
    const midShoulderY = (lShoulder.y + rShoulder.y) / 2;
    const midHipY = (lHip.y + rHip.y) / 2;

    // Hips sagging means they are lower (higher Y) than expected
    // For wall pushups, shoulders and hips should be relatively aligned vertically
    const lAnkle = lm[27], rAnkle = lm[28];
    if (visible(lAnkle, rAnkle)) {
      const midAnkleY = (lAnkle.y + rAnkle.y) / 2;
      const bodyLen = Math.abs(midAnkleY - midShoulderY);
      const hipDeviation = midHipY - ((midShoulderY + midAnkleY) / 2);

      if (bodyLen > 0.05 && hipDeviation / bodyLen > 0.15) {
        return fault(
          "PUSHUP_HIP_SAG",
          "Your hips are sagging — keep your body in a straight line.",
          "Engage your core. Keep your body straight.",
          "error"
        );
      }
    }
  }

  return OK_RESULT;
}

/**
 * **Leg Raises / Hip Abduction / Hip Extension**
 *   1. Trunk Lean — compensating with trunk movement
 */
function checkLegExercises(lm: Landmark[]): FormFaultResult {
  const lShoulder = lm[11], rShoulder = lm[12];
  const lHip = lm[23], rHip = lm[24];

  if (visible(lShoulder, rShoulder) && visible(lHip, rHip)) {
    const shoulderMidX = (lShoulder.x + rShoulder.x) / 2;
    const hipMidX = (lHip.x + rHip.x) / 2;
    const shoulderWidth = dist2D(lShoulder, rShoulder);

    if (shoulderWidth > 0.01 && Math.abs(shoulderMidX - hipMidX) / shoulderWidth > 0.35) {
      return fault(
        "LEG_TRUNK_LEAN",
        "You're compensating with your trunk — keep upright and move only your leg.",
        "Stay upright. Isolate the leg movement.",
        "warning"
      );
    }
  }

  return OK_RESULT;
}

// ─── Sit-to-Stand ──────────────────────────────────────────────────────
function checkSitToStand(lm: Landmark[]): FormFaultResult {
  const lKnee = lm[25], rKnee = lm[26];
  const lAnkle = lm[27], rAnkle = lm[28];

  // Knee Valgus during standing
  if (visible(lKnee, rKnee) && visible(lAnkle, rAnkle)) {
    const kneeDist = dist2D(lKnee, rKnee);
    const ankleDist = dist2D(lAnkle, rAnkle);

    if (ankleDist > 0.01 && kneeDist / ankleDist < 0.55) {
      return fault(
        "STS_KNEE_VALGUS",
        "Knees collapsing inward — push them outward as you stand.",
        "Push your knees out as you stand up.",
        "error"
      );
    }
  }

  return OK_RESULT;
}

// ─── Router ─────────────────────────────────────────────────────────────

/** Map exercise name (from the backend registry) to the appropriate checker. */
const CHECKER_MAP: Record<string, (lm: Landmark[]) => FormFaultResult> = {
  "Squats": checkSquats,
  "Sit-to-Stand": checkSitToStand,
  "Marching": checkMarching,
  "Heel Raises": checkHeelRaises,
  "Wall Push-ups": checkWallPushups,
  "Forward Arm Raises": checkArmRaises,
  "Side Arm Raises": checkArmRaises,
  "Standing Hip Abduction": checkLegExercises,
  "Standing Hip Extension": checkLegExercises,
  "Leg Raises": checkLegExercises,
};

/**
 * Main entry point – call this every frame with the current landmarks and
 * exercise name.  Returns a fault result (or `OK_RESULT` if form is clean).
 */
export function checkForm(
  exerciseName: string,
  landmarks: Landmark[]
): FormFaultResult {
  if (!landmarks || landmarks.length < 33) return OK_RESULT;

  const checker = CHECKER_MAP[exerciseName];
  if (!checker) return OK_RESULT; // unknown exercise — skip checking

  return checker(landmarks);
}

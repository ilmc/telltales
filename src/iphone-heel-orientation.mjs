// src/iphone-heel-orientation.mjs
// Experimental phone-relative inclination, not calibrated vessel heel.
// Supported orientation: screen up, portrait, phone top pointing forwards.
export const SUPPORTED_MOUNT =
  'Face-up portrait; phone top forward; screen approximately parallel to the vessel plane.';
export const MAX_RELIABLE_HEEL_DEGREES = 85;

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const length = (v) => Math.hypot(v.x, v.y, v.z);
const projection = (v) => Math.hypot(v.x, v.z);

export function gravityFromMotion(event) {
  const v = event?.accelerationIncludingGravity;
  if (![v?.x, v?.y, v?.z].every(finite)) return null;
  return { x: v.x, y: v.y, z: v.z, source: 'devicemotion gravity' };
}

// Safari can supply beta/gamma but withhold accelerationIncludingGravity.
// Use both Euler components to reconstruct the gravity vector; gamma alone
// is not a physically valid heel angle across larger changes in pitch.
export function gravityFromOrientation(event) {
  if (![event?.beta, event?.gamma].every(finite)) return null;
  const beta = (event.beta * Math.PI) / 180;
  const gamma = (event.gamma * Math.PI) / 180;
  return {
    x: Math.sin(gamma) * 9.81,
    y: -Math.sin(beta) * Math.cos(gamma) * 9.81,
    z: Math.cos(beta) * Math.cos(gamma) * 9.81,
    source: 'deviceorientation beta+gamma fallback',
  };
}

export function createHeelOrientation({
  maxHeelDegrees = MAX_RELIABLE_HEEL_DEGREES,
  minProjectionFraction = 0.7,
} = {}) {
  let reference = null;
  function inspect(gravity) {
    if (!gravity) return { ok: false, reason: 'No gravity vector from this browser' };
    const magnitude = length(gravity);
    const projected = projection(gravity);
    if (!finite(magnitude) || magnitude < 4 || magnitude > 15) {
      return { ok: false, reason: 'Unreliable gravity vector', gravity, magnitude };
    }
    if (projected / magnitude < minProjectionFraction) {
      return { ok: false, reason: 'Unsupported mount: phone too close to edge-on', gravity, magnitude };
    }
    return {
      ok: true,
      gravity,
      magnitude,
      vector: { x: gravity.x / projected, z: gravity.z / projected },
    };
  }
  function calibrate(gravity) {
    const result = inspect(gravity);
    if (!result.ok) return { ...result, calibrated: Boolean(reference) };
    reference = result.vector;
    return {
      ...result,
      calibrated: true,
      heel: 0,
      calibration: { ...reference, source: gravity.source || 'unknown' },
    };
  }
  function measure(gravity) {
    const result = inspect(gravity);
    if (!result.ok) return { ...result, calibrated: Boolean(reference) };
    if (!reference) {
      return { ...result, ok: false, calibrated: false, reason: 'Zero the phone mount first' };
    }
    const { vector } = result;
    const heel =
      (Math.atan2(
        reference.z * vector.x - reference.x * vector.z,
        reference.x * vector.x + reference.z * vector.z,
      ) *
        180) /
      Math.PI;
    if (Math.abs(heel) > maxHeelDegrees) {
      return {
        ...result,
        ok: false,
        heel,
        calibrated: true,
        reason: `Heel exceeds supported ±${maxHeelDegrees}° range`,
      };
    }
    return { ...result, heel, rawHeel: heel, calibrated: true };
  }
  function reset() {
    reference = null;
  }
  return Object.freeze({
    inspect,
    calibrate,
    measure,
    reset,
    get calibrated() {
      return Boolean(reference);
    },
  });
}

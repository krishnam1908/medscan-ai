/**
 * Turns loosely-structured medicine info into a normalized schedule.
 *
 * Handles common Indian prescription notations:
 *   "1-0-1"      -> morning + night
 *   "1-1-1"      -> morning + afternoon + night
 *   "0-0-1"      -> night only
 *   "1/2-0-1/2"  -> half doses morning + night
 *   "BD" / "TDS" / "OD" / "QID" / "HS" / "SOS"
 */

const SLOT_ORDER = ["morning", "afternoon", "evening", "night"];

const LATIN_FREQUENCY = {
  od: ["morning"], // once daily
  bd: ["morning", "night"], // twice daily
  bid: ["morning", "night"],
  tds: ["morning", "afternoon", "night"], // thrice daily
  tid: ["morning", "afternoon", "night"],
  qid: ["morning", "afternoon", "evening", "night"], // four times
  hs: ["night"], // at bedtime
  sos: ["anytime"], // as needed
  stat: ["anytime"], // immediately
};

/** Parse a dosage-pattern string like "1-0-1" into timing slots. */
function parsePattern(pattern) {
  if (!pattern) return null;
  const normalized = String(pattern).toLowerCase().trim();

  // Latin abbreviations
  if (LATIN_FREQUENCY[normalized]) {
    return { timing: LATIN_FREQUENCY[normalized], raw: pattern };
  }

  // dash patterns: supports 3-part (m-a-n) and 4-part (m-a-e-n)
  const dashParts = normalized.split(/[-–/]/).map((p) => p.trim());
  const looksNumeric = dashParts.every((p) =>
    /^(\d+(\.\d+)?|½|\d\/\d)?$/.test(p)
  );

  if (dashParts.length >= 3 && looksNumeric) {
    const slots =
      dashParts.length === 4
        ? ["morning", "afternoon", "evening", "night"]
        : ["morning", "afternoon", "night"];
    const timing = [];
    dashParts.forEach((val, idx) => {
      const amount = parseAmount(val);
      if (amount > 0 && slots[idx]) timing.push(slots[idx]);
    });
    if (timing.length) return { timing, raw: pattern };
  }

  // textual frequency
  if (/once/.test(normalized)) return { timing: ["morning"], raw: pattern };
  if (/twice/.test(normalized)) return { timing: ["morning", "night"], raw: pattern };
  if (/thrice|three times/.test(normalized))
    return { timing: ["morning", "afternoon", "night"], raw: pattern };
  if (/night|bedtime/.test(normalized)) return { timing: ["night"], raw: pattern };
  if (/morning/.test(normalized)) return { timing: ["morning"], raw: pattern };

  return null;
}

function parseAmount(val) {
  if (!val) return 0;
  if (val === "½" || val === "1/2") return 0.5;
  const n = parseFloat(val);
  return Number.isNaN(n) ? 0 : n;
}

/** Infer food relationship from free text. */
function parseFood(text = "") {
  const t = text.toLowerCase();
  if (/before\s*(food|meal|eating)|खाने से पहले|empty stomach/.test(t)) return "before";
  if (/after\s*(food|meal|eating)|खाने के बाद/.test(t)) return "after";
  return null;
}

/**
 * Normalize a single medicine entry (as parsed by the AI/mock layer) into a
 * structured, schedule-ready object.
 */
export function normalizeMedicine(med) {
  const freqSource = med.frequency || med.pattern || med.timingRaw || "";
  const parsed = parsePattern(freqSource) || { timing: [], raw: freqSource };

  // if the AI already gave explicit timing slots, respect them
  let timing = Array.isArray(med.timing) && med.timing.length
    ? med.timing.map((t) => t.toLowerCase())
    : parsed.timing;

  timing = timing
    .filter((t) => SLOT_ORDER.includes(t) || t === "anytime")
    .sort((a, b) => SLOT_ORDER.indexOf(a) - SLOT_ORDER.indexOf(b));

  const food = med.food || parseFood(`${med.instructions || ""} ${freqSource}`);

  return {
    name: (med.name || "Unknown medicine").trim(),
    dosage: med.dosage || "1 tablet",
    frequencyRaw: parsed.raw || freqSource || "",
    timing,
    duration: med.duration || null,
    food: food || null,
    instructions: med.instructions || "",
  };
}

/**
 * Build a day-part grouped schedule from a list of normalized medicines.
 * Returns { morning: [...], afternoon: [...], evening: [...], night: [...] }
 */
export function buildDaySchedule(medicines = []) {
  const schedule = { morning: [], afternoon: [], evening: [], night: [], anytime: [] };
  for (const med of medicines) {
    const slots = med.timing && med.timing.length ? med.timing : ["anytime"];
    for (const slot of slots) {
      if (schedule[slot]) {
        schedule[slot].push({
          name: med.name,
          dosage: med.dosage,
          food: med.food,
        });
      }
    }
  }
  return schedule;
}

/**
 * Lightweight multilingual phrase builder for dosage instructions.
 *
 * We translate the *structured* schedule rather than free text, which keeps it
 * accurate and offline-friendly. Supported: English (en), Hindi (hi).
 */

const DICT = {
  en: {
    morning: "Morning",
    afternoon: "Afternoon",
    evening: "Evening",
    night: "Night",
    beforeFood: "before food",
    afterFood: "after food",
    anytime: "any time",
    take: "Take",
    tablet: "tablet",
    tablets: "tablets",
    for: "for",
    days: "days",
    times: "time(s) a day",
    once: "Take once",
  },
  hi: {
    morning: "सुबह",
    afternoon: "दोपहर",
    evening: "शाम",
    night: "रात",
    beforeFood: "खाने से पहले",
    afterFood: "खाने के बाद",
    anytime: "किसी भी समय",
    take: "लें",
    tablet: "गोली",
    tablets: "गोलियाँ",
    for: "के लिए",
    days: "दिन",
    times: "बार प्रतिदिन",
    once: "एक बार लें",
  },
};

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी (Hindi)" },
];

/**
 * Build a human-readable instruction string for a medicine in a given language.
 * medicine: { name, dosage, frequency, timing, duration, food }
 */
export function buildInstruction(medicine, lang = "en") {
  const d = DICT[lang] || DICT.en;
  const parts = [];

  const timings = (medicine.timing || [])
    .map((t) => d[t] || t)
    .filter(Boolean);

  if (timings.length) {
    parts.push(`${d.take} ${medicine.dosage || "1 " + d.tablet} — ${timings.join(", ")}`);
  } else {
    parts.push(`${d.take} ${medicine.dosage || "1 " + d.tablet}`);
  }

  if (medicine.food === "before") parts.push(`(${d.beforeFood})`);
  else if (medicine.food === "after") parts.push(`(${d.afterFood})`);

  if (medicine.duration) {
    parts.push(`${d.for} ${medicine.duration} ${d.days}`);
  }

  return parts.join(" ");
}

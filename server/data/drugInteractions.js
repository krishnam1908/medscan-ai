/**
 * A small, curated knowledge base of common drug interactions and warnings.
 *
 * This is intentionally lightweight and demo-focused. For production you would
 * swap this out for a real source (e.g. RxNorm + a drug-interaction API).
 *
 * Matching is done on normalized generic names and common brand aliases.
 */

// Map common brand / alias names -> normalized generic key
export const DRUG_ALIASES = {
  // Pain / fever
  crocin: "paracetamol",
  dolo: "paracetamol",
  calpol: "paracetamol",
  tylenol: "paracetamol",
  acetaminophen: "paracetamol",
  combiflam: "ibuprofen",
  brufen: "ibuprofen",
  advil: "ibuprofen",
  disprin: "aspirin",
  ecosprin: "aspirin",

  // Antibiotics
  augmentin: "amoxicillin",
  mox: "amoxicillin",
  azithral: "azithromycin",
  azee: "azithromycin",

  // Acidity
  pan: "pantoprazole",
  pantop: "pantoprazole",
  omez: "omeprazole",

  // Blood thinners
  warf: "warfarin",

  // Diabetes
  glyciphage: "metformin",
  glycomet: "metformin",

  // Cholesterol
  rosuvas: "rosuvastatin",
  atorva: "atorvastatin",

  // Allergy
  cetzine: "cetirizine",
  allegra: "fexofenadine",

  // Antidepressants
  prozac: "fluoxetine",
};

/**
 * Each interaction is a pair of normalized drugs with a severity and message.
 * severity: "high" | "moderate" | "low"
 */
export const INTERACTIONS = [
  {
    pair: ["warfarin", "aspirin"],
    severity: "high",
    message:
      "Warfarin + Aspirin greatly increases bleeding risk. This combination needs close medical supervision.",
  },
  {
    pair: ["warfarin", "ibuprofen"],
    severity: "high",
    message:
      "Warfarin + Ibuprofen (an NSAID) raises the risk of serious gastrointestinal bleeding.",
  },
  {
    pair: ["aspirin", "ibuprofen"],
    severity: "moderate",
    message:
      "Taking Aspirin with Ibuprofen can reduce aspirin's heart-protective effect and increase stomach irritation.",
  },
  {
    pair: ["paracetamol", "ibuprofen"],
    severity: "low",
    message:
      "Paracetamol and Ibuprofen are often used together safely, but do not exceed recommended doses of either.",
  },
  {
    pair: ["fluoxetine", "aspirin"],
    severity: "moderate",
    message:
      "SSRIs like Fluoxetine with Aspirin may increase bleeding risk. Monitor for unusual bruising.",
  },
  {
    pair: ["metformin", "alcohol"],
    severity: "moderate",
    message:
      "Metformin with alcohol increases the risk of lactic acidosis. Limit alcohol intake.",
  },
  {
    pair: ["azithromycin", "warfarin"],
    severity: "moderate",
    message:
      "Azithromycin may enhance the blood-thinning effect of Warfarin. INR should be monitored.",
  },
  {
    pair: ["atorvastatin", "azithromycin"],
    severity: "moderate",
    message:
      "Combining Atorvastatin with certain antibiotics can increase the risk of muscle pain (myopathy).",
  },
];

/** Single-drug cautionary notes surfaced regardless of combinations. */
export const SINGLE_DRUG_NOTES = {
  warfarin:
    "Avoid sudden changes in diet (especially leafy greens) and get your INR checked regularly.",
  metformin: "Take with food to reduce stomach upset.",
  ibuprofen: "Take after food. Avoid if you have kidney issues or stomach ulcers.",
  pantoprazole: "Best taken 30–60 minutes before the first meal of the day.",
  amoxicillin: "Complete the full course even if you feel better.",
  azithromycin: "Complete the full course even if you feel better.",
};

/** Normalize a raw medicine name into a generic key. */
export function normalizeDrugName(raw) {
  if (!raw) return "";
  // take the first word, strip dosage noise, lowercase
  const cleaned = String(raw)
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .trim();
  const firstWord = cleaned.split(/\s+/)[0] || "";
  if (DRUG_ALIASES[firstWord]) return DRUG_ALIASES[firstWord];
  if (DRUG_ALIASES[cleaned]) return DRUG_ALIASES[cleaned];
  return firstWord;
}

/**
 * Given a list of medicines (objects with a `name`), return any interaction
 * warnings plus single-drug cautionary notes.
 */
export function checkInteractions(medicines = []) {
  const normalized = medicines.map((m) => ({
    original: m.name,
    key: normalizeDrugName(m.name),
  }));

  const warnings = [];

  // pairwise interactions
  for (let i = 0; i < normalized.length; i++) {
    for (let j = i + 1; j < normalized.length; j++) {
      const a = normalized[i].key;
      const b = normalized[j].key;
      const match = INTERACTIONS.find(
        (int) =>
          (int.pair[0] === a && int.pair[1] === b) ||
          (int.pair[0] === b && int.pair[1] === a)
      );
      if (match) {
        warnings.push({
          type: "interaction",
          severity: match.severity,
          drugs: [normalized[i].original, normalized[j].original],
          message: match.message,
        });
      }
    }
  }

  // single-drug notes
  const notes = [];
  for (const n of normalized) {
    if (SINGLE_DRUG_NOTES[n.key]) {
      notes.push({
        type: "note",
        severity: "low",
        drugs: [n.original],
        message: SINGLE_DRUG_NOTES[n.key],
      });
    }
  }

  // sort warnings by severity (high first)
  const rank = { high: 0, moderate: 1, low: 2 };
  warnings.sort((x, y) => rank[x.severity] - rank[y.severity]);

  return { warnings, notes };
}

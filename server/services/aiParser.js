/**
 * AI parsing layer.
 *
 * Strategy:
 *   1. If OPENAI_API_KEY is set, send the prescription image to a vision model
 *      and ask it to return structured JSON.
 *   2. If no key is set (or the real call fails), fall back to a deterministic
 *      mock parser so the demo always works offline.
 *
 * The output shape is identical in both paths so the rest of the app doesn't
 * care which was used.
 */

const EXTRACTION_PROMPT = `You are a medical prescription parser. Extract medicines from the prescription image.
Return ONLY valid JSON (no markdown) with this exact shape:
{
  "patientName": string | null,
  "doctorName": string | null,
  "date": string | null,
  "medicines": [
    {
      "name": string,
      "dosage": string,
      "frequency": string,        // e.g. "1-0-1", "BD", "twice daily"
      "duration": string | null,  // number of days, e.g. "5"
      "food": "before" | "after" | null,
      "instructions": string
    }
  ],
  "notes": string | null
}
If the image is unreadable, still return the JSON with an empty medicines array.`;

/** Realistic sample prescriptions used when no API key is available. */
const MOCK_PRESCRIPTIONS = [
  {
    patientName: "Rajesh Kumar",
    doctorName: "Dr. A. Sharma",
    date: new Date().toISOString().slice(0, 10),
    medicines: [
      {
        name: "Dolo 650",
        dosage: "1 tablet",
        frequency: "1-0-1",
        duration: "5",
        food: "after",
        instructions: "For fever and body pain",
      },
      {
        name: "Augmentin 625",
        dosage: "1 tablet",
        frequency: "BD",
        duration: "7",
        food: "after",
        instructions: "Complete full course",
      },
      {
        name: "Pan 40",
        dosage: "1 tablet",
        frequency: "1-0-0",
        duration: "7",
        food: "before",
        instructions: "Before breakfast",
      },
      {
        name: "Cetzine",
        dosage: "1 tablet",
        frequency: "0-0-1",
        duration: "5",
        food: "after",
        instructions: "At night for allergy",
      },
    ],
    notes: "Drink plenty of fluids. Review after 5 days if no improvement.",
  },
  {
    patientName: "Priya Verma",
    doctorName: "Dr. M. Iyer",
    date: new Date().toISOString().slice(0, 10),
    medicines: [
      {
        name: "Ecosprin 75",
        dosage: "1 tablet",
        frequency: "0-0-1",
        duration: "30",
        food: "after",
        instructions: "For heart health",
      },
      {
        name: "Combiflam",
        dosage: "1 tablet",
        frequency: "1-0-1",
        duration: "3",
        food: "after",
        instructions: "For pain and inflammation",
      },
      {
        name: "Rosuvas 10",
        dosage: "1 tablet",
        frequency: "HS",
        duration: "30",
        food: "after",
        instructions: "At bedtime for cholesterol",
      },
    ],
    notes: "Monitor blood pressure weekly.",
  },
  {
    patientName: "Anita Desai",
    doctorName: "Dr. S. Rao",
    date: new Date().toISOString().slice(0, 10),
    medicines: [
      {
        name: "Glycomet 500",
        dosage: "1 tablet",
        frequency: "1-0-1",
        duration: "30",
        food: "after",
        instructions: "For diabetes, take with meals",
      },
      {
        name: "Azithral 500",
        dosage: "1 tablet",
        frequency: "OD",
        duration: "3",
        food: "after",
        instructions: "Once daily for infection",
      },
    ],
    notes: "Check fasting sugar after 2 weeks.",
  },
];

/** Deterministically pick a mock based on a seed so re-scanning feels stable. */
function pickMock(seed = 0) {
  const idx = Math.abs(seed) % MOCK_PRESCRIPTIONS.length;
  // deep clone so callers can't mutate the source
  return JSON.parse(JSON.stringify(MOCK_PRESCRIPTIONS[idx]));
}

/** Strip markdown fences and parse JSON defensively. */
function safeParseJson(text) {
  if (!text) return null;
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1) {
    cleaned = cleaned.slice(start, end + 1);
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

/**
 * Call OpenAI's vision model with the image. Returns parsed JSON or null.
 */
async function parseWithOpenAI(imageBase64, mimeType) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  if (!apiKey) return null;

  const dataUrl = `data:${mimeType};base64,${imageBase64}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: EXTRACTION_PROMPT },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      max_tokens: 1200,
      temperature: 0,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OpenAI API error ${res.status}: ${errText}`);
  }

  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  return safeParseJson(content);
}

/**
 * Main entry: parse a prescription image buffer into structured data.
 * Returns { source: "ai" | "mock", data: {...} }.
 */
export async function parsePrescription(imageBuffer, mimeType = "image/jpeg") {
  const base64 = imageBuffer ? imageBuffer.toString("base64") : "";

  // Try real AI first if configured
  if (process.env.OPENAI_API_KEY) {
    try {
      const data = await parseWithOpenAI(base64, mimeType);
      if (data && Array.isArray(data.medicines) && data.medicines.length) {
        return { source: "ai", data };
      }
      // fall through to mock if AI returned nothing useful
    } catch (err) {
      console.warn("[aiParser] Real AI failed, falling back to mock:", err.message);
    }
  }

  // Mock fallback — seed by buffer length so different images feel different
  const seed = imageBuffer ? imageBuffer.length : Date.now();
  return { source: "mock", data: pickMock(seed) };
}

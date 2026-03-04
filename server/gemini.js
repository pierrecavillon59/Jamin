const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent";

function cleanJsonText(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
}

function validateGeminiOutput(payload) {
  if (!payload || typeof payload !== "object") return false;

  const hasStrings =
    typeof payload.jamName === "string" &&
    typeof payload.tagline === "string" &&
    typeof payload.yield === "string" &&
    typeof payload.totalTime === "string";

  const validIngredients =
    Array.isArray(payload.ingredients) &&
    payload.ingredients.length > 0 &&
    payload.ingredients.every(
      (entry) =>
        entry &&
        typeof entry.item === "string" &&
        typeof entry.quantity === "string"
    );

  const validInstructions =
    Array.isArray(payload.instructions) &&
    payload.instructions.length >= 4 &&
    payload.instructions.every((s) => typeof s === "string");

  const validNotes =
    Array.isArray(payload.notes) && payload.notes.every((s) => typeof s === "string");

  const validChosen =
    payload.chosen &&
    typeof payload.chosen.fruit1 === "string" &&
    typeof payload.chosen.fruit2 === "string" &&
    typeof payload.chosen.spice === "string";

  return hasStrings && validIngredients && validInstructions && validNotes && validChosen;
}

function buildPrompt({ mode, fruit1, fruit2, spice }) {
  return `You are a playful artisan jam chef called Riton. Produce a creative, practical jam recipe.
Return STRICT JSON only (no markdown, no explanation), matching this schema exactly:
{
  "jamName": "string",
  "tagline": "string (short and funny)",
  "ingredients": [
    { "item": "string", "quantity": "string" }
  ],
  "instructions": ["string", "..."],
  "yield": "string",
  "totalTime": "string",
  "notes": ["string", "..."],
  "chosen": { "fruit1": "string", "fruit2": "string", "spice": "string" },
  "imagePrompt": "string (optional prompt for a small fun jam illustration)"
}

Requirements:
- Jam name MUST include a clear pun or playful wordplay referencing at least one chosen fruit or spice.
- Keep puns original and avoid copyrighted titles.
- Include ingredients with quantities in grams/ml/tsp where appropriate (fruit grams, sugar grams, lemon juice, pectin if needed, spice amount, optional water).
- Instructions should include prep, optional maceration, cooking cues (temp or visual), gel test, sterilization, and jar filling.
- Include yield estimate and total cook time.
- Include a short quirky Riton tip in notes.
- Mode: ${mode}
- Chosen ingredients: fruit1="${fruit1}", fruit2="${fruit2}", spice="${spice}"`;
}

async function generateJamRecipe({ mode, fruit1, fruit2, spice, apiKey }) {
  const basePrompt = buildPrompt({ mode, fruit1, fruit2, spice });

  const firstPass = await callGemini(basePrompt, apiKey);
  let parsed = tryParseJson(firstPass);

  if (!validateGeminiOutput(parsed)) {
    const fixPrompt = `Your previous response was invalid JSON or schema-mismatched. Rewrite and return ONLY valid JSON for the same request. Keep all required fields and types exactly.\n\nOriginal request:\n${basePrompt}`;
    const secondPass = await callGemini(fixPrompt, apiKey);
    parsed = tryParseJson(secondPass);
  }

  if (!validateGeminiOutput(parsed)) {
    throw new Error("Gemini returned invalid structured output.");
  }

  return parsed;
}

async function callGemini(prompt, apiKey) {
  const response = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.8,
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${body}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("\n");

  if (!text) {
    throw new Error("Gemini returned no text content.");
  }

  return text;
}

function tryParseJson(raw) {
  const cleaned = cleanJsonText(raw);
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

module.exports = {
  generateJamRecipe
};

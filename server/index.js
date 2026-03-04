const path = require("path");
const express = require("express");
const dotenv = require("dotenv");
const { fruits, twists } = require("./options");
const { generateJamRecipe } = require("./gemini");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const requestsByIp = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 25;

app.use((req, res, next) => {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const timestamps = requestsByIp.get(ip) || [];
  const fresh = timestamps.filter((t) => now - t < WINDOW_MS);

  if (fresh.length >= MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({ error: "Too many requests. Please wait a minute." });
  }

  fresh.push(now);
  requestsByIp.set(ip, fresh);
  return next();
});

app.get("/api/options", (_req, res) => {
  res.json({ fruits, twists });
});

app.post("/api/generate", async (req, res) => {
  try {
    const payload = normalizeInput(req.body || {});
    if (!payload.ok) {
      return res.status(400).json({ error: payload.error });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing GEMINI_API_KEY in server/.env" });
    }

    const recipe = await generateJamRecipe({
      mode: payload.mode,
      fruit1: payload.fruit1,
      fruit2: payload.fruit2,
      spice: payload.spice,
      apiKey
    });

    return res.json(recipe);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not generate jam recipe right now." });
  }
});

app.post("/api/roulette", async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing GEMINI_API_KEY in server/.env" });
    }

    const requestedSegment = typeof req.body?.segment === "string" ? req.body.segment.trim().toLowerCase() : "";
    const segment = rouletteSegments.find((item) => item.label.toLowerCase() === requestedSegment) || pickRandom(rouletteSegments);
    const selected = pickIngredientsForSegment(segment.key);

    const recipe = await generateJamRecipe({
      mode: `roulette:${segment.label}`,
      fruit1: selected.fruit1,
      fruit2: selected.fruit2,
      spice: selected.spice,
      apiKey
    });

    return res.json({
      roulette: segment.label,
      ...recipe,
      chosen: selected
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Roulette jam failed. Give it another spin!" });
  }
});

app.use(express.static(path.join(__dirname, "..", "public")));

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Jamming with Riton running on http://localhost:${PORT}`);
});

function normalizeInput(body) {
  const mode = typeof body.mode === "string" ? body.mode.trim().toLowerCase() : "";
  let fruit1 = safeText(body.fruit1);
  let fruit2 = safeText(body.fruit2);
  let spice = safeText(body.spice);

  if (!["manual", "roulette"].includes(mode)) {
    return { ok: false, error: "mode must be 'manual' or 'roulette'." };
  }

  if (mode === "roulette") {
    const chosen = pickIngredientsForSegment();
    fruit1 = chosen.fruit1;
    fruit2 = chosen.fruit2;
    spice = chosen.spice;
  }

  if (!fruits.includes(fruit1) || !fruits.includes(fruit2)) {
    return { ok: false, error: "Please provide valid fruits." };
  }

  if (fruit1 === fruit2) {
    return { ok: false, error: "Please choose two different fruits." };
  }

  if (!twists.includes(spice)) {
    return { ok: false, error: "Please provide a valid twist." };
  }

  return { ok: true, mode, fruit1, fruit2, spice };
}

function safeText(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

const rouletteSegments = [
  { key: "two-fruits", label: "2 fruits + twist" },
  { key: "tropical", label: "Tropical" },
  { key: "berry", label: "Berry chaos" },
  { key: "citrus", label: "Citrus punch" },
  { key: "herbal", label: "Herbal surprise" },
  { key: "spicy", label: "Spicy dare" },
  { key: "chef", label: "Chef's pick" }
];

const tropical = ["pineapple", "mango", "banana", "kiwi", "lime", "orange"];
const berries = ["strawberry", "raspberry", "blueberry", "blackberry", "cherry", "grape"];
const citrus = ["orange", "lemon", "lime"];
const herbalTwists = ["basil", "mint", "rosemary", "thyme", "lavender"];
const spicyTwists = ["ginger", "chili", "black pepper", "cardamom", "cinnamon", "star anise"];

function pickIngredientsForSegment(segmentKey = "chef") {
  switch (segmentKey) {
    case "tropical": {
      const fruit1 = pickRandom(tropical);
      return {
        fruit1,
        fruit2: pickDifferentFrom(tropical, fruit1),
        spice: pickRandom(twists)
      };
    }
    case "berry": {
      const fruit1 = pickRandom(berries);
      return {
        fruit1,
        fruit2: pickDifferentFrom(berries, fruit1),
        spice: pickRandom(twists)
      };
    }
    case "citrus": {
      const fruit1 = pickRandom(citrus);
      const fruit2 = pickDifferentFrom(fruits, fruit1);
      return {
        fruit1,
        fruit2,
        spice: pickRandom(twists)
      };
    }
    case "herbal": {
      const fruit1 = pickRandom(fruits);
      return {
        fruit1,
        fruit2: pickDifferentFrom(fruits, fruit1),
        spice: pickRandom(herbalTwists)
      };
    }
    case "spicy": {
      const fruit1 = pickRandom(fruits);
      return {
        fruit1,
        fruit2: pickDifferentFrom(fruits, fruit1),
        spice: pickRandom(spicyTwists)
      };
    }
    case "two-fruits":
    case "chef":
    default: {
      const fruit1 = pickRandom(fruits);
      return {
        fruit1,
        fruit2: pickDifferentFrom(fruits, fruit1),
        spice: pickRandom(twists)
      };
    }
  }
}

function pickDifferentFrom(pool, selected) {
  const filtered = pool.filter((entry) => entry !== selected);
  return pickRandom(filtered);
}

function pickRandom(pool) {
  return pool[Math.floor(Math.random() * pool.length)];
}

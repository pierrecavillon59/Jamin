const modeManualBtn = document.getElementById("modeManual");
const modeRouletteBtn = document.getElementById("modeRoulette");
const manualSection = document.getElementById("manualSection");
const rouletteSection = document.getElementById("rouletteSection");
const resultEl = document.getElementById("result");
const errorEl = document.getElementById("error");
const statusEl = document.getElementById("status");
const roulettePicked = document.getElementById("roulettePicked");
const wheelEl = document.getElementById("wheel");

const fruit1El = document.getElementById("fruit1");
const fruit2El = document.getElementById("fruit2");
const spiceEl = document.getElementById("spice");

const generateBtn = document.getElementById("generateBtn");
const spinBtn = document.getElementById("spinBtn");

const segments = [
  "2 fruits + twist",
  "Tropical",
  "Berry chaos",
  "Citrus punch",
  "Herbal surprise",
  "Spicy dare",
  "Chef's pick"
];

let currentMode = "manual";
let rotation = 0;

init();

async function init() {
  bindEvents();
  await loadOptions();
}

function bindEvents() {
  modeManualBtn.addEventListener("click", () => setMode("manual"));
  modeRouletteBtn.addEventListener("click", () => setMode("roulette"));
  generateBtn.addEventListener("click", generateManual);
  spinBtn.addEventListener("click", spinAndGenerate);
}

function setMode(mode) {
  currentMode = mode;
  const isManual = mode === "manual";

  modeManualBtn.classList.toggle("active", isManual);
  modeRouletteBtn.classList.toggle("active", !isManual);
  manualSection.classList.toggle("hidden", !isManual);
  rouletteSection.classList.toggle("hidden", isManual);

  hideError();
}

async function loadOptions() {
  try {
    const res = await fetch("/api/options");
    const data = await res.json();

    populateSelect(fruit1El, data.fruits);
    populateSelect(fruit2El, data.fruits);
    populateSelect(spiceEl, data.twists);
  } catch {
    showError("Could not load ingredients. Refresh and try again.");
  }
}

function populateSelect(selectEl, options) {
  options.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value[0].toUpperCase() + value.slice(1);
    selectEl.appendChild(option);
  });
}

async function generateManual() {
  hideError();
  const fruit1 = fruit1El.value;
  const fruit2 = fruit2El.value;
  const spice = spiceEl.value;

  if (!fruit1 || !fruit2 || !spice) {
    showError("Please choose both fruits and one twist.");
    return;
  }

  if (fruit1 === fruit2) {
    showError("Fruit 1 and Fruit 2 must be different.");
    return;
  }

  setLoading(true);

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "manual", fruit1, fruit2, spice })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Generation failed.");

    renderResult(data);
  } catch (err) {
    showError(err.message || "Something went wrong.");
  } finally {
    setLoading(false);
  }
}

async function spinAndGenerate() {
  hideError();
  roulettePicked.textContent = "";

  const spinDuration = 2000 + Math.random() * 2000;
  const segmentDegrees = 360 / segments.length;
  const targetIndex = Math.floor(Math.random() * segments.length);
  const landedSegment = segments[targetIndex];
  const extraTurns = 5 + Math.floor(Math.random() * 3);
  rotation += extraTurns * 360 + targetIndex * segmentDegrees;

  wheelEl.style.transitionDuration = `${spinDuration / 1000}s`;
  wheelEl.style.transform = `rotate(${rotation}deg)`;

  await delay(spinDuration + 100);

  setLoading(true);

  try {
    const response = await fetch("/api/roulette", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ segment: landedSegment })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Roulette generation failed.");

    roulettePicked.textContent = `Roulette picked (${data.roulette}): ${capitalize(data.chosen.fruit1)} + ${capitalize(data.chosen.fruit2)} + ${capitalize(data.chosen.spice)}`;
    renderResult(data);
  } catch (err) {
    showError(err.message || "Could not spin up a jam.");
  } finally {
    setLoading(false);
  }
}

function renderResult(data) {
  resultEl.classList.remove("hidden");
  resultEl.innerHTML = `
    <article class="result-card">
      <div class="result-head">
        <div>
          <h2>${escapeHtml(data.jamName)}</h2>
          <p><em>${escapeHtml(data.tagline)}</em></p>
          <p><strong>Chosen:</strong> ${escapeHtml(data.chosen.fruit1)}, ${escapeHtml(data.chosen.fruit2)}, ${escapeHtml(data.chosen.spice)}</p>
        </div>
        <div class="meta">
          <p><strong>Yield:</strong> ${escapeHtml(data.yield)}</p>
          <p><strong>Total time:</strong> ${escapeHtml(data.totalTime)}</p>
        </div>
      </div>

      <h3>Ingredients</h3>
      <ul>
        ${data.ingredients.map((i) => `<li>${escapeHtml(i.quantity)} — ${escapeHtml(i.item)}</li>`).join("")}
      </ul>

      <h3>Instructions</h3>
      <ol>
        ${data.instructions.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}
      </ol>

      <h3>Notes</h3>
      <ul>
        ${data.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}
      </ul>
    </article>
  `;
}

function setLoading(loading) {
  statusEl.classList.toggle("hidden", !loading);
  generateBtn.disabled = loading;
  spinBtn.disabled = loading;
}

function showError(message) {
  errorEl.classList.remove("hidden");
  errorEl.textContent = message;
}

function hideError() {
  errorEl.classList.add("hidden");
  errorEl.textContent = "";
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function capitalize(value) {
  return value ? value[0].toUpperCase() + value.slice(1) : "";
}

function escapeHtml(text) {
  if (typeof text !== "string") return "";
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

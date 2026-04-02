import express from "express";
import cors from "cors";
import multer from "multer";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";
import { randomUUID } from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file if present (no dependency needed)
const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*?)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

const IS_VERCEL = !!process.env.VERCEL;

// On Vercel: use /tmp for ephemeral file ops; deployed templates are read-only
// Local: everything lives in the project root
const WORK_DIR   = IS_VERCEL ? "/tmp" : path.resolve(__dirname, "..");

// TEMPLATES_READ_DIR = where pre-built templates live (read-only on Vercel)
// TEMPLATES_WRITE_DIR = where we write custom/new templates (writable)
const TEMPLATES_READ_DIR  = path.resolve(__dirname, "../templates");
const TEMPLATES_WRITE_DIR = IS_VERCEL ? "/tmp/templates" : TEMPLATES_READ_DIR;

// Helper: find a template file — check writable dir first, then read-only dir
function templatePath(filename) {
  const writePath = path.join(TEMPLATES_WRITE_DIR, filename);
  if (fs.existsSync(writePath)) return writePath;
  return path.join(TEMPLATES_READ_DIR, filename);
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.text());
app.use("/outputs",   express.static(path.join(WORK_DIR, "outputs")));
// Serve templates from BOTH dirs (writable first so custom overrides built-in)
app.use("/templates", express.static(TEMPLATES_WRITE_DIR));
app.use("/templates", express.static(TEMPLATES_READ_DIR));

const upload = multer({ dest: path.join(WORK_DIR, "uploads/") });

// Ensure dirs exist
for (const d of [
  path.join(WORK_DIR, "uploads"),
  path.join(WORK_DIR, "outputs"),
  TEMPLATES_WRITE_DIR,
]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}
// Don't mkdir TEMPLATES_READ_DIR on Vercel — it's the deployed read-only dir
if (!IS_VERCEL && !fs.existsSync(TEMPLATES_READ_DIR)) {
  fs.mkdirSync(TEMPLATES_READ_DIR, { recursive: true });
}

// ============================================================
// BANNER CONFIGS — Amazon Prime formats
// ============================================================
const SUPPORTED_RATIOS = ["1:1","1:4","2:3","3:2","3:4","4:1","4:3","4:5","5:4","8:1","9:16","16:9","21:9"];

function closestSupportedRatio(w, h) {
  const target = w / h;
  let best = "1:1", bestDiff = Infinity;
  for (const r of SUPPORTED_RATIOS) {
    const [a, b] = r.split(":").map(Number);
    const diff = Math.abs((a / b) - target);
    if (diff < bestDiff) { bestDiff = diff; best = r; }
  }
  return best;
}

function getDesignerCompositionHint(config, az) {
  const ratio = az.width / az.height;
  const isExtremePortrait = ratio < 0.5;
  const isPortrait        = ratio < 0.85;
  const isSquare          = ratio >= 0.85 && ratio <= 1.2;
  const isLandscape       = ratio > 1.2 && ratio < 2.5;
  const isWideLandscape   = ratio >= 2.5 && ratio < 5;
  const isUltraWide       = ratio >= 5;

  let shape = "";
  if (isExtremePortrait) {
    shape = `FORMAT: Extreme tall/narrow — design like a full-height outdoor poster.
HERO PLACEMENT: Fill the vertical center of the canvas with the hero character(s), from about 20% down to 85% down the canvas. Characters should face slightly inward, slightly off-centre.
TITLE PLACEMENT: Upper section, centred horizontally, in the top 5%–22% of the canvas. If multi-word, stack vertically with generous line spacing.
LOWER AREA: Ground, crowd, environmental texture from source. Keep the bottom 15% free of important content.
BACKGROUND: Dramatic sky filling the top, extending around the title.`;
  } else if (isPortrait) {
    shape = `FORMAT: Portrait — design like a movie poster.
HERO PLACEMENT: Center-to-lower portion of the canvas, from about 25% to 88% down, horizontally centred.
TITLE PLACEMENT: Upper portion, centred, in the top 5%–25% of the canvas.
BACKGROUND: Fill top and bottom with environment from source.`;
  } else if (isSquare) {
    shape = `FORMAT: Square — design like a square campaign asset.
HERO PLACEMENT: Centre of canvas, occupying the central 60% of width and height.
TITLE PLACEMENT: Upper third, centred horizontally.
BACKGROUND: Fill corners and edges with environment from source.`;
  } else if (isLandscape) {
    shape = `FORMAT: Landscape — design like a horizontal theatrical banner.
HERO PLACEMENT: Slightly left of centre, occupying roughly the left 10%–65% of the canvas width.
TITLE PLACEMENT: Upper-left or upper-centre area, clear of the hero's face.
BACKGROUND: Atmospheric environment fills the right portion and edges.`;
  } else if (isWideLandscape) {
    shape = `FORMAT: Wide landscape — design like a billboard.
HERO PLACEMENT: Left and centre sections, occupying roughly the left 60% of the canvas. Stack or spread multiple characters horizontally.
TITLE PLACEMENT: Left or lower-centre area. Large, bold, readable at distance.
BACKGROUND: Right 35% and all edges filled with atmospheric environment from source only.`;
  } else {
    shape = `FORMAT: Ultra-wide — design like a panoramic OOH billboard.
HERO PLACEMENT: LEFT half of the canvas. Keep faces and bodies fully visible.
TITLE PLACEMENT: Lower-left or centre-left area.
BACKGROUND: Right half and all edges filled with atmospheric environment, no characters.`;
  }

  const logo = config.logo || "";
  let avoidNote = "";
  if (logo === "right") {
    avoidNote = `EDGE CLEARANCE: The right 30% of your canvas will be partially covered after compositing. Keep that area as atmosphere only — no title, no hero faces there.`;
  } else if (logo === "top-left") {
    avoidNote = `EDGE CLEARANCE: The top-left corner will be partially covered after compositing. Shift title and hero slightly right of centre — keep the top-left quadrant free of key content.`;
  } else if (logo === "top-right") {
    avoidNote = `EDGE CLEARANCE: The top-right corner will be partially covered after compositing. Keep title and hero centred or left-of-centre — keep the top-right quadrant free of key content.`;
  } else if (logo === "top-center") {
    avoidNote = `EDGE CLEARANCE: The top centre will be partially covered after compositing. Place the title slightly lower than you normally would, in the upper-middle zone rather than the very top.`;
  }

  return [shape, avoidNote].filter(Boolean).join("\n");
}

const BANNER_CONFIGS = [
  {
    id: "6_sheet", label: "6 Sheet", width: 1200, height: 1800, ratio: "2:3", category: "OOH", logo: "top-left",
    artZone: { xPct: 0.03, yPct: 0.10, wPct: 0.82, hPct: 0.80 },
    layoutHint: "A brand logo will be overlaid in the TOP-LEFT corner (roughly the top 10% and left 20%). A text bar will cover the BOTTOM 10%. Place the hero subject and any titles/text in the CENTER and CENTER-RIGHT of the image. Keep the top-left and bottom areas free of important content.",
  },
  {
    id: "extreme_portrait", label: "Extreme Portrait OOH", width: 800, height: 2400, ratio: "1:4", category: "OOH", logo: "top-center",
    artZone: { xPct: 0.05, yPct: 0.08, wPct: 0.90, hPct: 0.84 },
    layoutHint: "A brand logo will be overlaid at the TOP CENTER (top 8%). A text bar will cover the BOTTOM 8%. This is a very tall, narrow format. Place the hero subject vertically centered. Keep the top center and bottom areas free of important content like faces or titles.",
  },
  {
    id: "26x24", label: "26 x 24", width: 1560, height: 1440, ratio: "1:1", category: "Display", logo: "top-center",
    artZone: { xPct: 0.03, yPct: 0.10, wPct: 0.94, hPct: 0.80 },
    layoutHint: "A brand logo will be overlaid at the TOP CENTER (top 10%). A text bar will cover the BOTTOM 10%. This is a near-square format. Place the hero subject in the center. Keep the top center and bottom strip free of important content.",
  },
  {
    id: "48_sheet", label: "48 Sheet", width: 2400, height: 1200, ratio: "16:9", category: "OOH", logo: "right",
    artZone: { xPct: 0.02, yPct: 0.03, wPct: 0.72, hPct: 0.85 },
    layoutHint: "A brand logo will be overlaid on the RIGHT 25% of the image. A text bar will cover the BOTTOM-LEFT 10%. This is a wide landscape. Place the hero subject and all important content (faces, titles, key elements) in the LEFT and CENTER-LEFT of the image. The right quarter must only contain background/atmosphere that can be covered.",
  },
  {
    id: "96_sheet", label: "96 Sheet", width: 3000, height: 1000, ratio: "4:1", category: "OOH", logo: "right",
    artZone: { xPct: 0.02, yPct: 0.03, wPct: 0.72, hPct: 0.85 },
    layoutHint: "A brand logo will be overlaid on the RIGHT 25% of the image. A text bar will cover the BOTTOM-LEFT 10%. This is an ultra-wide landscape. Place the hero subject and all important content in the LEFT 70%. The right quarter must only contain background/atmosphere that can be covered.",
  },
  {
    id: "extreme_landscape", label: "Extreme Landscape", width: 3200, height: 800, ratio: "4:1", category: "OOH", logo: "right",
    artZone: { xPct: 0.02, yPct: 0.03, wPct: 0.72, hPct: 0.85 },
    layoutHint: "A brand logo will be overlaid on the RIGHT 25% of the image. A text bar will cover the BOTTOM-LEFT 10%. This is an extremely wide, short landscape. Place the hero subject and all important content (faces, titles) in the LEFT 70%. The right quarter must only contain expendable background that can be covered by the logo.",
  },
  {
    id: "press_landscape", label: "Press Landscape", width: 1800, height: 1200, ratio: "3:2", category: "Press", logo: "top-right",
    artZone: { xPct: 0.03, yPct: 0.03, wPct: 0.70, hPct: 0.85 },
    layoutHint: "A brand logo will be overlaid in the TOP-RIGHT corner (top 10%, right 25%). A text bar will cover the BOTTOM 10%. Place the hero subject in the LEFT and CENTER. Keep the top-right corner and bottom free of important content.",
  },
  {
    id: "press_portrait", label: "Press Portrait", width: 1200, height: 1600, ratio: "3:4", category: "Press", logo: "top-right",
    artZone: { xPct: 0.03, yPct: 0.08, wPct: 0.80, hPct: 0.82 },
    layoutHint: "A brand logo will be overlaid in the TOP-RIGHT corner (top 8%, right 20%). A text bar will cover the BOTTOM 10%. Place the hero subject center to center-left. Keep the top-right and bottom areas free of important content.",
  },
];

// ============================================================
// TEMPLATE GENERATION
// ============================================================
async function generateTemplate(config) {
  const { width: w, height: h, label, logo, artZone: az } = config;
  const fw = Math.max(Math.round(Math.min(w, h) * 0.025), 4);

  const artX = Math.round(w * az.xPct) + fw;
  const artY = Math.round(h * az.yPct) + fw;
  const artW = Math.round(w * az.wPct) - fw * 2;
  const artH = Math.round(h * az.hPct) - fw * 2;

  config._artZone = { x: artX, y: artY, width: artW, height: artH };

  const logoH = Math.round(Math.min(w, h) * 0.14);
  const logoW = Math.round(logoH * 2.2);
  const logoFS = Math.round(logoH * 0.5);

  let logoX, logoY;
  switch (logo) {
    case "top-left": logoX = fw + w * 0.03; logoY = fw + h * 0.02; break;
    case "top-center": logoX = (w - logoW) / 2; logoY = fw + h * 0.01; break;
    case "top-right": logoX = w - fw - logoW - w * 0.03; logoY = fw + h * 0.02; break;
    case "right": logoX = w - fw - logoW - w * 0.04; logoY = (h - logoH) / 2; break;
    default: logoX = fw + w * 0.03; logoY = fw + h * 0.02;
  }

  const ctaFS = Math.max(Math.round(h * 0.025), 10);
  const ctaY = h - fw - h * 0.06;

  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <mask id="frame-mask">
        <rect width="${w}" height="${h}" fill="white"/>
        <rect x="${artX}" y="${artY}" width="${artW}" height="${artH}" fill="black" rx="3"/>
      </mask>
    </defs>
    <g mask="url(#frame-mask)">
      <rect width="${w}" height="${h}" fill="#0078E7" rx="6"/>
      <rect x="${fw}" y="${fw}" width="${w - fw * 2}" height="${h - fw * 2}" fill="#002F6C" rx="3"/>
    </g>
    <text x="${Math.round(logoX)}" y="${Math.round(logoY + logoH * 0.6)}" font-family="Arial" font-size="${logoFS}" font-weight="bold" fill="white" font-style="italic">prime</text>
    <path d="M${Math.round(logoX + logoW * 0.08)},${Math.round(logoY + logoH * 0.75)} Q${Math.round(logoX + logoW * 0.45)},${Math.round(logoY + logoH * 1.05)} ${Math.round(logoX + logoW * 0.65)},${Math.round(logoY + logoH * 0.7)}" stroke="#FF9900" stroke-width="${Math.max(Math.round(logoH * 0.05), 2)}" fill="none" stroke-linecap="round"/>
    <text x="${Math.round(w * 0.04 + fw)}" y="${Math.round(ctaY)}" font-family="Arial" font-size="${ctaFS}" fill="white" letter-spacing="1">NEW ORIGINAL SERIES | MONTH XX</text>
  </svg>`;

  const buf = await sharp(Buffer.from(svg)).ensureAlpha().png().toBuffer();
  const tpath = path.join(TEMPLATES_WRITE_DIR, `${config.id}.png`);
  fs.writeFileSync(tpath, buf);
  return tpath;
}

function computeArtZone(config) {
  const { width: w, height: h, artZone: az } = config;
  const fw = Math.max(Math.round(Math.min(w, h) * 0.025), 4);
  return {
    x: Math.round(w * az.xPct) + fw,
    y: Math.round(h * az.yPct) + fw,
    width: Math.round(w * az.wPct) - fw * 2,
    height: Math.round(h * az.hPct) - fw * 2,
  };
}

// Generate templates + restore user-created formats on startup
(async () => {
  console.log("Generating templates...");

  // Restore user-created formats from saved meta files
  // Scan both dirs for meta files
  const metaDirs = IS_VERCEL ? [TEMPLATES_WRITE_DIR, TEMPLATES_READ_DIR] : [TEMPLATES_WRITE_DIR];
  const seenMeta = new Set();
  const allMetaFiles = [];
  for (const dir of metaDirs) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith("_meta.json"))) {
      if (!seenMeta.has(f)) { seenMeta.add(f); allMetaFiles.push(path.join(dir, f)); }
    }
  }
  for (const mfPath of allMetaFiles) {
    const meta = JSON.parse(fs.readFileSync(mfPath, "utf8"));
    if (!meta.userCreated) continue;
    const id = path.basename(mfPath).replace("_meta.json", "");
    if (BANNER_CONFIGS.find(c => c.id === id)) continue;
    const framePath = templatePath(`${id}_custom.png`);
    if (!fs.existsSync(framePath)) continue;

    const overallRatio = closestSupportedRatio(meta.width, meta.height);
    BANNER_CONFIGS.push({
      id,
      label: meta.label || id,
      width: meta.width,
      height: meta.height,
      ratio: overallRatio,
      category: "Custom",
      logo: "none",
      artZone: {
        xPct: meta.artZone.x / meta.width,
        yPct: meta.artZone.y / meta.height,
        wPct: meta.artZone.width / meta.width,
        hPct: meta.artZone.height / meta.height,
      },
      layoutHint: `Art zone is at (${meta.artZone.x}, ${meta.artZone.y}), size ${meta.artZone.width}×${meta.artZone.height}. The remaining area around the art zone contains the banner frame elements. Place all important content inside the art zone.`,
      _artZone: meta.artZone,
      _customTemplate: true,
      _userCreated: true,
      _frameAnalysis: meta.frameAnalysis || null,
      _frameInstructions: meta.frameInstructions || null,
    });
    console.log(`  ✓ ${meta.label || id} (${meta.width}×${meta.height}) [user-created]`);
  }

  // Generate default templates for built-in configs
  for (const c of BANNER_CONFIGS) {
    if (c._userCreated) continue; // already loaded above
    const customPath = templatePath(`${c.id}_custom.png`);
    if (fs.existsSync(customPath)) {
      const metaPath = templatePath(`${c.id}_meta.json`);
      if (fs.existsSync(metaPath)) {
        const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
        c._artZone = meta.artZone;
        c._frameAnalysis = meta.frameAnalysis || null;
        c._frameInstructions = meta.frameInstructions || null;
      } else {
        c._artZone = computeArtZone(c);
      }
      c._customTemplate = true;
      console.log(`  ✓ ${c.label} (${c.width}×${c.height}) [custom]`);
    } else {
      await generateTemplate(c);
      console.log(`  ✓ ${c.label} (${c.width}×${c.height})`);
    }
  }
  console.log("Templates ready.\n");

  // Analyze frames for any templates missing frameInstructions (custom OR built-in)
  const needsAnalysis = BANNER_CONFIGS.filter(c => !c._frameInstructions && c._artZone);
  if (needsAnalysis.length > 0 && process.env.GEMINI_API_KEY) {
    console.log(`Analyzing ${needsAnalysis.length} template frame(s)...`);
    for (const c of needsAnalysis) {
      const customFrame = templatePath(`${c.id}_custom.png`);
      const defaultFrame = templatePath(`${c.id}.png`);
      const framePath = fs.existsSync(customFrame) ? customFrame : defaultFrame;
      if (!fs.existsSync(framePath)) continue;
      try {
        const frameAnalysis = await analyzeFrameWithAI(framePath, c._artZone, c.width, c.height);
        if (frameAnalysis?.instructions) {
          c._frameAnalysis = frameAnalysis;
          c._frameInstructions = frameAnalysis.instructions;
          // Update or create meta.json
          const metaPath = path.join(TEMPLATES_WRITE_DIR, `${c.id}_meta.json`);
          let meta = {};
          if (fs.existsSync(metaPath)) {
            meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
          }
          meta.artZone = meta.artZone || c._artZone;
          meta.frameAnalysis = frameAnalysis;
          meta.frameInstructions = frameAnalysis.instructions;
          fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
          console.log(`  ✓ ${c.label}: ${frameAnalysis.instructions.slice(0, 100)}...`);
        } else {
          console.log(`  ⚠ ${c.label}: no instructions returned`);
        }
      } catch (err) {
        console.log(`  ⚠ ${c.label}: ${err.message?.slice(0, 80)}`);
      }
    }
    console.log("Frame analysis complete.\n");
  }
})();

// ============================================================
// API ROUTES
// ============================================================

app.get("/api/banners", (req, res) => {
  res.json(BANNER_CONFIGS.map(c => ({
    id: c.id,
    label: c.label,
    width: c.width,
    height: c.height,
    ratio: c.ratio,
    category: c.category,
    templateUrl: c._customTemplate ? `/templates/${c.id}_custom.png` : `/templates/${c.id}.png`,
    isCustom: !!c._customTemplate,
    isUserCreated: !!c._userCreated,
  })));
});

// Analyze the frame around the art zone to generate template-specific composition instructions.
// This tells Gemini exactly where logos, text bars, and branding sit so artwork avoids those areas.
async function analyzeFrameWithAI(imagePath, artZone, fullWidth, fullHeight) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const ai = new GoogleGenAI({ apiKey });
  const imgBuf = fs.readFileSync(imagePath);
  const b64 = imgBuf.toString("base64");

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: [{ role: "user", parts: [
        { inlineData: { mimeType: "image/png", data: b64 } },
        { text: `This is a banner TEMPLATE/FRAME image that is ${fullWidth}×${fullHeight} pixels. It has a transparent cutout (art zone) at x=${artZone.x}, y=${artZone.y}, size ${artZone.width}×${artZone.height} where artwork will be placed.

The OPAQUE areas around the cutout contain the banner frame — logos, text, branding, borders, etc. These frame elements will be composited ON TOP of the generated artwork.

Analyze the frame and tell me EXACTLY what is in each area around the art zone. I need this to instruct an image generation AI where to place content so nothing important gets hidden.

Return ONLY a JSON object with this structure:
{
  "top": {"height_px": <number>, "contains": "<what's there — e.g. 'logo', 'brand name', 'empty border', 'thin frame edge'>"},
  "bottom": {"height_px": <number>, "contains": "<what's there>"},
  "left": {"width_px": <number>, "contains": "<what's there>"},
  "right": {"width_px": <number>, "contains": "<what's there>"},
  "corners": "<describe any logos or branding in specific corners, e.g. 'Prime Video logo in top-left', 'QR code bottom-right'>",
  "instructions": "<Write 2-3 sentences of composition instructions for an AI generating artwork for this cutout. Describe which areas to avoid and where to place the hero subject and title using RELATIVE terms like 'top 10%', 'left third', 'bottom quarter', 'upper-right corner'. NEVER use pixel coordinates — only use percentages and directional descriptions.>"
}

Be precise about the measurements in the top/bottom/left/right fields. The 'instructions' field MUST use only relative terms (percentages, thirds, quarters, halves) — NEVER pixel values. Return ONLY the JSON, no other text.` }
      ]}],
      config: { responseModalities: ["TEXT"] },
    });

    const text = response.candidates?.[0]?.content?.parts?.find(p => p.text)?.text;
    if (!text) return null;

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    return parsed;
  } catch (err) {
    console.error("[Frame Analysis] Error:", err.message?.slice(0, 200));
    return null;
  }
}

async function detectArtZoneWithAI(imagePath, config) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const ai = new GoogleGenAI({ apiKey });
  const imgBuf = fs.readFileSync(imagePath);
  const b64 = imgBuf.toString("base64");

  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-image-preview",
    contents: [{ role: "user", parts: [
      { inlineData: { mimeType: "image/png", data: b64 } },
      { text: `This is a banner template image that is ${config.width}x${config.height} pixels. It has a rectangular area where artwork/key art should be placed. This area is typically lighter or clearly marked as the content zone — it's the main open space where a movie/show poster image would go.

Identify the EXACT pixel coordinates of this art zone rectangle. Return ONLY a JSON object with these fields:
{"x": <left edge in pixels>, "y": <top edge in pixels>, "width": <width in pixels>, "height": <height in pixels>}

Be precise. The coordinates should define the clear rectangular area for art placement, NOT including the border frame, logo areas, or CTA text areas. Return ONLY the JSON, no other text.` }
    ]}],
    config: { responseModalities: ["TEXT"] },
  });

  const text = response.candidates?.[0]?.content?.parts?.find(p => p.text)?.text;
  if (!text) throw new Error("No response from AI");

  const jsonMatch = text.match(/\{[\s\S]*?\}/);
  if (!jsonMatch) throw new Error("Could not parse art zone from AI response: " + text.slice(0, 200));

  const parsed = JSON.parse(jsonMatch[0]);
  if (!parsed.x && parsed.x !== 0 || !parsed.y && parsed.y !== 0 || !parsed.width || !parsed.height) {
    throw new Error("Invalid art zone coordinates from AI: " + JSON.stringify(parsed));
  }

  return {
    x: Math.max(0, Math.round(parsed.x)),
    y: Math.max(0, Math.round(parsed.y)),
    width: Math.min(config.width - Math.round(parsed.x), Math.round(parsed.width)),
    height: Math.min(config.height - Math.round(parsed.y), Math.round(parsed.height)),
  };
}

async function detectTransparentRegion(pngBuffer, w, h) {
  const { data } = await sharp(pngBuffer).raw().toBuffer({ resolveWithObject: true });
  let minX = w, minY = h, maxX = 0, maxY = 0, transparentCount = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const alpha = data[(y * w + x) * 4 + 3];
      if (alpha < 10) {
        transparentCount++;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }

  if (transparentCount < (w * h * 0.05)) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

// POST /api/formats/new — create a brand new format by uploading a frame
app.post("/api/formats/new", upload.single("frame"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const label = req.body.label?.trim();
  if (!label) return res.status(400).json({ error: "Name is required" });

  try {
    // Read the image to get its actual dimensions
    const meta = await sharp(req.file.path).metadata();
    const width = meta.width;
    const height = meta.height;

    // Create a stable ID from the label
    const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    if (BANNER_CONFIGS.find(c => c.id === id)) {
      return res.status(400).json({ error: `A format called "${label}" already exists` });
    }

    // Render to PNG at detected dimensions, preserving transparency
    const isSvg = req.file.originalname?.toLowerCase().endsWith(".svg") || req.file.mimetype === "image/svg+xml";
    let pngBuffer;
    if (isSvg) {
      pngBuffer = await sharp(fs.readFileSync(req.file.path), { density: 150 })
        .resize(width, height, { fit: "fill" }).ensureAlpha().png().toBuffer();
    } else {
      pngBuffer = await sharp(req.file.path).ensureAlpha().png().toBuffer();
    }

    // Check if the client sent an explicit art zone (from the visual selector)
    let artZone = null;
    let method = "manual";

    if (req.body.artZone) {
      try {
        const az = JSON.parse(req.body.artZone);
        artZone = { x: Math.round(az.x), y: Math.round(az.y), width: Math.round(az.width), height: Math.round(az.height) };
        console.log(`[NEW FORMAT] Using manual art zone: ${artZone.width}×${artZone.height} at (${artZone.x}, ${artZone.y})`);
        // Punch transparent hole for the art zone
        const punch = await sharp({
          create: { width: artZone.width, height: artZone.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
        }).png().toBuffer();
        pngBuffer = await sharp(pngBuffer)
          .composite([{ input: punch, left: artZone.x, top: artZone.y, blend: "dest-out" }])
          .png().toBuffer();
      } catch (e) {
        console.warn("[NEW FORMAT] Failed to parse artZone, falling back to auto-detection:", e.message);
        artZone = null;
      }
    }

    // Auto-detect if no manual zone provided
    if (!artZone) {
      artZone = await detectTransparentRegion(pngBuffer, width, height);
      method = "transparency";
    }

    if (!artZone) {
      // Save temp file for AI detection
      const tempPath = path.join(TEMPLATES_WRITE_DIR, `${id}_temp.png`);
      fs.writeFileSync(tempPath, pngBuffer);
      artZone = await detectArtZoneWithAI(tempPath, { width, height });
      method = "ai";

      // Punch transparent hole
      const punch = await sharp({
        create: { width: artZone.width, height: artZone.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
      }).png().toBuffer();
      pngBuffer = await sharp(pngBuffer)
        .composite([{ input: punch, left: artZone.x, top: artZone.y, blend: "dest-out" }])
        .png().toBuffer();
      fs.unlinkSync(tempPath);
    }

    // Figure out the closest supported ratio for the art zone
    const artRatio = closestSupportedRatio(artZone.width, artZone.height);
    const overallRatio = closestSupportedRatio(width, height);

    // Save the frame PNG first so we can analyze it
    const framePath = path.join(TEMPLATES_WRITE_DIR, `${id}_custom.png`);
    fs.writeFileSync(framePath, pngBuffer);

    // Analyze the frame to generate template-specific composition instructions
    const frameAnalysis = await analyzeFrameWithAI(framePath, artZone, width, height);
    const frameInstructions = frameAnalysis?.instructions || null;
    if (frameAnalysis) {
      console.log(`[NEW FORMAT] Frame analysis for ${label}:`, frameAnalysis.instructions?.slice(0, 120));
    }

    // Infer which side has the most frame coverage for edge clearance hints
    const _topPct = artZone.y / height;
    const _bottomPct = (height - artZone.y - artZone.height) / height;
    const _leftPct = artZone.x / width;
    const _rightPct = (width - artZone.x - artZone.width) / width;
    const _maxEdge = Math.max(_topPct, _bottomPct, _leftPct, _rightPct);
    const inferredLogo = _maxEdge < 0.08 ? "none"
      : _rightPct === _maxEdge ? "right"
      : _leftPct === _maxEdge ? "top-left"
      : _topPct === _maxEdge ? "top-center"
      : "none";

    // Build the config
    const config = {
      id,
      label,
      width,
      height,
      ratio: overallRatio,
      category: "Custom",
      logo: inferredLogo,
      artZone: {
        xPct: artZone.x / width,
        yPct: artZone.y / height,
        wPct: artZone.width / width,
        hPct: artZone.height / height,
      },
      layoutHint: (() => {
        const topPct = Math.round((artZone.y / height) * 100);
        const bottomPct = Math.round(((height - artZone.y - artZone.height) / height) * 100);
        const leftPct = Math.round((artZone.x / width) * 100);
        const rightPct = Math.round(((width - artZone.x - artZone.width) / width) * 100);
        const parts = [];
        if (topPct > 3) parts.push(`the top ~${topPct}%`);
        if (bottomPct > 3) parts.push(`the bottom ~${bottomPct}%`);
        if (leftPct > 3) parts.push(`the left ~${leftPct}%`);
        if (rightPct > 3) parts.push(`the right ~${rightPct}%`);
        const covered = parts.length ? parts.join(', ') : 'the outermost edges';
        return `After compositing, a decorative frame will cover ${covered} of the canvas. These areas will be hidden under the frame overlay, so fill them with expendable background only (sky, atmosphere, texture — no faces, no text, no important content). Keep ALL important content (hero characters, title text, key visual elements) well inside the visible centre of the canvas.`;
      })(),
      _artZone: artZone,
      _customTemplate: true,
      _userCreated: true,
      _frameAnalysis: frameAnalysis,
      _frameInstructions: frameInstructions,
    };

    // Save metadata
    const metaPath = path.join(TEMPLATES_WRITE_DIR, `${id}_meta.json`);
    fs.writeFileSync(metaPath, JSON.stringify({
      artZone,
      label,
      width,
      height,
      userCreated: true,
      frameAnalysis,
      frameInstructions,
    }, null, 2));

    BANNER_CONFIGS.push(config);
    fs.unlinkSync(req.file.path);

    console.log(`[NEW FORMAT] ${label} (${width}×${height}), art zone: ${artZone.width}×${artZone.height} via ${method}`);

    res.json({
      success: true,
      id,
      label,
      width,
      height,
      artZone,
      method,
      templateUrl: `/templates/${id}_custom.png`,
    });
  } catch (err) {
    console.error("[NEW FORMAT] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/formats/:id — delete a user-created format
app.delete("/api/formats/:id", (req, res) => {
  const idx = BANNER_CONFIGS.findIndex(c => c.id === req.params.id && c._userCreated);
  if (idx === -1) return res.status(404).json({ error: "User-created format not found" });

  const config = BANNER_CONFIGS[idx];
  const framePath = path.join(TEMPLATES_WRITE_DIR, `${config.id}_custom.png`);
  const metaPath  = path.join(TEMPLATES_WRITE_DIR, `${config.id}_meta.json`);
  if (fs.existsSync(framePath)) fs.unlinkSync(framePath);
  if (fs.existsSync(metaPath))  fs.unlinkSync(metaPath);
  BANNER_CONFIGS.splice(idx, 1);

  res.json({ success: true, deleted: config.id });
});

app.post("/api/templates/:id/upload", upload.single("template"), async (req, res) => {
  const config = BANNER_CONFIGS.find(c => c.id === req.params.id);
  if (!config) return res.status(404).json({ error: "Banner not found" });
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  try {
    const isSvg = req.file.originalname?.toLowerCase().endsWith(".svg") || req.file.mimetype === "image/svg+xml";

    let pngBuffer;
    if (isSvg) {
      const svgData = fs.readFileSync(req.file.path);
      pngBuffer = await sharp(svgData, { density: 150 })
        .resize(config.width, config.height, { fit: "fill" })
        .ensureAlpha().png().toBuffer();
    } else {
      pngBuffer = await sharp(req.file.path)
        .resize(config.width, config.height, { fit: "fill" })
        .ensureAlpha().png().toBuffer();
    }

    let artZone = await detectTransparentRegion(pngBuffer, config.width, config.height);

    if (artZone) {
      const customPath = path.join(TEMPLATES_WRITE_DIR, `${config.id}_custom.png`);
      fs.writeFileSync(customPath, pngBuffer);
    } else {
      const tempPath = path.join(TEMPLATES_WRITE_DIR, `${config.id}_temp.png`);
      fs.writeFileSync(tempPath, pngBuffer);

      artZone = await detectArtZoneWithAI(tempPath, config);

      const punch = await sharp({
        create: { width: artZone.width, height: artZone.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
      }).png().toBuffer();

      const frameWithCutout = await sharp(pngBuffer)
        .composite([{ input: punch, left: artZone.x, top: artZone.y, blend: "dest-out" }])
        .png().toBuffer();

      const customPath = path.join(TEMPLATES_WRITE_DIR, `${config.id}_custom.png`);
      fs.writeFileSync(customPath, frameWithCutout);
      fs.unlinkSync(tempPath);
    }

    config._artZone = artZone;
    config._customTemplate = true;

    // Analyze the frame to generate template-specific composition instructions
    const customPath = path.join(TEMPLATES_WRITE_DIR, `${config.id}_custom.png`);
    const frameAnalysis = await analyzeFrameWithAI(customPath, artZone, config.width, config.height);
    const frameInstructions = frameAnalysis?.instructions || null;
    config._frameAnalysis = frameAnalysis;
    config._frameInstructions = frameInstructions;
    if (frameAnalysis) {
      console.log(`[${config.id}] Frame analysis:`, frameInstructions?.slice(0, 120));
    }

    const metaPath = path.join(TEMPLATES_WRITE_DIR, `${config.id}_meta.json`);
    fs.writeFileSync(metaPath, JSON.stringify({ artZone, frameAnalysis, frameInstructions }, null, 2));
    fs.unlinkSync(req.file.path);

    res.json({ success: true, label: config.label, artZone, frameInstructions, templateUrl: `/templates/${config.id}_custom.png` });
  } catch (err) {
    console.error(`[${config.id}] Template upload error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/templates/:id/custom", (req, res) => {
  const config = BANNER_CONFIGS.find(c => c.id === req.params.id);
  if (!config) return res.status(404).json({ error: "Banner not found" });

  const customPath = path.join(TEMPLATES_WRITE_DIR, `${config.id}_custom.png`);
  const metaPath   = path.join(TEMPLATES_WRITE_DIR, `${config.id}_meta.json`);
  if (fs.existsSync(customPath)) fs.unlinkSync(customPath);
  if (fs.existsSync(metaPath))   fs.unlinkSync(metaPath);
  config._customTemplate = false;
  generateTemplate(config);

  res.json({ success: true, reverted: true });
});

// ============================================================
// CONCURRENCY CONTROL
// ============================================================
const CONCURRENCY_LIMIT = parseInt(process.env.CONCURRENCY_LIMIT || "5", 10);

class Semaphore {
  constructor(max) { this.max = max; this.current = 0; this.queue = []; }
  acquire() {
    if (this.current < this.max) { this.current++; return Promise.resolve(); }
    return new Promise(resolve => this.queue.push(resolve));
  }
  release() {
    this.current--;
    if (this.queue.length > 0) { this.current++; this.queue.shift()(); }
  }
}

app.post("/api/generate", upload.single("art"), async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY not set" });

  const { bannerIds, model, customPrompt, bannerNotes, variations: variationsRaw } = req.body;
  const selectedIds = JSON.parse(bannerIds || "[]");
  const selectedModel = model || "gemini-3.1-flash-image-preview";
  const perBannerNotes = JSON.parse(bannerNotes || "{}");
  const variations = Math.max(1, Math.min(10, parseInt(variationsRaw || "1", 10)));
  if (!req.file) return res.status(400).json({ error: "No art file uploaded" });
  if (!selectedIds.length) return res.status(400).json({ error: "No banners selected" });

  // Build flat job array: N formats × M variations
  const jobs = [];
  for (const id of selectedIds) {
    for (let v = 0; v < variations; v++) {
      jobs.push({ bannerId: id, variationIndex: v, jobId: `${id}_v${v}` });
    }
  }

  const ai = new GoogleGenAI({ apiKey });
  const artBuffer = fs.readFileSync(req.file.path);
  const mimeType  = req.file.mimetype || "image/png";
  console.log(`Upload: ${req.file.originalname}, ${artBuffer.length} bytes, ${jobs.length} jobs (${selectedIds.length} formats × ${variations} variations)`);

  let processedBuffer = artBuffer;
  if (artBuffer.length > 4 * 1024 * 1024) {
    processedBuffer = await sharp(artBuffer).resize(2048, 2048, { fit: "inside" }).jpeg({ quality: 85 }).toBuffer();
  }
  const artBase64 = processedBuffer.toString("base64");

  const templateCache = new Map(); // Cache template PNGs per bannerId across variations

  const runId  = Date.now().toString();
  const runDir = path.join(WORK_DIR, "outputs", runId);
  fs.mkdirSync(path.join(runDir, "regenerated"), { recursive: true });
  fs.mkdirSync(path.join(runDir, "banners"),     { recursive: true });
  fs.copyFileSync(req.file.path, path.join(runDir, "original.png"));

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });

  let clientDisconnected = false;
  req.on("close", () => { clientDisconnected = true; });

  const send = (data) => {
    if (!clientDisconnected) {
      try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch {}
    }
  };

  send({ type: "start", runId, total: jobs.length });

  const completedJobs = [];
  const defaultPrompt = `You are a world-class photo retoucher and art director. Your job is to take existing key art and recompose it for a {{RATIO}} canvas — like a professional retoucher would in Photoshop.

=== WHAT YOU PRODUCE ===
A CLEAN, FINISHED piece of artwork. No annotations, no guidelines, no markup — just beautiful, professional campaign art ready for print.

=== COMPOSITION GUIDANCE ===
The edges of your canvas will be partially covered by a frame after compositing:
{{LAYOUT}}
Keep expendable background near the edges (sky, gradients, texture). All important content must be inset from edges into the central area.

=== YOUR CREATIVE PROCESS ===
Think like a retoucher recomposing a poster for a new aspect ratio:

1. STUDY the source art carefully. Identify:
   - The hero characters and their poses
   - The title treatment — exact spelling, font style, colour, visual effects (metallic, shadow, glow, etc.)
   - Any taglines or dates — exact text, exact styling
   - The mood, colour palette, lighting, and atmosphere

2. RECOMPOSE for {{RATIO}}:
   - Rearrange, reposition, and resize elements from the source art to fill the new shape beautifully
   - The hero subject must be COMPLETE — full head, full body if shown, no awkward crops
   - Reflow the title if needed: split across lines, stack vertically, move it — whatever works for the shape. Match the SAME font style, colour, and effects
   - Extend the background atmosphere (sky, fog, sparks, arena, environment) to fill the new canvas naturally
   - Be creative with the composition — a great retoucher makes every format look like it was the original

3. ONLY USE WHAT EXISTS in the source art:
   - Characters, title, tagline, date text — reposition and resize these freely
   - Background environment — extend and fill naturally
   - That's it. NOTHING ELSE.

=== WHAT TO STRIP FROM THE SOURCE ===
The source image may have packaging that is NOT part of the artwork:
- Streaming service branding, network watermarks, colored borders/frames added by distributors
- "Watch now" badges, QR codes, app store icons
These are packaging — strip them completely. Output ONLY the show/movie artwork.

=== ABSOLUTE RULES ===
- ONLY use elements that exist in the source artwork. NEVER invent, generate, or add ANY element that is not already in the source — no new text, no new graphics, no watermarks, no branding of any kind.
- NEVER change the spelling of any text from the source artwork.
- NEVER stretch, squash, or distort elements.
- NEVER add borders, letterboxing, or pillarboxing.
- NEVER leave dead space — fill the full {{RATIO}} canvas.
- NEVER crop the hero subject's face or head.
- NEVER draw lines, boxes, annotations, measurements, or any technical markup. Your output is FINISHED ART.
- NEVER place important content near the canvas edges.`;

  const sem = new Semaphore(CONCURRENCY_LIMIT);

  async function processJob(job) {
    const { bannerId, variationIndex, jobId } = job;
    const config = BANNER_CONFIGS.find(c => c.id === bannerId);
    if (!config) return;

    if (clientDisconnected) return;

    await sem.acquire();
    try {
      if (clientDisconnected) return;

      // Random jitter 0-2s INSIDE the semaphore to stagger concurrent Gemini API calls
      await new Promise(r => setTimeout(r, Math.random() * 2000));

      const varLabel = variations > 1 ? `${config.label} v${variationIndex + 1}` : config.label;
      send({ type: "progress", bannerId, jobId, variationIndex, step: "regenerating", label: varLabel });

      const az = config._artZone;
      const artRatio = closestSupportedRatio(az.width, az.height);

      const margin = Math.max(30, Math.round(Math.min(az.width, az.height) * 0.06));
      const compositionHint = getDesignerCompositionHint(config, az);

      const rawFrameInstructions = config._frameInstructions;
      // Strip any pixel coordinates from cached frame instructions to prevent the model from drawing them
      const frameInstructions = rawFrameInstructions
        ? rawFrameInstructions
            .replace(/\b\d+\s*[×x]\s*\d+\s*(px|pixels?)\b/gi, '')
            .replace(/\b[xy]\s*[=:]\s*\d+/gi, '')
            .replace(/\b\d+\s*px\b/gi, '')
            .replace(/\b\d+\s*pixels?\b/gi, '')
            .replace(/\s{2,}/g, ' ')
            .trim()
        : null;
      const frameBlock = frameInstructions
        ? `\n\nTEMPLATE-SPECIFIC COMPOSITION NOTES:\n${frameInstructions}\nFollow these composition guidelines — but remember: NEVER draw any lines, boxes, or annotations on the artwork.`
        : '';

      // For custom templates with asymmetric frames, compute per-edge coverage
      const topCover = Math.round((az.y / config.height) * 100);
      const bottomCover = Math.round(((config.height - az.y - az.height) / config.height) * 100);
      const leftCover = Math.round((az.x / config.width) * 100);
      const rightCover = Math.round(((config.width - az.x - az.width) / config.width) * 100);
      const marginPct = Math.round((margin / Math.min(az.width, az.height)) * 100);

      // Build edge-specific coverage description
      const edgeParts = [];
      if (topCover > 3) edgeParts.push(`TOP ~${topCover}%`);
      if (bottomCover > 3) edgeParts.push(`BOTTOM ~${bottomCover}%`);
      if (leftCover > 3) edgeParts.push(`LEFT ~${leftCover}%`);
      if (rightCover > 3) edgeParts.push(`RIGHT ~${rightCover}%`);
      const edgeDesc = edgeParts.length
        ? `These specific edges will be covered by the frame overlay after compositing: ${edgeParts.join(', ')}.`
        : `The outermost ~${marginPct}% on every side will be partially covered by the frame edge.`;

      const computedLayout = `Your generated canvas is the visible art window.
${edgeDesc}
SAFE ZONE: All important content (title text, faces, characters, key visual elements) MUST be placed well inside the canvas — away from any covered edges. Think of it as padding: push everything important toward the centre.
COVERED EDGES = expendable background ONLY (sky, atmosphere, gradients, texture). No faces, no text, no characters in those zones.

CRITICAL: Your output is FINISHED ART. Do NOT draw any lines, rectangles, borders, safe zone markers, or boundary indicators. The safe zone is an invisible guide — never render it visually.

DESIGNER COMPOSITION GUIDE for this format:
${compositionHint}${frameBlock}`;

      const bannerNote = perBannerNotes[bannerId]?.trim();

      let basePrompt = (customPrompt || defaultPrompt)
        .replaceAll("{{RATIO}}", artRatio)
        .replaceAll("{{LAYOUT}}", computedLayout)
;

      let prompt;
      if (bannerNote) {
        const noteBlock = `=== PRIORITY INSTRUCTIONS FOR THIS FORMAT ===\n${bannerNote}\n=== END PRIORITY INSTRUCTIONS ===\n\n`;
        const firstNewline = basePrompt.indexOf('\n');
        prompt = firstNewline >= 0
          ? basePrompt.slice(0, firstNewline + 1) + '\n' + noteBlock + basePrompt.slice(firstNewline + 1)
          : noteBlock + basePrompt;
        prompt += `\n\nREMINDER — apply the priority instructions above: ${bannerNote}`;
      } else {
        prompt = basePrompt;
      }

      let response;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          response = await ai.models.generateContent({
            model: selectedModel,
            contents: [{ role: "user", parts: [
              { inlineData: { mimeType, data: artBase64 } },
              { text: prompt }
            ]}],
            config: {
              responseModalities: ["TEXT", "IMAGE"],
              imageConfig: { aspectRatio: artRatio, imageSize: "1K" },
            },
          });
          break;
        } catch (retryErr) {
          console.error(`[${jobId}] Attempt ${attempt + 1} failed:`, retryErr.message?.slice(0, 100));
          if (attempt < 2) {
            const wait = retryErr.status === 429 ? (attempt + 1) * 15000 : (attempt + 1) * 10000;
            send({ type: "progress", bannerId, jobId, variationIndex, step: "regenerating", label: `${varLabel} (retry ${attempt + 1})` });
            await new Promise(r => setTimeout(r, wait));
          } else {
            throw retryErr;
          }
        }
      }

      let regenBuffer = null;
      const parts = response?.candidates?.[0]?.content?.parts;
      if (Array.isArray(parts)) {
        for (const part of parts) {
          if (part.inlineData) { regenBuffer = Buffer.from(part.inlineData.data, "base64"); break; }
        }
      }

      if (!regenBuffer) {
        const text = parts?.find(p => p.text)?.text || JSON.stringify(response);
        throw new Error(text.slice(0, 200));
      }

      const fileSuffix = variations > 1 ? `${bannerId}_v${variationIndex}` : bannerId;
      const regenPath = path.join(runDir, "regenerated", `${fileSuffix}.png`);
      fs.writeFileSync(regenPath, regenBuffer);

      send({ type: "progress", bannerId, jobId, variationIndex, step: "compositing", label: varLabel });

      let resized = await sharp(regenBuffer)
        .resize(az.width, az.height, { fit: "cover", position: "centre" })
        .png().toBuffer();

      let artLayer = await sharp({
        create: { width: config.width, height: config.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
      })
        .composite([{ input: resized, left: az.x, top: az.y }])
        .png().toBuffer();

      const tplPath = config._customTemplate
        ? templatePath(`${bannerId}_custom.png`)
        : templatePath(`${bannerId}.png`);
      // Cache template reads — same template is reused across variations
      if (!templateCache.has(bannerId)) {
        templateCache.set(bannerId, fs.readFileSync(tplPath));
      }
      const frameOverlay = templateCache.get(bannerId);
      let banner = await sharp(artLayer)
        .composite([{ input: frameOverlay, left: 0, top: 0 }])
        .png().toBuffer();

      const bannerPath = path.join(runDir, "banners", `${fileSuffix}.png`);
      fs.writeFileSync(bannerPath, banner);

      send({
        type: "complete",
        bannerId,
        jobId,
        variationIndex,
        label: config.label,
        width: config.width,
        height: config.height,
        regenUrl:     `/outputs/${runId}/regenerated/${fileSuffix}.png`,
        bannerUrl:    `/outputs/${runId}/banners/${fileSuffix}.png`,
        templateUrl:  `/templates/${bannerId}.png`,
      });

      completedJobs.push(jobId);

      // Help GC reclaim large buffers
      regenBuffer = null;
      resized = null;
      artLayer = null;
      banner = null;

    } catch (err) {
      const errStr = err.message || String(err);
      try {
        fs.writeFileSync(
          path.join(WORK_DIR, `outputs/last_error_${jobId}.txt`),
          JSON.stringify({ message: errStr, stack: err.stack }),
          "utf8"
        );
      } catch {}

      let msg = "Unknown error";
      if (err.errorDetails?.length) {
        msg = err.errorDetails.map(d => d.reason || d.message || JSON.stringify(d)).join("; ");
      } else if (err.status && err.statusText) {
        msg = `[${err.status}] ${err.statusText}`;
      } else {
        const raw = err.message || String(err);
        try {
          const obj = JSON.parse(raw);
          const body = obj?.sdkHttpResponse?.body || obj?.error || obj;
          if (typeof body === "string") {
            try { const b2 = JSON.parse(body); msg = b2?.error?.message || body.slice(0,200); } catch { msg = body.slice(0,200); }
          } else {
            msg = body?.error?.message || body?.message || JSON.stringify(body).slice(0,200);
          }
        } catch {
          msg = raw.slice(0, 300);
        }
      }
      if (err.code) msg = `[${err.code}] ${msg}`;
      console.error(`[${jobId}] Error:`, msg);
      send({ type: "error", bannerId, jobId, variationIndex, label: config.label, error: msg });
    } finally {
      sem.release();
    }
  }

  await Promise.allSettled(jobs.map(job => processJob(job)));

  send({ type: "done", runId, completed: completedJobs.length, total: jobs.length });
  res.end();

  try { fs.unlinkSync(req.file.path); } catch {}
});

app.get("/api/runs/:id", (req, res) => {
  const runDir = path.join(WORK_DIR, "outputs", req.params.id);
  if (!fs.existsSync(runDir)) return res.status(404).json({ error: "Run not found" });
  const bannersDir = path.join(runDir, "banners");
  const banners = fs.existsSync(bannersDir)
    ? fs.readdirSync(bannersDir).map(f => ({
        id: f.replace(".png", ""),
        bannerUrl: `/outputs/${req.params.id}/banners/${f}`,
        regenUrl:  `/outputs/${req.params.id}/regenerated/${f}`,
      }))
    : [];
  res.json({ runId: req.params.id, banners, originalUrl: `/outputs/${req.params.id}/original.png` });
});

// ============================================================
// AIFLOW — SSE + Webhooks
// ============================================================
const sseClients = new Set();

app.get('/sse', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

function broadcastSSE(data) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(r => r.write(msg));
}

app.all('/webhook/:wpath', (req, res) => {
  const wpath = req.params.wpath;
  broadcastSSE({ path: wpath, payload: req.body });
  res.json({ ok: true, path: wpath, received: req.body });
});

// ============================================================
// AIFLOW — API Proxies (Gemini, OpenAI, Kling, fal.ai)
// ============================================================

// Kling JWT helper
async function signKlingJWT(accessKey, secretKey) {
  const encoder = new TextEncoder();
  const now = Math.floor(Date.now() / 1000);
  const headerB64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify({ iss: accessKey, exp: now + 1800, nbf: now - 5 })).toString('base64url');
  const signingInput = `${headerB64}.${payloadB64}`;
  const cryptoKey = await crypto.subtle.importKey(
    'raw', encoder.encode(secretKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(signingInput));
  return `${headerB64}.${payloadB64}.${Buffer.from(sig).toString('base64url')}`;
}

// Gemini proxy (workflow nodes use this)
app.post('/api/gemini', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY || req.headers['x-gemini-key'];
    if (!apiKey) return res.status(400).json({ error: 'No Gemini API key.' });
    const { model, action = 'generateContent', ...body } = req.body;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${action}?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    res.status(response.status).json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Gemini operation polling (Veo)
app.get('/api/gemini/operation', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY || req.headers['x-gemini-key'];
    if (!apiKey) return res.status(400).json({ error: 'No Gemini API key.' });
    const { name } = req.query;
    const url = `https://generativelanguage.googleapis.com/v1beta/${name}?key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json().catch(() => ({}));
    res.status(response.status).json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// OpenAI chat proxy
app.post('/api/openai/chat', async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY || req.headers['x-openai-key'];
    if (!apiKey) return res.status(400).json({ error: 'No OpenAI API key.' });
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(req.body),
    });
    const data = await response.json().catch(() => ({}));
    res.status(response.status).json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// OpenAI images proxy
app.post('/api/openai/images', async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY || req.headers['x-openai-key'];
    if (!apiKey) return res.status(400).json({ error: 'No OpenAI API key.' });
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(req.body),
    });
    const data = await response.json().catch(() => ({}));
    res.status(response.status).json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// OpenAI image edits proxy (base64 → FormData)
app.post('/api/openai/images/edits', async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY || req.headers['x-openai-key'];
    if (!apiKey) return res.status(400).json({ error: 'No OpenAI API key.' });
    const { prompt, size, quality, images } = req.body;
    const formData = new FormData();
    formData.append('model', 'gpt-image-1');
    formData.append('prompt', prompt);
    formData.append('n', '1');
    formData.append('size', size || '1024x1024');
    formData.append('quality', quality || 'high');
    formData.append('output_format', 'b64_json');
    for (let i = 0; i < images.length; i++) {
      const [header, b64] = images[i].split(',');
      const mimeType = header.replace('data:', '').replace(';base64', '');
      const bytes = Buffer.from(b64, 'base64');
      formData.append('image[]', new Blob([bytes], { type: mimeType }), `ref_${i}.png`);
    }
    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });
    const data = await response.json().catch(() => ({}));
    res.status(response.status).json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Kling video proxy (JWT signed)
app.post('/api/kling/task', async (req, res) => {
  try {
    const accessKey = process.env.KLING_ACCESS_KEY || req.headers['x-kling-key'];
    const secretKey = process.env.KLING_SECRET_KEY || req.headers['x-kling-secret'];
    if (!accessKey || !secretKey) return res.status(400).json({ error: 'No Kling API keys.' });
    const { type = 'text2video', ...body } = req.body;
    const endpoint = type === 'image2video'
      ? 'https://api.klingai.com/v1/videos/image2video'
      : 'https://api.klingai.com/v1/videos/text2video';
    const jwt = await signKlingJWT(accessKey, secretKey);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    res.status(response.status).json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/kling/task/:id', async (req, res) => {
  try {
    const accessKey = process.env.KLING_ACCESS_KEY || req.headers['x-kling-key'];
    const secretKey = process.env.KLING_SECRET_KEY || req.headers['x-kling-secret'];
    if (!accessKey || !secretKey) return res.status(400).json({ error: 'No Kling API keys.' });
    const jwt = await signKlingJWT(accessKey, secretKey);
    const response = await fetch(`https://api.klingai.com/v1/videos/text2video/${req.params.id}`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    const data = await response.json().catch(() => ({}));
    res.status(response.status).json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// fal.ai proxy
app.post('/api/fal', async (req, res) => {
  try {
    const apiKey = process.env.FAL_API_KEY || req.headers['x-fal-key'];
    if (!apiKey) return res.status(400).json({ error: 'No fal.ai API key.' });
    const { modelId, referenceImages, ...body } = req.body;
    if (referenceImages && referenceImages.length > 0) {
      const converted = await Promise.all(referenceImages.map(async (imgUrl) => {
        if (imgUrl.startsWith('data:')) return imgUrl;
        try {
          const imgRes = await fetch(imgUrl);
          const buffer = await imgRes.arrayBuffer();
          const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
          return `data:${contentType};base64,${Buffer.from(buffer).toString('base64')}`;
        } catch { return imgUrl; }
      }));
      if (converted.length > 0) body.image_url = converted[0];
      if (converted.length > 1) body.image_urls = converted;
    }
    const response = await fetch(`https://fal.run/${modelId}`, {
      method: 'POST',
      headers: { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    res.status(response.status).json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// AIFLOW — Workflow Persistence (JSON file)
// ============================================================
const WORKFLOW_DB = path.join(WORK_DIR, 'workflows.db.json');

function loadWorkflowDb() {
  try { return JSON.parse(fs.readFileSync(WORKFLOW_DB, 'utf8')); } catch { return { workflows: [] }; }
}

function saveWorkflowDb(db) {
  fs.writeFileSync(WORKFLOW_DB, JSON.stringify(db, null, 2));
}

app.get('/workflows', (req, res) => {
  const db = loadWorkflowDb();
  res.json(db.workflows.map(w => ({ id: w.id, name: w.name, updatedAt: w.updatedAt, nodeCount: w.nodes?.length ?? 0 })));
});

app.get('/workflows/:id', (req, res) => {
  const db = loadWorkflowDb();
  const w = db.workflows.find(w => w.id === req.params.id);
  if (!w) return res.status(404).json({ error: 'Not found' });
  res.json(w);
});

app.post('/workflows', (req, res) => {
  const db = loadWorkflowDb();
  const workflow = { id: randomUUID(), ...req.body, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  db.workflows.push(workflow);
  saveWorkflowDb(db);
  res.json(workflow);
});

app.put('/workflows/:id', (req, res) => {
  const db = loadWorkflowDb();
  const idx = db.workflows.findIndex(w => w.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  db.workflows[idx] = { ...db.workflows[idx], ...req.body, updatedAt: new Date().toISOString() };
  saveWorkflowDb(db);
  res.json(db.workflows[idx]);
});

app.delete('/workflows/:id', (req, res) => {
  const db = loadWorkflowDb();
  const idx = db.workflows.findIndex(w => w.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  db.workflows.splice(idx, 1);
  saveWorkflowDb(db);
  res.json({ ok: true });
});

// Expose which API keys are available from server .env (for workflow auto-config)
app.get('/api/keys', (req, res) => {
  res.json({
    gemini: !!process.env.GEMINI_API_KEY,
    geminiKey: process.env.GEMINI_API_KEY || '',
  });
});

// ============================================================
// Start (local dev only — Vercel handles listening itself)
// ============================================================
if (!IS_VERCEL) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`\n🚀 Banner API running on http://localhost:${PORT}\n`);
  });
}

export default app;

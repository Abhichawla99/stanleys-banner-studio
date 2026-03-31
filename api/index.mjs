import express from "express";
import cors from "cors";
import multer from "multer";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IS_VERCEL = !!process.env.VERCEL;

// On Vercel: use /tmp for ephemeral file ops; deployed templates are read-only
// Local: everything lives in the project root
const WORK_DIR   = IS_VERCEL ? "/tmp" : path.resolve(__dirname, "..");

// TEMPLATES_READ_DIR = where pre-built templates live (read-only on Vercel)
// TEMPLATES_WRITE_DIR = where we write custom/new templates (writable)
const TEMPLATES_READ_DIR  = IS_VERCEL
  ? path.resolve(process.cwd(), "templates")
  : path.resolve(__dirname, "../templates");
const TEMPLATES_WRITE_DIR = IS_VERCEL ? "/tmp/templates" : TEMPLATES_READ_DIR;

// Helper: find a template file — check writable dir first, then read-only dir
function templatePath(filename) {
  const writePath = path.join(TEMPLATES_WRITE_DIR, filename);
  if (fs.existsSync(writePath)) return writePath;
  return path.join(TEMPLATES_READ_DIR, filename);
}

const app = express();
app.use(cors());
app.use(express.json());
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

    // Try transparent region detection first, fall back to AI
    let artZone = await detectTransparentRegion(pngBuffer, width, height);
    let method = "transparency";

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

    // Build the config
    const config = {
      id,
      label,
      width,
      height,
      ratio: overallRatio,
      category: "Custom",
      logo: "none",
      artZone: {
        xPct: artZone.x / width,
        yPct: artZone.y / height,
        wPct: artZone.width / width,
        hPct: artZone.height / height,
      },
      layoutHint: `Art zone is at (${artZone.x}, ${artZone.y}), size ${artZone.width}×${artZone.height}. The remaining area around the art zone contains the banner frame elements (logos, text bars, branding). Place all important content (faces, titles, characters) inside the art zone. Fill the areas that will be covered by the frame with expendable background only.`,
      _artZone: artZone,
      _customTemplate: true,
      _userCreated: true,
    };

    // Save the frame PNG and metadata
    const framePath = path.join(TEMPLATES_WRITE_DIR, `${id}_custom.png`);
    fs.writeFileSync(framePath, pngBuffer);
    const metaPath = path.join(TEMPLATES_WRITE_DIR, `${id}_meta.json`);
    fs.writeFileSync(metaPath, JSON.stringify({
      artZone,
      label,
      width,
      height,
      userCreated: true,
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
    const metaPath = path.join(TEMPLATES_WRITE_DIR, `${config.id}_meta.json`);
    fs.writeFileSync(metaPath, JSON.stringify({ artZone }, null, 2));
    fs.unlinkSync(req.file.path);

    res.json({ success: true, label: config.label, artZone, templateUrl: `/templates/${config.id}_custom.png` });
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

app.post("/api/generate", upload.single("art"), async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY not set" });

  const { bannerIds, model, customPrompt } = req.body;
  const selectedIds = JSON.parse(bannerIds || "[]");
  const selectedModel = model || "gemini-3.1-flash-image-preview";
  if (!req.file) return res.status(400).json({ error: "No art file uploaded" });
  if (!selectedIds.length) return res.status(400).json({ error: "No banners selected" });

  const ai = new GoogleGenAI({ apiKey });
  const artBuffer = fs.readFileSync(req.file.path);
  const mimeType  = req.file.mimetype || "image/png";
  console.log(`Upload: ${req.file.originalname}, ${artBuffer.length} bytes`);

  let processedBuffer = artBuffer;
  if (artBuffer.length > 4 * 1024 * 1024) {
    processedBuffer = await sharp(artBuffer).resize(2048, 2048, { fit: "inside" }).jpeg({ quality: 85 }).toBuffer();
  }
  const artBase64 = processedBuffer.toString("base64");

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

  send({ type: "start", runId, total: selectedIds.length });

  const results = [];
  const defaultPrompt = `You are a senior art director redesigning a piece of key art for a {{RATIO}} banner ({{ART_WIDTH}}×{{ART_HEIGHT}} px).

=== SAFE ZONES ===
The final banner will have a frame overlaid on top. These areas will be PARTIALLY COVERED:
{{LAYOUT}}
Only put expendable background in those zones — skies, gradients, blurred texture. All important content (faces, titles, logos, characters) MUST be inside the safe area that remains visible.

=== YOUR JOB ===
You are RECOMPOSING the artwork for a new shape, the way a designer would create an alternate campaign layout. You are NOT resizing or cropping.

1. READ every piece of text in the source art — titles, taglines, dates, credits, logos. Note the EXACT spelling, capitalisation, font style, weight, colour, and visual treatment (shadows, outlines, gradients, effects).

2. REDESIGN the layout for {{RATIO}}:
   - The hero subject must be COMPLETE — full head, full body if shown, no awkward crops.
   - If the original title fits on one line but the new shape is too narrow or too short, REFLOW the text: split across two lines, stack it vertically, move it to a different area — whatever a designer would do. You may resize the title, reposition it, split it across top and bottom, or center it with effects that match the artwork's mood.
   - Use the SAME font style, the SAME colour, the SAME visual effects. If the title had a metallic gradient and drop shadow, the reflowed title must also have a metallic gradient and drop shadow.
   - Place characters, title, and key elements in the SAFE ZONE where they will NOT be covered by the banner frame.
   - Fill the overlay zones with atmospheric extension: continue the sky, fog, sparks, rain, environmental texture from the original.

3. SACRED RULES — things you must NEVER change:
   - The SPELLING of every word. If it says "Lord of the Rings" you output "Lord of the Rings" — letter for letter, no rewording.
   - The VISUAL IDENTITY — same art style (photorealistic stays photorealistic, illustrated stays illustrated), same colour palette, same lighting mood, same contrast.
   - The CONTENT — never add characters, objects, logos, or text that are not in the original. Never remove elements that are in the original.

4. ABSOLUTE RULES:
   - NEVER change, rephrase, abbreviate, or misspell ANY text from the original artwork.
   - NEVER stretch, squash, or distort any element.
   - NEVER add borders, letterboxing, or pillarboxing.
   - NEVER leave dead space — fill the full {{RATIO}} canvas.
   - NEVER crop the hero subject's face or head.
   - NEVER place important content in the overlay zones described above — it WILL be covered.
   - NEVER reproduce dimension lines, measurement annotations, pixel counts, ruler marks, grid overlays, bounding boxes, or any technical markup that may appear in the source image. These are NOT part of the artwork — they are editing artifacts. Ignore them completely and produce clean artwork only.`;

  for (const id of selectedIds) {
    const config = BANNER_CONFIGS.find(c => c.id === id);
    if (!config) continue;

    send({ type: "progress", bannerId: id, step: "regenerating", label: config.label });

    try {
      const az = config._artZone;
      const artRatio = closestSupportedRatio(az.width, az.height);

      const prompt = (customPrompt || defaultPrompt)
        .replaceAll("{{RATIO}}", artRatio)
        .replaceAll("{{LAYOUT}}", config.layoutHint || "No specific layout constraints.")
        .replaceAll("{{ART_WIDTH}}", String(az.width))
        .replaceAll("{{ART_HEIGHT}}", String(az.height));

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
          console.error(`[${id}] Attempt ${attempt + 1} failed:`, retryErr.message?.slice(0, 100));
          if (attempt < 2) {
            const wait = (attempt + 1) * 10000;
            send({ type: "progress", bannerId: id, step: "regenerating", label: `${config.label} (retry ${attempt + 1})` });
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

      const regenPath = path.join(runDir, "regenerated", `${id}.png`);
      fs.writeFileSync(regenPath, regenBuffer);

      send({ type: "progress", bannerId: id, step: "compositing", label: config.label });

      const resized = await sharp(regenBuffer)
        .resize(az.width, az.height, { fit: "cover", position: "centre" })
        .png().toBuffer();

      const artLayer = await sharp({
        create: { width: config.width, height: config.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
      })
        .composite([{ input: resized, left: az.x, top: az.y }])
        .png().toBuffer();

      const tplPath = config._customTemplate
        ? templatePath(`${id}_custom.png`)
        : templatePath(`${id}.png`);
      const frameOverlay = fs.readFileSync(tplPath);
      const banner = await sharp(artLayer)
        .composite([{ input: frameOverlay, left: 0, top: 0 }])
        .png().toBuffer();

      const bannerPath = path.join(runDir, "banners", `${id}.png`);
      fs.writeFileSync(bannerPath, banner);

      // Include base64 data in the event — works on Vercel (no persistent URLs needed)
      // Also keep URL fields for local dev
      send({
        type: "complete",
        bannerId: id,
        label: config.label,
        width: config.width,
        height: config.height,
        bannerData:   banner.toString("base64"),
        regenData:    regenBuffer.toString("base64"),
        templateData: fs.readFileSync(tplPath).toString("base64"),
        regenUrl:     `/outputs/${runId}/regenerated/${id}.png`,
        bannerUrl:    `/outputs/${runId}/banners/${id}.png`,
        templateUrl:  `/templates/${id}.png`,
      });

      results.push(id);
      await new Promise(r => setTimeout(r, 2000));

    } catch (err) {
      // Log error
      const errStr = err.message || String(err);
      try {
        fs.writeFileSync(
          path.join(WORK_DIR, `outputs/last_error_${id}.txt`),
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
      console.error(`[${id}] Error:`, msg);
      send({ type: "error", bannerId: id, label: config.label, error: msg });
    }
  }

  send({ type: "done", runId, completed: results.length, total: selectedIds.length });
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
// Start (local dev only — Vercel handles listening itself)
// ============================================================
if (!IS_VERCEL) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`\n🚀 Banner API running on http://localhost:${PORT}\n`);
  });
}

export default app;

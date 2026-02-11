import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("GEMINI_API_KEY is not set. Set it in backend/.env");
} else {
  console.log("GEMINI_API_KEY is set (length:", apiKey.length, "chars)");
}

const genAI = new GoogleGenerativeAI(apiKey || "");

// Date coercion function to normalize dates to YYYY-MM-DD format
function coerceIsoDate(text) {
  if (!text || typeof text !== "string") return "";
  const normalized = text.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  const m1 = normalized.match(/(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})/);
  if (m1) {
    const [_, d, m, y] = m1;
    return `${y}-${m}-${d}`;
  }
  const m2 = normalized.match(/(\d{4})[\/\-.](\d{2})[\/\-.](\d{2})/);
  if (m2) {
    const [_, y, m, d] = m2;
    return `${y}-${m}-${d}`;
  }
  return normalized;
}

const prompt = `Task: Read the product label OCR text and return concise, reliable metadata.

Return ONLY a JSON object with keys: product, expiryDate, batchNo, manufacturingDate

Rules for product:
- Output the human-friendly product title found on the label (e.g., "Olive Oil", "Instant Noodles Chicken", "Laundry Detergent").
- If a brand name is prominent next to the product name, include it only if it helps identification (e.g., "Brand X Basmati Rice"). Keep it short.
- If the text is in non‑Latin script, transliterate to English where obvious.
- Never return generic words like "ingredients", "nutrition facts", lot numbers, barcodes, or regulatory text.
- If multiple candidates exist, choose the one that best represents what the item is.
- If you truly cannot infer a product title, set product to an empty string.

Rules for expiryDate:
- If there is an explicit expiry/best before/BB/EXP/Use By date, return it in YYYY-MM-DD.
- If multiple dates appear, prefer the one labeled as expiry/best before. Do NOT return manufacture/production dates as expiry.
- If unreadable or absent, return an empty string.

Rules for batchNo:
- Look for batch/lot identifiers labeled as "Batch", "Batch No", "LOT", "LOT No", "Lot Number", "Serial", or "Batch Code".
- Extract the complete identifier value (alphanumeric, may include hyphens or slashes).
- Extract only the value after the label (e.g., "LOT: ABC123" → "ABC123").
- Preserve the exact format as printed on the label.
- If not found, return an empty string.

Rules for manufacturingDate:
- If there is an explicit manufacturing/production/Mfg/MFG/Made date, return it in YYYY-MM-DD.
- If multiple dates appear, prefer the one labeled as manufacturing/production/Mfg. Do NOT return expiry dates as manufacturing date.
- If unreadable or absent, return an empty string.`;

app.get("/", (req, res) => {
  res.json({
    message: "OCR expiry backend",
    health: "GET /health",
    extract: "POST /extract-fields",
  });
});

app.get("/favicon.ico", (req, res) => res.status(204).end());
app.get("/favicon.png", (req, res) => res.status(204).end());

app.post("/extract-fields", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "text is required" });
    }
    console.log("OCR length:", text.length, "chars. First 200:", text.slice(0, 200));

    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY not configured on server" });
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { temperature: 0.2 },
    });

    const result = await model.generateContent([
      { text: prompt },
      { text: "\n\nOCR_TEXT:\n" + text }
    ]);

    const textResponse = result.response.text();
    let extracted = { product: "", expiryDate: "", batchNo: "", manufacturingDate: "" };
    
    try {
      const jsonStart = textResponse.indexOf("{");
      const jsonEnd = textResponse.lastIndexOf("}");
      const raw = jsonStart >= 0 && jsonEnd >= 0 ? textResponse.slice(jsonStart, jsonEnd + 1) : textResponse;
      const parsed = JSON.parse(raw);
      extracted.product = String(parsed.product || "").slice(0, 120);
      if (parsed.expiryDate) extracted.expiryDate = coerceIsoDate(String(parsed.expiryDate));
      if (parsed.batchNo) extracted.batchNo = String(parsed.batchNo || "").slice(0, 100);
      if (parsed.manufacturingDate) extracted.manufacturingDate = coerceIsoDate(String(parsed.manufacturingDate));
    } catch (e) {
      // Fallback regex extraction
      const expiryMatch = textResponse.match(/"expiryDate"\s*:\s*"([^"]+)"/);
      if (expiryMatch) extracted.expiryDate = coerceIsoDate(expiryMatch[1]);
      const productMatch = textResponse.match(/"product"\s*:\s*"([^"]+)"/);
      if (productMatch) extracted.product = productMatch[1].slice(0, 120);
      const batchMatch = textResponse.match(/"batchNo"\s*:\s*"([^"]+)"/);
      if (batchMatch) extracted.batchNo = batchMatch[1].slice(0, 100);
      const mfgMatch = textResponse.match(/"manufacturingDate"\s*:\s*"([^"]+)"/);
      if (mfgMatch) extracted.manufacturingDate = coerceIsoDate(mfgMatch[1]);
    }

    if (!extracted.product) extracted.product = "";
    if (!extracted.expiryDate) extracted.expiryDate = "";
    if (!extracted.batchNo) extracted.batchNo = "";
    if (!extracted.manufacturingDate) extracted.manufacturingDate = "";
    
    console.log("Extracted:", extracted);
    res.json(extracted);
  } catch (err) {
    console.error("extract-fields error:", err);
    console.error("Error type:", typeof err);
    console.error("Error keys:", err ? Object.keys(err) : "null");
    console.error("Error status:", err?.status);
    console.error("Error statusText:", err?.statusText);
    
    // Extract error message from various possible structures
    let message = "Internal error";
    if (err) {
      if (err.message) {
        message = String(err.message).trim();
      } else if (err.statusText) {
        message = `${err.status || "Error"} ${err.statusText}`;
      } else if (typeof err.toString === "function") {
        const str = err.toString();
        if (str && str !== "[object Object]") {
          message = str;
        }
      }
      // For Gemini API errors, check nested properties
      if (message === "Internal error" && err.errorDetails) {
        message = String(err.errorDetails).slice(0, 200);
      }
    }
    
    res.status(500).json({ error: String(message).slice(0, 200) });
  }
});

app.get("/health", (req, res) => {
  res.json({ ok: true, message: "OCR backend running" });
});

// Export app for Vercel serverless functions
export default app;

// Only start listening if running locally (not on Vercel)
if (process.env.VERCEL !== "1" && !process.env.VERCEL_ENV) {
  const port = process.env.PORT || 5050;
  const host = "0.0.0.0";
  app.listen(port, host, () => {
    console.log(`Backend listening on http://${host}:${port} (use this PC's LAN IP for real device)`);
  });
}

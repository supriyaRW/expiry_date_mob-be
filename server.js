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
function coerceIsoDate(text, isManufacturingDate = false) {
  if (!text || typeof text !== "string") return "";
  const normalized = text.trim();
  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const m1 = normalized.match(/(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})/);
  if (m1) {
    const [, d, m, y] = m1;
    return `${y}-${m}-${d}`;
  }
  // YYYY/MM/DD or YYYY-MM-DD or YYYY.MM.DD
  const m2 = normalized.match(/(\d{4})[\/\-.](\d{2})[\/\-.](\d{2})/);
  if (m2) {
    const [, y, m, d] = m2;
    return `${y}-${m}-${d}`;
  }
  // MM/YYYY or MM.YYYY
  const m3 = normalized.match(/(\d{2})[\/\-.](\d{4})/);
  if (m3) {
    const [, m, y] = m3;
    return `${y}-${m}-01`;
  }
  // YYYY only
  const m4 = normalized.match(/^(\d{4})$/);
  if (m4) {
    // Use first day of year for manufacturing, last day for expiry
    return isManufacturingDate ? `${m4[1]}-01-01` : `${m4[1]}-12-31`;
  }
  // Try to parse common date formats with month names
  const monthMap = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12"
  };
  const m5 = normalized.match(/(\d{1,2})[\s\-]?([a-z]{3})[\s\-]?(\d{4})/i);
  if (m5) {
    const [, d, mon, y] = m5;
    const month = monthMap[mon.toLowerCase().slice(0, 3)];
    if (month) {
      return `${y}-${month}-${d.padStart(2, "0")}`;
    }
  }
  return normalized; // Return as-is if can't parse
}

const prompt = `Task: Read the product label OCR text and extract metadata.

Return ONLY a JSON object with keys: product, expiryDate, batchNo, manufacturingDate

Rules for product:
- Extract the human-friendly product name/title from the label
- Prefer values after labels like "Product:", "Description:", "Item:", "Product Name:"
- If no label found, use the main product title (usually the longest descriptive line)
- Exclude lot numbers, batch codes, dates, barcodes, and regulatory text
- Keep it concise (max 120 chars). If not found, return empty string ""

Rules for expiryDate:
- Look for labels: "Expiry", "Exp Date", "EXP", "Use by", "Best before", "BB", "BBE", "Expires", "Valid until", "Sell by"
- Extract the date value and return in YYYY-MM-DD format
- If multiple expiry dates appear, use the earliest one
- If not found or unreadable, return empty string ""

Rules for batchNo:
- Look for labels: "Batch", "Batch No", "LOT", "LOT No", "Lot Number", "Serial", "Batch Code"
- Extract the complete batch/lot identifier value (alphanumeric, may include hyphens/slashes)
- Extract only the value after the label (e.g., "LOT: ABC123" → "ABC123")
- Preserve the exact format as printed
- If not found, return empty string ""

Rules for manufacturingDate:
- Look for labels: "Mfg", "MFG", "Manufacturing", "Production", "Prod", "Made", "Made on", "Date of Manufacture"
- Extract the date value and return in YYYY-MM-DD format
- If multiple manufacturing dates appear, use the earliest one
- If not found or unreadable, return empty string ""

Output format: Single-line JSON only, no markdown, no explanations.
Example: {"product":"SHARPS CONTAINER 10L","expiryDate":"2027-03-15","batchNo":"LOT12345","manufacturingDate":"2024-01-10"}`;

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
      generationConfig: { temperature: 0.2 }
    });

    const result = await model.generateContent([
      { text: prompt },
      { text: "\n\nOCR_TEXT:\n" + text }
    ]);

    const textResponse = result.response.text();
    let extracted = { product: "", expiryDate: "", batchNo: "", manufacturingDate: "" };
    
    // Try to parse JSON from response
    try {
      const jsonStart = textResponse.indexOf("{");
      const jsonEnd = textResponse.lastIndexOf("}");
      const raw = jsonStart >= 0 && jsonEnd >= 0 
        ? textResponse.slice(jsonStart, jsonEnd + 1) 
        : textResponse;
      const parsed = JSON.parse(raw);
      
      if (parsed.product) extracted.product = String(parsed.product).trim().slice(0, 120);
      if (parsed.expiryDate) extracted.expiryDate = coerceIsoDate(String(parsed.expiryDate), false);
      if (parsed.batchNo) extracted.batchNo = String(parsed.batchNo).trim().slice(0, 100);
      if (parsed.manufacturingDate) extracted.manufacturingDate = coerceIsoDate(String(parsed.manufacturingDate), true);
    } catch (e) {
      // Fallback: try regex extraction if JSON parsing fails
      console.warn("JSON parse failed, trying regex fallback. Raw:", textResponse.slice(0, 200));
      const productMatch = textResponse.match(/"product"\s*:\s*"([^"]+)"/);
      if (productMatch) extracted.product = productMatch[1].trim().slice(0, 120);
      
      const expiryMatch = textResponse.match(/"expiryDate"\s*:\s*"([^"]+)"/);
      if (expiryMatch) extracted.expiryDate = coerceIsoDate(expiryMatch[1], false);
      
      const batchMatch = textResponse.match(/"batchNo"\s*:\s*"([^"]+)"/);
      if (batchMatch) extracted.batchNo = batchMatch[1].trim().slice(0, 100);
      
      const mfgMatch = textResponse.match(/"manufacturingDate"\s*:\s*"([^"]+)"/);
      if (mfgMatch) extracted.manufacturingDate = coerceIsoDate(mfgMatch[1], true);
    }

    // Ensure all fields are strings and normalized
    extracted.product = extracted.product || "";
    extracted.expiryDate = extracted.expiryDate || "";
    extracted.batchNo = extracted.batchNo || "";
    extracted.manufacturingDate = extracted.manufacturingDate || "";

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

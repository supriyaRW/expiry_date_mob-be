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
  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const m1 = normalized.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (m1) {
    const [_, d, m, y] = m1;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  // YYYY/MM/DD or YYYY-MM-DD or YYYY.MM.DD
  const m2 = normalized.match(/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (m2) {
    const [_, y, m, d] = m2;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  // MM/DD/YYYY format (US format)
  const m3 = normalized.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (m3 && parseInt(m3[1]) <= 12 && parseInt(m3[2]) <= 31) {
    const [_, m, d, y] = m3;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  return normalized;
}

const prompt = `Task: Read the product label OCR text and extract metadata. You MUST extract expiryDate, batchNo, and manufacturingDate if they exist in the text.

Return ONLY a JSON object with keys: product, expiryDate, batchNo, manufacturingDate

CRITICAL: Extract these three fields (expiryDate, batchNo, manufacturingDate) with high priority.

Rules for expiryDate:
- Search for these labels (case-insensitive): "Expiry", "Expiry Date", "Exp Date", "EXP", "EXP DATE", "E:", "Exp:", "Use by", "Use-by", "Use By", "Use By Date", "Best before", "Best Before", "BB", "BBE", "BB Date", "Expires", "Expires on", "Expiration", "Expiration Date", "Valid until", "Valid Until", "Sell by", "Sell-by"
- Extract the date value that appears after these labels
- Convert to YYYY-MM-DD format (e.g., "15/03/2027" → "2027-03-15", "03-15-2027" → "2027-03-15")
- If multiple expiry dates found, use the earliest one
- If no expiry date found, return empty string ""

Rules for batchNo:
- Search for these labels (case-insensitive): "Batch", "Batch No", "Batch No:", "Batch Number", "Batch#", "Batch Code", "LOT", "LOT No", "LOT No:", "LOT Number", "LOT#", "Lot", "Lot No", "Lot Number", "Lote", "Lote No", "Serial", "Serial No", "Serial Number", "Serial#", "Batch ID", "Lot ID"
- Extract the complete identifier value that appears after the label
- Include alphanumeric characters, hyphens (-), slashes (/), underscores (_) as printed
- Extract only the value, not the label (e.g., "LOT: ABC123XYZ" → "ABC123XYZ", "Batch No. 2024-001" → "2024-001")
- Preserve exact format as printed
- If not found, return empty string ""

Rules for manufacturingDate:
- Search for these labels (case-insensitive): "Mfg", "MFG", "Mfg Date", "MFG Date", "Mfg:", "MFG:", "Mfg. Date", "Manufacturing", "Manufacturing Date", "Manufactured", "Manufactured Date", "Production", "Production Date", "Prod", "Prod Date", "Prod:", "Produced", "Produced Date", "P:", "P Date", "Made", "Made on", "Made Date", "Made:", "Date of Manufacture", "Produced on", "Produced:", "Date of Production"
- Extract the date value that appears after these labels
- Convert to YYYY-MM-DD format (same conversion rules as expiryDate)
- If multiple manufacturing dates found, use the earliest one
- If no manufacturing date found, return empty string ""

Rules for product:
- Output the human-friendly product title found on the label
- If a brand name is prominent, include it only if it helps identification. Keep it short.
- Never return generic words like "ingredients", "nutrition facts", lot numbers, barcodes, or regulatory text.
- If you cannot infer a product title, set product to an empty string.

IMPORTANT: 
- Read the ENTIRE OCR text carefully
- Look for all variations of the labels mentioned above
- Extract values even if labels are abbreviated or slightly misspelled
- Always return dates in YYYY-MM-DD format
- Return empty strings only if the field is truly not found

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
      generationConfig: { temperature: 0.2 },
    });

    const result = await model.generateContent([
      { text: prompt },
      { text: "\n\nOCR_TEXT:\n" + text }
    ]);

    const textResponse = result.response.text();
    console.log("Gemini raw response:", textResponse);
    
    let extracted = { product: "", expiryDate: "", batchNo: "", manufacturingDate: "" };
    
    try {
      const jsonStart = textResponse.indexOf("{");
      const jsonEnd = textResponse.lastIndexOf("}");
      const raw = jsonStart >= 0 && jsonEnd >= 0 ? textResponse.slice(jsonStart, jsonEnd + 1) : textResponse;
      console.log("Extracted JSON string:", raw);
      const parsed = JSON.parse(raw);
      console.log("Parsed JSON:", parsed);
      
      extracted.product = String(parsed.product || "").trim().slice(0, 120);
      if (parsed.expiryDate && String(parsed.expiryDate).trim()) {
        extracted.expiryDate = coerceIsoDate(String(parsed.expiryDate).trim());
      }
      if (parsed.batchNo && String(parsed.batchNo).trim()) {
        extracted.batchNo = String(parsed.batchNo).trim().slice(0, 100);
      }
      if (parsed.manufacturingDate && String(parsed.manufacturingDate).trim()) {
        extracted.manufacturingDate = coerceIsoDate(String(parsed.manufacturingDate).trim());
      }
    } catch (e) {
      console.warn("JSON parse failed, trying regex fallback. Error:", e.message);
      // Fallback regex extraction - try multiple patterns
      const expiryMatch = textResponse.match(/"expiryDate"\s*:\s*"([^"]+)"/i) || 
                         textResponse.match(/expiryDate["\s]*:["\s]*([^",\s}]+)/i);
      if (expiryMatch) extracted.expiryDate = coerceIsoDate(expiryMatch[1].trim());
      
      const productMatch = textResponse.match(/"product"\s*:\s*"([^"]+)"/i) ||
                          textResponse.match(/product["\s]*:["\s]*([^",\s}]+)/i);
      if (productMatch) extracted.product = productMatch[1].trim().slice(0, 120);
      
      const batchMatch = textResponse.match(/"batchNo"\s*:\s*"([^"]+)"/i) ||
                        textResponse.match(/batchNo["\s]*:["\s]*([^",\s}]+)/i);
      if (batchMatch) extracted.batchNo = batchMatch[1].trim().slice(0, 100);
      
      const mfgMatch = textResponse.match(/"manufacturingDate"\s*:\s*"([^"]+)"/i) ||
                      textResponse.match(/manufacturingDate["\s]*:["\s]*([^",\s}]+)/i);
      if (mfgMatch) extracted.manufacturingDate = coerceIsoDate(mfgMatch[1].trim());
    }

    // Ensure all fields are strings
    extracted.product = extracted.product || "";
    extracted.expiryDate = extracted.expiryDate || "";
    extracted.batchNo = extracted.batchNo || "";
    extracted.manufacturingDate = extracted.manufacturingDate || "";
    
    console.log("Final extracted values:", {
      product: extracted.product,
      expiryDate: extracted.expiryDate,
      batchNo: extracted.batchNo,
      manufacturingDate: extracted.manufacturingDate
    });
    
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

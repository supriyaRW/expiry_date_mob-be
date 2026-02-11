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

const prompt = `You are extracting product information from OCR text of a product label image. Extract exactly three critical fields: expiryDate, batchNo, and manufacturingDate.

Return ONLY a JSON object with these keys: product, expiryDate, batchNo, manufacturingDate

FIELD 1: expiryDate
Your task: Find the expiry/expiration date on the product label.
Search for these keywords (case-insensitive, check all variations):
- "Expiry", "Expiry Date", "Exp Date", "EXP", "EXP DATE", "E:", "Exp:"
- "Use by", "Use-by", "Use By", "Use By Date", "Use Before"
- "Best before", "Best Before", "Best Before Date", "BB", "BBE", "BB Date"
- "Expires", "Expires on", "Expires:", "Expiration", "Expiration Date"
- "Valid until", "Valid Until", "Valid Until Date", "Valid Thru"
- "Sell by", "Sell-by", "Sell By Date"

Extraction steps:
1. Find any line containing one of the keywords above
2. Extract the date value that follows the keyword (may be on same line or next line)
3. Convert the date to YYYY-MM-DD format:
   - "15/03/2027" → "2027-03-15"
   - "03/15/2027" → "2027-03-15" (US format)
   - "15-03-2027" → "2027-03-15"
   - "15.03.2027" → "2027-03-15"
   - "2027-03-15" → keep as-is
   - "Mar 15, 2027" → "2027-03-15"
4. If multiple expiry dates found, choose the earliest one
5. If no expiry date found, return ""

FIELD 2: batchNo
Your task: Find the batch number or lot number on the product label.
Search for these keywords (case-insensitive, check all variations):
- "Batch", "Batch No", "Batch No:", "Batch Number", "Batch#", "Batch Code", "Batch ID"
- "LOT", "LOT No", "LOT No:", "LOT Number", "LOT#", "Lot", "Lot No", "Lot Number", "Lot ID"
- "Lote", "Lote No", "Lote Number"
- "Serial", "Serial No", "Serial Number", "Serial#"

Extraction steps:
1. Find any line containing one of the keywords above
2. Extract the complete identifier that follows the keyword
3. Include all characters: letters, numbers, hyphens (-), slashes (/), underscores (_)
4. Extract ONLY the value, not the keyword itself:
   - "LOT: ABC123XYZ" → "ABC123XYZ"
   - "Batch No. 2024-001" → "2024-001"
   - "LOT# ABC-XYZ-123" → "ABC-XYZ-123"
   - "Batch: LOT12345" → "LOT12345"
5. Preserve the exact format as printed (case-sensitive, include all characters)
6. If not found, return ""

FIELD 3: manufacturingDate
Your task: Find the manufacturing/production date on the product label.
Search for these keywords (case-insensitive, check all variations):
- "Mfg", "MFG", "Mfg Date", "MFG Date", "Mfg:", "MFG:", "Mfg. Date"
- "Manufacturing", "Manufacturing Date", "Manufactured", "Manufactured Date"
- "Production", "Production Date", "Prod", "Prod Date", "Prod:", "Produced", "Produced Date"
- "P:", "P Date"
- "Made", "Made on", "Made Date", "Made:"
- "Date of Manufacture", "Produced on", "Produced:", "Date of Production"

Extraction steps:
1. Find any line containing one of the keywords above
2. Extract the date value that follows the keyword
3. Convert to YYYY-MM-DD format (use same conversion rules as expiryDate)
4. If multiple manufacturing dates found, choose the earliest one
5. If no manufacturing date found, return ""

FIELD 4: product (optional, for reference)
- Extract the main product name/title from the label
- Keep it short and descriptive
- If not found, return ""

CRITICAL INSTRUCTIONS:
1. Read the ENTIRE OCR text from top to bottom
2. Look carefully for ALL variations of the keywords listed above
3. Dates may appear in various formats - convert ALL to YYYY-MM-DD
4. Batch numbers may have different formats - preserve them exactly as printed
5. If a field is not found after thorough search, return empty string ""
6. Do NOT confuse expiry dates with manufacturing dates
7. Do NOT include the keyword/label in the extracted value (e.g., don't return "LOT ABC123", return "ABC123")

Output format: Return ONLY valid JSON, no markdown, no code blocks, no explanations.
Example output: {"product":"SHARPS CONTAINER 10L","expiryDate":"2027-03-15","batchNo":"LOT12345","manufacturingDate":"2024-01-10"}`;

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

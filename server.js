import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" })); // Increased limit for base64 image data

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

  // Month name mapping
  const monthMap = {
    jan: "01", january: "01", feb: "02", february: "02", mar: "03", march: "03",
    apr: "04", april: "04", may: "05", jun: "06", june: "06",
    jul: "07", july: "07", aug: "08", august: "08", sep: "09", sept: "09", september: "09",
    oct: "10", october: "10", nov: "11", november: "11", dec: "12", december: "12"
  };

  // Try parsing dates with month names: "15 Mar 2027", "Mar 15, 2027", "15-Mar-2027"
  const monthNamePattern = /(\d{1,2})[\s\-]?([a-z]+)[\s\-,]?(\d{4})/i;
  const monthNameMatch = normalized.match(monthNamePattern);
  if (monthNameMatch) {
    const [_, day, month, year] = monthNameMatch;
    const monthKey = month.toLowerCase().slice(0, 3);
    if (monthMap[monthKey] || monthMap[month.toLowerCase()]) {
      const monthNum = monthMap[monthKey] || monthMap[month.toLowerCase()];
      return `${year}-${monthNum}-${String(day).padStart(2, "0")}`;
    }
  }

  // Try "Mar 15, 2027" format
  const monthFirstPattern = /([a-z]+)[\s\-](\d{1,2})[\s\-,](\d{4})/i;
  const monthFirstMatch = normalized.match(monthFirstPattern);
  if (monthFirstMatch) {
    const [_, month, day, year] = monthFirstMatch;
    const monthKey = month.toLowerCase().slice(0, 3);
    if (monthMap[monthKey] || monthMap[month.toLowerCase()]) {
      const monthNum = monthMap[monthKey] || monthMap[month.toLowerCase()];
      return `${year}-${monthNum}-${String(day).padStart(2, "0")}`;
    }
  }

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY (assume day first if day > 12)
  const ddmmyyyy = normalized.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (ddmmyyyy) {
    const [_, part1, part2, year] = ddmmyyyy;
    const p1 = parseInt(part1);
    const p2 = parseInt(part2);
    // If first part > 12, it's definitely day (DD/MM/YYYY)
    if (p1 > 12 && p2 <= 12) {
      return `${year}-${String(part2).padStart(2, "0")}-${String(part1).padStart(2, "0")}`;
    }
    // If second part > 12, it's MM/DD/YYYY (US format)
    if (p1 <= 12 && p2 > 12) {
      return `${year}-${String(part1).padStart(2, "0")}-${String(part2).padStart(2, "0")}`;
    }
    // If both <= 12, try DD/MM/YYYY first (more common internationally)
    if (p1 <= 12 && p2 <= 12) {
      return `${year}-${String(part2).padStart(2, "0")}-${String(part1).padStart(2, "0")}`;
    }
  }

  // YYYY/MM/DD or YYYY-MM-DD or YYYY.MM.DD
  const yyyymmdd = normalized.match(/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (yyyymmdd) {
    const [_, year, month, day] = yyyymmdd;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return normalized;
}

const prompt = `You are an expert at extracting product information from product label images. Analyze the image and extract the Manufacturing Date (mfgDate), Expiry Date (expiryDate), and Batch Number (batchNo) into a structured JSON format.

### FIELDS TO EXTRACT:

1. **mfgDate**: The date the product was manufactured.
   - Keywords: "MFD", "Mfg Date", "Mfg. Date", "Date of Manufacture", "Manufactured on", "DOM", "PKD", "Packed on".
   - Search strategy: Scan for any of these keywords followed by a date.
   - Logic: Manufacturing dates are ALWAYS in the PAST compared to expiry dates.
   - Format: Convert to YYYY-MM-DD.

2. **expiryDate**: The date the product expires or should be used by.
   - Keywords: "EXP", "Expiry", "Expiry Date", "Exp Date", "Best Before", "BBE", "BB", "Use By", "Valid Until", "Best By", "Expiration".
   - Search strategy: Scan for any of these keywords followed by a date. 
   - Logic: Expiry dates are ALWAYS in the FUTURE compared to manufacturing dates.
   - Format: Convert to YYYY-MM-DD.

3. **batchNo**: The batch or lot number associated with the production.
   - Keywords: "Batch No", "Batch Number", "B.No", "BN", "Lot No", "Lot Number", "Lot", "Batch", "L.No".
   - Search strategy: Look for a string of alphanumeric characters, often preceded by "B." or "L.".
   - Format: Extract exactly as it appears (e.g., "B12345", "LOT-99").

### STRICT RULES:
- Extract ONLY these three fields: mfgDate, expiryDate, batchNo.
- Return ONLY a single-line JSON object.
- ALL dates MUST be normalized to YYYY-MM-DD using the coerceIsoDate logic.
- If only month/year is provided (e.g., "Dec 2025"), default to "2025-12-01".
- If a field is not found, return an empty string "" for that field.
- Do NOT include markdown formatting or conversational text.

### OUTPUT FORMAT:
{"mfgDate": "YYYY-MM-DD", "expiryDate": "YYYY-MM-DD", "batchNo": "BATCH_VALUE"}`;

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
    const { image, mimeType } = req.body;

    // Accept either image (base64) or text (for backward compatibility)
    if (!image && !req.body.text) {
      return res.status(400).json({ error: "image (base64) or text is required" });
    }

    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY not configured on server" });
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-3-flash-preview",
      generationConfig: { temperature: 0.2 },
    });

    let result;

    if (image && typeof image === "string") {
      // Image provided - use Gemini Vision API
      console.log("Processing image (base64 length:", image.length, "chars)");
      const imageMimeType = mimeType || "image/jpeg";

      // Remove data URL prefix if present (data:image/jpeg;base64,)
      const base64Data = image.includes(",") ? image.split(",")[1] : image;

      result = await model.generateContent([
        { text: prompt },
        {
          inlineData: {
            data: base64Data,
            mimeType: imageMimeType
          }
        }
      ]);
    } else {
      // Text provided - backward compatibility
      const text = req.body.text;
      console.log("Processing text (length:", text.length, "chars. First 200:", text.slice(0, 200));
      result = await model.generateContent([
        { text: prompt },
        { text: "\n\nOCR_TEXT:\n" + text }
      ]);
    }

    const textResponse = result.response.text();
    console.log("Gemini raw response:", textResponse);

    let extracted = { mfgDate: "", expiryDate: "", batchNo: "" };

    try {
      const jsonStart = textResponse.indexOf("{");
      const jsonEnd = textResponse.lastIndexOf("}");
      const raw = jsonStart >= 0 && jsonEnd >= 0 ? textResponse.slice(jsonStart, jsonEnd + 1) : textResponse;
      console.log("Extracted JSON string:", raw);
      const parsed = JSON.parse(raw);
      console.log("Parsed JSON:", parsed);

      // Extract mfgDate
      if (parsed.mfgDate && String(parsed.mfgDate).trim()) {
        extracted.mfgDate = coerceIsoDate(String(parsed.mfgDate).trim());
      }

      // Extract expiryDate
      if (parsed.expiryDate && String(parsed.expiryDate).trim()) {
        extracted.expiryDate = coerceIsoDate(String(parsed.expiryDate).trim());
      }

      // Extract batchNo
      if (parsed.batchNo && String(parsed.batchNo).trim()) {
        extracted.batchNo = String(parsed.batchNo).trim();
      }
    } catch (e) {
      console.warn("JSON parse failed, trying regex fallback. Error:", e.message);

      // Fallback regex extraction
      const mfgMatch = textResponse.match(/"mfgDate"\s*:\s*"([^"]+)"/i) || textResponse.match(/mfgDate["\s]*:["\s]*"([^"]+)"/i);
      if (mfgMatch) extracted.mfgDate = coerceIsoDate(mfgMatch[1].trim());

      const expMatch = textResponse.match(/"expiryDate"\s*:\s*"([^"]+)"/i) || textResponse.match(/expiryDate["\s]*:["\s]*"([^"]+)"/i);
      if (expMatch) extracted.expiryDate = coerceIsoDate(expMatch[1].trim());

      const batchMatch = textResponse.match(/"batchNo"\s*:\s*"([^"]+)"/i) || textResponse.match(/batchNo["\s]*:["\s]*"([^"]+)"/i);
      if (batchMatch) extracted.batchNo = batchMatch[1].trim();
    }

    // Ensure all fields are strings
    extracted.mfgDate = extracted.mfgDate || "";
    extracted.expiryDate = extracted.expiryDate || "";
    extracted.batchNo = extracted.batchNo || "";

    console.log("Final extracted values:", extracted);

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



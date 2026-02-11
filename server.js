// import express from "express";
// import cors from "cors";
// import dotenv from "dotenv";
// import { GoogleGenerativeAI } from "@google/generative-ai";

// dotenv.config();

// const app = express();
// app.use(cors());
// app.use(express.json());

// const apiKey = process.env.GEMINI_API_KEY;
// if (!apiKey) {
//   console.warn("GEMINI_API_KEY is not set. Set it in backend/.env");
// } else {
//   console.log("GEMINI_API_KEY is set (length:", apiKey.length, "chars)");
// }

// const genAI = new GoogleGenerativeAI(apiKey || "");

// // Date coercion function to normalize dates to YYYY-MM-DD format
// function coerceIsoDate(text) {
//   if (!text || typeof text !== "string") return "";
//   const normalized = text.trim();
  
//   // Already in YYYY-MM-DD format
//   if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  
//   // Month name mapping
//   const monthMap = {
//     jan: "01", january: "01", feb: "02", february: "02", mar: "03", march: "03",
//     apr: "04", april: "04", may: "05", jun: "06", june: "06",
//     jul: "07", july: "07", aug: "08", august: "08", sep: "09", sept: "09", september: "09",
//     oct: "10", october: "10", nov: "11", november: "11", dec: "12", december: "12"
//   };
  
//   // Try parsing dates with month names: "15 Mar 2027", "Mar 15, 2027", "15-Mar-2027"
//   const monthNamePattern = /(\d{1,2})[\s\-]?([a-z]+)[\s\-,]?(\d{4})/i;
//   const monthNameMatch = normalized.match(monthNamePattern);
//   if (monthNameMatch) {
//     const [_, day, month, year] = monthNameMatch;
//     const monthKey = month.toLowerCase().slice(0, 3);
//     if (monthMap[monthKey] || monthMap[month.toLowerCase()]) {
//       const monthNum = monthMap[monthKey] || monthMap[month.toLowerCase()];
//       return `${year}-${monthNum}-${String(day).padStart(2, "0")}`;
//     }
//   }
  
//   // Try "Mar 15, 2027" format
//   const monthFirstPattern = /([a-z]+)[\s\-](\d{1,2})[\s\-,](\d{4})/i;
//   const monthFirstMatch = normalized.match(monthFirstPattern);
//   if (monthFirstMatch) {
//     const [_, month, day, year] = monthFirstMatch;
//     const monthKey = month.toLowerCase().slice(0, 3);
//     if (monthMap[monthKey] || monthMap[month.toLowerCase()]) {
//       const monthNum = monthMap[monthKey] || monthMap[month.toLowerCase()];
//       return `${year}-${monthNum}-${String(day).padStart(2, "0")}`;
//     }
//   }
  
//   // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY (assume day first if day > 12)
//   const ddmmyyyy = normalized.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
//   if (ddmmyyyy) {
//     const [_, part1, part2, year] = ddmmyyyy;
//     const p1 = parseInt(part1);
//     const p2 = parseInt(part2);
//     // If first part > 12, it's definitely day (DD/MM/YYYY)
//     if (p1 > 12 && p2 <= 12) {
//       return `${year}-${String(part2).padStart(2, "0")}-${String(part1).padStart(2, "0")}`;
//     }
//     // If second part > 12, it's MM/DD/YYYY (US format)
//     if (p1 <= 12 && p2 > 12) {
//       return `${year}-${String(part1).padStart(2, "0")}-${String(part2).padStart(2, "0")}`;
//     }
//     // If both <= 12, try DD/MM/YYYY first (more common internationally)
//     if (p1 <= 12 && p2 <= 12) {
//       return `${year}-${String(part2).padStart(2, "0")}-${String(part1).padStart(2, "0")}`;
//     }
//   }
  
//   // YYYY/MM/DD or YYYY-MM-DD or YYYY.MM.DD
//   const yyyymmdd = normalized.match(/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
//   if (yyyymmdd) {
//     const [_, year, month, day] = yyyymmdd;
//     return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
//   }
  
//   return normalized;
// }

// const prompt = `You are extracting product information from OCR text of a product label image. Extract exactly three critical fields: expiryDate, batchNo, and manufacturingDate.

// Return ONLY a JSON object with these keys: product, expiryDate, batchNo, manufacturingDate

// FIELD 1: expiryDate (HIGHEST PRIORITY - MUST EXTRACT IF PRESENT)
// Your task: Find the expiry/expiration date on the product label. This is CRITICAL.

// Search for these keywords (case-insensitive, check EVERY variation):
// - "Expiry", "Expiry Date", "Exp Date", "EXP", "EXP DATE", "E:", "Exp:", "Expiry:", "EXPIRY"
// - "Use by", "Use-by", "Use By", "Use By Date", "Use Before", "Use By:", "USE BY"
// - "Best before", "Best Before", "Best Before Date", "BB", "BBE", "BB Date", "BEST BEFORE"
// - "Expires", "Expires on", "Expires:", "Expiration", "Expiration Date", "EXPIRES"
// - "Valid until", "Valid Until", "Valid Until Date", "Valid Thru", "VALID UNTIL"
// - "Sell by", "Sell-by", "Sell By Date", "SELL BY"
// - "Best By", "Best By Date", "BEST BY"
// - "Consume by", "Consume By", "CONSUME BY"

// CRITICAL EXTRACTION STEPS:
// 1. Scan the ENTIRE OCR text line by line
// 2. Look for ANY line containing one of the keywords above (even if misspelled or abbreviated)
// 3. The date may appear:
//    - On the same line after the keyword (e.g., "Expiry: 15/03/2027")
//    - On the next line after the keyword
//    - Separated by colon, dash, or space (e.g., "EXP-15/03/2027", "BB 15.03.2027")
// 4. Extract the date value - it will be numbers in various formats
// 5. Convert to YYYY-MM-DD format:
//    - "15/03/2027" or "15-03-2027" or "15.03.2027" → "2027-03-15"
//    - "03/15/2027" → "2027-03-15" (US format MM/DD/YYYY)
//    - "2027-03-15" → keep as-is
//    - "Mar 15, 2027" or "15 Mar 2027" → "2027-03-15"
//    - "15/03/27" → "2027-03-15" (assume 20XX for 2-digit years)
// 6. If multiple expiry dates found, choose the EARLIEST (soonest) date
// 7. If NO expiry date found after thorough search, return "" (empty string)
// 8. IMPORTANT: Do NOT confuse with manufacturing date - expiry dates are FUTURE dates, manufacturing dates are PAST dates

// FIELD 2: batchNo
// Your task: Find the batch number or lot number on the product label.
// Search for these keywords (case-insensitive, check all variations):
// - "Batch", "Batch No", "Batch No:", "Batch Number", "Batch#", "Batch Code", "Batch ID"
// - "LOT", "LOT No", "LOT No:", "LOT Number", "LOT#", "Lot", "Lot No", "Lot Number", "Lot ID"
// - "Lote", "Lote No", "Lote Number"
// - "Serial", "Serial No", "Serial Number", "Serial#"

// Extraction steps:
// 1. Find any line containing one of the keywords above
// 2. Extract the complete identifier that follows the keyword
// 3. Include all characters: letters, numbers, hyphens (-), slashes (/), underscores (_)
// 4. Extract ONLY the value, not the keyword itself:
//    - "LOT: ABC123XYZ" → "ABC123XYZ"
//    - "Batch No. 2024-001" → "2024-001"
//    - "LOT# ABC-XYZ-123" → "ABC-XYZ-123"
//    - "Batch: LOT12345" → "LOT12345"
// 5. Preserve the exact format as printed (case-sensitive, include all characters)
// 6. If not found, return ""

// FIELD 3: manufacturingDate
// Your task: Find the manufacturing/production date on the product label.
// Search for these keywords (case-insensitive, check all variations):
// - "Mfg", "MFG", "Mfg Date", "MFG Date", "Mfg:", "MFG:", "Mfg. Date"
// - "Manufacturing", "Manufacturing Date", "Manufactured", "Manufactured Date"
// - "Production", "Production Date", "Prod", "Prod Date", "Prod:", "Produced", "Produced Date"
// - "P:", "P Date"
// - "Made", "Made on", "Made Date", "Made:"
// - "Date of Manufacture", "Produced on", "Produced:", "Date of Production"

// Extraction steps:
// 1. Find any line containing one of the keywords above
// 2. Extract the date value that follows the keyword
// 3. Convert to YYYY-MM-DD format (use same conversion rules as expiryDate)
// 4. If multiple manufacturing dates found, choose the earliest one
// 5. If no manufacturing date found, return ""

// FIELD 4: product (optional, for reference)
// - Extract the main product name/title from the label
// - Keep it short and descriptive
// - If not found, return ""

// CRITICAL INSTRUCTIONS:
// 1. Read the ENTIRE OCR text from top to bottom
// 2. Look carefully for ALL variations of the keywords listed above
// 3. Dates may appear in various formats - convert ALL to YYYY-MM-DD
// 4. Batch numbers may have different formats - preserve them exactly as printed
// 5. If a field is not found after thorough search, return empty string ""
// 6. Do NOT confuse expiry dates with manufacturing dates
// 7. Do NOT include the keyword/label in the extracted value (e.g., don't return "LOT ABC123", return "ABC123")

// Output format: Return ONLY valid JSON, no markdown, no code blocks, no explanations.
// Example output: {"product":"SHARPS CONTAINER 10L","expiryDate":"2027-03-15","batchNo":"LOT12345","manufacturingDate":"2024-01-10"}`;

// app.get("/", (req, res) => {
//   res.json({
//     message: "OCR expiry backend",
//     health: "GET /health",
//     extract: "POST /extract-fields",
//   });
// });

// app.get("/favicon.ico", (req, res) => res.status(204).end());
// app.get("/favicon.png", (req, res) => res.status(204).end());

// app.post("/extract-fields", async (req, res) => {
//   try {
//     const { text } = req.body;
//     if (!text || typeof text !== "string") {
//       return res.status(400).json({ error: "text is required" });
//     }
//     console.log("OCR length:", text.length, "chars. First 200:", text.slice(0, 200));

//     if (!apiKey) {
//       return res.status(500).json({ error: "GEMINI_API_KEY not configured on server" });
//     }

//     const model = genAI.getGenerativeModel({
//       model: "gemini-2.5-flash",
//       generationConfig: { temperature: 0.2 },
//     });

//     const result = await model.generateContent([
//       { text: prompt },
//       { text: "\n\nOCR_TEXT:\n" + text }
//     ]);

//     const textResponse = result.response.text();
//     console.log("Gemini raw response:", textResponse);
    
//     let extracted = { product: "", expiryDate: "", batchNo: "", manufacturingDate: "" };
    
//     try {
//       const jsonStart = textResponse.indexOf("{");
//       const jsonEnd = textResponse.lastIndexOf("}");
//       const raw = jsonStart >= 0 && jsonEnd >= 0 ? textResponse.slice(jsonStart, jsonEnd + 1) : textResponse;
//       console.log("Extracted JSON string:", raw);
//       const parsed = JSON.parse(raw);
//       console.log("Parsed JSON:", parsed);
      
//       extracted.product = String(parsed.product || "").trim().slice(0, 120);
      
//       // Extract expiryDate with priority
//       if (parsed.expiryDate && String(parsed.expiryDate).trim()) {
//         const rawExpiry = String(parsed.expiryDate).trim();
//         extracted.expiryDate = coerceIsoDate(rawExpiry);
//         console.log("Expiry date - raw:", rawExpiry, "converted:", extracted.expiryDate);
//       } else {
//         console.log("Expiry date not found in parsed JSON");
//       }
      
//       if (parsed.batchNo && String(parsed.batchNo).trim()) {
//         extracted.batchNo = String(parsed.batchNo).trim().slice(0, 100);
//       }
//       if (parsed.manufacturingDate && String(parsed.manufacturingDate).trim()) {
//         extracted.manufacturingDate = coerceIsoDate(String(parsed.manufacturingDate).trim());
//       }
//     } catch (e) {
//       console.warn("JSON parse failed, trying regex fallback. Error:", e.message);
//       // Fallback regex extraction - try multiple patterns for expiry date first
      
//       // Try multiple patterns for expiryDate
//       const expiryPatterns = [
//         /"expiryDate"\s*:\s*"([^"]+)"/i,
//         /expiryDate["\s]*:["\s]*"([^"]+)"/i,
//         /expiryDate["\s]*:["\s]*([^",\s}]+)/i,
//         /"expiry"\s*:\s*"([^"]+)"/i,
//         /expiry["\s]*:["\s]*"([^"]+)"/i
//       ];
      
//       for (const pattern of expiryPatterns) {
//         const match = textResponse.match(pattern);
//         if (match && match[1]) {
//           extracted.expiryDate = coerceIsoDate(match[1].trim());
//           console.log("Expiry date extracted via regex fallback:", match[1], "→", extracted.expiryDate);
//           break;
//         }
//       }
      
//       const productMatch = textResponse.match(/"product"\s*:\s*"([^"]+)"/i) ||
//                           textResponse.match(/product["\s]*:["\s]*([^",\s}]+)/i);
//       if (productMatch) extracted.product = productMatch[1].trim().slice(0, 120);
      
//       const batchMatch = textResponse.match(/"batchNo"\s*:\s*"([^"]+)"/i) ||
//                         textResponse.match(/batchNo["\s]*:["\s]*([^",\s}]+)/i);
//       if (batchMatch) extracted.batchNo = batchMatch[1].trim().slice(0, 100);
      
//       const mfgMatch = textResponse.match(/"manufacturingDate"\s*:\s*"([^"]+)"/i) ||
//                       textResponse.match(/manufacturingDate["\s]*:["\s]*([^",\s}]+)/i);
//       if (mfgMatch) extracted.manufacturingDate = coerceIsoDate(mfgMatch[1].trim());
//     }

//     // Ensure all fields are strings
//     extracted.product = extracted.product || "";
//     extracted.expiryDate = extracted.expiryDate || "";
//     extracted.batchNo = extracted.batchNo || "";
//     extracted.manufacturingDate = extracted.manufacturingDate || "";
    
//     console.log("Final extracted values:", {
//       product: extracted.product,
//       expiryDate: extracted.expiryDate,
//       batchNo: extracted.batchNo,
//       manufacturingDate: extracted.manufacturingDate
//     });
    
//     res.json(extracted);
//   } catch (err) {
//     console.error("extract-fields error:", err);
//     console.error("Error type:", typeof err);
//     console.error("Error keys:", err ? Object.keys(err) : "null");
//     console.error("Error status:", err?.status);
//     console.error("Error statusText:", err?.statusText);
    
//     // Extract error message from various possible structures
//     let message = "Internal error";
//     if (err) {
//       if (err.message) {
//         message = String(err.message).trim();
//       } else if (err.statusText) {
//         message = `${err.status || "Error"} ${err.statusText}`;
//       } else if (typeof err.toString === "function") {
//         const str = err.toString();
//         if (str && str !== "[object Object]") {
//           message = str;
//         }
//       }
//       // For Gemini API errors, check nested properties
//       if (message === "Internal error" && err.errorDetails) {
//         message = String(err.errorDetails).slice(0, 200);
//       }
//     }
    
//     res.status(500).json({ error: String(message).slice(0, 200) });
//   }
// });

// app.get("/health", (req, res) => {
//   res.json({ ok: true, message: "OCR backend running" });
// });

// // Export app for Vercel serverless functions
// export default app;

// // Only start listening if running locally (not on Vercel)
// if (process.env.VERCEL !== "1" && !process.env.VERCEL_ENV) {
//   const port = process.env.PORT || 5050;
//   const host = "0.0.0.0";
//   app.listen(port, host, () => {
//     console.log(`Backend listening on http://${host}:${port} (use this PC's LAN IP for real device)`);
//   });
// }


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

const prompt = `
You are an expert OCR data extraction agent. Your task is to analyze the provided image/text and extract exactly THREE fields into a structured JSON format. 

### FIELDS TO EXTRACT:

1. **product**: The primary name or title of the item.
   - Strategy: Look for the largest text, brand names, or labels like "Product:", "Item:", or "Name:". 
   - Exclude: Batch numbers, weights (unless part of the name), or manufacturer addresses.
   - Cleanliness: Remove leading/trailing punctuation or labels.

2. **expiryDate**: The date the product expires or should be used by.
   - Keywords: "EXP", "Expiry", "Best Before", "BBE", "Use By", "Valid Until", "Best By".
   - Format: Convert to YYYY-MM-DD. (e.g., "12/05/2026" becomes "2026-05-12").
   - Logic: If only month/year is provided (e.g., "Dec 2025"), default to "2025-12-01". If not found, return "".

3. **description**: A brief summary of the product's characteristics.
   - Content: Include details like flavor, variant, net weight/volume, intended use, or a short summary of what the product is.
   - Constraint: Keep it under 150 characters.

### STRICT RULES:
- Return ONLY a single-line JSON object.
- Do NOT include markdown formatting (no json blocks).
- Do NOT include any conversational text or explanations.
- Use empty strings ("") for any field that cannot be identified with high confidence.
- Ensure all keys are lowercase as defined below.

### OUTPUT FORMAT:
{"product": "String", "expiryDate": "YYYY-MM-DD", "description": "String"}`;

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
      model: "gemini-3-flash-preview",
      generationConfig: { temperature: 0.2 },
    });

    const result = await model.generateContent([
      { text: prompt },
      { text: "\n\nOCR_TEXT:\n" + text }
    ]);

    const textResponse = result.response.text();
    console.log("Gemini raw response:", textResponse);
    
    let extracted = { product: "", expiryDate: "", manufacturingDate: "" };
    
    try {
      const jsonStart = textResponse.indexOf("{");
      const jsonEnd = textResponse.lastIndexOf("}");
      const raw = jsonStart >= 0 && jsonEnd >= 0 ? textResponse.slice(jsonStart, jsonEnd + 1) : textResponse;
      console.log("Extracted JSON string:", raw);
      const parsed = JSON.parse(raw);
      console.log("Parsed JSON:", parsed);
      
      // Extract product name
      if (parsed.product && String(parsed.product).trim()) {
        extracted.product = String(parsed.product).trim().slice(0, 120);
        console.log("Product name extracted:", extracted.product);
      } else {
        console.log("Product name not found in parsed JSON");
        extracted.product = "";
      }
      
      // Extract expiryDate with priority
      if (parsed.expiryDate && String(parsed.expiryDate).trim()) {
        const rawExpiry = String(parsed.expiryDate).trim();
        extracted.expiryDate = coerceIsoDate(rawExpiry);
        console.log("Expiry date - raw:", rawExpiry, "converted:", extracted.expiryDate);
      } else {
        console.log("Expiry date not found in parsed JSON");
      }
      
      if (parsed.manufacturingDate && String(parsed.manufacturingDate).trim()) {
        extracted.manufacturingDate = coerceIsoDate(String(parsed.manufacturingDate).trim());
        console.log("Manufacturing date - raw:", String(parsed.manufacturingDate).trim(), "converted:", extracted.manufacturingDate);
      }
    } catch (e) {
      console.warn("JSON parse failed, trying regex fallback. Error:", e.message);
      // Fallback regex extraction - try multiple patterns for expiry date first
      
      // Try multiple patterns for expiryDate
      const expiryPatterns = [
        /"expiryDate"\s*:\s*"([^"]+)"/i,
        /expiryDate["\s]*:["\s]*"([^"]+)"/i,
        /expiryDate["\s]*:["\s]*([^",\s}]+)/i,
        /"expiry"\s*:\s*"([^"]+)"/i,
        /expiry["\s]*:["\s]*"([^"]+)"/i
      ];
      
      for (const pattern of expiryPatterns) {
        const match = textResponse.match(pattern);
        if (match && match[1]) {
          extracted.expiryDate = coerceIsoDate(match[1].trim());
          console.log("Expiry date extracted via regex fallback:", match[1], "→", extracted.expiryDate);
          break;
        }
      }
      
      // Try multiple patterns for product
      const productPatterns = [
        /"product"\s*:\s*"([^"]+)"/i,
        /product["\s]*:["\s]*"([^"]+)"/i,
        /product["\s]*:["\s]*([^",\n}]+)/i,
        /"productName"\s*:\s*"([^"]+)"/i,
        /productName["\s]*:["\s]*"([^"]+)"/i
      ];
      
      for (const pattern of productPatterns) {
        const match = textResponse.match(pattern);
        if (match && match[1] && match[1].trim()) {
          extracted.product = match[1].trim().slice(0, 120);
          console.log("Product name extracted via regex fallback:", extracted.product);
          break;
        }
      }
      
      // Manufacturing date patterns
      const mfgPatterns = [
        /"manufacturingDate"\s*:\s*"([^"]+)"/i,
        /manufacturingDate["\s]*:["\s]*"([^"]+)"/i,
        /manufacturingDate["\s]*:["\s]*([^",\s}]+)/i
      ];
      
      for (const pattern of mfgPatterns) {
        const match = textResponse.match(pattern);
        if (match && match[1] && match[1].trim()) {
          extracted.manufacturingDate = coerceIsoDate(match[1].trim());
          console.log("Manufacturing date extracted via regex fallback:", match[1], "→", extracted.manufacturingDate);
          break;
        }
      }
    }

    // Ensure all fields are strings
    extracted.product = extracted.product || "";
    extracted.expiryDate = extracted.expiryDate || "";
    extracted.manufacturingDate = extracted.manufacturingDate || "";
    
    console.log("Final extracted values:", {
      product: extracted.product,
      expiryDate: extracted.expiryDate,
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

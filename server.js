import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" })); // Increased limit for large OCR text

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("⚠️  GEMINI_API_KEY is not set. Set it in backend/.env");
} else {
  console.log("✓ GEMINI_API_KEY is set (length:", apiKey.length, "chars)");
}

const genAI = new GoogleGenerativeAI(apiKey || "");

/**
 * Enhanced date coercion function to normalize dates to YYYY-MM-DD format
 * Handles multiple date formats including DD/MM/YYYY, MM/DD/YYYY, month names, and 2-digit years
 */
function coerceIsoDate(text) {
  if (!text || typeof text !== "string") return "";
  
  // Normalize whitespace and trim
  const normalized = text.trim().replace(/\s+/g, " ");
  
  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;

  // Month name mapping (case-insensitive)
  const monthMap = {
    jan: "01", january: "01",
    feb: "02", february: "02",
    mar: "03", march: "03",
    apr: "04", april: "04",
    may: "05",
    jun: "06", june: "06",
    jul: "07", july: "07",
    aug: "08", august: "08",
    sep: "09", sept: "09", september: "09",
    oct: "10", october: "10",
    nov: "11", november: "11",
    dec: "12", december: "12"
  };

  // Helper to pad numbers to 2 digits
  const pad = (n) => String(n).padStart(2, "0");

  // Try "15 Mar 2027", "15-Mar-2027", "15/Mar/2027", "15.Mar.2027"
  let match = normalized.match(/(\d{1,2})[\s\-\/.]?([a-z]+)[\s\-\/.,]?(\d{4})/i);
  if (match) {
    const [_, day, month, year] = match;
    const monthKey = month.toLowerCase();
    const monthNum = monthMap[monthKey] || monthMap[monthKey.slice(0, 3)];
    if (monthNum) {
      return `${year}-${monthNum}-${pad(day)}`;
    }
  }

  // Try "Mar 15, 2027", "Mar 15 2027", "Mar-15-2027"
  match = normalized.match(/([a-z]+)[\s\-\/.](\d{1,2})[\s\-\/.,]?(\d{4})/i);
  if (match) {
    const [_, month, day, year] = match;
    const monthKey = month.toLowerCase();
    const monthNum = monthMap[monthKey] || monthMap[monthKey.slice(0, 3)];
    if (monthNum) {
      return `${year}-${monthNum}-${pad(day)}`;
    }
  }

  // Handle 2-digit years: "15/03/27" → "2027-03-15"
  match = normalized.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})$/);
  if (match) {
    const [_, part1, part2, year] = match;
    const fullYear = `20${year}`; // Assume 20XX
    const p1 = parseInt(part1);
    const p2 = parseInt(part2);
    
    if (p1 > 12 && p2 <= 12) {
      // DD/MM/YY
      return `${fullYear}-${pad(part2)}-${pad(part1)}`;
    } else if (p1 <= 12 && p2 > 12) {
      // MM/DD/YY
      return `${fullYear}-${pad(part1)}-${pad(part2)}`;
    } else {
      // Ambiguous, assume DD/MM/YY (international standard)
      return `${fullYear}-${pad(part2)}-${pad(part1)}`;
    }
  }

  // DD/MM/YYYY or MM/DD/YYYY formats with separators (/, -, .)
  match = normalized.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (match) {
    const [_, part1, part2, year] = match;
    const p1 = parseInt(part1);
    const p2 = parseInt(part2);
    
    // If first part > 12, it's definitely day (DD/MM/YYYY)
    if (p1 > 12 && p2 <= 12) {
      return `${year}-${pad(part2)}-${pad(part1)}`;
    } 
    // If second part > 12, it's MM/DD/YYYY (US format)
    else if (p1 <= 12 && p2 > 12) {
      return `${year}-${pad(part1)}-${pad(part2)}`;
    } 
    // Both <= 12, ambiguous - assume DD/MM/YYYY (more common internationally)
    else {
      return `${year}-${pad(part2)}-${pad(part1)}`;
    }
  }

  // YYYY/MM/DD or YYYY-MM-DD or YYYY.MM.DD
  match = normalized.match(/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (match) {
    const [_, year, month, day] = match;
    return `${year}-${pad(month)}-${pad(day)}`;
  }

  // If no pattern matches, return original normalized text
  return normalized;
}

/**
 * Validate date format and check if date is valid
 */
function isValidDate(dateString) {
  if (!dateString || typeof dateString !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return false;
  
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
}

/**
 * Enhanced prompt for Gemini API
 * Concise but comprehensive instructions for extracting product information
 */
const prompt = `You are an expert at extracting product information from OCR text of product labels.

Extract these 4 fields and return ONLY a valid JSON object:

{
  "product": "product name",
  "expiryDate": "YYYY-MM-DD",
  "batchNo": "batch/lot number",
  "manufacturingDate": "YYYY-MM-DD"
}

FIELD EXTRACTION RULES:

1. PRODUCT NAME (required):
   - Look for labels: "Product:", "Item:", "Description:", "Product Name:", "Item Name:", "QR Item Description"
   - Extract the text that appears AFTER the label/colon
   - If no explicit label, find the main product title:
     * Usually at the top of the text
     * 2+ words, often capitalized
     * Main descriptive text (not codes or numbers)
   - EXCLUDE: dates, batch numbers, barcodes, addresses, single codes
   - Max 120 characters
   - If not found: return ""

2. EXPIRY DATE (HIGHEST PRIORITY):
   - Search for these keywords (case-insensitive):
     * "Expiry", "Exp", "EXP", "Exp Date", "Expiry Date", "E:", "Exp:"
     * "Use By", "Use-by", "Use By Date", "Use Before"
     * "Best Before", "Best Before Date", "BB", "BBE"
     * "Expires", "Expires on", "Expiration", "Expiration Date"
     * "Valid Until", "Valid Thru"
     * "Sell By", "Best By", "Consume By"
   - Date can appear on same line or next line after keyword
   - Accept these formats and convert ALL to YYYY-MM-DD:
     * DD/MM/YYYY: "15/03/2027" → "2027-03-15"
     * MM/DD/YYYY: "03/15/2027" → "2027-03-15"
     * DD-MM-YYYY: "15-03-2027" → "2027-03-15"
     * DD.MM.YYYY: "15.03.2027" → "2027-03-15"
     * Month names: "15 Mar 2027" → "2027-03-15"
     * Month names: "Mar 15, 2027" → "2027-03-15"
     * 2-digit year: "15/03/27" → "2027-03-15"
     * Already formatted: "2027-03-15" → "2027-03-15"
   - Rules for ambiguous dates (both parts ≤ 12):
     * If day > 12: DD/MM/YYYY format
     * If month > 12: MM/DD/YYYY format
     * Otherwise: assume DD/MM/YYYY (international standard)
   - If multiple expiry dates found, choose the EARLIEST (soonest) date
   - Expiry dates are FUTURE dates (not past dates like manufacturing dates)
   - If not found after thorough search: return ""

3. BATCH NUMBER / LOT NUMBER:
   - Search for these keywords (case-insensitive):
     * "Batch", "Batch No", "Batch Number", "Batch#", "Batch Code"
     * "LOT", "Lot", "LOT No", "Lot No", "LOT Number", "Lot Number", "LOT#"
     * "Lote", "Lote No"
     * "Serial", "Serial No", "Serial Number"
   - Extract the complete identifier that follows the keyword
   - Include all characters: letters, numbers, hyphens (-), slashes (/), underscores (_)
   - Extract ONLY the value, NOT the keyword:
     * "LOT: ABC123XYZ" → "ABC123XYZ"
     * "Batch No. 2024-001" → "2024-001"
     * "Batch: LOT12345" → "LOT12345"
   - Preserve exact format as printed (case-sensitive)
   - Max 100 characters
   - If not found: return ""

4. MANUFACTURING DATE / PRODUCTION DATE:
   - Search for these keywords (case-insensitive):
     * "Mfg", "MFG", "Mfg Date", "MFG Date", "Mfg:", "Manufacturing Date"
     * "Manufactured", "Manufactured Date"
     * "Production", "Production Date", "Prod", "Prod Date", "Produced"
     * "Made", "Made on", "Made Date"
     * "Date of Manufacture", "Produced on"
   - Extract the date value that follows the keyword
   - Convert to YYYY-MM-DD format (use same conversion rules as expiry date)
   - Manufacturing dates are PAST dates (not future dates)
   - If multiple manufacturing dates found, choose the earliest
   - If not found: return ""

CRITICAL INSTRUCTIONS:
✓ Read the ENTIRE OCR text from top to bottom carefully
✓ Search for ALL keyword variations (case-insensitive matching)
✓ ALL dates MUST be converted to YYYY-MM-DD format
✓ Do NOT include keywords/labels in extracted values (extract only the value itself)
✓ Do NOT confuse expiry dates with manufacturing dates (check if date is past or future)
✓ Product name is REQUIRED - always try to extract it
✓ Return ONLY valid JSON with no markdown formatting, no code blocks, no explanations
✓ All fields must be strings, use "" (empty string) for missing values

Example outputs:

{"product":"SHARPS CONTAINER 10L","expiryDate":"2027-03-15","batchNo":"LOT12345","manufacturingDate":"2024-01-10"}

{"product":"Basmati Rice Premium 5KG","expiryDate":"2026-12-31","batchNo":"ABC-2024-001","manufacturingDate":"2024-02-15"}

{"product":"Surgical Gloves Size M","expiryDate":"2025-06-30","batchNo":"XYZ123","manufacturingDate":""}`;

// Routes
app.get("/", (req, res) => {
  res.json({
    message: "OCR Product Information Extraction API",
    version: "2.0",
    endpoints: {
      health: "GET /health - Check API health",
      extract: "POST /extract-fields - Extract product info from OCR text"
    },
    usage: {
      method: "POST",
      endpoint: "/extract-fields",
      body: {
        text: "OCR text from product label"
      },
      response: {
        product: "Product name",
        expiryDate: "YYYY-MM-DD",
        batchNo: "Batch/Lot number",
        manufacturingDate: "YYYY-MM-DD"
      }
    }
  });
});

app.get("/favicon.ico", (req, res) => res.status(204).end());
app.get("/favicon.png", (req, res) => res.status(204).end());

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    status: "healthy",
    message: "OCR backend running",
    timestamp: new Date().toISOString(),
    geminiConfigured: !!apiKey
  });
});

/**
 * Main extraction endpoint
 * Accepts OCR text and returns extracted product information
 */
app.post("/extract-fields", async (req, res) => {
  const requestId = `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const { text } = req.body;

    // Input validation
    if (!text || typeof text !== "string") {
      console.log(`[${requestId}] ❌ Invalid input: text field is missing or not a string`);
      return res.status(400).json({
        error: "text field is required and must be a string",
        received: typeof text
      });
    }

    if (text.trim().length === 0) {
      console.log(`[${requestId}] ❌ Invalid input: text field is empty`);
      return res.status(400).json({
        error: "text field cannot be empty"
      });
    }

    console.log(`\n[${requestId}] 📥 New extraction request`);
    console.log(`[${requestId}] OCR text length: ${text.length} chars`);
    console.log(`[${requestId}] First 300 chars:\n${text.slice(0, 300)}`);
    console.log(`[${requestId}] Last 200 chars:\n${text.slice(-200)}`);

    // Check API key
    if (!apiKey) {
      console.log(`[${requestId}] ❌ GEMINI_API_KEY not configured`);
      return res.status(500).json({
        error: "GEMINI_API_KEY not configured on server"
      });
    }

    // Initialize Gemini model
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp",
      generationConfig: {
        temperature: 0.1, // Lower temperature for more consistent extraction
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 1024,
      },
    });

    console.log(`[${requestId}] 🤖 Calling Gemini API...`);
    const startTime = Date.now();

    // Call Gemini API
    const result = await model.generateContent([
      { text: prompt },
      { text: "\n\nOCR_TEXT:\n" + text }
    ]);

    const elapsedTime = Date.now() - startTime;
    const textResponse = result.response.text();

    console.log(`[${requestId}] ✓ Gemini API responded in ${elapsedTime}ms`);
    console.log(`[${requestId}] Raw response (${textResponse.length} chars):\n${textResponse}`);

    // Initialize extracted data
    let extracted = {
      product: "",
      expiryDate: "",
      batchNo: "",
      manufacturingDate: ""
    };

    try {
      // Try to parse JSON from response
      const jsonStart = textResponse.indexOf("{");
      const jsonEnd = textResponse.lastIndexOf("}");
      
      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error("No JSON object found in response");
      }

      const jsonString = textResponse.slice(jsonStart, jsonEnd + 1);
      console.log(`[${requestId}] Extracted JSON string:\n${jsonString}`);

      const parsed = JSON.parse(jsonString);
      console.log(`[${requestId}] ✓ Successfully parsed JSON:`, parsed);

      // Extract and validate product name
      if (parsed.product && String(parsed.product).trim()) {
        extracted.product = String(parsed.product).trim().slice(0, 120);
        console.log(`[${requestId}] ✓ Product name: "${extracted.product}"`);
      } else {
        console.log(`[${requestId}] ⚠️  Product name not found`);
      }

      // Extract and validate expiry date
      if (parsed.expiryDate && String(parsed.expiryDate).trim()) {
        const rawExpiry = String(parsed.expiryDate).trim();
        extracted.expiryDate = coerceIsoDate(rawExpiry);
        
        if (isValidDate(extracted.expiryDate)) {
          console.log(`[${requestId}] ✓ Expiry date: "${rawExpiry}" → "${extracted.expiryDate}"`);
        } else {
          console.log(`[${requestId}] ⚠️  Invalid expiry date format: "${extracted.expiryDate}"`);
          extracted.expiryDate = ""; // Clear invalid date
        }
      } else {
        console.log(`[${requestId}] ⚠️  Expiry date not found`);
      }

      // Extract batch number
      if (parsed.batchNo && String(parsed.batchNo).trim()) {
        extracted.batchNo = String(parsed.batchNo).trim().slice(0, 100);
        console.log(`[${requestId}] ✓ Batch number: "${extracted.batchNo}"`);
      } else {
        console.log(`[${requestId}] ⚠️  Batch number not found`);
      }

      // Extract and validate manufacturing date
      if (parsed.manufacturingDate && String(parsed.manufacturingDate).trim()) {
        const rawMfg = String(parsed.manufacturingDate).trim();
        extracted.manufacturingDate = coerceIsoDate(rawMfg);
        
        if (isValidDate(extracted.manufacturingDate)) {
          console.log(`[${requestId}] ✓ Manufacturing date: "${rawMfg}" → "${extracted.manufacturingDate}"`);
        } else {
          console.log(`[${requestId}] ⚠️  Invalid manufacturing date format: "${extracted.manufacturingDate}"`);
          extracted.manufacturingDate = ""; // Clear invalid date
        }
      } else {
        console.log(`[${requestId}] ⚠️  Manufacturing date not found`);
      }

    } catch (parseError) {
      console.log(`[${requestId}] ⚠️  JSON parse failed: ${parseError.message}`);
      console.log(`[${requestId}] 🔄 Attempting regex fallback extraction...`);

      // Fallback: Regex extraction
      // Try multiple patterns for each field

      // Product name patterns
      const productPatterns = [
        /"product"\s*:\s*"([^"]+)"/i,
        /product["\s]*:["\s]*"([^"]+)"/i,
        /product["\s]*:["\s]*([^",\n}]+)/i,
        /"productName"\s*:\s*"([^"]+)"/i,
      ];

      for (const pattern of productPatterns) {
        const match = textResponse.match(pattern);
        if (match && match[1] && match[1].trim()) {
          extracted.product = match[1].trim().slice(0, 120);
          console.log(`[${requestId}] ✓ Product extracted via regex: "${extracted.product}"`);
          break;
        }
      }

      // Expiry date patterns
      const expiryPatterns = [
        /"expiryDate"\s*:\s*"([^"]+)"/i,
        /expiryDate["\s]*:["\s]*"([^"]+)"/i,
        /expiryDate["\s]*:["\s]*([^",\s}]+)/i,
        /"expiry"\s*:\s*"([^"]+)"/i,
      ];

      for (const pattern of expiryPatterns) {
        const match = textResponse.match(pattern);
        if (match && match[1] && match[1].trim()) {
          const rawExpiry = match[1].trim();
          extracted.expiryDate = coerceIsoDate(rawExpiry);
          if (isValidDate(extracted.expiryDate)) {
            console.log(`[${requestId}] ✓ Expiry date extracted via regex: "${rawExpiry}" → "${extracted.expiryDate}"`);
          } else {
            extracted.expiryDate = "";
          }
          break;
        }
      }

      // Batch number patterns
      const batchPatterns = [
        /"batchNo"\s*:\s*"([^"]+)"/i,
        /batchNo["\s]*:["\s]*"([^"]+)"/i,
        /batchNo["\s]*:["\s]*([^",\s}]+)/i,
      ];

      for (const pattern of batchPatterns) {
        const match = textResponse.match(pattern);
        if (match && match[1] && match[1].trim()) {
          extracted.batchNo = match[1].trim().slice(0, 100);
          console.log(`[${requestId}] ✓ Batch number extracted via regex: "${extracted.batchNo}"`);
          break;
        }
      }

      // Manufacturing date patterns
      const mfgPatterns = [
        /"manufacturingDate"\s*:\s*"([^"]+)"/i,
        /manufacturingDate["\s]*:["\s]*"([^"]+)"/i,
        /manufacturingDate["\s]*:["\s]*([^",\s}]+)/i,
      ];

      for (const pattern of mfgPatterns) {
        const match = textResponse.match(pattern);
        if (match && match[1] && match[1].trim()) {
          const rawMfg = match[1].trim();
          extracted.manufacturingDate = coerceIsoDate(rawMfg);
          if (isValidDate(extracted.manufacturingDate)) {
            console.log(`[${requestId}] ✓ Manufacturing date extracted via regex: "${rawMfg}" → "${extracted.manufacturingDate}"`);
          } else {
            extracted.manufacturingDate = "";
          }
          break;
        }
      }
    }

    // Ensure all fields are strings (never null or undefined)
    extracted.product = extracted.product || "";
    extracted.expiryDate = extracted.expiryDate || "";
    extracted.batchNo = extracted.batchNo || "";
    extracted.manufacturingDate = extracted.manufacturingDate || "";

    // Sanity check: Expiry date should be after manufacturing date
    if (extracted.expiryDate && extracted.manufacturingDate) {
      const expiryTimestamp = new Date(extracted.expiryDate).getTime();
      const mfgTimestamp = new Date(extracted.manufacturingDate).getTime();
      
      if (expiryTimestamp <= mfgTimestamp) {
        console.log(`[${requestId}] ⚠️  WARNING: Expiry date (${extracted.expiryDate}) is before/equal to manufacturing date (${extracted.manufacturingDate})`);
      }
    }

    console.log(`[${requestId}] 📤 Final extracted values:`, extracted);
    console.log(`[${requestId}] ✅ Extraction completed successfully\n`);

    res.json(extracted);

  } catch (err) {
    console.error(`[${requestId}] ❌ ERROR:`, err);
    console.error(`[${requestId}] Error type:`, err?.constructor?.name);
    console.error(`[${requestId}] Error message:`, err?.message);
    console.error(`[${requestId}] Error stack:`, err?.stack);

    // Extract meaningful error message
    let errorMessage = "Internal server error";
    
    if (err?.message) {
      errorMessage = String(err.message);
    } else if (err?.statusText) {
      errorMessage = `${err.status || "Error"}: ${err.statusText}`;
    } else if (err?.toString && typeof err.toString === "function") {
      const errStr = err.toString();
      if (errStr && errStr !== "[object Object]") {
        errorMessage = errStr;
      }
    }

    // Check for specific Gemini API errors
    if (errorMessage.includes("API key")) {
      errorMessage = "Invalid or missing Gemini API key";
    } else if (errorMessage.includes("quota")) {
      errorMessage = "Gemini API quota exceeded";
    } else if (errorMessage.includes("rate limit")) {
      errorMessage = "Gemini API rate limit exceeded";
    }

    console.error(`[${requestId}] Final error message: "${errorMessage}"\n`);

    res.status(500).json({
      error: errorMessage.slice(0, 200),
      requestId: requestId
    });
  }
});

// Export app for Vercel serverless functions
export default app;

// Only start listening if running locally (not on Vercel)
if (process.env.VERCEL !== "1" && !process.env.VERCEL_ENV) {
  const port = process.env.PORT || 5050;
  const host = "0.0.0.0";
  
  app.listen(port, host, () => {
    console.log("\n" + "=".repeat(60));
    console.log("🚀 OCR Product Extraction Backend Server");
    console.log("=".repeat(60));
    console.log(`📡 Server listening on http://${host}:${port}`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`🤖 Gemini API: ${apiKey ? "✓ Configured" : "✗ Not configured"}`);
    console.log("\n📚 API Endpoints:");
    console.log(`   GET  http://${host}:${port}/          - API information`);
    console.log(`   GET  http://${host}:${port}/health    - Health check`);
    console.log(`   POST http://${host}:${port}/extract-fields - Extract product info`);
    console.log("\n💡 For mobile device testing, use your PC's LAN IP address");
    console.log("=".repeat(60) + "\n");
  });
}
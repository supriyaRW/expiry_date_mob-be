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

const prompt = `You are an expert product label reader. Extract exactly four fields from the OCR text below with high accuracy.

FIELD EXTRACTION RULES:

1) product (REQUIRED - always return a value):
   - PRIMARY SOURCES (in order of priority):
     * Lines containing: "Product Description", "QR Item Description", "Item Description", "Product Name", "Product:", "Description:", "Item:", "Name:", "Product Name:", "Item Name:"
     * Extract the text AFTER the colon or label (e.g., "Product: SHARPS CONTAINER" → "SHARPS CONTAINER")
   - SECONDARY SOURCES (if primary not found):
     * The longest line that contains descriptive words (not codes, dates, or numbers only)
     * Main product title (usually first or second substantial line)
     * Brand name + product name combination
   - EXCLUDE:
     * LOT/Batch numbers, REF codes, serial numbers, barcodes
     * Date-only lines (e.g., "2027-01-01")
     * Single-word codes or abbreviations
   - If truly no product name found, return "Unknown Product" (never empty string)

2) expiryDate (return YYYY-MM-DD format or empty string ""):
   - SEARCH TERMS: "Expiry", "Exp:", "E:", "EXP", "Expiry Date", "Exp Date", "Use by", "Use-by", "Use By", "Best before", "Best Before", "BB", "BBE", "Expires", "Valid until", "Valid Until"
   - DATE FORMAT CONVERSION:
     * DD.MM.YYYY → YYYY-MM-DD (e.g., "15.03.2027" → "2027-03-15")
     * DD/MM/YYYY → YYYY-MM-DD (e.g., "15/03/2027" → "2027-03-15")
     * MM/DD/YYYY → YYYY-MM-DD (e.g., "03/15/2027" → "2027-03-15")
     * YYYY-MM-DD → keep as-is
     * MM/YYYY or MM.YYYY → YYYY-MM-01 (e.g., "03/2027" → "2027-03-01")
     * YYYY → YYYY-12-31 (if only year, use last day of year)
   - If multiple expiry dates found, use the EARLIEST one
   - If not found, return "" (empty string)

3) batchNo (return as printed or empty string ""):
   - SEARCH TERMS: "Batch", "Batch No", "Batch No:", "Batch#", "Batch Number", "LOT", "LOT No", "LOT No:", "LOT#", "Lot Number", "Lote", "Lote No", "Batch ID", "Lot ID", "Serial", "Serial No"
   - EXTRACTION:
     * Extract the complete value after the label (e.g., "LOT: ABC123XYZ" → "ABC123XYZ")
     * Include all alphanumeric characters, hyphens, and slashes as printed
     * Do NOT include the label itself (e.g., don't return "LOT ABC123", return "ABC123")
   - COMMON PATTERNS:
     * "LOT12345" → "12345" or "LOT12345" (prefer without prefix if ambiguous)
     * "Batch: 2024-001" → "2024-001"
     * "LOT# ABC-XYZ-123" → "ABC-XYZ-123"
   - If not found, return "" (empty string)

4) manufacturingDate (return YYYY-MM-DD format or empty string ""):
   - SEARCH TERMS: "Mfg", "MFG", "Mfg Date", "MFG Date", "Mfg:", "Manufacturing", "Manufacturing Date", "Production", "Prod.", "Prod Date", "Production Date", "P:", "Made", "Made on", "Produced", "Produced on"
   - DATE FORMAT CONVERSION: Same rules as expiryDate (convert to YYYY-MM-DD)
   - If multiple manufacturing dates found, use the EARLIEST one
   - If not found, return "" (empty string)

OUTPUT FORMAT:
- Output ONLY a single-line JSON object with keys: product, expiryDate, batchNo, manufacturingDate
- No markdown, no code blocks, no explanations, no extra text
- All dates must be YYYY-MM-DD format (or empty string)
- Product must never be empty (use "Unknown Product" if not found)

EXAMPLE OUTPUT:
{"product":"SHARPS CONTAINER 10L","expiryDate":"2027-01-15","batchNo":"LOT12345","manufacturingDate":"2024-05-01"}

Now extract the fields from the OCR text below:`;

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

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent([
      { text: prompt },
      { text: "\n\nOCR_TEXT:\n" + text }
    ]);

    let raw = (await result.response.text()).trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) raw = jsonMatch[0];

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.error("Gemini raw:", raw);
      return res.status(500).json({ error: "Gemini response not valid JSON", raw });
    }

    const product = (parsed.product != null && String(parsed.product).trim() !== "") ? String(parsed.product).trim() : "";
    const expiryDate = (parsed.expiryDate != null && String(parsed.expiryDate).trim() !== "") ? String(parsed.expiryDate).trim() : "";
    const batchNo = (parsed.batchNo != null && String(parsed.batchNo).trim() !== "") ? String(parsed.batchNo).trim() : "";
    const manufacturingDate = (parsed.manufacturingDate != null && String(parsed.manufacturingDate).trim() !== "") ? String(parsed.manufacturingDate).trim() : "";

    console.log("Extracted:", { product, expiryDate, batchNo, manufacturingDate });

    res.json({ product, expiryDate, batchNo, manufacturingDate });
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

const port = process.env.PORT || 5050;
const host = "0.0.0.0";
app.listen(port, host, () => {
  console.log(`Backend listening on http://${host}:${port} (use this PC's LAN IP for real device)`);
});

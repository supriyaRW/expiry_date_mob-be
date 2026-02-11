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

const prompt = `You are a product label reader. Extract exactly four fields from the OCR text below.

RULES:
1) product (required): The product or item name.
   - Prefer values from: "Product Description", "QR Item Description", "Item Description", "Product Name", "Product:", "Description:", "Item:", "Name:" (use the value after the colon).
   - Otherwise use the main product title or the longest line that clearly describes the product.
   - Do NOT use: LOT number, REF, batch number, or date-only lines as product.
   - If the OCR text has no product-like line, use the first non-empty line that is not a date or code, or return "Unknown Product".

2) expiryDate: Expiry / use-by / best before date. Return YYYY-MM-DD only.
   - Look for: "Expiry", "Exp:", "E:", "Use by", "Best before", "EXP".
   - Convert any format (DD.MM.YYYY, MM/YYYY, etc.) to YYYY-MM-DD. Month-only -> first day (e.g. 2027-01-01).
   - If not found, return "".

3) batchNo: Batch number / lot number. Return the full batch or lot identifier as printed.
   - Look for: "Batch", "Batch No", "LOT", "LOT No", "LOT#", "Batch #", "Lote", etc.
   - Return the value as-is (letters and numbers). If not found, return "".

4) manufacturingDate: Manufacturing / production date. Return YYYY-MM-DD only.
   - Look for: "Mfg", "MFG", "Production", "Prod.", "P:", "Manufacturing".
   - Same conversion as expiry. If not found, return "".

Output ONLY a single-line JSON object with keys product, expiryDate, batchNo, manufacturingDate. No markdown, no code block, no extra text.
Example: {"product":"SHARPS CONTAINER 10L","expiryDate":"2027-01-01","batchNo":"LOT12345","manufacturingDate":"2024-05-01"}`;

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

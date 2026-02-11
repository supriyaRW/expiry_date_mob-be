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
}

const genAI = new GoogleGenerativeAI(apiKey || "");

const prompt = `You are a product label reader. Extract exactly three fields from the OCR text below.

RULES:
1) product (required): The product or item name.
   - Prefer values from: "Product Description", "QR Item Description", "Item Description", "Product Name", "Product:", "Description:", "Item:", "Name:" (use the value after the colon).
   - Otherwise use the main product title or the longest line that clearly describes the product (e.g. "TOILET SEAT SANITIZING WIPES", "SHARPS CONTAINER 10L").
   - Do NOT use: LOT number, REF, batch, barcode, or date-only lines as product.
   - If the OCR text has no product-like line, use the first non-empty line that is not a date or code, or return "Unknown Product".

2) expiryDate: Expiry / use-by / best before date. Return YYYY-MM-DD only.
   - Look for: "Expiry", "Exp:", "E:", "Use by", "Best before", "EXP".
   - Convert any format (DD.MM.YYYY, MM/YYYY, etc.) to YYYY-MM-DD. Month-only -> first day (e.g. 2027-01-01).
   - If not found, return "".

3) manufacturingDate: Manufacturing / production date. Return YYYY-MM-DD only.
   - Look for: "Mfg", "MFG", "Production", "Prod.", "P:", "Manufacturing".
   - Same conversion. If not found, return "".

Output ONLY a single-line JSON object with keys product, expiryDate, manufacturingDate. No markdown, no code block, no extra text.
Example: {"product":"SHARPS CONTAINER 10L","expiryDate":"2027-01-01","manufacturingDate":"2024-05-01"}`;

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

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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
    const manufacturingDate = (parsed.manufacturingDate != null && String(parsed.manufacturingDate).trim() !== "") ? String(parsed.manufacturingDate).trim() : "";

    console.log("Extracted:", { product, expiryDate, manufacturingDate });

    res.json({ product, expiryDate, manufacturingDate });
  } catch (err) {
    console.error("extract-fields error:", err);
    const message =
      (err && err.message && String(err.message).trim()) ||
      (err && typeof err.toString === "function" && err.toString()) ||
      "Internal error";
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

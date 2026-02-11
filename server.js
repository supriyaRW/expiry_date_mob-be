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

const prompt = `You are a product label reader. Read ALL text from the OCR and extract ONLY these three fields:

1) product: The product name FROM THE TEXT.
- Prefer labeled fields: "Product Description", "QR Item Description", "Item Description", "Product Name", "Product:", "Description:" (value after the colon).
- Examples: "TOILET SEAT SANITIZING WIPES", "Refreshing Towel EY", "SHARPS CONTAINER 10L", "100% Natural Hair Remover".
- If no such field, use the main product name or title on the label. Do NOT use LOT, REF, batch, or barcode codes as the product name.
- If the text only has dates/lot/REF with no product description, return empty string for product.

2) expiryDate: The expiry / best before / use-by date FROM THE TEXT only. Return in YYYY-MM-DD.
- Look for: "Expiry Date", "Exp:", "E:", "Use by", "Best before", "EXPIRY DATE", etc.
- Accept any date format and convert to YYYY-MM-DD. If month-only (e.g. 2027/01), use first day (2027-01-01).
- If none or unreadable, return empty string. Do NOT use manufacturing/production date as expiry.

3) manufacturingDate: The manufacturing / production date FROM THE TEXT only. Return in YYYY-MM-DD.
- Look for: "Mfg", "MFG", "Production Date", "Prod.", "P:".
- Same conversion rules as expiryDate. If not found, return empty string.

You are given OCR text from an image. Use ONLY that text.

Reply with ONLY a single-line JSON object, no markdown. Example:
{"product":"SHARPS CONTAINER 10L","expiryDate":"2027-01-01","manufacturingDate":"2024-05-01"}`;

app.post("/extract-fields", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "text is required" });
    }

    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY not configured on server" });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent([
      { text: prompt },
      { text: "\n\nOCR_TEXT:\n" + text }
    ]);

    const raw = (await result.response.text()).trim();

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return res.status(500).json({ error: "Gemini response not valid JSON", raw });
    }

    const product = parsed.product ?? "";
    const expiryDate = parsed.expiryDate ?? "";
    const manufacturingDate = parsed.manufacturingDate ?? "";

    res.json({ product, expiryDate, manufacturingDate });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
});

const port = process.env.PORT || 5050;
app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});

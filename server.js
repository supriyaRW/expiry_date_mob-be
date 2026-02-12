// // import express from "express";
// // import cors from "cors";
// // import dotenv from "dotenv";
// // import { GoogleGenerativeAI } from "@google/generative-ai";

// // dotenv.config();

// // const app = express();
// // app.use(cors());
// // app.use(express.json({ limit: "10mb" })); // Increased limit for base64 image data

// // const apiKey = process.env.GEMINI_API_KEY;
// // if (!apiKey) {
// //   console.warn("GEMINI_API_KEY is not set. Set it in backend/.env");
// // } else {
// //   console.log("GEMINI_API_KEY is set (length:", apiKey.length, "chars)");
// // }

// // const genAI = new GoogleGenerativeAI(apiKey || "");

// // // Date coercion function to normalize dates to YYYY-MM-DD format
// // function coerceIsoDate(text) {
// //   if (!text || typeof text !== "string") return "";
// //   const normalized = text.trim();
  
// //   // Already in YYYY-MM-DD format
// //   if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  
// //   // Month name mapping
// //   const monthMap = {
// //     jan: "01", january: "01", feb: "02", february: "02", mar: "03", march: "03",
// //     apr: "04", april: "04", may: "05", jun: "06", june: "06",
// //     jul: "07", july: "07", aug: "08", august: "08", sep: "09", sept: "09", september: "09",
// //     oct: "10", october: "10", nov: "11", november: "11", dec: "12", december: "12"
// //   };
  
// //   // Try parsing dates with month names: "15 Mar 2027", "Mar 15, 2027", "15-Mar-2027"
// //   const monthNamePattern = /(\d{1,2})[\s\-]?([a-z]+)[\s\-,]?(\d{4})/i;
// //   const monthNameMatch = normalized.match(monthNamePattern);
// //   if (monthNameMatch) {
// //     const [_, day, month, year] = monthNameMatch;
// //     const monthKey = month.toLowerCase().slice(0, 3);
// //     if (monthMap[monthKey] || monthMap[month.toLowerCase()]) {
// //       const monthNum = monthMap[monthKey] || monthMap[month.toLowerCase()];
// //       return `${year}-${monthNum}-${String(day).padStart(2, "0")}`;
// //     }
// //   }
  
// //   // Try "Mar 15, 2027" format
// //   const monthFirstPattern = /([a-z]+)[\s\-](\d{1,2})[\s\-,](\d{4})/i;
// //   const monthFirstMatch = normalized.match(monthFirstPattern);
// //   if (monthFirstMatch) {
// //     const [_, month, day, year] = monthFirstMatch;
// //     const monthKey = month.toLowerCase().slice(0, 3);
// //     if (monthMap[monthKey] || monthMap[month.toLowerCase()]) {
// //       const monthNum = monthMap[monthKey] || monthMap[month.toLowerCase()];
// //       return `${year}-${monthNum}-${String(day).padStart(2, "0")}`;
// //     }
// //   }
  
// //   // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY (assume day first if day > 12)
// //   const ddmmyyyy = normalized.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
// //   if (ddmmyyyy) {
// //     const [_, part1, part2, year] = ddmmyyyy;
// //     const p1 = parseInt(part1);
// //     const p2 = parseInt(part2);
// //     // If first part > 12, it's definitely day (DD/MM/YYYY)
// //     if (p1 > 12 && p2 <= 12) {
// //       return `${year}-${String(part2).padStart(2, "0")}-${String(part1).padStart(2, "0")}`;
// //     }
// //     // If second part > 12, it's MM/DD/YYYY (US format)
// //     if (p1 <= 12 && p2 > 12) {
// //       return `${year}-${String(part1).padStart(2, "0")}-${String(part2).padStart(2, "0")}`;
// //     }
// //     // If both <= 12, try DD/MM/YYYY first (more common internationally)
// //     if (p1 <= 12 && p2 <= 12) {
// //       return `${year}-${String(part2).padStart(2, "0")}-${String(part1).padStart(2, "0")}`;
// //     }
// //   }
  
// //   // YYYY/MM/DD or YYYY-MM-DD or YYYY.MM.DD
// //   const yyyymmdd = normalized.match(/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
// //   if (yyyymmdd) {
// //     const [_, year, month, day] = yyyymmdd;
// //     return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
// //   }
  
// //   return normalized;
// // }

// // const prompt = `You are an expert at extracting product information from product label images. Analyze the image and extract ONLY the expiry date into a structured JSON format. Extract ONLY this field - do not extract any other information.

// // ### FIELD TO EXTRACT:

// // **expiryDate**: The date the product expires or should be used by. THIS IS CRITICAL - MUST EXTRACT IF PRESENT.
// //    - Keywords (case-insensitive): "EXP", "Expiry", "Expiry Date", "Exp Date", "Best Before", "BBE", "BB", "Use By", "Use-by", "Use Before", "Valid Until", "Valid Thru", "Best By", "Consume By", "Expires", "Expires on", "Expiration", "Expiration Date", "Sell by", "Sell-by".
// //    - Search strategy: Scan the ENTIRE image text carefully. Look for ANY text containing these keywords (even if misspelled or abbreviated).
// //    - Date location: Date may appear on same line after keyword, next line, or separated by colon/dash/space.
// //    - Format: Convert to YYYY-MM-DD. Examples:
// //      * "12/05/2026" → "2026-05-12"
// //      * "15/03/2027" → "2027-03-15"
// //      * "03/15/2027" → "2027-03-15" (US format MM/DD/YYYY)
// //      * "15-03-2027" → "2027-03-15"
// //      * "15.03.2027" → "2027-03-15"
// //      * "Mar 15, 2027" → "2027-03-15"
// //      * "15 Mar 2027" → "2027-03-15"
// //      * "15/03/27" → "2027-03-15" (assume 20XX)
// //    - Logic: If only month/year is provided (e.g., "Dec 2025"), default to "2025-12-01". 
// //    - If multiple expiry dates found, choose the EARLIEST (soonest) date.
// //    - Expiry dates are FUTURE dates (not past dates like manufacturing dates).
// //    - If not found after thorough search, return "" (empty string).

// // ### STRICT RULES:
// // - Extract ONLY the expiryDate field
// // - Do NOT extract any other information (no product names, no batch numbers, no manufacturing dates, no weights, no addresses, no other dates, no barcodes, etc.)
// // - Return ONLY a single-line JSON object.
// // - Do NOT include markdown formatting (no json blocks, no code fences).
// // - Do NOT include any conversational text or explanations.
// // - Use empty string ("") if expiry date cannot be identified with high confidence.
// // - Ensure the key is lowercase: expiryDate
// // - ALL dates MUST be in YYYY-MM-DD format
// // - Read the ENTIRE image text carefully from top to bottom
// // - Expiry date is THE ONLY FIELD TO EXTRACT

// // ### OUTPUT FORMAT:
// // {"expiryDate": "YYYY-MM-DD"}`;

// // app.get("/", (req, res) => {
// //   res.json({
// //     message: "OCR expiry backend",
// //     health: "GET /health",
// //     extract: "POST /extract-fields",
// //   });
// // });

// // app.get("/favicon.ico", (req, res) => res.status(204).end());
// // app.get("/favicon.png", (req, res) => res.status(204).end());

// // app.post("/extract-fields", async (req, res) => {
// //   try {
// //     const { image, mimeType } = req.body;
    
// //     // Accept either image (base64) or text (for backward compatibility)
// //     if (!image && !req.body.text) {
// //       return res.status(400).json({ error: "image (base64) or text is required" });
// //     }

// //     if (!apiKey) {
// //       return res.status(500).json({ error: "GEMINI_API_KEY not configured on server" });
// //     }

// //     const model = genAI.getGenerativeModel({
// //       model: "gemini-3-flash-preview",
// //       generationConfig: { temperature: 0.2 },
// //     });

// //     let result;
    
// //     if (image && typeof image === "string") {
// //       // Image provided - use Gemini Vision API
// //       console.log("Processing image (base64 length:", image.length, "chars)");
// //       const imageMimeType = mimeType || "image/jpeg";
      
// //       // Remove data URL prefix if present (data:image/jpeg;base64,)
// //       const base64Data = image.includes(",") ? image.split(",")[1] : image;
      
// //       result = await model.generateContent([
// //         { text: prompt },
// //         {
// //           inlineData: {
// //             data: base64Data,
// //             mimeType: imageMimeType
// //           }
// //         }
// //       ]);
// //     } else {
// //       // Text provided - backward compatibility
// //       const text = req.body.text;
// //       console.log("Processing text (length:", text.length, "chars. First 200:", text.slice(0, 200));
// //       result = await model.generateContent([
// //         { text: prompt },
// //         { text: "\n\nOCR_TEXT:\n" + text }
// //       ]);
// //     }

// //     const textResponse = result.response.text();
// //     console.log("Gemini raw response:", textResponse);
    
// //     let extracted = { expiryDate: "" };
    
// //     try {
// //       const jsonStart = textResponse.indexOf("{");
// //       const jsonEnd = textResponse.lastIndexOf("}");
// //       const raw = jsonStart >= 0 && jsonEnd >= 0 ? textResponse.slice(jsonStart, jsonEnd + 1) : textResponse;
// //       console.log("Extracted JSON string:", raw);
// //       const parsed = JSON.parse(raw);
// //       console.log("Parsed JSON:", parsed);
      
// //       // Extract expiryDate only
// //       if (parsed.expiryDate && String(parsed.expiryDate).trim()) {
// //         const rawExpiry = String(parsed.expiryDate).trim();
// //         extracted.expiryDate = coerceIsoDate(rawExpiry);
// //         console.log("Expiry date - raw:", rawExpiry, "converted:", extracted.expiryDate);
// //       } else {
// //         console.log("Expiry date not found in parsed JSON");
// //         extracted.expiryDate = "";
// //       }
// //     } catch (e) {
// //       console.warn("JSON parse failed, trying regex fallback. Error:", e.message);
// //       // Fallback regex extraction - only for expiryDate
      
// //       // Try multiple patterns for expiryDate
// //       const expiryPatterns = [
// //         /"expiryDate"\s*:\s*"([^"]+)"/i,
// //         /expiryDate["\s]*:["\s]*"([^"]+)"/i,
// //         /expiryDate["\s]*:["\s]*([^",\s}]+)/i,
// //         /"expiry"\s*:\s*"([^"]+)"/i,
// //         /expiry["\s]*:["\s]*"([^"]+)"/i
// //       ];
      
// //       for (const pattern of expiryPatterns) {
// //         const match = textResponse.match(pattern);
// //         if (match && match[1]) {
// //           extracted.expiryDate = coerceIsoDate(match[1].trim());
// //           console.log("Expiry date extracted via regex fallback:", match[1], "→", extracted.expiryDate);
// //           break;
// //         }
// //       }
// //     }

// //     // Ensure field is a string
// //     extracted.expiryDate = extracted.expiryDate || "";
    
// //     console.log("Final extracted value:", {
// //       expiryDate: extracted.expiryDate
// //     });
    
// //     res.json(extracted);
// //   } catch (err) {
// //     console.error("extract-fields error:", err);
// //     console.error("Error type:", typeof err);
// //     console.error("Error keys:", err ? Object.keys(err) : "null");
// //     console.error("Error status:", err?.status);
// //     console.error("Error statusText:", err?.statusText);
    
// //     // Extract error message from various possible structures
// //     let message = "Internal error";
// //     if (err) {
// //       if (err.message) {
// //         message = String(err.message).trim();
// //       } else if (err.statusText) {
// //         message = `${err.status || "Error"} ${err.statusText}`;
// //       } else if (typeof err.toString === "function") {
// //         const str = err.toString();
// //         if (str && str !== "[object Object]") {
// //           message = str;
// //         }
// //       }
// //       // For Gemini API errors, check nested properties
// //       if (message === "Internal error" && err.errorDetails) {
// //         message = String(err.errorDetails).slice(0, 200);
// //       }
// //     }
    
// //     res.status(500).json({ error: String(message).slice(0, 200) });
// //   }
// // });

// // app.get("/health", (req, res) => {
// //   res.json({ ok: true, message: "OCR backend running" });
// // });

// // // Export app for Vercel serverless functions
// // export default app;

// // // Only start listening if running locally (not on Vercel)
// // if (process.env.VERCEL !== "1" && !process.env.VERCEL_ENV) {
// //   const port = process.env.PORT || 5050;
// //   const host = "0.0.0.0";
// //   app.listen(port, host, () => {
// //     console.log(`Backend listening on http://${host}:${port} (use this PC's LAN IP for real device)`);
// //   });
// // }


// import express from "express";
// import cors from "cors";
// import dotenv from "dotenv";
// import { GoogleGenerativeAI } from "@google/generative-ai";

// dotenv.config();

// const app = express();
// app.use(cors());
// app.use(express.json({ limit: "10mb" })); // Increased limit for base64 image data

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
  
//   // Try "Mar 15, 2027" or "July 25 2002" or "July 25 02" (month day year)
//   const monthFirstPattern = /([a-z]+)[\s\-]+(\d{1,2})[\s\-,]+(\d{2}|\d{4})/i;
//   const monthFirstMatch = normalized.match(monthFirstPattern);
//   if (monthFirstMatch) {
//     const [_, month, day, yRaw] = monthFirstMatch;
//     const year = yRaw.length === 2 ? `20${yRaw}` : yRaw;
//     const monthKey = month.toLowerCase().slice(0, 3);
//     if (monthMap[monthKey] || monthMap[month.toLowerCase()]) {
//       const monthNum = monthMap[monthKey] || monthMap[month.toLowerCase()];
//       return `${year}-${monthNum}-${String(day).padStart(2, "0")}`;
//     }
//   }

//   // Month + day (no year): "July 25", "Jul-25"
//   // Choose current year; if already passed this year, roll to next year.
//   let match = normalized.match(/([a-z]+)[\s\-\/\.]+(\d{1,2})$/i);
//   if (match) {
//     const [__, month, day] = match;
//     const monthKey = month.toLowerCase().slice(0, 3);
//     const monthNum = monthMap[monthKey] || monthMap[month.toLowerCase()];
//     if (monthNum) {
//       const now = new Date();
//       let year = now.getFullYear();
//       const candidate = new Date(`${year}-${monthNum}-${String(day).padStart(2, "0")}T00:00:00Z`);
//       if (!isNaN(candidate.getTime())) {
//         // if date is in the past relative to today, assume next year
//         const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
//         if (candidate.getTime() < today.getTime()) year += 1;
//         return `${year}-${monthNum}-${String(day).padStart(2, "0")}`;
//       }
//     }
//   }

//   // Month only: "July", "Jul" -> default to 1st of that month.
//   // Choose current year; if month already passed this year, roll to next year.
//   match = normalized.match(/^([a-z]+)$/i);
//   if (match) {
//     const month = match[1];
//     const monthKey = month.toLowerCase().slice(0, 3);
//     const monthNum = monthMap[monthKey] || monthMap[month.toLowerCase()];
//     if (monthNum) {
//       const now = new Date();
//       let year = now.getFullYear();
//       const currentMonth = now.getUTCMonth() + 1; // 1-12
//       if (parseInt(monthNum, 10) < currentMonth) year += 1;
//       return `${year}-${monthNum}-01`;
//     }
//   }

//   // Month + year (no day): "July 2026", "Jul 26" -> default day 01
//   match = normalized.match(/^([a-z]+)[\s\-\/\.]+(\d{2}|\d{4})$/i);
//   if (match) {
//     const [__, month, yRaw] = match;
//     const monthKey = month.toLowerCase().slice(0, 3);
//     const monthNum = monthMap[monthKey] || monthMap[month.toLowerCase()];
//     if (monthNum) {
//       const year = yRaw.length === 2 ? `20${yRaw}` : yRaw;
//       return `${year}-${monthNum}-01`;
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

// const prompt = `You are an expert at extracting product information from product label images. Analyze the image and extract ONLY the expiry date into a structured JSON format. Extract ONLY this field - do not extract any other information.

// ### FIELD TO EXTRACT:

// **expiryDate**: The date the product expires or should be used by. THIS IS CRITICAL - MUST EXTRACT IF PRESENT.
//    - Keywords (case-insensitive): "EXP", "Expiry", "Expiry Date", "Exp Date", "Best Before", "BBE", "BB", "Use By", "Use-by", "Use Before", "Valid Until", "Valid Thru", "Best By", "Consume By", "Expires", "Expires on", "Expiration", "Expiration Date", "Sell by", "Sell-by".
//    - Search strategy: Scan the ENTIRE image text carefully. Look for ANY text containing these keywords (even if misspelled or abbreviated).
//    - Date location: Date may appear on same line after keyword, next line, or separated by colon/dash/space.
//    - Format: ALWAYS output YYYY-MM-DD. Accept and convert ALL of these (and similar):
//      * Numeric: "12/05/2026" → "2026-05-12", "15-03-2027", "15.03.2027", "03/15/2027" (US), "15/03/27" (20XX).
//      * Month name + day + year: "July 25 2002" → "2002-07-25", "Mar 15, 2027" → "2027-03-15", "15 Mar 2027" → "2027-03-15".
//      * Month + year only: "July 2026", "Dec 2025" → "2026-07-01", "2025-12-01" (use 1st of month).
//      * Month + day only: "July 25", "Jul 25" → use next occurrence of that date (e.g. "2026-07-25" if still future).
//      * Month only: "July", "Jul" → "YYYY-07-01" (use 1st of that month, year so it is in the future).
//    - Logic: If only month/year, use day 01. If only month, use 01 and pick year so date is future. If multiple expiry dates, choose the EARLIEST.
//    - Expiry dates are FUTURE dates (not past dates like manufacturing dates).
//    - If not found after thorough search, return "" (empty string).

// ### STRICT RULES:
// - Extract ONLY the expiryDate field
// - Do NOT extract any other information (no product names, no batch numbers, no manufacturing dates, no weights, no addresses, no other dates, no barcodes, etc.)
// - Return ONLY a single-line JSON object.
// - Do NOT include markdown formatting (no json blocks, no code fences).
// - Do NOT include any conversational text or explanations.
// - Use empty string ("") if expiry date cannot be identified with high confidence.
// - Ensure the key is lowercase: expiryDate
// - ALL dates MUST be in YYYY-MM-DD format
// - Read the ENTIRE image text carefully from top to bottom
// - Expiry date is THE ONLY FIELD TO EXTRACT

// ### OUTPUT FORMAT:
// {"expiryDate": "YYYY-MM-DD"}`;

// // Shorter prompt when input is OCR text (faster, same extraction rules)
// const promptForText = `Extract ONLY the expiry date from the OCR text below. Return a single-line JSON: {"expiryDate": "YYYY-MM-DD"} or {"expiryDate": ""} if not found.

// Rules:
// - Look for keywords: EXP, Expiry, Exp Date, Best Before, BBE, Use By, Valid Until, Best By, Sell by, etc.
// - ALWAYS output YYYY-MM-DD. Convert any format you find:
//   * "July 25 2002" or "Jul 25 2002" → "2002-07-25"
//   * "July 25" or "Jul 25" (no year) → use next future date (e.g. "2026-07-25")
//   * "July 2026" or "Jul 26" → "2026-07-01"
//   * "July" or "Jul" only → "YYYY-07-01" (1st of month, year = next future)
//   * "15/03/2027", "15-03-2027", "Mar 15, 2027" → "2027-03-15"
// - Expiry is a FUTURE date. If unclear, prefer the date that looks like expiry (after keywords). Return only the JSON, no other text.`;

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
//     const { image, mimeType } = req.body;
    
//     // Accept either image (base64) or text (for backward compatibility)
//     if (!image && !req.body.text) {
//       return res.status(400).json({ error: "image (base64) or text is required" });
//     }

//     if (!apiKey) {
//       return res.status(500).json({ error: "GEMINI_API_KEY not configured on server" });
//     }

//     const model = genAI.getGenerativeModel({
//       model: "gemini-3-flash-preview",
//       generationConfig: { temperature: 0.2 },
//     });

//     let result;
    
//     if (image && typeof image === "string") {
//       // Image provided - use Gemini Vision API
//       console.log("Processing image (base64 length:", image.length, "chars)");
//       const imageMimeType = mimeType || "image/jpeg";
      
//       // Remove data URL prefix if present (data:image/jpeg;base64,)
//       const base64Data = image.includes(",") ? image.split(",")[1] : image;
      
//       result = await model.generateContent([
//         { text: prompt },
//         {
//           inlineData: {
//             data: base64Data,
//             mimeType: imageMimeType
//           }
//         }
//       ]);
//     } else {
//       // Text provided (OCR from device) - use text-only prompt for speed
//       const text = req.body.text;
//       console.log("Processing OCR text (length:", text.length, "chars. First 200:", text.slice(0, 200));
//       result = await model.generateContent([
//         { text: promptForText },
//         { text: "\n\nOCR_TEXT:\n" + text }
//       ]);
//     }

//     const textResponse = result.response.text();
//     console.log("Gemini raw response:", textResponse);
    
//     let extracted = { expiryDate: "" };
    
//     try {
//       const jsonStart = textResponse.indexOf("{");
//       const jsonEnd = textResponse.lastIndexOf("}");
//       const raw = jsonStart >= 0 && jsonEnd >= 0 ? textResponse.slice(jsonStart, jsonEnd + 1) : textResponse;
//       console.log("Extracted JSON string:", raw);
//       const parsed = JSON.parse(raw);
//       console.log("Parsed JSON:", parsed);
      
//       // Extract expiryDate only
//       if (parsed.expiryDate && String(parsed.expiryDate).trim()) {
//         const rawExpiry = String(parsed.expiryDate).trim();
//         extracted.expiryDate = coerceIsoDate(rawExpiry);
//         console.log("Expiry date - raw:", rawExpiry, "converted:", extracted.expiryDate);
//       } else {
//         console.log("Expiry date not found in parsed JSON");
//         extracted.expiryDate = "";
//       }
//     } catch (e) {
//       console.warn("JSON parse failed, trying regex fallback. Error:", e.message);
//       // Fallback regex extraction - only for expiryDate
      
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
//     }

//     // Ensure field is a string
//     extracted.expiryDate = extracted.expiryDate || "";
    
//     console.log("Final extracted value:", {
//       expiryDate: extracted.expiryDate
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


// =================================================================
//  Imports: Import required modules.
// =================================================================
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

// =================================================================
//  Configuration: Load environment variables and initialize the app.
// =================================================================
dotenv.config(); // Load variables from .env file

const app = express();
const PORT = process.env.PORT || 5050;

// =================================================================
//  Middleware: Configure the Express app.
// =================================================================
app.use(cors()); // Enable Cross-Origin Resource Sharing for all routes
app.use(express.json({ limit: "10mb" })); // Enable JSON body parsing with a 10MB limit for image data

// =================================================================
//  Gemini AI Client Initialization
// =================================================================
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn(
    "GEMINI_API_KEY is not set. Please create a backend/.env file and add your key."
  );
}
const genAI = new GoogleGenerativeAI(apiKey || "");

// =================================================================
//  Utility Functions: Helper for date normalization.
// =================================================================
/**
 * Normalizes various date string formats into a standard "YYYY-MM-DD" format.
 * @param {string} text - The raw date string to process.
 * @returns {string} The normalized date string or the original text if parsing fails.
 */
function coerceIsoDate(text) {
  if (!text || typeof text !== "string") return "";
  const normalized = text.trim();

  // Return if already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;

  // Month name mapping for parsing
  const monthMap = {
    jan: "01", january: "01", feb: "02", february: "02", mar: "03", march: "03",
    apr: "04", april: "04", may: "05", jun: "06", june: "06",
    jul: "07", july: "07", aug: "08", august: "08", sep: "09", sept: "09", september: "09",
    oct: "10", october: "10", nov: "11", november: "11", dec: "12", december: "12"
  };

  // Try: "15 Mar 2027", "Mar 15, 2027", "15-Mar-2027", "15.Mar.2027"
  let match = normalized.match(/(\d{1,2})[\s\-.,]*([a-z]+)[\s\-.,]*(\d{2,4})/i);
  if (match) {
    const [_, day, monthStr, yearStr] = match;
    const year = yearStr.length === 2 ? `20${yearStr}` : yearStr;
    const monthKey = monthStr.toLowerCase().slice(0, 3);
    if (monthMap[monthKey]) {
      const monthNum = monthMap[monthKey];
      return `${year}-${monthNum.padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  // Try: "Mar 15, 2027", "March 15 2027"
  match = normalized.match(/([a-z]+)[\s\-.,]*(\d{1,2})[\s\-.,]*(\d{2,4})/i);
  if (match) {
    const [_, monthStr, day, yearStr] = match;
    const year = yearStr.length === 2 ? `20${yearStr}` : yearStr;
    const monthKey = monthStr.toLowerCase().slice(0, 3);
    if (monthMap[monthKey]) {
      const monthNum = monthMap[monthKey];
      return `${year}-${monthNum.padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  // Try: "Dec 2025", "December 2025", "12-2025", "12/2025"
  match = normalized.match(/([a-z]+|\d{1,2})[\s\-/.](\d{4})/i);
  if (match) {
    const [_, part1, year] = match;
    // Check if part1 is month name
    if (isNaN(part1)) {
      const monthKey = part1.toLowerCase().slice(0, 3);
      if (monthMap[monthKey]) {
        return `${year}-${monthMap[monthKey]}-01`;
      }
    } else {
      // Numeric month
      const month = String(part1).padStart(2, "0");
      if (parseInt(month) >= 1 && parseInt(month) <= 12) {
        return `${year}-${month}-01`;
      }
    }
  }

  // Try: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
  match = normalized.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (match) {
    let [_, p1, p2, year] = match;
    year = year.length === 2 ? `20${year}` : year;
    const n1 = parseInt(p1);
    const n2 = parseInt(p2);
    
    // If first part > 12, it must be day (DD/MM/YYYY)
    if (n1 > 12 && n2 <= 12) {
      return `${year}-${p2.padStart(2, "0")}-${p1.padStart(2, "0")}`;
    }
    // If second part > 12, it's MM/DD/YYYY
    if (n1 <= 12 && n2 > 12) {
      return `${year}-${p1.padStart(2, "0")}-${p2.padStart(2, "0")}`;
    }
    // Both <= 12: Assume DD/MM/YYYY (international standard)
    if (n1 <= 12 && n2 <= 12) {
      return `${year}-${p2.padStart(2, "0")}-${p1.padStart(2, "0")}`;
    }
  }
  
  // Try: YYYY/MM/DD, YYYY-MM-DD, YYYY.MM.DD
  match = normalized.match(/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (match) {
    const [_, year, month, day] = match;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  // Try: Just month name "December" -> use 1st of month, current/next year
  match = normalized.match(/^([a-z]+)$/i);
  if (match) {
    const monthKey = match[1].toLowerCase().slice(0, 3);
    if (monthMap[monthKey]) {
      const now = new Date();
      let year = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      const targetMonth = parseInt(monthMap[monthKey]);
      // If month has passed this year, use next year
      if (targetMonth < currentMonth) year += 1;
      return `${year}-${monthMap[monthKey]}-01`;
    }
  }
  
  // If all parsing fails, return empty string for safety
  return "";
}

// =================================================================
//  AI Prompts: Instructions for the Gemini model.
// =================================================================
const PROMPT_FOR_IMAGE = `You are an expert at extracting product information from labels. Extract THREE fields and return ONLY a JSON object.

⚠️ CRITICAL: You MUST look for ALL THREE fields. Don't stop after finding manufacturer!

EXTRACTION PRIORITY (scan in this order):
1. EXPIRY DATE - MOST IMPORTANT
2. BATCH NUMBER - SECOND PRIORITY  
3. MANUFACTURER - LAST

FIELDS TO EXTRACT:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**expiryDate** (HIGHEST PRIORITY - FIND THIS FIRST):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KEYWORDS (look for ANY of these):
- "EXP", "EXP DATE", "EXP:", "EXPIRY", "EXPIRY DATE", "EXPIRES", "EXPIRES ON"
- "BEST BEFORE", "BBE", "BB", "BEST BY", "BEST BEFORE DATE"
- "USE BY", "USE-BY", "USE BEFORE", "USE BEFORE DATE"
- "VALID UNTIL", "VALID THRU", "VALID TILL"
- "CONSUME BEFORE", "CONSUME BY"
- "SELL BY", "SELL-BY DATE"

SEARCH EVERYWHERE on the label - top, bottom, sides, corners!
The date may be on a separate line, in small text, or stamped.

FORMAT CONVERSION - Convert ANY of these to YYYY-MM-DD:
- "31/12/2025" → "2025-12-31"
- "31-12-2025" → "2025-12-31"  
- "31.12.2025" → "2025-12-31"
- "Dec 2025" → "2025-12-01"
- "December 2025" → "2025-12-01"
- "12/2025" → "2025-12-01"
- "2025/12/31" → "2025-12-31"
- "25/03/27" → "2027-03-25" (assume 20XX for 2-digit years)

⚠️ NEVER confuse with manufacturing date! Look for EXP/EXPIRY keywords!
Return "" if not found

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**batchNo** (SECOND PRIORITY):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KEYWORDS (look for ANY of these):
- "BATCH", "BATCH NO", "BATCH NUMBER", "BATCH #", "B.NO", "B NO"
- "LOT", "LOT NO", "LOT NUMBER", "LOT #", "L.NO", "L NO"  
- "SERIAL", "SERIAL NO", "SERIAL NUMBER", "SN"
- "CODE", "PRODUCT CODE", "ITEM CODE"

WHAT TO EXTRACT:
- The alphanumeric code that appears AFTER these keywords
- Usually format: "ABC123", "20250115", "L-12345", "B987654", etc.
- Ignore barcodes (long numbers like 1234567890123)
- Ignore dates, prices, weights

EXAMPLE:
- "Batch No: ABC123" → Extract "ABC123"
- "LOT L-98765" → Extract "L-98765"
- "Code: XYZ-2024-01" → Extract "XYZ-2024-01"

Return "" if not found

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**manufacturer** (THIRD PRIORITY):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT TO LOOK FOR:
- Brand name (usually largest text on label)
- Company logo text
- "Manufactured by", "Mfr:", "Brand:", "Company:"

EXAMPLES: "Nestle", "Coca-Cola", "Unilever", "P&G", "Qatar Airways"
Return "" if not found

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SCANNING STRATEGY:
1. Scan ENTIRE label from top to bottom
2. Find EXPIRY keywords first → Extract date
3. Find BATCH/LOT keywords → Extract code  
4. Find brand/company name
5. Double-check you found all three (if they exist)

OUTPUT FORMAT (STRICT):
{"manufacturer": "String", "batchNo": "String", "expiryDate": "YYYY-MM-DD"}

EXAMPLES:
{"manufacturer": "Nestle", "batchNo": "L12345", "expiryDate": "2025-12-31"}
{"manufacturer": "Coca-Cola", "batchNo": "ABC123", "expiryDate": "2026-06-15"}
{"manufacturer": "Qatar Airways", "batchNo": "QR-98765", "expiryDate": "2027-03-20"}

⚠️ IMPORTANT: Even if manufacturer is prominent, ALWAYS search for batch and expiry!`;

const PROMPT_FOR_TEXT = `Extract manufacturer, batchNo, and expiryDate from the OCR text below.

⚠️ CRITICAL RULES:
1. ALWAYS search for all THREE fields
2. Expiry date ≠ Manufacturing date
3. Extract expiry FIRST, then batch, then manufacturer

PRIORITY ORDER:
1️⃣ **expiryDate**: Look for "EXP", "EXPIRY", "BEST BEFORE", "USE BY", "VALID UNTIL", "BB", "BBE"
   - NOT "MFG", "MANUFACTURED", "PRODUCTION DATE"
   - Convert to YYYY-MM-DD format
   
2️⃣ **batchNo**: Look for "BATCH", "LOT", "SERIAL", "B.NO", "L.NO", "CODE"
   - Extract the alphanumeric code after keyword
   - Example: "LOT ABC123" → "ABC123"
   
3️⃣ **manufacturer**: Brand/company name

SCAN STRATEGY:
- Read ALL text line by line
- Find EXPIRY keywords → extract date
- Find BATCH/LOT keywords → extract code
- Find brand name
- Return "" for fields not found

OUTPUT: Single-line JSON only.
{"manufacturer":"String","batchNo":"String","expiryDate":"YYYY-MM-DD"}

⚠️ Don't stop after finding manufacturer - ALWAYS search for batch and expiry!`;


// =================================================================
//  API Routes
// =================================================================
app.get("/", (req, res) => {
  res.status(200).json({
    message: "OCR Expiry Backend is running.",
    endpoints: {
      health: "GET /health",
      extract: "POST /extract-fields",
    },
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// New endpoint to check available models
app.get("/list-models", async (req, res) => {
  try {
    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY not configured" });
    }

    // Try to list models using direct API call
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ 
        error: `API error: ${response.status}`,
        details: errorText 
      });
    }

    const data = await response.json();
    const modelNames = data.models?.map(m => m.name) || [];
    
    res.status(200).json({
      available_models: modelNames,
      total_count: modelNames.length,
      recommendation: modelNames.length > 0 ? modelNames[0] : "No models found"
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Main endpoint for extracting data from image or text
app.post("/extract-fields", async (req, res) => {
  try {
    const { image, mimeType, text } = req.body;

    // 1. Validate Input
    if (!image && !text) {
      return res.status(400).json({ error: "Request body must contain 'image' (base64) or 'text'." });
    }
    if (!apiKey) {
      return res.status(500).json({ error: "Server is missing GEMINI_API_KEY configuration." });
    }

    // 2. Configure and select the AI model
    // Using gemini-3-flash-preview as requested
    const model = genAI.getGenerativeModel({
      model: "gemini-3-flash-preview",
      generationConfig: { temperature: 0.2, maxOutputTokens: 500 },
    });

    // 3. Prepare the payload for the Gemini API
    const requestPayload = [];
    if (image) {
      console.log(`Processing image input (MIME type: ${mimeType || 'image/jpeg'}).`);
      const base64Data = image.includes(",") ? image.split(",")[1] : image;
      requestPayload.push(
        { text: PROMPT_FOR_IMAGE },
        { inlineData: { data: base64Data, mimeType: mimeType || "image/jpeg" } }
      );
    } else {
      console.log(`Processing text input (Length: ${text.length} chars).`);
      requestPayload.push(
        { text: PROMPT_FOR_TEXT },
        { text: `\n\n---OCR TEXT START---\n${text}\n---OCR TEXT END---` }
      );
    }

    // 4. Call the Gemini API
    const result = await model.generateContent(requestPayload);
    const textResponse = result.response.text();
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Gemini raw response:");
    console.log(textResponse);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // 5. Parse the AI response (JSON with Regex Fallback)
    let extracted = { manufacturer: "", batchNo: "", expiryDate: "" };
    try {
      // Attempt to find and parse the JSON block
      const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON object found in the response.");
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      extracted.manufacturer = (parsed.manufacturer || "").trim().slice(0, 100);
      extracted.batchNo = (parsed.batchNo || "").trim().slice(0, 100);
      
      // Special handling for expiry date - validate it's a future date
      if (parsed.expiryDate && String(parsed.expiryDate).trim()) {
        const rawExpiry = String(parsed.expiryDate).trim();
        const convertedDate = coerceIsoDate(rawExpiry);
        
        // Validate that the expiry date is in the future (not a manufacturing date)
        if (convertedDate && convertedDate !== "") {
          const expiryDateObj = new Date(convertedDate);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          // If date is more than 20 years in the past, it's probably a manufacturing date
          const twentyYearsAgo = new Date();
          twentyYearsAgo.setFullYear(twentyYearsAgo.getFullYear() - 20);
          
          if (expiryDateObj >= twentyYearsAgo) {
            extracted.expiryDate = convertedDate;
            console.log("Expiry date validated - raw:", rawExpiry, "converted:", convertedDate);
          } else {
            console.warn("Date rejected (too old, likely mfg date):", convertedDate);
            extracted.expiryDate = "";
          }
        } else {
          console.log("Expiry date conversion failed for:", rawExpiry);
          extracted.expiryDate = "";
        }
      } else {
        console.log("Expiry date not found in parsed JSON");
        extracted.expiryDate = "";
      }

    } catch (e) {
      console.warn("JSON parsing failed, attempting regex fallback. Error:", e.message);
      // Fallback: Use regex if JSON parsing fails
      const manuMatch = textResponse.match(/"manufacturer"\s*:\s*"([^"]*)"/i);
      if (manuMatch) extracted.manufacturer = manuMatch[1].trim().slice(0, 100);

      const batchMatch = textResponse.match(/"batchNo"\s*:\s*"([^"]*)"/i);
      if (batchMatch) extracted.batchNo = batchMatch[1].trim().slice(0, 100);

      const expiryMatch = textResponse.match(/"expiryDate"\s*:\s*"([^"]*)"/i);
      if (expiryMatch) {
        const convertedDate = coerceIsoDate(expiryMatch[1].trim());
        if (convertedDate) extracted.expiryDate = convertedDate;
      }
    }
    
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("FINAL EXTRACTED VALUES:");
    console.log("  manufacturer:", extracted.manufacturer || "(empty)");
    console.log("  batchNo:", extracted.batchNo || "(empty)");
    console.log("  expiryDate:", extracted.expiryDate || "(empty)");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    // Warn if critical fields are missing
    if (!extracted.batchNo) {
      console.warn("⚠️ WARNING: Batch number not found in extraction!");
    }
    if (!extracted.expiryDate) {
      console.warn("⚠️ WARNING: Expiry date not found in extraction!");
    }
    
    res.status(200).json(extracted);

  } catch (err) {
    console.error("Error in /extract-fields:", err.message);
    res.status(500).json({ error: "An internal server error occurred.", details: err.message });
  }
});

// =================================================================
//  Server Startup
// =================================================================
// This check prevents the server from starting on platforms like Vercel,
// where the platform handles the lifecycle.
if (process.env.VERCEL !== "1") {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Server is running on http://0.0.0.0:${PORT}`);
    console.log(`   (Use this PC's LAN IP for local network access)`);
  });
}

// Export app for serverless environments
export default app;
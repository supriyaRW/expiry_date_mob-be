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
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  Object.assign(monthMap, {
    january: "01", february: "02", march: "03", april: "04", /* may */
    june: "06", july: "07", august: "08", september: "09", october: "10",
    november: "11", december: "12"
  });

  // Tries to match formats like: "15 Mar 2027", "Mar 15, 2027", "15-Mar-2027"
  let match = normalized.match(/(\d{1,2})?[\s\-,.]*([a-z]+)[\s\-,.]*(\d{1,2})?[\s\-,.]*(\d{4}|\d{2})/i);
  if (match) {
    const [_, day1, monthStr, day2, yearStr] = match;
    const day = day1 || day2;
    const year = yearStr.length === 2 ? `20${yearStr}` : yearStr;
    const monthKey = monthStr.toLowerCase().slice(0, 3);
    if (day && year && monthMap[monthKey]) {
      const monthNum = monthMap[monthKey];
      return `${year}-${monthNum.padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  // Tries to match formats like: DD/MM/YYYY or MM/DD/YYYY
  match = normalized.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4}|\d{2})/);
  if (match) {
    let [_, p1, p2, year] = match;
    year = year.length === 2 ? `20${year}` : year;
    // Assume DD/MM if day > 12
    if (parseInt(p1, 10) > 12) {
      return `${year}-${p2.padStart(2, "0")}-${p1.padStart(2, "0")}`; // DD/MM/YYYY
    }
    // Assume MM/DD if day > 12
    if (parseInt(p2, 10) > 12) {
      return `${year}-${p1.padStart(2, "0")}-${p2.padStart(2, "0")}`; // MM/DD/YYYY
    }
    // Ambiguous (e.g., 01/02/2025), assume international standard DD/MM/YYYY
    return `${year}-${p2.padStart(2, "0")}-${p1.padStart(2, "0")}`;
  }
  
  // If all parsing fails, return the original trimmed string
  return normalized;
}

// =================================================================
//  AI Prompts: Instructions for the Gemini model.
// =================================================================
const PROMPT_FOR_IMAGE = `Extract THREE fields from product label images: manufacturer, batchNo, expiryDate. Return ONLY a single-line JSON.

### FIELDS:
1.  **manufacturer**: Brand/company name (e.g., "Nestle", "Coca-Cola"). Look for company names, logos, or "Manufactured by". Max 100 chars. Return "" if not found.
2.  **batchNo**: Batch/lot number. Keywords: "Batch", "Batch No", "LOT". Extract the identifier that follows the keyword. Max 100 chars. Return "" if not found.
3.  **expiryDate**: Expiration date. Keywords: "EXP", "Expiry", "Best Before", "Use By". Convert the found date to YYYY-MM-DD format. Return "" if not found.

### OUTPUT FORMAT:
{"manufacturer": "String", "batchNo": "String", "expiryDate": "YYYY-MM-DD"}`;

const PROMPT_FOR_TEXT = `From the following OCR text, extract manufacturer, batchNo, and expiryDate.
- **manufacturer**: The brand or company name.
- **batchNo**: The code after keywords like "Batch", "LOT", or "Serial".
- **expiryDate**: The date after "EXP", "Expiry", "Best Before". Convert it to YYYY-MM-DD format.
Return ONLY a single-line JSON object: {"manufacturer":"String","batchNo":"String","expiryDate":"YYYY-MM-DD"}. Return "" for any field not found.`;


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
    // Model options (try these in order if one fails):
    // - "gemini-1.5-flash-002" (stable production model, Dec 2024)
    // - "gemini-1.5-flash" (alias for latest stable)
    // - "gemini-1.5-pro" (more capable but slower/expensive)
    // If errors persist, check: https://ai.google.dev/gemini-api/docs/models/gemini
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash-002",
      generationConfig: { temperature: 0.1, maxOutputTokens: 200 }, // Low temp for predictable JSON
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
    console.log("Gemini raw response:", textResponse);

    // 5. Parse the AI response (JSON with Regex Fallback)
    let extracted = { manufacturer: "", batchNo: "", expiryDate: "" };
    try {
      // Attempt to find and parse the JSON block
      const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON object found in the response.");
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      extracted.manufacturer = (parsed.manufacturer || "").trim().slice(0, 100);
      extracted.batchNo = (parsed.batchNo || "").trim().slice(0, 100);
      extracted.expiryDate = coerceIsoDate(parsed.expiryDate || "");

    } catch (e) {
      console.warn("JSON parsing failed, attempting regex fallback. Error:", e.message);
      // Fallback: Use regex if JSON parsing fails
      const manuMatch = textResponse.match(/"manufacturer"\s*:\s*"([^"]*)"/i);
      if (manuMatch) extracted.manufacturer = manuMatch[1].trim().slice(0, 100);

      const batchMatch = textResponse.match(/"batchNo"\s*:\s*"([^"]*)"/i);
      if (batchMatch) extracted.batchNo = batchMatch[1].trim().slice(0, 100);

      const expiryMatch = textResponse.match(/"expiryDate"\s*:\s*"([^"]*)"/i);
      if (expiryMatch) extracted.expiryDate = coerceIsoDate(expiryMatch[1].trim());
    }
    
    console.log("Final extracted data:", extracted);
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
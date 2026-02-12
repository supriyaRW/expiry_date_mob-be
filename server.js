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
  
  // Try "Mar 15, 2027" or "July 25 2002" or "July 25 02" (month day year)
  const monthFirstPattern = /([a-z]+)[\s\-]+(\d{1,2})[\s\-,]+(\d{2}|\d{4})/i;
  const monthFirstMatch = normalized.match(monthFirstPattern);
  if (monthFirstMatch) {
    const [_, month, day, yRaw] = monthFirstMatch;
    const year = yRaw.length === 2 ? `20${yRaw}` : yRaw;
    const monthKey = month.toLowerCase().slice(0, 3);
    if (monthMap[monthKey] || monthMap[month.toLowerCase()]) {
      const monthNum = monthMap[monthKey] || monthMap[month.toLowerCase()];
      return `${year}-${monthNum}-${String(day).padStart(2, "0")}`;
    }
  }

  // Month + day (no year): "July 25", "Jul-25"
  // Choose current year; if already passed this year, roll to next year.
  let match = normalized.match(/([a-z]+)[\s\-\/\.]+(\d{1,2})$/i);
  if (match) {
    const [__, month, day] = match;
    const monthKey = month.toLowerCase().slice(0, 3);
    const monthNum = monthMap[monthKey] || monthMap[month.toLowerCase()];
    if (monthNum) {
      const now = new Date();
      let year = now.getFullYear();
      const candidate = new Date(`${year}-${monthNum}-${String(day).padStart(2, "0")}T00:00:00Z`);
      if (!isNaN(candidate.getTime())) {
        // if date is in the past relative to today, assume next year
        const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        if (candidate.getTime() < today.getTime()) year += 1;
        return `${year}-${monthNum}-${String(day).padStart(2, "0")}`;
      }
    }
  }

  // Month only: "July", "Jul" -> default to 1st of that month.
  // Choose current year; if month already passed this year, roll to next year.
  match = normalized.match(/^([a-z]+)$/i);
  if (match) {
    const month = match[1];
    const monthKey = month.toLowerCase().slice(0, 3);
    const monthNum = monthMap[monthKey] || monthMap[month.toLowerCase()];
    if (monthNum) {
      const now = new Date();
      let year = now.getFullYear();
      const currentMonth = now.getUTCMonth() + 1; // 1-12
      if (parseInt(monthNum, 10) < currentMonth) year += 1;
      return `${year}-${monthNum}-01`;
    }
  }

  // Month + year (no day): "July 2026", "Jul 26" -> default day 01
  match = normalized.match(/^([a-z]+)[\s\-\/\.]+(\d{2}|\d{4})$/i);
  if (match) {
    const [__, month, yRaw] = match;
    const monthKey = month.toLowerCase().slice(0, 3);
    const monthNum = monthMap[monthKey] || monthMap[month.toLowerCase()];
    if (monthNum) {
      const year = yRaw.length === 2 ? `20${yRaw}` : yRaw;
      return `${year}-${monthNum}-01`;
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

const prompt = `Extract THREE fields from product label images: manufacturer, batchNo, expiryDate. Return ONLY a single-line JSON.

### FIELDS:

1. **manufacturer**: Brand/manufacturer name (e.g. "Nestle", "Coca-Cola", "Johnson & Johnson"). Look for company names, brand logos, "Made by", "Manufactured by". Max 100 chars. Return "" if not found.

2. **batchNo**: Batch/lot/serial number. Keywords: "Batch", "Batch No", "LOT", "Lot", "Serial", "Serial No". Extract the identifier after the keyword. Max 100 chars. Return "" if not found.

3. **expiryDate**: Expiry date. Keywords: "EXP", "Expiry", "Best Before", "BBE", "Use By", "Valid Until". Convert to YYYY-MM-DD:
   * "July 25 2002" → "2002-07-25"
   * "July 25" → next future date (e.g. "2026-07-25")
   * "July 2026" → "2026-07-01"
   * "July" → "YYYY-07-01" (future year)
   * "15/03/2027" → "2027-03-15"
   Return "" if not found.

### OUTPUT:
{"manufacturer": "String", "batchNo": "String", "expiryDate": "YYYY-MM-DD"}`;

// Shorter prompt when input is OCR text (faster, same extraction rules)
const promptForText = `Extract manufacturer, batchNo, expiryDate from OCR text. Return JSON: {"manufacturer":"String","batchNo":"String","expiryDate":"YYYY-MM-DD"}.
Manufacturer: brand/company name. BatchNo: after "Batch"/"LOT"/"Serial". ExpiryDate: after "EXP"/"Expiry"/"Best Before" → YYYY-MM-DD (July 25 2002→2002-07-25, July 25→next future, July 2026→2026-07-01). Return "" for missing fields.`;

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

    // Use stable production model (not preview/experimental) for reliability
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 128,
      },
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
      // Text provided (OCR from device) - use text-only prompt for speed
      const text = req.body.text;
      console.log("Processing OCR text (length:", text.length, "chars. First 200:", text.slice(0, 200));
      result = await model.generateContent([
        { text: promptForText },
        { text: "\n\nOCR_TEXT:\n" + text }
      ]);
    }

    const textResponse = result.response.text();
    console.log("Gemini raw response:", textResponse);
    
    let extracted = { manufacturer: "", batchNo: "", expiryDate: "" };
    
    try {
      const jsonStart = textResponse.indexOf("{");
      const jsonEnd = textResponse.lastIndexOf("}");
      const raw = jsonStart >= 0 && jsonEnd >= 0 ? textResponse.slice(jsonStart, jsonEnd + 1) : textResponse;
      console.log("Extracted JSON string:", raw);
      const parsed = JSON.parse(raw);
      console.log("Parsed JSON:", parsed);
      
      // Extract manufacturer
      if (parsed.manufacturer && String(parsed.manufacturer).trim()) {
        extracted.manufacturer = String(parsed.manufacturer).trim().slice(0, 100);
        console.log("Manufacturer extracted:", extracted.manufacturer);
      }
      
      // Extract batchNo
      if (parsed.batchNo && String(parsed.batchNo).trim()) {
        extracted.batchNo = String(parsed.batchNo).trim().slice(0, 100);
        console.log("Batch number extracted:", extracted.batchNo);
      }
      
      // Extract expiryDate
      if (parsed.expiryDate && String(parsed.expiryDate).trim()) {
        const rawExpiry = String(parsed.expiryDate).trim();
        extracted.expiryDate = coerceIsoDate(rawExpiry);
        console.log("Expiry date - raw:", rawExpiry, "converted:", extracted.expiryDate);
      }
    } catch (e) {
      console.warn("JSON parse failed, trying regex fallback. Error:", e.message);
      // Fallback regex extraction
      
      const manufacturerPatterns = [
        /"manufacturer"\s*:\s*"([^"]+)"/i,
        /manufacturer["\s]*:["\s]*"([^"]+)"/i
      ];
      for (const pattern of manufacturerPatterns) {
        const match = textResponse.match(pattern);
        if (match && match[1]) {
          extracted.manufacturer = match[1].trim().slice(0, 100);
          break;
        }
      }
      
      const batchPatterns = [
        /"batchNo"\s*:\s*"([^"]+)"/i,
        /batchNo["\s]*:["\s]*"([^"]+)"/i,
        /"batch"\s*:\s*"([^"]+)"/i,
        /"lot"\s*:\s*"([^"]+)"/i
      ];
      for (const pattern of batchPatterns) {
        const match = textResponse.match(pattern);
        if (match && match[1]) {
          extracted.batchNo = match[1].trim().slice(0, 100);
          break;
        }
      }
      
      const expiryPatterns = [
        /"expiryDate"\s*:\s*"([^"]+)"/i,
        /expiryDate["\s]*:["\s]*"([^"]+)"/i,
        /"expiry"\s*:\s*"([^"]+)"/i
      ];
      for (const pattern of expiryPatterns) {
        const match = textResponse.match(pattern);
        if (match && match[1]) {
          extracted.expiryDate = coerceIsoDate(match[1].trim());
          break;
        }
      }
    }

    // Ensure all fields are strings
    extracted.manufacturer = extracted.manufacturer || "";
    extracted.batchNo = extracted.batchNo || "";
    extracted.expiryDate = extracted.expiryDate || "";
    
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

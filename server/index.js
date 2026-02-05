const express = require('express');
const multer = require('multer');
const cors = require('cors');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// CORS configuration - allow all origins for now (can restrict later)
app.use(cors({
  origin: true, // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => console.error('MongoDB connection error:', err));

// Mongoose Schema for Forensic Scans
const scanSchema = new mongoose.Schema({
  filename: String,
  claim: String,
  authenticity_score: Number,
  risk_level: String,
  reasons: [String],
  signals: [String],
  verdict: String,
  timestamp: { type: Date, default: Date.now }
});

const Scan = mongoose.model('Scan', scanSchema);

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });
const uploadMultiple = multer({ storage: storage }).array('files', 10); // Allow up to 10 files

// Gemini setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-3-pro-preview"; // Default to gemini-3-pro-preview

//Temporary function to list available models for debugging
// async function listAvailableModels() {
//   try {
//     const models = await genAI.listModels();
//     console.log("\n--- Available Gemini Models ---");
//     for (const model of models.models) {
//       if (model.supportedGenerationMethods.includes("generateContent") && (model.name.includes("vision") || model.name.includes("flash") || model.name.includes("pro"))) {
//         console.log(`Name: ${model.name}, Display Name: ${model.displayName}, Supported Methods: ${model.supportedGenerationMethods.join(", ")}`);
//       }
//     }
//     console.log("-------------------------------\n");
//   } catch (err) {
//     console.error("Error listing models:", err);
//   }
// }

// listAvailableModels(); // Call this once when the server starts

async function analyzeFile(filePath, mimeType, claimText = "") {
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });

  const prompt = `
    You are VeriWeave, a high-fidelity multimodal forensic AI. Your task is to analyze the provided document or media (image/video/PDF) alongside a user's textual claim.
    
    User Claim: "${claimText}"

    CORE MISSION:
    Evaluate the AUTHENTICITY and ACCURACY of the claim relative to the actual content. The authenticity_score should reflect how well the claim matches reality, NOT whether the content is "real" vs "synthetic".
    
    CRITICAL LOGIC (applies to ANY content type - videos, images, documents, etc.):
    The authenticity_score reflects CLAIM ACCURACY, not content type. Use this universal principle:
    - If the claim accurately describes what the content actually is → HIGH score (claim is ACCURATE)
    - If the claim misrepresents what the content actually is → LOW score (claim is FALSE/MISLEADING)
    
    Examples of accurate claims (HIGH score):
    - Claim says "CGI video" and content IS CGI → accurate
    - Claim says "real invoice for $500" and content IS real invoice showing $500 → accurate
    - Claim says "deepfake video" and content IS deepfake → accurate
    
    Examples of inaccurate claims (LOW score):
    - Claim says "real photo" but content IS CGI/AI-generated → inaccurate
    - Claim says "invoice for $500" but content shows different amount → inaccurate
    - Claim says "authentic document" but content shows signs of tampering → inaccurate
    
    For ANY content type, analyze: Does the claim truthfully represent what the content actually is?
    
    ANALYSIS PROTOCOL:
    1. Multimodal Cross-Reference: Does the visual content match the claim? (e.g., if claim says "Invoice for $500", does the image show $500? If claim says "CGI video", does the video appear to be CGI?)
    2. Claim Accuracy: Is the claim truthful about what the content actually is? (e.g., if claim says "3D CGI" and content is CGI → accurate; if claim says "real photo" but content is CGI → inaccurate)
    3. Document Forensics: Check for font kerning inconsistencies, misaligned text boxes, varied ink density, or overlapping digital layers in invoices/bills.
    4. Visual Artifacts: Spot synthetic artifacts (warping, blurred edges), unnatural lighting/shadows, or "hallucinated" details common in AI generation. Note: These are expected if the claim states the content is CGI/AI-generated.
    5. Logical Consistency: Validate vendor formats (GST/VAT), date logic, and metadata timestamps.
    6. Synthetic Signs: Look for "Deepfake" markers in videos (lip-sync, eye-blink patterns) or generative patterns in static images. Note: These are expected if the claim states the content is CGI/AI-generated.
    7. Shadow & Perspective: Analyze if shadows align with the primary light source and if the perspective of added elements matches the background.

    OUTPUT SPECIFICATION (STRICT JSON):
    Return ONLY a JSON object with these keys:
    - authenticity_score: (0-100) where 100 means the claim is ACCURATE and matches the content perfectly, 0 means the claim is FALSE or MISLEADING. Score based on claim-accuracy, not content-type.
    - risk_level: "Low", "Medium", or "High". 
      CRITICAL: Map risk_level based on authenticity_score:
      * authenticity_score 70-100 → risk_level: "Low" (highly authentic = low risk)
      * authenticity_score 40-69 → risk_level: "Medium" (suspicious = medium risk)
      * authenticity_score 0-39 → risk_level: "High" (tampered = high risk)
    - category_scores: Object with scores (0-100) for each analysis dimension:
      * multimodal_match: How well visual content matches the claim
      * document_forensics: Font, alignment, and document structure analysis
      * visual_artifacts: Synthetic generation markers and artifacts
      * logical_consistency: Date logic, formats, and metadata validation
      * synthetic_signs: Deepfake and AI-generation indicators
      * shadow_perspective: Lighting, shadow, and perspective analysis
    - reasons: Array of 3-5 specific, high-reasoning explanations for your verdict.
    - signals: Array of 3-5 technical forensic signals detected (e.g., "Chrominance Subsampling", "Perspective Warp", "Kerning Variance", "Shadow Misalignment").
    - verdict: A single, punchy professional verdict sentence.

    JSON Template:
    {
      "authenticity_score": number,
      "risk_level": "string",
      "category_scores": {
        "multimodal_match": number,
        "document_forensics": number,
        "visual_artifacts": number,
        "logical_consistency": number,
        "synthetic_signs": number,
        "shadow_perspective": number
      },
      "reasons": ["string"],
      "signals": ["string"],
      "verdict": "string"
    }
  `;

  const imageData = {
    inlineData: {
      data: Buffer.from(fs.readFileSync(filePath)).toString("base64"),
      mimeType,
    },
  };

  const result = await model.generateContent([prompt, imageData]);
  const response = await result.response;
  const text = response.text();
  
  //console.log("Raw Gemini response text:", text); // Log raw response

  // Extract JSON from the response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const parsedResponse = JSON.parse(jsonMatch[0]);
    //console.log("Parsed Gemini response:", parsedResponse); // Log parsed response
    return parsedResponse;
  } else {
    throw new Error("Failed to parse Gemini response: " + text);
  }
}

// New function for batch multimodal analysis - analyzes all files together
async function analyzeBatchFiles(files, claimText = "") {
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });

  const fileList = files.map((f, idx) => `${idx + 1}. ${f.originalname} (${f.mimetype})`).join('\n');

  const prompt = `
    You are VeriWeave, a high-fidelity multimodal forensic AI. Your task is to perform MULTIMODAL REASONING across MULTIPLE files together to evaluate a single claim.
    
    User Claim: "${claimText}"
    
    Files Provided (${files.length} total):
    ${fileList}

    CORE MISSION:
    Analyze ALL files TOGETHER using multimodal reasoning. Consider how the files relate to each other, cross-reference information across them, and provide a UNIFIED analysis that evaluates the claim against the COLLECTIVE evidence from all files.
    
    CRITICAL: You are analyzing ${files.length} files TOGETHER as a single unit. Return ONE unified result that considers ALL files collectively. Do NOT analyze files individually. Do NOT return separate results for each file. Return ONE combined analysis result.

    MULTIMODAL REASONING APPROACH:
    1. Cross-File Analysis: Look for patterns, inconsistencies, or correlations across all files. Do they tell a consistent story?
    2. Evidence Synthesis: Combine information from different files (e.g., if one file is an invoice and another is a receipt, do they match?)
    3. Temporal Consistency: If files have dates/timestamps, do they align logically?
    4. Content Correlation: Do the files support or contradict each other regarding the claim?
    5. Unified Forensics: Apply forensic analysis across all files collectively - are there patterns of manipulation, or do they all appear authentic together?

    CRITICAL LOGIC:
    The authenticity_score should reflect how well the claim matches the COLLECTIVE content across ALL files:
    - If the claim accurately describes what the files collectively show → HIGH score
    - If the claim misrepresents what the files collectively show → LOW score
    - If files contradict each other or show inconsistencies → Consider this in your score

    ANALYSIS PROTOCOL (Applied Across All Files):
    1. Multimodal Cross-Reference: Does the collective visual content across all files match the claim?
    2. Cross-File Consistency: Do the files support each other, or are there contradictions?
    3. Document Forensics: Check for inconsistencies across documents (font mismatches, date logic, format variations).
    4. Visual Artifacts: Look for synthetic artifacts across all media files.
    5. Logical Consistency: Validate formats, dates, and metadata across all files.
    6. Synthetic Signs: Check for deepfake or AI-generation markers across all files.
    7. Shadow & Perspective: Analyze lighting and perspective consistency across images/videos.

    OUTPUT SPECIFICATION (STRICT JSON):
    IMPORTANT: Return EXACTLY ONE JSON object. Do NOT return an array. Do NOT return separate objects for each file. Return ONE unified result.
    
    Return ONLY a JSON object with these keys:
    - authenticity_score: (0-100) where 100 means the claim is ACCURATE based on ALL files collectively, 0 means the claim is FALSE or MISLEADING based on the collective evidence.
    - risk_level: "Low", "Medium", or "High". 
      CRITICAL: Map risk_level based on authenticity_score:
      * authenticity_score 70-100 → risk_level: "Low" (highly authentic = low risk)
      * authenticity_score 40-69 → risk_level: "Medium" (suspicious = medium risk)
      * authenticity_score 0-39 → risk_level: "High" (tampered = high risk)
    - category_scores: Object with scores (0-100) for each analysis dimension (evaluated across ALL files):
      * multimodal_match: How well collective visual content matches the claim
      * document_forensics: Cross-file document structure and consistency analysis
      * visual_artifacts: Synthetic generation markers across all files
      * logical_consistency: Date logic, formats, and metadata validation across files
      * synthetic_signs: Deepfake and AI-generation indicators across all files
      * shadow_perspective: Lighting, shadow, and perspective consistency across files
    - reasons: Array of 5-7 specific, high-reasoning explanations that reference MULTIPLE files and their relationships. Mention specific files and how they relate.
    - signals: Array of 5-7 technical forensic signals detected across the files (e.g., "Cross-File Date Mismatch", "Font Inconsistency Across Documents", "Perspective Warp in File 2", "Metadata Timestamp Alignment").
    - verdict: A single, punchy professional verdict sentence that addresses the claim in the context of ALL files together.
    - analyzed_files: Array of filenames that were analyzed (for reference).

    JSON Template:
    {
      "authenticity_score": number,
      "risk_level": "string",
      "category_scores": {
        "multimodal_match": number,
        "document_forensics": number,
        "visual_artifacts": number,
        "logical_consistency": number,
        "synthetic_signs": number,
        "shadow_perspective": number
      },
      "reasons": ["string"],
      "signals": ["string"],
      "verdict": "string",
      "analyzed_files": ["string"]
    }
  `;

  // Prepare all files as inline data for multimodal input
  // IMPORTANT: All files must be sent together in a single request for multimodal reasoning
  const fileDataArray = files.map(file => {
    try {
      const fileBuffer = fs.readFileSync(file.path);
      return {
        inlineData: {
          data: fileBuffer.toString("base64"),
          mimeType: file.mimetype,
        },
      };
    } catch (error) {
      console.error(`Error reading file ${file.path}:`, error);
      throw new Error(`Failed to read file ${file.originalname}: ${error.message}`);
    }
  });

  console.log(`\n=== SENDING TO GEMINI ===`);
  console.log(`Files count: ${files.length}`);
  console.log(`Files: ${files.map(f => f.originalname).join(', ')}`);
  console.log(`Content array length: ${1 + fileDataArray.length} (1 prompt + ${fileDataArray.length} files)`);
  console.log(`==========================\n`);

  // Build content array: [prompt, file1, file2, file3, ...]
  // This sends ALL files in ONE request to Gemini for unified multimodal reasoning
  // CRITICAL: All files are sent together, NOT individually
  const contentArray = [prompt, ...fileDataArray];
  
  console.log(`Calling Gemini generateContent with ${contentArray.length} items (1 prompt + ${fileDataArray.length} files)...`);
  
  // Send all files together with the prompt for multimodal reasoning
  // Gemini will analyze ALL files together and provide ONE unified response
  // This is a SINGLE API call, NOT multiple calls
  const result = await model.generateContent(contentArray);
  const response = await result.response;
  const text = response.text();
  
  console.log(`\n=== GEMINI RESPONSE RECEIVED ===`);
  console.log(`Response length: ${text.length} characters`);
  console.log(`First 500 chars: ${text.substring(0, 500)}`);
  console.log(`==================================\n`);
  
  // Extract JSON from the response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsedResponse = JSON.parse(jsonMatch[0]);
      console.log("Parsed batch response:", JSON.stringify(parsedResponse, null, 2));
      
      // Validate and ensure required fields exist
      if (typeof parsedResponse.authenticity_score !== 'number') {
        console.warn("Missing or invalid authenticity_score, defaulting to 0");
        parsedResponse.authenticity_score = 0;
      }
      if (!parsedResponse.risk_level) {
        // Auto-calculate risk_level based on score
        const score = parsedResponse.authenticity_score;
        parsedResponse.risk_level = score >= 70 ? 'Low' : score >= 40 ? 'Medium' : 'High';
      }
      if (!parsedResponse.verdict) {
        parsedResponse.verdict = "Analysis completed. Review details for specific findings.";
      }
      if (!Array.isArray(parsedResponse.reasons)) {
        parsedResponse.reasons = ["Multimodal analysis completed across all files."];
      }
      if (!Array.isArray(parsedResponse.signals)) {
        parsedResponse.signals = ["Cross-file analysis performed."];
      }
      if (!parsedResponse.category_scores) {
        parsedResponse.category_scores = {
          multimodal_match: parsedResponse.authenticity_score || 0,
          document_forensics: parsedResponse.authenticity_score || 0,
          visual_artifacts: parsedResponse.authenticity_score || 0,
          logical_consistency: parsedResponse.authenticity_score || 0,
          synthetic_signs: parsedResponse.authenticity_score || 0,
          shadow_perspective: parsedResponse.authenticity_score || 0
        };
      }
      
      return parsedResponse;
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      throw new Error("Failed to parse Gemini JSON response: " + parseError.message);
    }
  } else {
    console.error("No JSON found in response. Full text:", text);
    throw new Error("Failed to extract JSON from Gemini response: " + text.substring(0, 200));
  }
}

app.post('/api/analyze', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { claim } = req.body;
    const result = await analyzeFile(req.file.path, req.file.mimetype, claim);
    
    // Save to MongoDB
    const newScan = new Scan({
      filename: req.file.originalname,
      claim: claim,
      ...result
    });
    await newScan.save();

    // Clean up the uploaded file
    fs.unlinkSync(req.file.path);

    res.json(result);
  } catch (error) {
    console.error('Error analyzing file:', error);
    res.status(500).json({ error: 'Analysis failed', details: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// Health check endpoint for Render
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/api/history', async (req, res) => {
  try {
    const scans = await Scan.find().sort({ timestamp: -1 }).limit(10);
    res.json(scans);
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Failed to fetch history', details: error.message });
  }
});

// Batch analysis endpoint - Multimodal reasoning across all files together
// IMPORTANT: This endpoint analyzes ALL files TOGETHER in a single multimodal request
// Returns ONE unified result, not individual file results
app.post('/api/analyze-batch', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const { claim } = req.body;
    
    if (!claim || claim.trim() === '') {
      return res.status(400).json({ error: 'Claim is required for batch analysis' });
    }

    console.log(`\n=== BATCH MULTIMODAL ANALYSIS START ===`);
    console.log(`Files count: ${req.files.length}`);
    console.log(`Files: ${req.files.map(f => f.originalname).join(', ')}`);
    console.log(`Claim: ${claim}`);
    console.log(`========================================\n`);

    // Analyze all files together using multimodal reasoning
    // This sends ALL files in ONE request to Gemini - NOT individual requests
    const result = await analyzeBatchFiles(req.files, claim);
    
    // Add metadata to result
    const filenames = req.files.map(f => f.originalname);
    result.filenames = filenames;
    result.claim = claim;
    result.batch_size = req.files.length;
    result.analysis_type = 'multimodal_batch';
    
    console.log(`\n=== BATCH ANALYSIS RESULT ===`);
    console.log(`Authenticity Score: ${result.authenticity_score}%`);
    console.log(`Risk Level: ${result.risk_level}`);
    console.log(`Verdict: ${result.verdict}`);
    console.log(`==============================\n`);
    
    // Save to MongoDB (single record for the batch - NOT individual records)
    const newScan = new Scan({
      filename: filenames.join(', '), // Store all filenames in one record
      claim: claim,
      ...result
    });
    await newScan.save();
    
    // Clean up all files
    req.files.forEach(file => {
      try {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      } catch (err) {
        console.error(`Error deleting file ${file.path}:`, err);
      }
    });

    // Return SINGLE unified result (not an array of results)
    res.json(result);
  } catch (error) {
    console.error('Error in batch analysis:', error);
    res.status(500).json({ error: 'Batch analysis failed', details: error.message });
  }
});

// PDF export endpoint - returns data for frontend to generate PDF
app.post('/api/export-pdf', async (req, res) => {
  try {
    const { analysisData } = req.body;
    
    if (!analysisData) {
      return res.status(400).json({ error: 'Analysis data required' });
    }

    // Return structured data for PDF generation
    const pdfData = {
      title: 'VeriWeave Forensic Analysis Report',
      timestamp: new Date().toISOString(),
      filename: analysisData.filename || 'Unknown',
      claim: analysisData.claim || 'No claim provided',
      authenticity_score: analysisData.authenticity_score,
      risk_level: analysisData.risk_level,
      verdict: analysisData.verdict,
      reasons: analysisData.reasons || [],
      signals: analysisData.signals || [],
      category_scores: analysisData.category_scores || {}
    };

    res.json(pdfData);
  } catch (error) {
    console.error('Error generating PDF data:', error);
    res.status(500).json({ error: 'PDF generation failed', details: error.message });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});


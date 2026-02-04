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
    - reasons: Array of 3-5 specific, high-reasoning explanations for your verdict.
    - signals: Array of 3-5 technical forensic signals detected (e.g., "Chrominance Subsampling", "Perspective Warp", "Kerning Variance", "Shadow Misalignment").
    - verdict: A single, punchy professional verdict sentence.

    JSON Template:
    {
      "authenticity_score": number,
      "risk_level": "string",
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

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});


#  VeriWeave - AI-Powered Forensic Analysis

**Multimodal Document & Media Authenticity Verification using Google Gemini 3**

[![Built for Gemini 3 Hackathon](https://img.shields.io/badge/Built%20for-Gemini%203%20Hackathon-blue)](https://gemini3.devpost.com)
[![Powered by Gemini 3 pro](https://img.shields.io/badge/Powered%20by-Gemini%203-Pro-orange)](https://deepmind.google/technologies/gemini/)

##  Overview

VeriWeave is a cutting-edge forensic analysis platform that uses Google Gemini 3's advanced multimodal reasoning to verify the authenticity of documents, images, and videos. It combines multiple analysis dimensions to provide comprehensive authenticity scores and detailed forensic reports.

**Live Demo**: [https://veri-weave.vercel.app](https://veri-weave.vercel.app)

##  Core Innovation: Batch Multimodal Analysis

###  **The Game-Changer: Cross-File Reasoning**

**Batch Multimodal Analysis** is VeriWeave's flagship feature that showcases Gemini 3's breakthrough reasoning capabilities. Unlike traditional tools that analyze files in isolation, VeriWeave sends **multiple files to Gemini 3 in a single API call**, enabling the model to perform **unified forensic reasoning across the entire document set**.

###  **How It Works**

1. **User uploads multiple files** (e.g., invoice, receipt, bank statement)
2. **All files sent together** to Gemini 3 in one API request
3. **Gemini 3 performs cross-file analysis**:
   - Detects inconsistencies across documents
   - Correlates information between files
   - Identifies patterns that only appear when files are analyzed together
   - Provides a unified authenticity conclusion

###  **Why This Matters**

**Real-World Example:**
- **Traditional Approach**: Analyze invoice → 95% authentic. Analyze receipt → 90% authentic. Analyze bank statement → 85% authentic. **Result**: All seem fine individually.
- **VeriWeave's Batch Approach**: Analyze all three together → Gemini 3 detects that invoice date doesn't match receipt date, and bank statement shows different amount. **Result**: 15% authentic - fraud detected!

**The Power**: Fraud patterns often only appear when documents are analyzed together. Gemini 3's multimodal reasoning can spot these cross-file inconsistencies that would be invisible in isolated analysis.

###  **Use Cases**

- **Invoice Fraud Detection**: Verify invoice + receipt + bank statement together
- **Document Chain Verification**: Analyze related documents as a set
- **Multi-Evidence Cases**: Cross-reference multiple pieces of evidence
- **Financial Audits**: Verify document consistency across transaction chains

---

##  Additional Features

###  Three Analysis Modes

1. **Batch Multimodal Analysis**  (Core Innovation - see above)
2. **Single Analysis**: Analyze one file with one claim
3. **Multi-Case Analysis**: Analyze multiple files, each with its own unique claim

###  Gemini 3 Integration

**Batch Multimodal Reasoning** (Primary Feature):
- Sends multiple files (images, videos, PDFs) to Gemini 3 in **one API call**
- Enables **cross-file correlation** and **unified analysis**
- Detects inconsistencies that only appear when files are analyzed together
- Demonstrates Gemini 3's advanced reasoning across multiple documents simultaneously

**Additional Capabilities**:
- **Multimodal Processing**: Analyzes images, videos, and PDFs simultaneously
- **Advanced Forensics**: Evaluates 6 dimensions:
  - Multimodal Match
  - Document Forensics
  - Visual Artifacts
  - Logical Consistency
  - Synthetic Signs
  - Shadow & Perspective

###  Features

- Real-time authenticity scoring (0-100%)
- Detailed confidence breakdown by category
- Technical forensic signals detection
- Professional PDF report export
- Analysis history tracking
- Risk level assessment (Low/Medium/High)

##  Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌──────────────┐
│   React Client  │  ──────▶│  Express Server  │  ──────▶│ Gemini 3 API │
│   (Vercel)      │          │    (Render)      │         │              │
└─────────────────┘          └──────────────────┘         └──────────────┘
                                      │
                                      ▼
                              ┌──────────────┐
                              │   MongoDB    │
                              │   Atlas      │
                              └──────────────┘
```
Gemini 3 handles multimodal reasoning while MongoDB stores analysis history and forensic reports.

##  Tech Stack

### Frontend
- **React** + **TypeScript**
- **Vite** (Build tool)
- **Tailwind CSS** (Styling)
- **Axios** (HTTP client)
- **jsPDF** (PDF generation)
- **Lucide React** (Icons)

### Backend
- **Node.js** + **Express**
- **Google Gemini 3 Pro** (`gemini-3-pro-preview`)
- **MongoDB** + **Mongoose**
- **Multer** (File uploads)
- **CORS** (Cross-origin support)

##  Installation

### Prerequisites
- Node.js (LTS version)
- MongoDB Atlas account (or local MongoDB)
- Google Gemini API key

### Backend Setup

```bash
cd server
npm install
```

Create `.env` file:
```env
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3-pro-preview
MONGODB_URI=your_mongodb_connection_string
CLIENT_ORIGIN=https://veri-weave.vercel.app,http://localhost:5173
PORT=5000
```

Start server:
```bash
npm start
```

### Frontend Setup

```bash
cd client
npm install
```

Create `.env` file:
```env
VITE_API_BASE_URL=http://localhost:5000
```

Start dev server:
```bash
npm run dev
```

##  Gemini 3 Integration Details

### Model Used
- **Model**: `gemini-3-pro-preview`
- **API Version**: v1beta

### Key Implementation

#### 1. **Batch Multimodal Analysis**  (Core Innovation)

**The Innovation**: Send multiple files to Gemini 3 in a single API call for unified cross-file reasoning.

```javascript
// Traditional approach (analyzes files separately):
// file1 → Gemini → result1
// file2 → Gemini → result2
// file3 → Gemini → result3
// Problem: Can't detect cross-file inconsistencies

// VeriWeave's batch approach (analyzes files together):
const contentArray = [prompt, file1Data, file2Data, file3Data];
const result = await model.generateContent(contentArray);
// Gemini 3 analyzes ALL files together, detecting:
// - Date mismatches across documents
// - Amount inconsistencies
// - Format variations
// - Cross-file fraud patterns
```

**What Makes This Special**:
- **Single API Call**: All files processed together, not sequentially
- **Cross-File Reasoning**: Gemini 3 can correlate information across files
- **Unified Analysis**: One comprehensive result instead of multiple isolated results
- **Fraud Detection**: Catches inconsistencies that only appear when documents are analyzed together

**Example Prompt Structure**:
```
"Analyze these 3 files TOGETHER:
- File 1: Invoice dated Jan 15, 2024 for $500
- File 2: Receipt dated Jan 20, 2024 for $500
- File 3: Bank statement showing $500 transaction on Jan 18, 2024

Perform MULTIMODAL REASONING across all files:
- Do the dates align logically?
- Do the amounts match?
- Are there inconsistencies that suggest fraud?
- Provide a UNIFIED analysis of the entire document set."
```

#### 2. **Single File Analysis**

```javascript
const result = await model.generateContent([prompt, fileData]);
```

#### 3. **Structured Output**

Gemini 3 returns comprehensive JSON with:
- Authenticity score (0-100)
- Risk level (Low/Medium/High)
- Category scores (6 dimensions)
- Reasons (detailed explanations referencing multiple files in batch mode)
- Signals (technical forensic markers)
- Verdict (professional conclusion)

## Demo Video

https://youtu.be/gQ0ck0WpiQs

##  Use Cases

###  **Batch Multimodal Analysis Use Cases** (Primary Feature)

1. **Invoice Fraud Detection**:
   - Upload: Invoice + Receipt + Bank Statement
   - Gemini 3 analyzes all three together
   - Detects: Date mismatches, amount inconsistencies, cross-file fraud patterns
   - **Impact**: Prevents financial fraud by catching inconsistencies invisible in isolated analysis

2. **Document Chain Verification**:
   - Upload: Contract + Supporting Documents + Related Evidence
   - Gemini 3 performs unified analysis across the chain
   - Detects: Contradictions, inconsistencies, tampering patterns
   - **Impact**: Ensures document integrity across related files

3. **Financial Audit Trail**:
   - Upload: Multiple transaction documents
   - Gemini 3 correlates information across all documents
   - Detects: Missing links, inconsistent data, audit trail breaks
   - **Impact**: Comprehensive audit verification in one analysis

4. **Multi-Evidence Case Analysis**:
   - Upload: Multiple pieces of evidence (images, documents, videos)
   - Gemini 3 performs cross-evidence reasoning
   - Detects: Contradictions, correlations, unified authenticity
   - **Impact**: Comprehensive evidence verification

###  **Additional Use Cases**

- **Single Document Verification**: Check individual documents for tampering
- **Deepfake Detection**: Analyze videos for synthetic manipulation
- **Media Forensics**: Verify authenticity of images and videos

##  Third-Party Integrations

This project uses the following third-party services and libraries:

- **MongoDB Atlas**: Database hosting service (free tier)
- **jsPDF**: Open source PDF generation library (MIT license)
- **Standard npm packages**: React, Express, TypeScript, Tailwind CSS, etc. (all open source)
- **Vercel**: Frontend hosting (free tier)
- **Render**: Backend hosting (free tier)

All third-party tools are open source or free tier services with no commercial restrictions or conflicts of interest. All dependencies are properly licensed and authorized for use.

##  Hackathon Submission

**Built for**: Google DeepMind Gemini 3 Hackathon

**Submission Requirements**:
- ✅ Public Project Link: `https://veri-weave.vercel.app`
- ✅ Public Code Repository: https://github.com/shekar-m/VeriWeave
- ⏳ Demo Video: https://youtu.be/gQ0ck0WpiQs
- ✅ Gemini Integration Description: See `GEMINI_INTEGRATION_DESCRIPTION.md`

##  License

ISC

##  Authors

**Shekar Myakala**  
Software Engineer

##  Acknowledgments

- Google DeepMind for Gemini 3 API
- Devpost for hosting the hackathon

---

**Built with love for the Gemini 3 Hackathon**

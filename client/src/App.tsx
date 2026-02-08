import React, { useState } from 'react';
import axios from 'axios';
import { Upload, ShieldCheck, AlertTriangle, CheckCircle, Info, Loader2, FileText, Image as ImageIcon, Video, Zap, History, X, Download, Files, FileStack } from 'lucide-react';
import jsPDF from 'jspdf';

interface AnalysisResult {
  authenticity_score: number;
  risk_level: 'Low' | 'Medium' | 'High';
  reasons: string[];
  signals: string[];
  verdict: string;
  timestamp?: string;
  filename?: string;
  filenames?: string[]; // For batch multimodal analysis
  claim?: string;
  category_scores?: {
    multimodal_match?: number;
    document_forensics?: number;
    visual_artifacts?: number;
    logical_consistency?: number;
    synthetic_signs?: number;
    shadow_perspective?: number;
  };
}

function App() {
  const API_BASE_URL =
    (import.meta as any).env?.VITE_API_BASE_URL?.toString()?.replace(/\/$/, '') ||
    'http://localhost:5000';

  const [file, setFile] = useState<File | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [fileClaims, setFileClaims] = useState<{ [key: string]: string }>({});
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [claim, setClaim] = useState('');
  const [loading, setLoading] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [multiCaseLoading, setMultiCaseLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [batchResults, setBatchResults] = useState<AnalysisResult[]>([]);
  const [multiCaseResults, setMultiCaseResults] = useState<AnalysisResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<AnalysisResult[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [isMultiCaseMode, setIsMultiCaseMode] = useState(false);

  // Fetch history on mount
  React.useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/history`);
      setHistory(response.data);
    } catch (err) {
      console.error("Failed to fetch history", err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      // Validation
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('File size too large. Please upload a file smaller than 10MB.');
        return;
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'application/pdf'];
      if (!allowedTypes.includes(selectedFile.type)) {
        setError('Unsupported file type. Please upload a JPG, PNG, WEBP, MP4, or PDF.');
        return;
      }

      // Clear previous results when starting new analysis
      setResult(null);
      setError(null);
      setFile(selectedFile);

      // Create preview URL
      if (selectedFile.type.startsWith('image/') || selectedFile.type.startsWith('video/')) {
        const url = URL.createObjectURL(selectedFile);
        setPreviewUrl(url);
      } else {
        setPreviewUrl(null); // No preview for PDFs in this MVP
      }
    }
  };

  const handleNewAnalysis = () => {
    setFile(null);
    setFiles([]);
    setFileClaims({});
    setPreviewUrl(null);
    setClaim('');
    setResult(null);
    setBatchResults([]);
    setMultiCaseResults([]);
    setError(null);
    setSelectedHistoryId(null);
    setIsBatchMode(false);
    setIsMultiCaseMode(false);
  };

  const handleHistoryClick = (item: AnalysisResult, index: number) => {
    // Load the selected history record
    setResult(item);
    // Clear current file since we don't have the original file
    setFile(null);
    setPreviewUrl(null);
    // Set the claim from the history record if available
    if (item.claim) {
      setClaim(item.claim);
    }
    // Mark this history item as selected
    setSelectedHistoryId(`${item.filename}-${item.timestamp || index}`);
  };

  const setSampleData = (type: 'authentic' | 'manipulated' | 'ai') => {
    setResult(null);
    setError(null);
    if (type === 'authentic') {
      setClaim("This is a standard Amazon invoice for a Kindle purchase.");
    } else if (type === 'manipulated') {
      setClaim("I received this bill but the total amount looks edited compared to the line items.");
    } else {
      setClaim("This video shows a CEO making a statement, but the lip-sync looks off.");
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    // Clear previous results when starting new analysis
    setResult(null);
    setSelectedHistoryId(null);
    setLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('claim', claim);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/analyze`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      // Ensure filename is set from the uploaded file (use server response or fallback to uploaded file name)
      const resultData = {
        ...response.data,
        filename: response.data.filename || file.name || 'Uploaded File'
      };
      setResult(resultData);
      fetchHistory(); // Refresh history list
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to analyze file. Please check your connection and API key.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      if (selectedFiles.length > 10) {
        setError('Maximum 10 files allowed for batch analysis.');
        return;
      }
      setFiles(selectedFiles);
      // Initialize claims for each file (for multi-case mode)
      if (isMultiCaseMode) {
        const newClaims: { [key: string]: string } = {};
        selectedFiles.forEach((f) => {
          newClaims[f.name] = '';
        });
        setFileClaims(newClaims);
      }
      setError(null);
    }
  };

  const updateFileClaim = (fileName: string, claimText: string) => {
    setFileClaims({ ...fileClaims, [fileName]: claimText });
  };

  const handleMultiCaseUpload = async () => {
    if (files.length === 0) return;

    // Check if all files have claims
    const missingClaims = files.filter(f => !fileClaims[f.name] || fileClaims[f.name].trim() === '');
    if (missingClaims.length > 0) {
      setError(`Please provide claims for all files. Missing: ${missingClaims.map(f => f.name).join(', ')}`);
      return;
    }

    setMultiCaseLoading(true);
    setError(null);
    setMultiCaseResults([]);

    const results: AnalysisResult[] = [];

    // Process files sequentially with their individual claims
    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('claim', fileClaims[file.name]);

        const response = await axios.post(`${API_BASE_URL}/api/analyze`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        
        results.push({
          ...response.data,
          filename: file.name,
          claim: fileClaims[file.name]
        });
      } catch (err: any) {
        console.error(`Error analyzing ${file.name}:`, err);
        results.push({
          filename: file.name,
          authenticity_score: 0,
          risk_level: 'High',
          reasons: [`Error: ${err.response?.data?.error || 'Analysis failed'}`],
          signals: [],
          verdict: 'Analysis failed for this file',
          claim: fileClaims[file.name]
        });
      }
    }

    setMultiCaseResults(results);
    fetchHistory();
    setMultiCaseLoading(false);
  };

  const handleBatchUpload = async () => {
    if (files.length === 0) return;

    setBatchLoading(true);
    setError(null);
    setBatchResults([]);
    setResult(null); // Clear single result when batch is active
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });
    formData.append('claim', claim);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/analyze-batch`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      //console.log('Batch response:', response.data); // Debug log
      
      if (response.data) {
        let batchResult = response.data;
        //console.log('Batch response received:', batchResult); // Debug log
        
        // Handle old format: if response has 'results' array, use the first result or combine them
        if (batchResult.results && Array.isArray(batchResult.results) && batchResult.results.length > 0) {
          console.warn('Received old format with results array, converting to unified result');
          
          // If we have individual results, create a unified result by averaging/combining
          const results = batchResult.results;
          const avgScore = Math.round(results.reduce((sum: number, r: any) => sum + (r.authenticity_score || 0), 0) / results.length);
          const allReasons = results.flatMap((r: any) => r.reasons || []);
          const allSignals = results.flatMap((r: any) => r.signals || []);
          const allFilenames = results.map((r: any) => r.filename).filter(Boolean);
          
          // Calculate average category scores
          const avgCategoryScores = {
            multimodal_match: Math.round(results.reduce((sum: number, r: any) => sum + (r.category_scores?.multimodal_match || 0), 0) / results.length),
            document_forensics: Math.round(results.reduce((sum: number, r: any) => sum + (r.category_scores?.document_forensics || 0), 0) / results.length),
            visual_artifacts: Math.round(results.reduce((sum: number, r: any) => sum + (r.category_scores?.visual_artifacts || 0), 0) / results.length),
            logical_consistency: Math.round(results.reduce((sum: number, r: any) => sum + (r.category_scores?.logical_consistency || 0), 0) / results.length),
            synthetic_signs: Math.round(results.reduce((sum: number, r: any) => sum + (r.category_scores?.synthetic_signs || 0), 0) / results.length),
            shadow_perspective: Math.round(results.reduce((sum: number, r: any) => sum + (r.category_scores?.shadow_perspective || 0), 0) / results.length)
          };
          
          // Determine risk level from average score
          const riskLevel = avgScore >= 70 ? 'Low' : avgScore >= 40 ? 'Medium' : 'High';
          
          // Create unified result
          batchResult = {
            authenticity_score: avgScore,
            risk_level: riskLevel,
            verdict: `Unified analysis of ${results.length} file${results.length !== 1 ? 's' : ''}: ${results.map((r: any) => r.verdict).join(' | ')}`,
            reasons: allReasons.slice(0, 7), // Limit to 7 reasons
            signals: [...new Set(allSignals)].slice(0, 7), // Remove duplicates, limit to 7
            category_scores: avgCategoryScores,
            filenames: allFilenames.length > 0 ? allFilenames : files.map(f => f.name),
            claim: claim,
            batch_size: results.length,
            analysis_type: 'multimodal_batch_combined'
          };
          
          //console.log('Converted to unified result:', batchResult);
        } else {
          // New format: single unified result
          // Ensure all required fields are present
          if (typeof batchResult.authenticity_score !== 'number' || batchResult.authenticity_score === 0) {
            // Only use default if it's truly missing, not if it's 0 from a valid analysis
            if (batchResult.authenticity_score === undefined || batchResult.authenticity_score === null) {
              console.warn('Missing authenticity_score, using 0');
              batchResult.authenticity_score = 0;
            }
          }
          
          if (!batchResult.risk_level || batchResult.risk_level === 'High' && batchResult.authenticity_score > 39) {
            const score = batchResult.authenticity_score;
            batchResult.risk_level = score >= 70 ? 'Low' : score >= 40 ? 'Medium' : 'High';
          }
          
          if (!batchResult.verdict || batchResult.verdict === 'Analysis completed. Review details for specific findings.') {
            if (batchResult.authenticity_score > 0) {
              batchResult.verdict = `Unified multimodal analysis completed with ${batchResult.authenticity_score}% authenticity score.`;
            }
          }
          
          if (!Array.isArray(batchResult.reasons) || batchResult.reasons.length === 0 || 
              (batchResult.reasons.length === 1 && batchResult.reasons[0] === 'Multimodal analysis completed across all files.')) {
            batchResult.reasons = batchResult.reasons && batchResult.reasons.length > 0 
              ? batchResult.reasons 
              : ['Multimodal analysis completed across all files.'];
          }
          
          if (!Array.isArray(batchResult.signals) || batchResult.signals.length === 0 ||
              (batchResult.signals.length === 1 && batchResult.signals[0] === 'Cross-file analysis performed.')) {
            batchResult.signals = batchResult.signals && batchResult.signals.length > 0
              ? batchResult.signals
              : ['Cross-file analysis performed.'];
          }
          
          if (!batchResult.category_scores || Object.values(batchResult.category_scores).every(v => v === 0)) {
            const score = batchResult.authenticity_score || 0;
            batchResult.category_scores = {
              multimodal_match: score,
              document_forensics: score,
              visual_artifacts: score,
              logical_consistency: score,
              synthetic_signs: score,
              shadow_perspective: score
            };
          }
          
          // Ensure filenames are set
          if (!batchResult.filenames || batchResult.filenames.length === 0) {
            batchResult.filenames = files.map(f => f.name);
          }
        }
        
        setBatchResults([batchResult]);
        //console.log('Batch results set successfully:', batchResult);
      } else {
        console.error('No data in response:', response);
        setError('No data received from server');
      }
      fetchHistory();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to analyze files. Please check your connection and API key.');
      console.error('Batch upload error:', err);
    } finally {
      setBatchLoading(false);
    }
  };

  const exportToPDF = () => {
    if (!result) return;

    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const footerHeight = 15; // Space reserved for footer/watermark
    const maxContentWidth = pageWidth - 2 * margin; // Maximum content width
    let yPos = margin;

    // Helper function to sanitize text for PDF (fixes Unicode/special character issues)
    const sanitizeTextForPDF = (text: string): string => {
      if (!text) return '';
      
      // Replace common currency symbols and special characters with ASCII equivalents
      let sanitized = text
        .replace(/₹/g, 'Rs.')
        .replace(/€/g, 'EUR')
        .replace(/£/g, 'GBP')
        .replace(/¥/g, 'JPY')
        .replace(/¹/g, 'Rs.')
        .replace(/²/g, '')
        .replace(/³/g, '')
        .replace(/–/g, '-')
        .replace(/—/g, '-')
        .replace(/"|"/g, '"')
        .replace(/'|'/g, "'")
        .replace(/…/g, '...');
      
      
      sanitized = sanitized.replace(/[^\x00-\x7F]/g, '?');
      
      return sanitized;
    };

    // Helper function to check if we need a new page
    const checkPageBreak = (requiredSpace: number) => {
      if (yPos + requiredSpace > pageHeight - footerHeight) {
        pdf.addPage();
        yPos = margin;
        return true;
      }
      return false;
    };

    // Title
    pdf.setFontSize(20);
    pdf.setTextColor(37, 99, 235);
    const titleLines = pdf.splitTextToSize('VeriWeave Forensic Analysis Report', maxContentWidth);
    pdf.text(titleLines, margin, yPos);
    yPos += titleLines.length * 8 + 5;

    // Timestamp
    pdf.setFontSize(10);
    pdf.setTextColor(100, 100, 100);
    pdf.text(`Generated: ${new Date().toLocaleString()}`, margin, yPos);
    yPos += 10;

    // File info - with wrapping
    pdf.setFontSize(12);
    pdf.setTextColor(0, 0, 0);
    
    // Handle filename display - support both single file and batch filenames
    let filenameDisplay = 'Unknown';
    if (result.filenames && result.filenames.length > 0) {
      // Batch analysis - show all filenames
      filenameDisplay = result.filenames.length === 1 
        ? result.filenames[0]
        : `${result.filenames.length} files: ${result.filenames.join(', ')}`;
    } else if (result.filename) {
      // Single file
      filenameDisplay = result.filename;
    }
    
    const filenameText = `File${result.filenames && result.filenames.length > 1 ? 's' : ''}: ${sanitizeTextForPDF(filenameDisplay)}`;
    const filenameLines = pdf.splitTextToSize(filenameText, maxContentWidth);
    pdf.text(filenameLines, margin, yPos);
    yPos += filenameLines.length * 6 + 5;

    const claimText = `Claim: ${sanitizeTextForPDF(result.claim || 'No claim provided')}`;
    const claimLines = pdf.splitTextToSize(claimText, maxContentWidth);
    pdf.text(claimLines, margin, yPos);
    yPos += claimLines.length * 6 + 5;

    // Score
    checkPageBreak(15);
    pdf.setFontSize(16);
    pdf.setTextColor(37, 99, 235);
    pdf.text(`Authenticity Score: ${result.authenticity_score}%`, margin, yPos);
    yPos += 10;
    pdf.setFontSize(12);
    pdf.setTextColor(0, 0, 0);
    pdf.text(`Risk Level: ${result.risk_level}`, margin, yPos);
    yPos += 10;

    // Verdict - with wrapping
    checkPageBreak(20);
    pdf.setFontSize(12);
    pdf.setTextColor(0, 0, 0);
    const verdictText = `Verdict: ${sanitizeTextForPDF(result.verdict)}`;
    const verdictLines = pdf.splitTextToSize(verdictText, maxContentWidth);
    pdf.text(verdictLines, margin, yPos);
    yPos += verdictLines.length * 7 + 8;

    // Category Scores
    if (result.category_scores) {
      checkPageBreak(50);
      pdf.setFontSize(14);
      pdf.setTextColor(37, 99, 235);
      pdf.text('Confidence Breakdown:', margin, yPos);
      yPos += 8;
      pdf.setFontSize(10);
      pdf.setTextColor(0, 0, 0);
      
      const categories = [
        { key: 'multimodal_match', label: 'Multimodal Match' },
        { key: 'document_forensics', label: 'Document Forensics' },
        { key: 'visual_artifacts', label: 'Visual Artifacts' },
        { key: 'logical_consistency', label: 'Logical Consistency' },
        { key: 'synthetic_signs', label: 'Synthetic Signs' },
        { key: 'shadow_perspective', label: 'Shadow & Perspective' }
      ];

      categories.forEach((cat) => {
        const score = result.category_scores?.[cat.key as keyof typeof result.category_scores] || 0;
        pdf.text(`${cat.label}: ${score}%`, margin + 5, yPos);
        yPos += 6;
      });
      yPos += 5;
    }

    // Helper function to highlight risky words in bold
    const highlightRiskyWords = (text: string): Array<{text: string, bold: boolean}> => {
      const riskyWords = [
        'fraud', 'tampered', 'tampering', 'inconsistent', 'inconsistency', 'mismatch', 'mismatched',
        'suspicious', 'suspicion', 'fake', 'falsified', 'manipulated', 'manipulation', 'altered',
        'forged', 'forgery', 'discrepancy', 'discrepancies', 'contradiction', 'contradictory',
        'invalid', 'illegitimate', 'unauthorized', 'high risk', 'low score', 'failed', 'failure',
        'error', 'warning', 'alert', 'critical', 'danger', 'dangerous', 'unverified', 'unauthentic'
      ];
      
      const words = text.split(/(\s+)/);
      const result: Array<{text: string, bold: boolean}> = [];
      
      words.forEach(word => {
        const lowerWord = word.toLowerCase().replace(/[.,!?;:]/g, '');
        const isRisky = riskyWords.some(risky => lowerWord.includes(risky.toLowerCase()));
        result.push({ text: word, bold: isRisky });
      });
      
      return result;
    };

    // Helper function to render text with bold highlighting
    const renderTextWithBold = (text: string, x: number, y: number, maxWidth: number): number => {
      const parts = highlightRiskyWords(text);
      let currentX = x;
      let currentY = y;
      const lineHeight = 7; 
      const currentFontSize = pdf.getFontSize();
      
      parts.forEach((part) => {
        const isSpace = /^\s+$/.test(part.text);
        
        // Set font style before measuring width
        if (part.bold && !isSpace) {
          pdf.setFont('helvetica', 'bold');
        } else {
          pdf.setFont('helvetica', 'normal');
        }
        pdf.setFontSize(currentFontSize); 
        
        const wordWidth = pdf.getTextWidth(part.text);
        
        // Check if we need a new line (with some margin for safety)
        if (currentX + wordWidth > x + maxWidth - 2 && !isSpace && currentX > x) {
          currentX = x;
          currentY += lineHeight;
        }
        
        pdf.text(part.text, currentX, currentY);
        currentX += wordWidth;
      });
      
     
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(currentFontSize);
      
      return currentY + lineHeight;
    };

    // Reasons - with wrapping and page breaks
    checkPageBreak(20);
    pdf.setFontSize(16);
    pdf.setTextColor(37, 99, 235);
    pdf.text('Analysis Reasons:', margin, yPos);
    yPos += 10; 
    pdf.setFontSize(11); 
    pdf.setTextColor(0, 0, 0);
    
    result.reasons.forEach((reason, index) => {
      const reasonText = `${index + 1}. ${sanitizeTextForPDF(reason)}`;
      const reasonLines = pdf.splitTextToSize(reasonText, maxContentWidth - 5);
      const requiredSpace = reasonLines.length * 7 + 4; 
      
      if (checkPageBreak(requiredSpace)) {
        // If we added a new page, add a small header continuation note
        pdf.setFontSize(9);
        pdf.setTextColor(100, 100, 100);
        pdf.text('(continued)', margin, yPos);
        yPos += 5;
        pdf.setFontSize(11);
        pdf.setTextColor(0, 0, 0);
      }
      
     
      let startY = yPos;
      reasonLines.forEach((line: string) => {
        const finalY = renderTextWithBold(line, margin + 5, startY, maxContentWidth - 5);
        startY = finalY;
      });
      yPos = startY + 2;
    });
    yPos += 5;

    // Signals - with wrapping
    checkPageBreak(20);
    pdf.setFontSize(16);
    pdf.setTextColor(37, 99, 235);
    pdf.text('Technical Signals:', margin, yPos);
    yPos += 10;
    pdf.setFontSize(11);
    pdf.setTextColor(0, 0, 0);
    
    result.signals.forEach((signal) => {
      const signalText = `• ${sanitizeTextForPDF(signal)}`;
      const signalLines = pdf.splitTextToSize(signalText, maxContentWidth - 5);
      const requiredSpace = signalLines.length * 7;
      
      if (checkPageBreak(requiredSpace)) {
        pdf.setFontSize(9);
        pdf.setTextColor(100, 100, 100);
        pdf.text('(continued)', margin, yPos);
        yPos += 5;
        pdf.setFontSize(11);
        pdf.setTextColor(0, 0, 0);
      }
      
     
      let startY = yPos;
      signalLines.forEach((line: string) => {
        const finalY = renderTextWithBold(line, margin + 5, startY, maxContentWidth - 5);
        startY = finalY;
      });
      yPos = startY + 2;
    });

    // Add footer/watermark on all pages
    const totalPages = pdf.internal.pages.length - 1; // jsPDF uses 1-indexed pages, but array is 0-indexed
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150); // Lighter color for watermark
      const footerText = 'VeriWeave - AI-Powered Forensic Analysis | Powered by Gemini 3';
      const footerX = pageWidth / 2; // Center the footer
      const footerY = pageHeight - 8; // Position above bottom margin
      pdf.text(footerText, footerX, footerY, { align: 'center' });
    }

    // Generate PDF filename
    let pdfFilename = 'veriweave-report';
    if (result.filenames && result.filenames.length > 0) {
      // Use first filename for batch, or create a batch name
      pdfFilename = result.filenames.length === 1 
        ? `veriweave-report-${result.filenames[0].replace(/[^a-z0-9]/gi, '-').toLowerCase()}`
        : `veriweave-report-batch-${result.filenames.length}-files`;
    } else if (result.filename) {
      pdfFilename = `veriweave-report-${result.filename.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`;
    } else {
      pdfFilename = 'veriweave-report-analysis';
    }
    pdf.save(`${pdfFilename}-${Date.now()}.pdf`);
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'Low': return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'Medium': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 'High': return 'text-red-400 bg-red-400/10 border-red-400/20';
      default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
    }
  };

  const getRiskStatus = (score: number) => {
    if (score >= 80) return { 
      label: 'AUTHENTIC', 
      icon: <ShieldCheck className="h-6 w-6" />,
      desc: 'No significant anomalies detected. Visual and textual evidence align with known authentic patterns.'
    };
    if (score >= 50) return { 
      label: 'SUSPICIOUS', 
      icon: <Info className="h-6 w-6" />,
      desc: 'Minor structural or metadata inconsistencies detected. Exercise caution before proceeding.'
    };
    return { 
      label: 'TAMPERED', 
      icon: <AlertTriangle className="h-6 w-6" />,
      desc: 'High-probability of synthetic manipulation or manual tampering detected in artifacts.'
    };
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 py-12 px-4 sm:px-6 lg:px-8 font-sans w-full">
      <div className="max-w-5xl mx-auto">
        <header className="text-center mb-12">
          <div className="flex justify-center items-center mb-4">
            <ShieldCheck className="h-14 w-14 text-blue-500 mr-3" />
            <h1 className="text-5xl font-black tracking-tight text-white sm:text-6xl italic uppercase">
              Veri<span className="text-blue-500">Weave</span>
            </h1>
          </div>
          <p className="mt-3 text-xl text-slate-400 max-w-2xl mx-auto flex items-center justify-center gap-2">
            <span className="bg-blue-500/10 text-blue-500 px-3 py-1 rounded-full text-xs font-bold border border-blue-500/20 uppercase tracking-widest">Multimodal Reasoning</span>
            Detecting AI-manipulated documents, images, and videos.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Upload & Input */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-slate-900/50 rounded-3xl p-6 border border-slate-800 backdrop-blur-sm shadow-2xl">
              <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-bold text-white flex items-center">
                    <Upload className="h-4 w-4 mr-2 text-blue-500" />
                    1. Submit Evidence
                  </h2>
                  {(result || file || files.length > 0) && (
                    <button 
                      onClick={handleNewAnalysis}
                      className="p-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-[10px] font-bold text-red-400 uppercase tracking-tighter transition-colors flex items-center"
                      title="Start New Analysis"
                    >
                      <X className="h-3.5 w-3.5 mr-1.5" />
                      New
                    </button>
                  )}
                </div>
                
                {/* Mode Selector */}
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                    Analysis Mode
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button 
                      onClick={() => {
                        setIsBatchMode(false);
                        setIsMultiCaseMode(false);
                        setFile(null);
                        setFiles([]);
                        setFileClaims({});
                        setPreviewUrl(null);
                        setResult(null);
                        setBatchResults([]);
                        setMultiCaseResults([]);
                      }}
                      className={`py-2.5 px-3 rounded-lg text-[10px] font-bold uppercase tracking-tight transition-all flex items-center justify-center ${
                        !isBatchMode && !isMultiCaseMode
                          ? 'bg-slate-700 border-2 border-slate-500 text-white shadow-lg' 
                          : 'bg-slate-800/50 border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-300'
                      }`}
                      title="Single File Analysis"
                    >
                      <FileText className="h-3.5 w-3.5 mr-1.5" />
                      Single
                    </button>
                    <button 
                      onClick={() => {
                        setIsBatchMode(true);
                        setIsMultiCaseMode(false);
                        setFile(null);
                        setFiles([]);
                        setFileClaims({});
                        setPreviewUrl(null);
                        setResult(null);
                        setBatchResults([]);
                        setMultiCaseResults([]);
                      }}
                      className={`py-2.5 px-3 rounded-lg text-[10px] font-bold uppercase tracking-tight transition-all flex items-center justify-center ${
                        isBatchMode
                          ? 'bg-blue-500/20 border-2 border-blue-500 text-blue-400 shadow-lg shadow-blue-500/20' 
                          : 'bg-slate-800/50 border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-300'
                      }`}
                      title="Batch Analysis - Same claim for all files"
                    >
                      <Files className="h-3.5 w-3.5 mr-1.5" />
                      Batch
                    </button>
                    <button 
                      onClick={() => {
                        setIsBatchMode(false);
                        setIsMultiCaseMode(true);
                        setFile(null);
                        setFiles([]);
                        setFileClaims({});
                        setPreviewUrl(null);
                        setResult(null);
                        setBatchResults([]);
                        setMultiCaseResults([]);
                      }}
                      className={`py-2.5 px-3 rounded-lg text-[10px] font-bold uppercase tracking-tight transition-all flex items-center justify-center ${
                        isMultiCaseMode
                          ? 'bg-purple-500/20 border-2 border-purple-500 text-purple-400 shadow-lg shadow-purple-500/20' 
                          : 'bg-slate-800/50 border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-300'
                      }`}
                      title="Multi-Case Analysis - Different claim per file"
                    >
                      <FileStack className="h-3.5 w-3.5 mr-1.5" />
                      Multi-Case
                    </button>
                  </div>
                </div>

                {/* Sample Data Buttons - Only show in Single mode */}
                {!isBatchMode && !isMultiCaseMode && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                      Quick Samples
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => setSampleData('authentic')}
                        className="py-2.5 px-3 rounded-lg text-[10px] font-bold uppercase tracking-tight transition-all flex items-center justify-center bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 hover:border-green-500/50"
                        title="Load Authentic Sample"
                      >
                        <ImageIcon className="h-3.5 w-3.5 mr-1.5" />
                        Real
                      </button>
                      <button 
                        onClick={() => setSampleData('manipulated')}
                        className="py-2.5 px-3 rounded-lg text-[10px] font-bold uppercase tracking-tight transition-all flex items-center justify-center bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 hover:border-red-500/50"
                        title="Load Manipulated Sample"
                      >
                        <Video className="h-3.5 w-3.5 mr-1.5" />
                        Fake
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="space-y-4">
                {!isMultiCaseMode && (
                  <div className="relative">
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Claim (Context)</label>
                    <textarea
                      value={claim}
                      onChange={(e) => setClaim(e.target.value)}
                      placeholder="e.g. 'Standard Amazon invoice...'"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all h-20 resize-none"
                    />
                  </div>
                )}

                <div className="relative">
                  {isMultiCaseMode ? (
                    <>
                      {files.length === 0 ? (
                        <div className="border-2 border-dashed border-slate-700 rounded-2xl p-6 flex flex-col items-center justify-center transition-all hover:border-purple-500/50 hover:bg-purple-500/5 group">
                          <Files className="h-8 w-8 text-slate-500 mb-3 group-hover:text-purple-500 transition-colors" />
                          <label className="cursor-pointer text-center">
                            <span className="text-purple-500 font-bold text-md block mb-1 underline-offset-4 hover:underline">Multi-Case Upload</span>
                            <input type="file" className="hidden" onChange={handleBatchFileChange} accept="image/*,video/*,.pdf" multiple />
                            <p className="text-[9px] text-slate-600 max-w-[150px] mx-auto leading-tight">
                              Select multiple files (Max 10)
                            </p>
                          </label>
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                          {files.map((f, idx) => (
                            <div key={idx} className="bg-slate-950 border border-slate-700 rounded-xl p-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-bold text-slate-300 truncate flex-1">{f.name}</span>
                                <button 
                                  onClick={() => {
                                    const newFiles = files.filter((_, i) => i !== idx);
                                    setFiles(newFiles);
                                    const newClaims = { ...fileClaims };
                                    delete newClaims[f.name];
                                    setFileClaims(newClaims);
                                  }} 
                                  className="bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 hover:text-red-300 p-1 rounded transition-colors flex items-center justify-center ml-2"
                                  title="Remove file"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              <textarea
                                value={fileClaims[f.name] || ''}
                                onChange={(e) => updateFileClaim(f.name, e.target.value)}
                                placeholder={`Claim for ${f.name}...`}
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-[10px] focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all h-16 resize-none"
                              />
                            </div>
                          ))}
                          <button
                            onClick={() => {
                              setFiles([]);
                              setFileClaims({});
                            }}
                            className="w-full text-[10px] text-slate-500 hover:text-slate-400"
                          >
                            Clear All
                          </button>
                        </div>
                      )}
                    </>
                  ) : isBatchMode ? (
                    <>
                      {files.length === 0 ? (
                        <div className="border-2 border-dashed border-slate-700 rounded-2xl p-6 flex flex-col items-center justify-center transition-all hover:border-blue-500/50 hover:bg-blue-500/5 group">
                          <Files className="h-8 w-8 text-slate-500 mb-3 group-hover:text-blue-500 transition-colors" />
                          <label className="cursor-pointer text-center">
                            <span className="text-blue-500 font-bold text-md block mb-1 underline-offset-4 hover:underline">Batch Upload</span>
                            <input type="file" className="hidden" onChange={handleBatchFileChange} accept="image/*,video/*,.pdf" multiple />
                            <p className="text-[9px] text-slate-600 max-w-[150px] mx-auto leading-tight">
                              Select multiple files (Max 10)
                            </p>
                          </label>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="bg-slate-950 border border-slate-700 rounded-xl p-3 max-h-40 overflow-y-auto">
                            {files.map((f, idx) => (
                              <div key={idx} className="flex items-center justify-between text-[10px] text-slate-400 mb-2 last:mb-0">
                                <span className="truncate flex-1">{f.name}</span>
                                <button 
                                  onClick={() => setFiles(files.filter((_, i) => i !== idx))} 
                                  className="bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 hover:text-red-300 p-1 rounded transition-colors flex items-center justify-center ml-2"
                                  title="Remove file"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                          <button
                            onClick={() => setFiles([])}
                            className="w-full text-[10px] text-slate-500 hover:text-slate-400"
                          >
                            Clear All
                          </button>
                        </div>
                      )}
                    </>
                  ) : !file ? (
                    <div className="border-2 border-dashed border-slate-700 rounded-2xl p-6 flex flex-col items-center justify-center transition-all hover:border-blue-500/50 hover:bg-blue-500/5 group">
                      <Upload className="h-8 w-8 text-slate-500 mb-3 group-hover:text-blue-500 transition-colors" />
                      <label className="cursor-pointer text-center">
                        <span className="text-blue-500 font-bold text-md block mb-1 underline-offset-4 hover:underline">Evidence Upload</span>
                        <input type="file" className="hidden" onChange={handleFileChange} accept="image/*,video/*,.pdf" />
                        <p className="text-[9px] text-slate-600 max-w-[150px] mx-auto leading-tight">
                          PDF, JPG, PNG, or MP4 (Max 10MB)
                        </p>
                      </label>
                    </div>
                  ) : (
                    <div className="relative rounded-2xl overflow-hidden border border-slate-700 bg-slate-950">
                      {previewUrl ? (
                        file.type.startsWith('image/') ? (
                          <img src={previewUrl} alt="Preview" className="w-full h-40 object-contain" />
                        ) : (
                          <video src={previewUrl} className="w-full h-40 object-contain" controls />
                        )
                      ) : (
                        <div className="w-full h-40 flex flex-col items-center justify-center text-slate-500">
                          <FileText className="h-10 w-10 mb-2" />
                          <span className="text-[10px] font-bold uppercase truncate max-w-[80%]">{file.name}</span>
                        </div>
                      )}
                      <button 
                        onClick={() => { setFile(null); setPreviewUrl(null); }}
                        className="absolute top-2 right-2 bg-red-500/80 backdrop-blur-sm text-white p-1.5 rounded-full hover:bg-red-600 transition-colors flex items-center justify-center"
                        title="Remove file"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={isMultiCaseMode ? handleMultiCaseUpload : isBatchMode ? handleBatchUpload : handleUpload}
                  disabled={
                    (isMultiCaseMode 
                      ? files.length === 0 || Object.values(fileClaims).some(c => !c || !c.trim())
                      : isBatchMode 
                        ? files.length === 0 
                        : !file) || 
                    (isMultiCaseMode ? multiCaseLoading : isBatchMode ? batchLoading : loading)
                  }
                  className={`w-full py-3.5 rounded-xl font-black text-sm uppercase tracking-[0.2em] transition-all flex items-center justify-center
                    ${
                      (isMultiCaseMode 
                        ? files.length === 0 || Object.values(fileClaims).some(c => !c || !c.trim())
                        : isBatchMode 
                          ? files.length === 0 
                          : !file) || 
                      (isMultiCaseMode ? multiCaseLoading : isBatchMode ? batchLoading : loading)
                      ? 'bg-slate-800 text-slate-600 cursor-not-allowed' 
                      : isMultiCaseMode
                      ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_20px_rgba(147,51,234,0.3)]'
                      : 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)]'
                    }`}
                >
                  {(isMultiCaseMode ? multiCaseLoading : isBatchMode ? batchLoading : loading) ? (
                    <>
                      <Loader2 className="animate-spin h-5 w-5 mr-3" />
                      AI Analyzing...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      {isMultiCaseMode 
                        ? `Analyze ${files.length} Case${files.length !== 1 ? 's' : ''}` 
                        : isBatchMode 
                          ? `Analyze ${files.length} File${files.length !== 1 ? 's' : ''}` 
                          : 'Run Analysis'}
                    </>
                  )}
                </button>
              </div>

              {error && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start animate-shake">
                  <AlertTriangle className="h-4 w-4 text-red-500 mr-2 mt-0.5 shrink-0" />
                  <p className="text-red-400 text-[10px] font-medium leading-tight">{error}</p>
                </div>
              )}
            </div>

            {/* History Section */}
            <div className="bg-slate-900/30 rounded-3xl p-6 border border-slate-800/50 backdrop-blur-sm">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center">
                <History className="h-3 w-3 mr-2" />
                Recent Audit Logs
              </h3>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {history.length === 0 ? (
                  <p className="text-[10px] text-slate-600 italic">No previous logs found.</p>
                ) : (
                  history.map((item, i) => {
                    const itemId = `${item.filename}-${item.timestamp || i}`;
                    const isSelected = selectedHistoryId === itemId;
                    return (
                      <div 
                        key={i} 
                        onClick={() => handleHistoryClick(item, i)}
                        className={`bg-slate-950/50 border rounded-lg p-2.5 transition-all cursor-pointer group active:scale-[0.98] ${
                          isSelected 
                            ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20' 
                            : 'border-slate-800 hover:border-blue-500/50 hover:bg-slate-900/50'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-[9px] font-bold text-slate-400 truncate max-w-[120px] group-hover:text-slate-300">{item.filename}</span>
                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${getRiskColor(item.risk_level)}`}>
                            {item.authenticity_score}%
                          </span>
                        </div>
                        <p className={`text-[9px] line-clamp-1 ${isSelected ? 'text-blue-300' : 'text-slate-500 group-hover:text-slate-300'}`}>{item.verdict}</p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Results & Timeline */}
          <div className="lg:col-span-8 space-y-6">
            {/* Empty State - Only show when not loading and no results */}
            {!result && !loading && !batchLoading && !multiCaseLoading && batchResults.length === 0 && multiCaseResults.length === 0 && (
              <div className="h-full min-h-[500px] border-2 border-dashed border-slate-800 rounded-3xl flex flex-col items-center justify-center text-slate-600 p-12 text-center">
                <ShieldCheck className="h-16 w-16 mb-6 opacity-20" />
                <h3 className="text-xl font-bold mb-2">Awaiting Verification</h3>
                <p className="text-sm max-w-xs">Upload a file to trigger the multimodal verification engine.</p>
              </div>
            )}

            {/* Main Loader - Show ONLY when loading, hide all results */}
            {(loading || batchLoading || multiCaseLoading) ? (
              <div className="h-full min-h-[500px] bg-slate-900/20 rounded-3xl border border-slate-800 flex flex-col items-center justify-center p-12">
                <div className="relative mb-8">
                  <div className={`h-24 w-24 border-4 rounded-full animate-spin ${
                    multiCaseLoading 
                      ? 'border-purple-500/20 border-t-purple-500' 
                      : batchLoading 
                        ? 'border-blue-500/20 border-t-blue-500'
                        : 'border-blue-500/20 border-t-blue-500'
                  }`}></div>
                  <ShieldCheck className={`h-10 w-10 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${
                    multiCaseLoading 
                      ? 'text-purple-500' 
                      : batchLoading 
                        ? 'text-blue-500'
                        : 'text-blue-500'
                  }`} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2 italic tracking-tight">Initiating Forensic Protocol</h3>
                <p className="text-slate-500 text-sm mb-6 animate-pulse">
                  {batchLoading ? `Analyzing ${files.length} file${files.length !== 1 ? 's' : ''} together with multimodal reasoning...` : 
                   multiCaseLoading ? `Analyzing ${files.length} case${files.length !== 1 ? 's' : ''}...` :
                   'Scanning metadata, typography, and visual artifacts...'}
                </p>
                <div className="w-64 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full animate-[loading_2s_ease-in-out_infinite] ${
                    multiCaseLoading 
                      ? 'bg-purple-500' 
                      : batchLoading 
                        ? 'bg-blue-500'
                        : 'bg-blue-500'
                  }`}></div>
                </div>
              </div>
            ) : (
              <>
                {result && batchResults.length === 0 && multiCaseResults.length === 0 && (
              <div className="space-y-6 animate-fade-in">
                {/* Result Hero */}
                <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-2xl relative overflow-hidden">
                  <div className="flex justify-between items-start mb-6">
                    <div className={`px-6 py-2 rounded-bl-2xl text-[10px] font-black uppercase tracking-widest ${getRiskColor(result.risk_level)}`}>
                      {getRiskStatus(result.authenticity_score).label} • {result.risk_level} RISK
                    </div>
                    <button
                      onClick={exportToPDF}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Export PDF
                    </button>
                  </div>
                  
                  <div className="flex flex-col md:flex-row items-center gap-8">
                    <div className="relative h-32 w-32 flex-shrink-0">
                      <svg className="h-32 w-32 transform -rotate-90">
                        <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-slate-800" />
                        <circle
                          cx="64"
                          cy="64"
                          r="56"
                          stroke="currentColor"
                          strokeWidth="12"
                          fill="transparent"
                          strokeDasharray={351.8}
                          strokeDashoffset={351.8 - (351.8 * result.authenticity_score) / 100}
                          className={`transition-all duration-1000 ${result.authenticity_score > 70 ? 'text-green-500' : result.authenticity_score > 40 ? 'text-yellow-500' : 'text-red-500'}`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-black text-white leading-none">{result.authenticity_score}</span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Match</span>
                      </div>
                    </div>
                    
      <div>
                      <h3 className="text-xl font-bold text-white mb-1 italic uppercase flex items-center">
                        <span className="mr-2">{getRiskStatus(result.authenticity_score).icon}</span>
                        Forensic Summary
                      </h3>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">
                        {getRiskStatus(result.authenticity_score).desc}
                      </p>
                      <p className="text-slate-300 text-lg leading-relaxed font-medium border-l-2 border-blue-500 pl-4 bg-blue-500/5 py-2 rounded-r-lg">
                        "{result.verdict}"
                      </p>
                    </div>
                  </div>
                </div>

                {/* Confidence Breakdown */}
                {result.category_scores && (
                  <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-2xl">
                    <h3 className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] mb-6">Confidence Breakdown</h3>
                    <div className="space-y-4">
                      {Object.entries(result.category_scores).map(([key, score]) => {
                        const labels: { [key: string]: string } = {
                          multimodal_match: 'Multimodal Match',
                          document_forensics: 'Document Forensics',
                          visual_artifacts: 'Visual Artifacts',
                          logical_consistency: 'Logical Consistency',
                          synthetic_signs: 'Synthetic Signs',
                          shadow_perspective: 'Shadow & Perspective'
                        };
                        return (
                          <div key={key} className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">{labels[key] || key}</span>
                              <span className="text-xs font-black text-blue-400">{score}%</span>
                            </div>
                            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-1000"
                                style={{ width: `${score}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Evidence Timeline */}
                <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-2xl">
                  <h3 className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] mb-8">Evidence Timeline</h3>
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-800"></div>
                    
                    <div className="space-y-10">
                      <div className="relative pl-12">
                        <div className="absolute left-0 h-8 w-8 bg-blue-600 rounded-full flex items-center justify-center border-4 border-[#020617] z-10">
                          <Upload className="h-3 w-3 text-white" />
                        </div>
                        <h4 className="text-white font-bold text-sm mb-1 uppercase tracking-wider">Evidence Uploaded</h4>
                        <p className="text-slate-400 text-xs">Multimodal data (File + Claim) ingested.</p>
                      </div>

                      <div className="relative pl-12">
                        <div className="absolute left-0 h-8 w-8 bg-indigo-600 rounded-full flex items-center justify-center border-4 border-[#020617] z-10">
                          <CheckCircle className="h-3 w-3 text-white" />
                        </div>
                        <h4 className="text-white font-bold text-sm mb-3 uppercase tracking-wider">Signal Extraction</h4>
                        <div className="flex flex-wrap gap-2">
                          {result.signals.map((signal, i) => (
                            <span key={i} className="bg-slate-800 text-slate-300 px-3 py-1 rounded-lg text-[10px] font-bold border border-slate-700">
                              {signal}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="relative pl-12">
                        <div className="absolute left-0 h-8 w-8 bg-purple-600 rounded-full flex items-center justify-center border-4 border-[#020617] z-10">
                          <Info className="h-3 w-3 text-white" />
                        </div>
                        <h4 className="text-white font-bold text-sm mb-3 uppercase tracking-wider">Reasoning Engine</h4>
                        <ul className="space-y-3">
                          {result.reasons.map((item, index) => (
                            <li key={index} className="text-sm text-slate-300 flex items-start leading-tight">
                              <span className="text-purple-500 mr-2">•</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="relative pl-12">
                        <div className="absolute left-0 h-8 w-8 bg-green-600 rounded-full flex items-center justify-center border-4 border-[#020617] z-10">
                          <ShieldCheck className="h-3 w-3 text-white" />
                        </div>
                        <h4 className="text-white font-bold text-sm mb-1 uppercase tracking-wider">Final Verdict</h4>
                        <p className="text-slate-400 text-xs">Authenticity score computed at {result.authenticity_score}%.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

                {/* Batch Results - Single Combined Multimodal Analysis */}
                {batchResults.length > 0 && batchResults[0] && (
                  <div className="space-y-6 animate-fade-in">
                <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-2xl">
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-white mb-2 flex items-center">
                      <Files className="h-5 w-5 mr-2 text-blue-500" />
                      Batch Multimodal Analysis
                    </h3>
                    <p className="text-xs text-slate-400 mb-2">
                      Analyzed {batchResults[0]?.filenames?.length || files.length} file{(batchResults[0]?.filenames?.length || files.length) !== 1 ? 's' : ''} together using multimodal reasoning
                    </p>
                    {batchResults[0]?.filenames && batchResults[0].filenames.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {batchResults[0].filenames.map((filename: string, idx: number) => (
                          <span key={idx} className="bg-slate-800 text-slate-400 px-2 py-1 rounded text-[10px] font-medium border border-slate-700">
                            {filename}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Display the single combined result */}
                  <div className="bg-slate-950 border border-blue-500/30 rounded-xl p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Combined Analysis Score</p>
                        <span className={`text-3xl font-black ${getRiskColor(batchResults[0].risk_level)}`}>
                          {batchResults[0].authenticity_score}%
                        </span>
                      </div>
                      <span className={`text-xs font-black px-3 py-1.5 rounded ${getRiskColor(batchResults[0].risk_level)}`}>
                        {batchResults[0].risk_level} Risk
                      </span>
                    </div>
                    {batchResults[0].verdict && (
                      <p className="text-sm text-slate-300 mb-4 italic">{batchResults[0].verdict}</p>
                    )}
                    {batchResults[0].reasons && batchResults[0].reasons.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs text-slate-400 mb-2 font-semibold">Key Findings:</p>
                        <ul className="space-y-1">
                          {batchResults[0].reasons.slice(0, 3).map((reason: string, idx: number) => (
                            <li key={idx} className="text-xs text-slate-400 flex items-start">
                              <span className="text-blue-500 mr-2">•</span>
                              <span>{reason}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <button
                      onClick={() => {
                        setResult(batchResults[0]);
                        setBatchResults([]);
                        setIsBatchMode(false);
                      }}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-colors"
                    >
                      View Full Analysis →
                    </button>
                  </div>
                </div>
              </div>
                )}

                {/* Multi-Case Results */}
                {multiCaseResults.length > 0 && (
                  <div className="space-y-6 animate-fade-in">
                <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-2xl">
                  <h3 className="text-lg font-bold text-white mb-6 flex items-center">
                    <Files className="h-5 w-5 mr-2 text-purple-500" />
                    Multi-Case Analysis Results ({multiCaseResults.length} cases)
                  </h3>
                  <div className="space-y-4">
                    {multiCaseResults.map((item, idx) => (
                      <div key={idx} className="bg-slate-950 border border-slate-800 rounded-xl p-5 hover:border-purple-500/50 transition-colors">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <h4 className="text-sm font-bold text-white mb-1">{item.filename || `Case ${idx + 1}`}</h4>
                            <p className="text-[10px] text-slate-400 mb-2">Claim: {item.claim || 'No claim'}</p>
                          </div>
                          <span className={`text-xs font-black px-3 py-1.5 rounded ${getRiskColor(item.risk_level)}`}>
                            {item.authenticity_score}%
                          </span>
                        </div>
                        <div className="mb-3">
                          <p className="text-xs text-slate-300 font-medium mb-2">Verdict:</p>
                          <p className="text-sm text-slate-400 italic">{item.verdict}</p>
                        </div>
                        <div className="flex gap-2 mb-3">
                          <div className="flex-1">
                            <p className="text-[10px] text-slate-500 mb-1">Signals:</p>
                            <div className="flex flex-wrap gap-1">
                              {item.signals.slice(0, 3).map((signal, i) => (
                                <span key={i} className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded text-[9px] border border-slate-700">
                                  {signal}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setResult(item);
                            setMultiCaseResults([]);
                            setIsMultiCaseMode(false);
                          }}
                          className="w-full text-[10px] text-purple-400 hover:text-purple-300 font-bold uppercase tracking-wider border border-purple-500/30 rounded-lg py-2 hover:bg-purple-500/10 transition-colors"
                        >
                          View Full Analysis →
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
                )}
              </>
            )}
          </div>
      </div>

        <footer className="mt-16 text-center border-t border-slate-900 pt-8 space-y-4">
          <p className="text-slate-600 text-[10px] font-medium max-w-2xl mx-auto leading-relaxed uppercase tracking-[0.1em]">
            Disclaimer: VeriWeave provides AI-assisted forensic analysis for informational purposes. While highly accurate, the results should be used as part of a broader verification workflow. Always verify high-stakes documents manually.
          </p>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2">
            <ShieldCheck className="h-3 w-3" />
            Built for the AI Era • Powered by Gemini 3
          </p>
        </footer>
      </div>

      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out forwards;
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
      `}</style>
    </div>
  );
}

export default App;

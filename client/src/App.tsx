import React, { useState } from 'react';
import axios from 'axios';
import { Upload, ShieldCheck, AlertTriangle, CheckCircle, Info, Loader2, FileText, Image as ImageIcon, Video, Zap, History, X } from 'lucide-react';

interface AnalysisResult {
  authenticity_score: number;
  risk_level: 'Low' | 'Medium' | 'High';
  reasons: string[];
  signals: string[];
  verdict: string;
  timestamp?: string;
  filename?: string;
  claim?: string;
}

function App() {
  const API_BASE_URL =
    (import.meta as any).env?.VITE_API_BASE_URL?.toString()?.replace(/\/$/, '') ||
    'http://localhost:5000';

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [claim, setClaim] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<AnalysisResult[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);

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
    setPreviewUrl(null);
    setClaim('');
    setResult(null);
    setError(null);
    setSelectedHistoryId(null);
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
      setResult(response.data);
      fetchHistory(); // Refresh history list
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to analyze file. Please check your connection and API key.');
      console.error(err);
    } finally {
      setLoading(false);
    }
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
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-white flex items-center">
                  <Upload className="h-4 w-4 mr-2 text-blue-500" />
                  1. Submit Evidence
                </h2>
                <div className="flex gap-2">
                  {(result || file) && (
                    <button 
                      onClick={handleNewAnalysis}
                      className="p-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-[9px] font-bold text-red-400 uppercase tracking-tighter transition-colors flex items-center"
                      title="Start New Analysis"
                    >
                      <X className="h-3 w-3 mr-1" />
                      New
                    </button>
                  )}
                  <button 
                    onClick={() => setSampleData('authentic')}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-[9px] font-bold text-slate-400 uppercase tracking-tighter transition-colors flex items-center"
                    title="Load Authentic Sample"
                  >
                    <ImageIcon className="h-3 w-3 mr-1" />
                    Real
                  </button>
                  <button 
                    onClick={() => setSampleData('manipulated')}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-[9px] font-bold text-slate-400 uppercase tracking-tighter transition-colors flex items-center"
                    title="Load Manipulated Sample"
                  >
                    <Video className="h-3 w-3 mr-1" />
                    Fake
                  </button>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="relative">
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Claim (Context)</label>
                  <textarea
                    value={claim}
                    onChange={(e) => setClaim(e.target.value)}
                    placeholder="e.g. 'Standard Amazon invoice...'"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all h-20 resize-none"
                  />
                </div>

                <div className="relative">
                  {!file ? (
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
                        className="absolute top-2 right-2 bg-red-500/80 backdrop-blur-sm text-white p-1 rounded-full hover:bg-red-600 transition-colors"
                      >
                        <AlertTriangle className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleUpload}
                  disabled={!file || loading}
                  className={`w-full py-3.5 rounded-xl font-black text-sm uppercase tracking-[0.2em] transition-all flex items-center justify-center
                    ${!file || loading 
                      ? 'bg-slate-800 text-slate-600 cursor-not-allowed' 
                      : 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)]'}`}
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin h-5 w-5 mr-3" />
                      AI Analyzing...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      Run Analysis
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
            {!result && !loading && (
              <div className="h-full min-h-[500px] border-2 border-dashed border-slate-800 rounded-3xl flex flex-col items-center justify-center text-slate-600 p-12 text-center">
                <ShieldCheck className="h-16 w-16 mb-6 opacity-20" />
                <h3 className="text-xl font-bold mb-2">Awaiting Verification</h3>
                <p className="text-sm max-w-xs">Upload a file to trigger the multimodal verification engine.</p>
              </div>
            )}

            {loading && (
              <div className="h-full min-h-[500px] bg-slate-900/20 rounded-3xl border border-slate-800 flex flex-col items-center justify-center p-12">
                <div className="relative mb-8">
                  <div className="h-24 w-24 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                  <ShieldCheck className="h-10 w-10 text-blue-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2 italic tracking-tight">Initiating Forensic Protocol</h3>
                <p className="text-slate-500 text-sm mb-6 animate-pulse">Scanning metadata, typography, and visual artifacts...</p>
                <div className="w-64 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 animate-[loading_2s_ease-in-out_infinite]"></div>
                </div>
              </div>
            )}

            {result && (
              <div className="space-y-6 animate-fade-in">
                {/* Result Hero */}
                <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-2xl relative overflow-hidden">
                  <div className={`absolute top-0 right-0 px-6 py-2 rounded-bl-2xl text-[10px] font-black uppercase tracking-widest ${getRiskColor(result.risk_level)}`}>
                    {getRiskStatus(result.authenticity_score).label} • {result.risk_level} RISK
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

import React, { useState, useEffect } from 'react';



const STEPS = {
    SETUP: 0,
    MODEL_LOAD: 1,
    SELECT_DRIVE: 2,
    PROCESSING: 3,
    COMPLETE: 4
};

// --- Main Application Component ---
export default function App() {
    const [step, setStep] = useState(STEPS.SETUP);
    const [logs, setLogs] = useState([]);
    const [processedCount, setProcessedCount] = useState(0);
    const [currentAction, setCurrentAction] = useState("");
    const [selectedPath, setSelectedPath] = useState(null);
    const [systemStats, setSystemStats] = useState({ memory: "--- / ---", port: "---" });

    const addLog = (msg, type = "info") => {
        setLogs(prev => [{ id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, timestamp: Date.now(), msg, type }, ...prev].slice(0, 50));
    };

    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Listen for logs from main process
        if (window.api) {
            window.api.onLog((data) => {
                addLog(data.msg, data.type);
            });
            window.api.onProcessingComplete(() => {
                setStep(STEPS.COMPLETE);
            });
            window.api.onSystemStats((stats) => {
                setSystemStats(stats);
            });

            // Auto-check for setup
            const checkSetup = async () => {
                try {
                    const check = await window.api.checkPrerequisites();
                    if (check.status === 'ready') {
                        setStep(STEPS.MODEL_LOAD);
                    }
                } catch (e) {
                    console.error("Auto-check failed:", e);
                } finally {
                    setIsLoading(false);
                }
            };
            checkSetup();
        } else {
            setIsLoading(false);
        }

        return () => {
            if (window.api) {
                window.api.removeLogListener();
                window.api.removeCompleteListener();
                window.api.removeSystemStatsListener();
            }
        };
    }, []);

    if (isLoading) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-[#09090b] text-slate-500 font-mono text-xs">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <span>System Check...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen w-screen flex flex-col bg-[#09090b] text-slate-200 overflow-hidden selection:bg-indigo-500/30">
            {/* Title Bar (Electron Style) */}
            <div className="h-10 bg-[#09090b] border-b border-white/5 flex items-center justify-between px-4 app-drag-region select-none">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                    <i className="ph-fill ph-brain text-indigo-500 text-lg"></i>
                    <span className="tracking-wide">NEUROSORT AI</span>
                    <span className="bg-white/5 px-1.5 py-0.5 rounded text-[10px] text-slate-500">v1.0.2 Local</span>
                </div>
                <div className="flex gap-2 no-drag">
                    <div className="w-3 h-3 rounded-full bg-yellow-500/20 hover:bg-yellow-500 transition-colors cursor-pointer"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500/20 hover:bg-green-500 transition-colors cursor-pointer"></div>
                    <div className="w-3 h-3 rounded-full bg-red-500/20 hover:bg-red-500 transition-colors cursor-pointer"></div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col relative overflow-hidden pb-8">
                {step === STEPS.SETUP && <SetupView onNext={() => setStep(STEPS.MODEL_LOAD)} />}
                {step === STEPS.MODEL_LOAD && <ModelLoader onComplete={() => setStep(STEPS.SELECT_DRIVE)} addLog={addLog} />}
                {step === STEPS.SELECT_DRIVE && <DriveSelection onStart={() => setStep(STEPS.PROCESSING)} addLog={addLog} selectedPath={selectedPath} setSelectedPath={setSelectedPath} />}
                {step === STEPS.PROCESSING && <ProcessingDashboard onComplete={() => setStep(STEPS.COMPLETE)} addLog={addLog} selectedPath={selectedPath} />}
                {step === STEPS.COMPLETE && <CompletionSummary onReset={() => { setStep(STEPS.SELECT_DRIVE); setSelectedPath(null); }} />}
            </div>

            {/* Status Bar */}
            <div className="fixed bottom-0 left-0 w-full h-8 bg-[#0f0f12] border-t border-white/5 flex items-center px-4 text-[10px] text-slate-500 justify-between z-50">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full 
                            ${step === STEPS.PROCESSING || step === STEPS.MODEL_LOAD ? 'bg-green-500 animate-pulse' :
                                logs.some(l => l.type === 'error') ? 'bg-red-500' :
                                    'bg-yellow-500'}`}></div>
                        {step === STEPS.PROCESSING ? "AI ENGINE ACTIVE" :
                            step === STEPS.MODEL_LOAD ? "AI ENGINE LOADING" :
                                logs.some(l => l.type === 'error') ? "AI ENGINE ERROR" :
                                    "AI ENGINE STANDBY"}
                    </div>
                    <span className="w-px h-3 bg-white/10"></span>
                    <span>MEM: {systemStats.memory}</span>
                </div>
                <div>
                    LOCAL SERVER: PORT {systemStats.port}
                </div>
            </div>

            {/* Global Log Overlay - Bottom Right */}
            <div className="fixed bottom-10 right-4 w-80 max-h-48 overflow-y-auto bg-black/80 backdrop-blur-md border border-white/10 rounded-lg p-3 font-mono text-[10px] text-slate-400 pointer-events-none select-none z-50 flex flex-col-reverse gap-1 shadow-xl">
                {logs.map(log => (
                    <div key={log.id} className={`${log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-emerald-400' : log.type === 'warning' ? 'text-yellow-400' : 'text-slate-400'}`}>
                        <span className="opacity-50">[{new Date(log.timestamp).toLocaleTimeString().split(' ')[0]}]</span> {log.msg}
                    </div>
                ))}
                {logs.length === 0 && <div className="opacity-30 italic">System ready...</div>}
            </div>
        </div>
    );
}

// --- View: 1. Setup ---
function SetupView({ onNext }) {
    return (
        <div className="h-full flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
            {/* Background Decorations */}
            <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-indigo-600/10 rounded-full blur-[100px]"></div>
            <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-600/10 rounded-full blur-[100px]"></div>

            <div className="relative z-10 max-w-md">
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-indigo-500/20">
                    <i className="ph-fill ph-brain text-4xl text-white"></i>
                </div>

                <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">Tired of Digital Chaos?</h1>
                <p className="text-slate-400 text-sm leading-relaxed mb-8">
                    NeuroSort uses a local, lightweight LLM to analyze your files, understand their context, and organize them into a "Twin-Directory" structure.
                    <br /><br />
                    <span className="text-indigo-400 font-medium">Private. Offline. Intelligent.</span>
                </p>

                <button
                    onClick={onNext}
                    className="group relative px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-all w-full overflow-hidden"
                >
                    <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                    <span className="flex items-center justify-center gap-2">
                        Initialize System <i className="ph-bold ph-arrow-right"></i>
                    </span>
                </button>

                <div className="mt-6 flex justify-center gap-4 text-[10px] text-slate-600 uppercase tracking-wider font-semibold">
                    <span className="flex items-center gap-1"><i className="ph-fill ph-check-circle"></i> No Cloud Upload</span>
                    <span className="flex items-center gap-1"><i className="ph-fill ph-cpu"></i> GPU Accelerated</span>
                </div>
            </div>
        </div>
    );
}

// --- View: 2. Model Loader ---
function ModelLoader({ onComplete, addLog }) {
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState("Initializing Runtime...");
    const [error, setError] = useState(null);

    const initialized = React.useRef(false);

    useEffect(() => {
        const initSystem = async () => {
            if (initialized.current) return;
            initialized.current = true;

            if (!window.api) {
                setError("API not available");
                return;
            }

            try {
                // 1. Check Prerequisites
                setStatus("Checking System Prerequisites...");
                addLog("Checking for Ollama...", "system");
                const check = await window.api.checkPrerequisites();

                if (check.status === 'missing') {
                    setStatus("Ollama not found. Downloading Installer...");
                    addLog("Ollama missing. Starting auto-install...", "warning");

                    // Listen for download progress
                    const progressCleanup = window.api.onDownloadProgress((data) => {
                        setProgress(data.percent);
                        setStatus(`Downloading Installer`);
                    });

                    await window.api.installOllama();

                    if (progressCleanup) window.api.removeDownloadProgressListener(); // Cleanup listener if needed, though we might want to keep it for a bit

                    setStatus("Installing Ollama... Please complete the setup wizard.");
                    addLog("Installer launched. Waiting for user...", "system");

                    // Poll for Ollama readiness
                    let attempts = 0;
                    while (true) {
                        const check = await window.api.checkPrerequisites();
                        if (check.status === 'ready') {
                            addLog("Ollama detected! Proceeding...", "success");
                            break;
                        }
                        attempts++;
                        if (attempts > 60) { // 5 minutes timeout (5s * 60)
                            throw new Error("Ollama installation timed out. Please restart.");
                        }
                        await new Promise(r => setTimeout(r, 5000));
                    }
                } else if (check.status === 'error') {
                    throw new Error(check.msg);
                }

                setProgress(30);
                setStatus("Connecting to Local AI Engine...");
                addLog("Ollama detected. Connecting...", "success");

                // 2. Pull Text Model (phi3)
                setStatus("Pulling Text Model (phi3)...");
                addLog("Checking model: phi3", "system");

                const progressCleanupPhi = window.api.onDownloadProgress((data) => {
                    setProgress(data.percent);
                    setStatus(`Pulling Text Model (phi3)`);
                });

                const pullPhi3 = await window.api.pullModel('phi3');

                if (progressCleanupPhi) window.api.removeDownloadProgressListener();

                if (!pullPhi3.success) {
                    throw new Error("Failed to pull phi3: " + pullPhi3.error);
                }

                // 3. Pull Vision Model (llava)
                setProgress(0); // Reset for next download
                setStatus("Pulling Vision Model (llava)...");
                addLog("Checking model: llava", "system");

                const progressCleanupLlava = window.api.onDownloadProgress((data) => {
                    setProgress(data.percent);
                    setStatus(`Pulling Vision Model (llava)`);
                });

                const pullLlava = await window.api.pullModel('llava');

                if (progressCleanupLlava) window.api.removeDownloadProgressListener();

                if (!pullLlava.success) {
                    // Optional: Don't fail hard if vision model fails?
                    addLog("Failed to pull llava. Vision features disabled.", "warning");
                } else {
                    addLog("Vision Model (llava) ready.", "success");
                }

                setProgress(100);
                setStatus("Ready.");
                setTimeout(onComplete, 500);

            } catch (err) {
                setError(err.message);
                addLog(`Initialization Failed: ${err.message}`, "error");
            }
        };

        initSystem();

        return () => {
            if (window.api) window.api.removeDownloadProgressListener();
        };
    }, []);



    if (error) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                <div className="text-red-500 text-4xl mb-4"><i className="ph-fill ph-warning-circle"></i></div>
                <h3 className="text-xl font-bold text-white mb-2">Initialization Failed</h3>
                <p className="text-slate-400 mb-6">{error}</p>
                <button onClick={() => window.location.reload()} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded">Retry</button>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col items-center justify-center p-8 relative">
            <div className="w-full max-w-md space-y-6">
                <div className="flex justify-between items-end text-sm mb-2">
                    <span className="text-slate-300 font-mono">{status}</span>
                    <span className="text-indigo-400 font-bold">{progress}%</span>
                </div>

                {/* Custom Progress Bar */}
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 w-full transition-transform duration-500 ease-out origin-left"
                        style={{ transform: `scaleX(${progress / 100})` }}
                    ></div>
                </div>


                {/* Tech Specs Display */}
                <div className="grid grid-cols-2 gap-2 mt-8">
                    <div className="glass-panel p-3 rounded border border-white/5">
                        <div className="text-[10px] text-slate-500 uppercase">Model</div>
                        <div className="text-xs text-slate-200 font-mono mt-1">Phi-3-Mini-4k-Instruct</div>
                    </div>
                    <div className="glass-panel p-3 rounded border border-white/5">
                        <div className="text-[10px] text-slate-500 uppercase">Quantization</div>
                        <div className="text-xs text-slate-200 font-mono mt-1">Q4_K_M (GGUF)</div>
                    </div>
                    <div className="glass-panel p-3 rounded border border-white/5">
                        <div className="text-[10px] text-slate-500 uppercase">Backend</div>
                        <div className="text-xs text-slate-200 font-mono mt-1">Node-Llama-CPP</div>
                    </div>
                    <div className="glass-panel p-3 rounded border border-white/5">
                        <div className="text-[10px] text-slate-500 uppercase">Memory Est.</div>
                        <div className="text-xs text-emerald-400 font-mono mt-1">~1.8 GB</div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- View: 3. Drive Selection ---
function DriveSelection({ onStart, addLog, selectedPath, setSelectedPath }) {

    const handleSelect = async () => {
        if (window.api) {
            const path = await window.api.selectFolder();
            if (path) {
                setSelectedPath(path);
                addLog(`Selected target: ${path}`);
            }
        } else {
            addLog("Error: API not available", "error");
        }
    };

    return (
        <div className="h-full flex flex-col items-center justify-center p-8 animate-fade-in">
            <h2 className="text-xl font-semibold text-white mb-8">Select Target Workspace</h2>

            <div className="grid grid-cols-1 gap-4 w-full max-w-lg">
                <div
                    onClick={handleSelect}
                    className={`
                    group cursor-pointer border border-dashed rounded-xl p-8 transition-all
                    ${selectedPath ? 'border-indigo-500 bg-indigo-500/5' : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800/50'}
                `}
                >
                    <div className="flex flex-col items-center gap-4">
                        <div className={`
                        w-16 h-16 rounded-full flex items-center justify-center transition-colors
                        ${selectedPath ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700'}
                    `}>
                            {selectedPath ? <i className="ph-fill ph-folder-open text-2xl"></i> : <i className="ph-fill ph-plus text-2xl"></i>}
                        </div>
                        <div className="text-center">
                            <div className="text-sm font-medium text-slate-200">
                                {selectedPath ? "Target Locked" : "Choose Directory to Scan"}
                            </div>
                            <div className="text-xs text-slate-500 mt-1 font-mono">
                                {selectedPath || "Drag folder here or click to browse"}
                            </div>
                        </div>
                    </div>
                </div>

                {selectedPath && (
                    <div className="space-y-4 mt-4">
                        <div className="glass-panel p-4 rounded-lg text-left">
                            <div className="text-xs text-slate-400 mb-2 uppercase tracking-wider font-bold">Scanning Plan</div>
                            <ul className="text-xs space-y-2 text-slate-300">
                                <li className="flex items-center gap-2">
                                    <i className="ph-fill ph-check text-emerald-500"></i> Creates <code>/00_Inbox</code>
                                </li>
                                <li className="flex items-center gap-2">
                                    <i className="ph-fill ph-check text-emerald-500"></i> Separates Code from Assets
                                </li>
                                <li className="flex items-center gap-2">
                                    <i className="ph-fill ph-check text-emerald-500"></i> Renames via AI Context
                                </li>
                            </ul>
                        </div>
                        <button
                            onClick={onStart}
                            className="w-full py-3 bg-white text-black font-bold rounded-lg hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                        >
                            <i className="ph-bold ph-play"></i> Start Arrangement
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// --- View: 4. Processing Dashboard (Real Data) ---
function ProcessingDashboard({ onComplete, addLog, selectedPath }) {
    const [files, setFiles] = useState([]);
    const [stats, setStats] = useState({ processed: 0, total: 0, startTime: null, etr: "Calculating..." });
    const [currentFile, setCurrentFile] = useState(null);

    const processingStarted = React.useRef(false);

    useEffect(() => {
        if (window.api && !processingStarted.current) {
            processingStarted.current = true;

            // Listen for start event to get total count
            window.api.onProcessingStart((data) => {
                console.log('[App.jsx] Received processing-start:', data);
                setStats(prev => ({ ...prev, total: data.total, startTime: Date.now() }));
                addLog(`Found ${data.total} files to process.`, "info");
            });

            // Start Processing
            window.api.startProcessing(selectedPath);

            // Listen for real file events
            window.api.onFileProcessed((file) => {
                console.log('[App.jsx] Received file:', file);
                addLog(`[UI] Received: ${file.name}`, "info");
                setFiles(prev => {
                    console.log('[App.jsx] Updating files state. Previous count:', prev.length);
                    return [file, ...prev];
                });
                setStats(prev => {
                    const newProcessed = prev.processed + 1;

                    // Calculate ETR
                    let newEtr = prev.etr;
                    if (prev.startTime && newProcessed > 0) {
                        const elapsed = Date.now() - prev.startTime;
                        const avgTimePerFile = elapsed / newProcessed;
                        const remaining = prev.total - newProcessed;
                        const etrMs = remaining * avgTimePerFile;

                        if (remaining <= 0) newEtr = "Finishing...";
                        else if (etrMs < 60000) newEtr = `${Math.ceil(etrMs / 1000)}s remaining`;
                        else newEtr = `${Math.ceil(etrMs / 60000)}m remaining`;
                    }

                    return { ...prev, processed: newProcessed, etr: newEtr };
                });
                setCurrentFile(null);
            });
        }

        return () => {
            if (window.api) {
                window.api.removeFileListener();
            }
        };
    }, []);

    return (
        <div className="h-full flex flex-col p-6">
            {/* Top Stats */}
            <div className="flex gap-4 mb-6">
                <div className="glass-panel flex-1 p-4 rounded-xl border-l-4 border-indigo-500">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider">Files Processed</div>
                    <div className="text-2xl font-bold text-white mt-1">{stats.processed} <span className="text-slate-500 text-sm">/ {stats.total || '?'}</span></div>
                </div>
                <div className="glass-panel flex-1 p-4 rounded-xl border-l-4 border-purple-500">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider">Estimated Time</div>
                    <div className="text-2xl font-bold text-white mt-1">{stats.etr}</div>
                </div>
            </div>

            {/* Main Visualization Area */}
            <div className="flex-1 flex gap-6 min-h-0">
                {/* Left: Live Feed */}
                <div className="flex-[2] flex flex-col gap-4 min-h-0">
                    <div className="text-xs font-bold text-slate-500 uppercase flex items-center justify-between">
                        <span>Live Activity</span>
                        {currentFile && <span className="text-indigo-400 animate-pulse">Processing...</span>}
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-2 relative">
                        {files.map((f, i) => (
                            <div key={i} className="bg-slate-800/50 border border-white/5 p-3 rounded-lg flex items-center justify-between animate-fade-in-up">
                                <div className="flex items-center gap-3">
                                    <div className={`
                                    w-8 h-8 rounded flex items-center justify-center text-lg
                                    ${f.type === 'image' ? 'bg-blue-500/20 text-blue-400' : ''}
                                    ${f.type === 'doc' ? 'bg-yellow-500/20 text-yellow-400' : ''}
                                    ${f.type === 'design' ? 'bg-pink-500/20 text-pink-400' : ''}
                                    ${f.type === 'code' ? 'bg-emerald-500/20 text-emerald-400' : ''}
                                    ${f.type === 'video' ? 'bg-red-500/20 text-red-400' : ''}
                                `}>
                                        <i className={`ph-fill ${f.type === 'image' ? 'ph-image' :
                                            f.type === 'doc' ? 'ph-file-text' :
                                                f.type === 'design' ? 'ph-paint-brush' :
                                                    f.type === 'code' ? 'ph-code' : 'ph-video'
                                            }`}></i>
                                    </div>
                                    <div>
                                        <div className="text-sm text-slate-200">{f.name}</div>
                                        <div className="text-[10px] text-slate-500">{f.size} • {f.reason}</div>
                                    </div>
                                </div>
                                <div className="text-[10px] font-mono bg-white/5 px-2 py-1 rounded text-indigo-300">
                                    {f.dest}
                                </div>
                            </div>
                        ))}
                        {currentFile && (
                            <div className="bg-indigo-500/10 border border-indigo-500/30 p-3 rounded-lg flex items-center gap-3 opacity-50">
                                <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                <div className="text-sm text-indigo-300">Scanning {currentFile.name}...</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: AI Thought Process (Log) */}
                <div className="flex-1 bg-[#050505] rounded-xl border border-white/10 p-4 flex flex-col font-mono text-xs min-h-0">
                    <div className="text-slate-500 mb-3 uppercase font-bold tracking-wider">LLM Context Window</div>
                    <div className="flex-1 overflow-y-auto space-y-1.5 opacity-80">
                        {files.length > 0 && (
                            <>
                                <div className="text-purple-400"> prompt &gt; classify_file("{files[0].name}")</div>
                                <div className="text-slate-400"> &gt; analyzing metadata...</div>
                                <div className="text-slate-400"> &gt; extension: .{files[0].name.split('.').pop()}</div>
                                <div className="text-emerald-500"> &gt; match_found: {files[0].dest} (Confidence: 98%)</div>
                                <div className="text-slate-600"> ---</div>
                            </>
                        )}
                        <div className="text-slate-600 animate-pulse">_ waiting for input stream</div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- View: 5. Completion ---
function CompletionSummary({ onReset }) {
    return (
        <div className="h-full flex flex-col items-center justify-center p-8 animate-fade-in">
            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6 text-emerald-400">
                <i className="ph-fill ph-check text-4xl"></i>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Workspace Harmonized</h2>
            <p className="text-slate-400 text-sm mb-8 text-center max-w-md">
                Files have been successfully moved to the Twin-Directory structure. Your "Downloads" folder is now empty.
            </p>

            <div className="grid grid-cols-3 gap-4 w-full max-w-lg mb-8">
                <div className="bg-slate-800/50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-white">10</div>
                    <div className="text-[10px] text-slate-500 uppercase">Files Moved</div>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-white">5</div>
                    <div className="text-[10px] text-slate-500 uppercase">Categories</div>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-white">0s</div>
                    <div className="text-[10px] text-slate-500 uppercase">Cloud Latency</div>
                </div>
            </div>

            <button
                onClick={onReset}
                className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
            >
                Process Another Folder
            </button>
        </div>
    );
}

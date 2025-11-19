import React, { useState, useEffect } from 'react';

// --- View: 4. Processing Dashboard (Real-time with Funnel Stats) ---
export default function ProcessingDashboard({ onComplete, addLog, selectedPath }) {
    const [files, setFiles] = useState([]);
    const [stats, setStats] = useState({ processed: 0, total: 0, startTime: null, etr: "Calculating..." });
    const [currentFile, setCurrentFile] = useState(null);
    const [funnelStats, setFunnelStats] = useState({ stage1: 0, stage2: 0, stage3: 0, total: 0, duplicates: 0 });
    const [duplicatesCount, setDuplicatesCount] = useState(0);
    const [completionData, setCompletionData] = useState(null);

    const processingStarted = React.useRef(false);

    useEffect(() => {
        if (window.api && !processingStarted.current) {
            processingStarted.current = true;

            // Listen for start event to get total count
            window.api.onProcessingStart((data) => {
                console.log('[ProcessingDashboard] ✅ Received processing-start:', data);
                setStats(prev => ({ ...prev, total: data.total, startTime: Date.now() }));
                addLog(`Found ${data.total} files to process.`, "info");
            });

            // Listen for real file events
            window.api.onFileProcessed((file) => {
                console.log('[ProcessingDashboard] ✓ RECEIVED FILE:', file);
                addLog(`✓ ${file.name} -> ${file.dest}`, "success");
                setFiles(prev => [file, ...prev]);
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
            });

            // Listen for current file processing status
            window.api.onFileProcessingStatus((data) => {
                if (data.status === 'analyzing') {
                    setCurrentFile({ name: data.filename, stage: null });
                } else if (data.status === 'classified') {
                    setCurrentFile({
                        name: data.filename,
                        stage: data.stage,
                        classification: data.classification
                    });
                }
            });

            // Listen for funnel statistics updates
            window.api.onFunnelStats((data) => {
                console.log('[ProcessingDashboard] 📊 Funnel stats:', data);
                setFunnelStats(data);
            });

            // Listen for duplicate file detection
            window.api.onFileDuplicateDetected((data) => {
                setDuplicatesCount(prev => prev + 1);
                addLog(`📋 Duplicate: ${data.filename}`, "warning");
            });

            // Listen for completion with real data
            window.api.onProcessingComplete((data) => {
                if (data) {
                    setCompletionData(data);
                }
                // Transition to completion view will happen in parent
            });

            // NOW start processing (after all listeners are ready)
            window.api.startProcessing(selectedPath);
        }

        return () => {
            if (window.api) {
                window.api.removeFileListener();
                window.api.removeFileProcessingStatusListener();
                window.api.removeFunnelStatsListener();
                window.api.removeFileDuplicateListener();
            }
        };
    }, [selectedPath, addLog]);

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
                <div className="glass-panel flex-1 p-4 rounded-xl border-l-4 border-amber-500">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider">Duplicates Removed</div>
                    <div className="text-2xl font-bold text-white mt-1">{duplicatesCount}</div>
                </div>
            </div>

            {/* Funnel Statistics Bar */}
            {funnelStats.total > 0 && (
                <div className="glass-panel p-4 rounded-xl mb-4">
                    <div className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center justify-between">
                        <span>v2.0 Classification Funnel</span>
                        <span className="text-slate-500 font-mono">{funnelStats.total} files analyzed</span>
                    </div>
                    <div className="flex gap-2 h-8 rounded overflow-hidden">
                        <div
                            className="bg-emerald-500 flex items-center justify-center text-xs font-bold text-white transition-all"
                            style={{ width: `${(funnelStats.stage1 / funnelStats.total) * 100}%` }}
                            title={`Stage 1: Regex Guard - ${funnelStats.stage1} files`}
                        >
                            {funnelStats.stage1 > 0 && `${Math.round((funnelStats.stage1 / funnelStats.total) * 100)}%`}
                        </div>
                        <div
                            className="bg-amber-500 flex items-center justify-center text-xs font-bold text-white transition-all"
                            style={{ width: `${(funnelStats.stage2 / funnelStats.total) * 100}%` }}
                            title={`Stage 2: Metadata Analyst - ${funnelStats.stage2} files`}
                        >
                            {funnelStats.stage2 > 0 && `${Math.round((funnelStats.stage2 / funnelStats.total) * 100)}%`}
                        </div>
                        <div
                            className="bg-purple-500 flex items-center justify-center text-xs font-bold text-white transition-all"
                            style={{ width: `${(funnelStats.stage3 / funnelStats.total) * 100}%` }}
                            title={`Stage 3: AI Arbiter - ${funnelStats.stage3} files`}
                        >
                            {funnelStats.stage3 > 0 && `${Math.round((funnelStats.stage3 / funnelStats.total) * 100)}%`}
                        </div>
                    </div>
                    <div className="flex gap-4 mt-3 text-[10px]">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                            <span className="text-slate-400">Regex Guard: {funnelStats.stage1}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                            <span className="text-slate-400">Metadata Analyst: {funnelStats.stage2}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                            <span className="text-slate-400">AI Arbiter: {funnelStats.stage3}</span>
                        </div>
                    </div>
                </div>
            )}

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
                            <div className="bg-indigo-500/10 border border-indigo-500/30 p-3 rounded-lg flex items-center justify-between animate-pulse">
                                <div className="flex items-center gap-3">
                                    <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                    <div>
                                        <div className="text-sm text-indigo-300">{currentFile.name}</div>
                                        {currentFile.stage && (
                                            <div className={`text-[10px] mt-0.5 ${currentFile.stage.includes('Stage 1') ? 'text-emerald-400' :
                                                    currentFile.stage.includes('Stage 2') ? 'text-amber-400' :
                                                        'text-purple-400'
                                                }`}>{currentFile.stage}</div>
                                        )}
                                    </div>
                                </div>
                                {currentFile.classification && (
                                    <div className="text-[10px] font-mono bg-white/5 px-2 py-1 rounded text-indigo-300">
                                        {currentFile.classification.folder}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Stage Activity Monitor (replaces fake LLM window) */}
                <div className="flex-1 bg-[#050505] rounded-xl border border-white/10 p-4 flex flex-col font-mono text-xs min-h-0">
                    <div className="text-slate-500 mb-3 uppercase font-bold tracking-wider">Stage Activity</div>
                    <div className="flex-1 overflow-y-auto space-y-2 opacity-90">
                        {currentFile && currentFile.stage && (
                            <div className="bg-slate-800/50 p-2 rounded border-l-2 border-indigo-500">
                                <div className={`font-bold ${currentFile.stage.includes('Stage 1') ? 'text-emerald-400' :
                                        currentFile.stage.includes('Stage 2') ? 'text-amber-400' :
                                            'text-purple-400'
                                    }`}>{currentFile.stage}</div>
                                <div className="text-slate-400 text-[10px] mt-1">
                                    {currentFile.classification?.reason || 'Analyzing...'}
                                </div>
                                {currentFile.classification?.confidence && (
                                    <div className="text-slate-500 text-[9px] mt-1">
                                        Confidence: {currentFile.classification.confidence}
                                    </div>
                                )}
                            </div>
                        )}
                        {files.slice(0, 5).map((f, i) => (
                            <div key={i} className={`p-2 rounded border-l-2 ${f.stage?.includes('Stage 1') ? 'border-emerald-500 bg-emerald-500/5' :
                                    f.stage?.includes('Stage 2') ? 'border-amber-500 bg-amber-500/5' :
                                        'border-purple-500 bg-purple-500/5'
                                }`}>
                                <div className="text-slate-300 text-[10px] truncate">{f.name}</div>
                                <div className={`text-[9px] mt-1 ${f.stage?.includes('Stage 1') ? 'text-emerald-400' :
                                        f.stage?.includes('Stage 2') ? 'text-amber-400' :
                                            'text-purple-400'
                                    }`}>{f.stage || 'Unknown stage'}</div>
                            </div>
                        ))}
                        {!currentFile && files.length === 0 && (
                            <div className="text-slate-600 animate-pulse">_ waiting for files...</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

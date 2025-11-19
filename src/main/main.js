const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const os = require('os');
const { exec, spawn } = require('child_process');
const crypto = require('crypto');

// v2.0 Architecture Modules
const { MASTER_TAXONOMY, sanitizeFolderName, getValidFolders } = require('./taxonomy');
const RegexGuard = require('./RegexGuard');
const MetadataAnalyst = require('./MetadataAnalyst');
const modelManager = require('./ModelManager');

// Fix for electron-store in CommonJS
let store;
(async () => {
    const { default: Store } = await import('electron-store');
    store = new Store();
})();

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        frame: false, // Custom title bar
        webPreferences: {
            preload: path.join(__dirname, '../shared/preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        },
        backgroundColor: '#09090b',
        titleBarStyle: 'hidden',
        titleBarOverlay: {
            color: '#09090b',
            symbolColor: '#e2e8f0',
            height: 40
        }
    });

    if (process.env.NODE_ENV === 'development') {
        win.loadURL('http://localhost:3000');
        win.webContents.openDevTools();
    } else {
        win.loadFile(path.join(__dirname, '../../dist/index.html'));
    }

    // Send system stats every 2 seconds
    setInterval(() => {
        if (!win.isDestroyed()) {
            const totalMem = (os.totalmem() / (1024 * 1024 * 1024)).toFixed(0);
            const freeMem = (os.freemem() / (1024 * 1024 * 1024)).toFixed(1);
            const usedMem = (totalMem - freeMem).toFixed(1);

            win.webContents.send('system-stats', {
                memory: `${usedMem}GB / ${totalMem}GB`,
                port: '11434' // Default Ollama port
            });
        }
    }, 2000);

    // IPC Handlers
    ipcMain.handle('select-folder', async () => {
        const result = await dialog.showOpenDialog(win, {
            properties: ['openDirectory']
        });
        if (result.canceled) return null;
        return result.filePaths[0];
    });

    ipcMain.on('start-sort', async (event, folderPath) => {
        console.log('Starting sort for:', folderPath);
        event.reply('log-update', { msg: `Starting sort for ${folderPath}`, type: 'info' });

        try {
            await processDirectory(folderPath, event);
            // Completion is handled inside processDirectory after metadata generation
        } catch (error) {
            console.error('Sort error:', error);
            event.reply('log-update', { msg: `Critical Error: ${error.message}`, type: 'error' });
        }
    });

    // --- Auto-Setup Handlers ---

    ipcMain.handle('check-prerequisites', async () => {
        try {
            // 1. Check if Ollama is running
            const isRunning = await checkOllamaRunning();
            if (isRunning) return { status: 'ready', msg: 'Ollama is running.' };

            // 2. Check if Ollama is installed
            const isInstalled = await checkOllamaInstalled();
            if (isInstalled) {
                // Try to start it
                startOllama();
                // Wait a bit for it to start
                await new Promise(r => setTimeout(r, 3000));
                const runningNow = await checkOllamaRunning();
                if (runningNow) return { status: 'ready', msg: 'Ollama started successfully.' };
                return { status: 'error', msg: 'Ollama installed but failed to start.' };
            }

            return { status: 'missing', msg: 'Ollama not found.' };
        } catch (e) {
            return { status: 'error', msg: e.message };
        }
    });

    ipcMain.handle('install-ollama', async (event) => {
        const installerUrl = 'https://ollama.com/download/OllamaSetup.exe'; // Windows
        const uniqueId = Date.now();
        const tempPath = path.join(os.tmpdir(), `OllamaSetup_${uniqueId}.exe`);
        const win = BrowserWindow.getAllWindows()[0];

        console.log(`[Install-Ollama] Starting download from ${installerUrl}`);
        console.log(`[Install-Ollama] Temp path: ${tempPath}`);

        try {
            const response = await fetch(installerUrl);
            if (!response.ok) {
                console.error(`[Install-Ollama] Download failed: ${response.status} ${response.statusText}`);
                throw new Error(`Download failed: ${response.status} ${response.statusText}`);
            }

            const totalBytes = parseInt(response.headers.get('content-length') || '0', 10);
            console.log(`[Install-Ollama] Total bytes: ${totalBytes}`);

            let downloadedBytes = 0;
            const fileStream = fs.createWriteStream(tempPath);
            const reader = response.body.getReader();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                downloadedBytes += value.length;
                fileStream.write(Buffer.from(value));

                if (totalBytes > 0) {
                    const percent = Math.round((downloadedBytes / totalBytes) * 100);
                    if (win && !win.isDestroyed()) {
                        win.webContents.send('download-progress', { percent });
                    }
                }
            }

            fileStream.end();
            console.log('[Install-Ollama] Download complete. Stream ended.');

            // Wait for file stream to finish closing
            await new Promise((resolve, reject) => {
                fileStream.on('finish', resolve);
                fileStream.on('error', reject);
            });
            console.log('[Install-Ollama] File stream closed.');

            // Small delay to ensure OS releases lock/scan
            console.log('[Install-Ollama] Waiting 1s for lock release...');
            await new Promise(resolve => setTimeout(resolve, 1000));

            console.log('[Install-Ollama] Launching installer via shell.openPath...');
            await shell.openPath(tempPath);
            console.log('[Install-Ollama] Installer launched successfully.');
            return 'Installer launched';
        } catch (error) {
            console.error('[Install-Ollama] Error:', error);
            // Cleanup
            if (fs.existsSync(tempPath)) {
                try {
                    fs.unlinkSync(tempPath);
                    console.log('[Install-Ollama] Cleaned up temp file.');
                } catch (cleanupErr) {
                    console.error('[Install-Ollama] Cleanup failed:', cleanupErr);
                }
            }
            throw error;
        }
    });

    ipcMain.handle('pull-model', async (event, modelName = 'phi3') => {
        const win = BrowserWindow.getAllWindows()[0];
        try {
            const response = await fetch('http://localhost:11434/api/pull', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: modelName, stream: true })
            });

            if (!response.ok) throw new Error('Failed to pull model');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // Keep incomplete line

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const data = JSON.parse(line);
                        if (data.total && data.completed) {
                            const percent = Math.round((data.completed / data.total) * 100);
                            if (win && !win.isDestroyed()) {
                                win.webContents.send('download-progress', { percent });
                            }
                        } else if (data.status) {
                            // Optional: Send status text update?
                            // For now, just progress is fine.
                        }
                    } catch (e) {
                        console.error('Error parsing pull stream:', e);
                    }
                }
            }

            return { success: true };
        } catch (e) {
            console.error('Pull model error:', e);
            return { success: false, error: e.message };
        }
    });
}

// --- Helper Functions ---

function checkOllamaRunning() {
    return new Promise((resolve) => {
        const req = require('http').request('http://localhost:11434', { method: 'HEAD' }, (res) => {
            resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.end();
    });
    // Note: http module should be used for localhost:11434 usually, not https unless configured.
    // Ollama default is http. Let's fix imports.
}

function checkOllamaInstalled() {
    return new Promise((resolve) => {
        exec('ollama --version', (err) => {
            resolve(!err);
        });
    });
}

function startOllama() {
    spawn('ollama', ['serve'], { detached: true, stdio: 'ignore' }).unref();
}

// --- v2.0 Hybrid Sort Engine (3-Stage Funnel) ---

async function processDirectory(folderPath, event) {
    console.log('[v2.0] processDirectory called for:', folderPath);
    const files = await fs.promises.readdir(folderPath);
    console.log('[v2.0] Files found:', files.length);
    const results = [];
    const processingStartTime = Date.now();
    const stats = {
        stage1Hits: 0,
        stage2Hits: 0,
        stage3Hits: 0,
        totalProcessed: 0,
        duplicatesDeleted: 0
    };

    // Filter valid files first to get accurate count
    const validFiles = [];
    for (const file of files) {
        const filePath = path.join(folderPath, file);
        try {
            const fileStats = await fs.promises.stat(filePath);
            if (fileStats.isFile() && !file.startsWith('.') && file !== 'desktop.ini') {
                validFiles.push(file);
            }
        } catch (e) { }
    }

    const totalFiles = validFiles.length;
    console.log('[v2.0] Valid files to process:', totalFiles);
    event.reply('processing-start', { total: totalFiles });
    console.log('[v2.0] Sent processing-start event');

    // Concurrency Control - Increased to 5 (Stage 1/2 are fast)
    const CONCURRENCY_LIMIT = 5;
    const queue = [...validFiles];
    const activePromises = [];

    const processNext = async () => {
        if (queue.length === 0) return;
        const filename = queue.shift();
        console.log('[v2.0] Processing:', filename);
        const filePath = path.join(folderPath, filename);

        try {
            const fileStats = await fs.promises.stat(filePath);
            if (fileStats.isDirectory()) return; // Skip directories

            const ext = path.extname(filename).toLowerCase();

            // Skip hidden files or system files
            if (filename.startsWith('.') || filename === 'desktop.ini') return;

            // Emit processing start event
            event.reply('file-processing-status', {
                filename,
                status: 'analyzing',
                stage: null
            });
            event.reply('log-update', { msg: `Analyzing: ${filename}`, type: 'process' });

            // === 3-STAGE FUNNEL SYSTEM ===
            let classification = null;

            // STAGE 1: Regex Guard (0ms, 0MB RAM)
            classification = RegexGuard.classify(filename);
            if (classification) {
                stats.stage1Hits++;
                console.log(`[Stage 1 ✓] ${filename} -> ${classification.folder}`);
                // Emit stage-specific event
                event.reply('file-processing-status', {
                    filename,
                    status: 'classified',
                    stage: 'Stage 1: Regex Guard',
                    classification: {
                        folder: classification.folder,
                        reason: classification.reason,
                        confidence: classification.confidence
                    }
                });
            }

            // STAGE 2: Metadata Analyst (5ms, 10MB RAM)
            if (!classification) {
                classification = await MetadataAnalyst.analyze(filePath);
                if (classification) {
                    stats.stage2Hits++;
                    console.log(`[Stage 2 ✓] ${filename} -> ${classification.folder}`);
                    // Emit stage-specific event
                    event.reply('file-processing-status', {
                        filename,
                        status: 'classified',
                        stage: 'Stage 2: Metadata Analyst',
                        classification: {
                            folder: classification.folder,
                            reason: classification.reason,
                            confidence: classification.confidence
                        }
                    });
                }
            }

            // STAGE 3: AI Arbiter (200ms+, 2GB RAM)
            if (!classification) {
                await modelManager.wake(); // Load model into RAM
                classification = await classifyWithAI(filename, filePath);
                if (classification) {
                    stats.stage3Hits++;
                    console.log(`[Stage 3 ✓] ${filename} -> ${classification.folder}`);
                    // Emit stage-specific event
                    event.reply('file-processing-status', {
                        filename,
                        status: 'classified',
                        stage: 'Stage 3: AI Arbiter',
                        classification: {
                            folder: classification.folder,
                            reason: classification.reason,
                            confidence: classification.confidence
                        }
                    });
                }
            }

            // Fallback to Unsorted if all stages fail
            if (!classification) {
                classification = {
                    folder: '99_Unsorted',
                    reason: 'Unable to classify',
                    stage: 'Fallback',
                    confidence: 'none'
                };
            }

            const folderName = sanitizeFolderName(classification.folder);
            const reason = classification.reason || classification.stage;

            const destFolder = path.join(folderPath, folderName);

            // Create Directory if needed
            if (!fs.existsSync(destFolder)) {
                await fs.promises.mkdir(destFolder, { recursive: true });
            }

            // Move File with MD5-based Collision Detection
            const destPath = path.join(destFolder, filename);
            if (filePath !== destPath) {
                let finalDestPath = destPath;

                // Handle collisions with MD5 hash check
                if (fs.existsSync(finalDestPath)) {
                    const sourceHash = calculateMD5(filePath);
                    const destHash = calculateMD5(finalDestPath);

                    if (sourceHash === destHash) {
                        // Duplicate file - delete source
                        await fs.promises.unlink(filePath);
                        stats.duplicatesDeleted++;
                        event.reply('file-duplicate-detected', { filename, originalPath: finalDestPath });
                        event.reply('log-update', { msg: `Duplicate deleted: ${filename}`, type: 'warning' });
                        stats.totalProcessed++;
                        return; // Skip move
                    } else {
                        // Different file - rename with timestamp
                        const namePart = path.basename(filename, ext);
                        finalDestPath = path.join(destFolder, `${namePart}_${Date.now()}${ext}`);
                    }
                }

                await fs.promises.rename(filePath, finalDestPath);

                const fileData = {
                    name: filename,
                    type: ['.jpg', '.jpeg', '.png', '.svg', '.gif'].includes(ext) ? 'image' : 'doc',
                    size: (fileStats.size / 1024).toFixed(1) + 'KB',
                    dest: folderName,
                    reason: reason,
                    stage: classification.stage // Add stage info for frontend detection
                };
                results.push(fileData);
                stats.totalProcessed++;
                event.reply('log-update', { msg: `Moved ${filename} -> ${folderName}`, type: 'success' });
                event.reply('file-processed', fileData);

                // Stream funnel statistics every 5 files
                if (stats.totalProcessed % 5 === 0 || stats.totalProcessed === totalFiles) {
                    event.reply('funnel-stats', {
                        stage1: stats.stage1Hits,
                        stage2: stats.stage2Hits,
                        stage3: stats.stage3Hits,
                        total: stats.totalProcessed,
                        duplicates: stats.duplicatesDeleted
                    });
                }
            }

        } catch (err) {
            console.error(`Error processing ${filename}:`, err);
            event.reply('log-update', { msg: `Error: ${err.message}`, type: 'error' });
        }
    };

    // Run with concurrency limit
    while (queue.length > 0 || activePromises.length > 0) {
        while (queue.length > 0 && activePromises.length < CONCURRENCY_LIMIT) {
            const p = processNext();
            activePromises.push(p);
            p.finally(() => {
                activePromises.splice(activePromises.indexOf(p), 1);
            });
        }
        if (activePromises.length > 0) {
            await Promise.race(activePromises);
        } else {
            break;
        }
    }

    // Log funnel statistics
    console.log('[v2.0 Statistics]');
    console.log(`  Stage 1 (Regex): ${stats.stage1Hits} files (${((stats.stage1Hits / stats.totalProcessed) * 100).toFixed(1)}%)`);
    console.log(`  Stage 2 (Metadata): ${stats.stage2Hits} files (${((stats.stage2Hits / stats.totalProcessed) * 100).toFixed(1)}%)`);
    console.log(`  Stage 3 (AI): ${stats.stage3Hits} files (${((stats.stage3Hits / stats.totalProcessed) * 100).toFixed(1)}%)`);
    console.log(`  Total Processed: ${stats.totalProcessed}`);

    event.reply('log-update', {
        msg: `Funnel Stats - Regex:${stats.stage1Hits} Metadata:${stats.stage2Hits} AI:${stats.stage3Hits}`,
        type: 'info'
    });

    // Post-Processing: Generate .neurosort metadata
    event.reply('log-update', { msg: "Generating folder context metadata...", type: "info" });

    const uniqueFolders = [...new Set(results.map(r => r.dest))].filter(d => d);

    for (const folderName of uniqueFolders) {
        const subFolderPath = path.join(folderPath, folderName);
        if (fs.existsSync(subFolderPath)) {
            try {
                await generateFolderMetadata(subFolderPath, folderName);
                event.reply('log-update', { msg: `Context generated for: ${folderName}`, type: "success" });
            } catch (err) {
                console.error(`Metadata generation failed for ${folderName}:`, err);
                event.reply('log-update', { msg: `Metadata failed: ${folderName}`, type: "warning" });
            }
        }
    }

    // Calculate processing duration
    const processingDuration = Date.now() - processingStartTime;

    // Send final completion with real statistics
    event.reply('processing-complete', {
        totalMoved: stats.totalProcessed - stats.duplicatesDeleted,
        totalProcessed: stats.totalProcessed,
        duplicatesDeleted: stats.duplicatesDeleted,
        totalFolders: uniqueFolders.length,
        processingTime: processingDuration,
        funnelBreakdown: {
            stage1: stats.stage1Hits,
            stage2: stats.stage2Hits,
            stage3: stats.stage3Hits
        }
    });
}

// --- Helper: Generate .neurosort Metadata ---
async function generateFolderMetadata(folderPath, folderName) {
    const files = await fs.promises.readdir(folderPath);
    const fileList = files.filter(f => !f.startsWith('.')).slice(0, 20).join(', '); // Limit to top 20 files for context

    const prompt = `
            You are a file system organizer. Analyze the following list of files in the folder "${folderName}".
            Provide a brief, professional summary of what this folder contains and its likely purpose.
            Return ONLY valid JSON in this format:
            {
                "summary": "Description of contents...",
                "tags": ["tag1", "tag2", "tag3"],
                "category": "Broad Category"
            }

            Files: ${fileList}
        `;

    try {
        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'phi3',
                prompt: prompt,
                stream: false,
                format: 'json'
            })
        });

        const data = await response.json();
        let metadata = {};
        try {
            metadata = JSON.parse(data.response);
        } catch (e) {
            // Fallback if JSON is malformed
            metadata = { summary: data.response, tags: [], category: "Unknown" };
        }

        metadata.generatedAt = new Date().toISOString();
        metadata.fileCount = files.length;

        await fs.promises.writeFile(
            path.join(folderPath, '.neurosort'),
            JSON.stringify(metadata, null, 2)
        );
    } catch (error) {
        console.error("LLM Metadata Error:", error);
        // Write basic metadata if AI fails
        await fs.promises.writeFile(
            path.join(folderPath, '.neurosort'),
            JSON.stringify({
                summary: "Auto-generated folder",
                error: "AI analysis failed",
                generatedAt: new Date().toISOString()
            }, null, 2)
        );
    }
}

/**
 * v2.0 AI Arbiter (Stage 3)
 * Text-only classification with constrained taxonomy
 * Only called for the "Ambiguous 10%" after Stage 1 and 2 fail
 */
async function classifyWithAI(filename, filePath) {
    try {
        const ext = path.extname(filename).toLowerCase();

        // Read first 500 chars for context (text files only)
        let contentSnippet = '';
        const textExtensions = ['.txt', '.md', '.json', '.csv', '.log', '.xml', '.yml', '.yaml'];

        if (textExtensions.includes(ext)) {
            try {
                const buffer = Buffer.alloc(500);
                const fd = await fs.promises.open(filePath, 'r');
                await fd.read(buffer, 0, 500, 0);
                await fd.close();
                contentSnippet = buffer.toString('utf-8').replace(/\0/g, '').trim();
            } catch (e) {
                // Can't read content, classify by filename only
            }
        }

        // Constrained Classification Prompt
        const validFolders = getValidFolders();
        const prompt = `SYSTEM: You are a JSON categorization engine.
USER: Classify the file "${filename}"${contentSnippet ? `\nContent preview: "${contentSnippet.substring(0, 200)}..."` : ''}.
OPTIONS: ${JSON.stringify(validFolders)}
RESPONSE RULES:
1. Return ONLY the exact string from OPTIONS.
2. Do not explain.
3. If uncertain, return "99_Unsorted".
4. Response must be valid JSON: {"folder": "OPTION_VALUE"}`;

        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'phi3',
                prompt: prompt,
                stream: false,
                format: 'json',
                options: {
                    temperature: 0.1, // Low temperature for deterministic output
                    num_predict: 50 // Short response
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.statusText}`);
        }

        const data = await response.json();
        let result;

        try {
            result = JSON.parse(data.response);
        } catch (e) {
            // Try to extract JSON from response
            const match = data.response.match(/\{.*\}/s);
            if (match) {
                result = JSON.parse(match[0]);
            } else {
                throw new Error('Invalid JSON response from AI');
            }
        }

        // Validate that folder exists in taxonomy
        if (result.folder && getValidFolders().includes(result.folder)) {
            return {
                folder: result.folder,
                reason: 'AI Classification (Constrained)',
                stage: 'Stage 3: AI Arbiter',
                confidence: 'medium'
            };
        } else {
            // AI returned invalid folder, fallback to Unsorted
            return {
                folder: '99_Unsorted',
                reason: 'AI returned invalid category',
                stage: 'Stage 3: AI Arbiter (Fallback)',
                confidence: 'low'
            };
        }

    } catch (error) {
        console.error('[AI Arbiter] Classification error:', error.message);
        return null; // Will trigger unsorted fallback
    }
}

/**
 * Helper: Calculate MD5 hash of a file
 * Used for duplicate detection
 */
function calculateMD5(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(fileBuffer).digest('hex');
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

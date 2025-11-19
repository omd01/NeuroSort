const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const os = require('os');
const { exec, spawn } = require('child_process');

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

// --- Hybrid Sort Engine ---

const EXTENSIONS = {
    assets: ['.jpg', '.jpeg', '.png', '.svg', '.gif', '.mp4', '.mov', '.avi', '.mp3', '.wav'],
    code: ['.js', '.jsx', '.ts', '.tsx', '.py', '.html', '.css', '.json', '.java', '.cpp', '.c', '.h', '.sql'],
    docs: ['.pdf', '.docx', '.doc', '.txt', '.md', '.pptx', '.xlsx', '.csv']
};

async function processDirectory(folderPath, event) {
    console.log('[DEBUG] processDirectory called for:', folderPath);
    const files = await fs.promises.readdir(folderPath);
    console.log('[DEBUG] Files found:', files.length);
    const results = [];

    // Filter valid files first to get accurate count
    const validFiles = [];
    for (const file of files) {
        const filePath = path.join(folderPath, file);
        try {
            const stats = await fs.promises.stat(filePath);
            if (stats.isFile() && !file.startsWith('.') && file !== 'desktop.ini') {
                validFiles.push(file);
            }
        } catch (e) { }
    }

    const totalFiles = validFiles.length;
    console.log('[DEBUG] Valid files to process:', totalFiles);
    event.reply('processing-start', { total: totalFiles });
    console.log('[DEBUG] Sent processing-start event');

    // Concurrency Control
    const CONCURRENCY_LIMIT = 3; // Reduced for heavier AI tasks
    const queue = [...validFiles];
    const activePromises = [];

    const processNext = async () => {
        if (queue.length === 0) return;
        const filename = queue.shift();
        console.log('[DEBUG] Processing next file:', filename);
        const filePath = path.join(folderPath, filename);

        try {
            const stats = await fs.promises.stat(filePath);
            if (stats.isDirectory()) return; // Skip directories

            const ext = path.extname(filename).toLowerCase();

            // Skip hidden files or system files
            if (filename.startsWith('.') || filename === 'desktop.ini') return;

            event.reply('log-update', { msg: `Analyzing: ${filename}`, type: 'process' });

            // AI Analysis
            const analysis = await classifyWithOllama(filePath, filename);

            // Determine Destination
            let folderName = 'Unsorted';
            let reason = 'Default';

            if (analysis) {
                folderName = analysis.folder || 'Unsorted';
                reason = analysis.description || 'AI Classification';
            } else {
                // Fallback Heuristics
                if (EXTENSIONS.assets.includes(ext)) folderName = 'Assets_Misc';
                else if (EXTENSIONS.code.includes(ext)) folderName = 'Code_Misc';
                else if (EXTENSIONS.docs.includes(ext)) folderName = 'Docs_Misc';
                reason = 'Fallback Heuristic';
            }

            // Sanitize Folder Name
            folderName = folderName.replace(/[^a-zA-Z0-9_\- ]/g, '').trim();
            if (folderName.length === 0) folderName = 'Unsorted';

            const destFolder = path.join(folderPath, folderName);

            // Create Directory if needed
            if (!fs.existsSync(destFolder)) {
                await fs.promises.mkdir(destFolder, { recursive: true });
            }

            // Move File
            const destPath = path.join(destFolder, filename);
            if (filePath !== destPath) {
                // Handle collisions
                let finalDestPath = destPath;
                if (fs.existsSync(finalDestPath)) {
                    const namePart = path.basename(filename, ext);
                    finalDestPath = path.join(destFolder, `${namePart}_${Date.now()}${ext}`);
                }

                await fs.promises.rename(filePath, finalDestPath);

                const fileData = {
                    name: filename,
                    type: EXTENSIONS.assets.includes(ext) ? 'image' : 'doc',
                    size: (stats.size / 1024).toFixed(1) + 'KB',
                    dest: folderName,
                    reason: reason
                };
                results.push(fileData);
                event.reply('log-update', { msg: `Moved ${filename} -> ${folderName}`, type: 'success' });
                event.reply('file-processed', fileData);
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

    // 4. Post-Processing: Generate .neurosort metadata
    event.reply('log-update', { msg: "Generating folder context metadata...", type: "info" });

    // Get unique set of destination folders
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

    event.reply('processing-complete');
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

async function classifyWithOllama(filePath, filename) {
    try {
        const ext = path.extname(filename).toLowerCase();
        const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(ext);

        let model = 'phi3';
        let prompt = '';
        let images = [];

        if (isImage) {
            model = 'llava'; // Vision model
            const imageBitmap = await fs.promises.readFile(filePath);
            images = [imageBitmap.toString('base64')];
            prompt = `
            Analyze this image and suggest a hierarchical folder path.
            Rules:
            1. Use "Parent/Child" format (e.g., "Marketing/Social", "Design/Logos", "Personal/Photos").
            2. Be specific.
            3. JSON Format: {"folder": "Parent/Child", "description": "Brief description"}
            `;
        } else {
            // Text/Code Analysis
            const buffer = Buffer.alloc(1000); // Read more context
            const fd = await fs.promises.open(filePath, 'r');
            await fd.read(buffer, 0, 1000, 0);
            await fd.close();
            const content = buffer.toString('utf-8').replace(/\0/g, '');

            prompt = `
            Analyze this file and suggest a hierarchical folder path.
            Filename: '${filename}'
            Content Snippet: "${content}"
            
            Rules:
            1. Use "Parent/Child" format (e.g., "Marketing/Scripts", "Development/React", "Finance/Invoices").
            2. Group related items logically.
            3. JSON Format: {"folder": "Parent/Child", "description": "Brief rationale"}
            `;
        }

        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: model,
                prompt: prompt,
                images: images.length > 0 ? images : undefined,
                stream: false,
                format: 'json'
            })
        });

        if (!response.ok) throw new Error(`Ollama API error: ${response.statusText}`);

        const data = await response.json();
        let result;
        try {
            result = JSON.parse(data.response);
        } catch (e) {
            const match = data.response.match(/\{.*\}/s);
            if (match) result = JSON.parse(match[0]);
        }

        return result;

    } catch (error) {
        console.error('Ollama classification error:', error);
        return null;
    }
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

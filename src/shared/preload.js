const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    startProcessing: (path) => ipcRenderer.send('start-sort', path),
    onLog: (callback) => ipcRenderer.on('log-update', (event, data) => callback(data)),
    onProcessingComplete: (callback) => ipcRenderer.on('processing-complete', (event, data) => callback(data)),
    removeLogListener: () => ipcRenderer.removeAllListeners('log-update'),
    removeCompleteListener: () => ipcRenderer.removeAllListeners('processing-complete'),
    checkPrerequisites: () => ipcRenderer.invoke('check-prerequisites'),
    installOllama: () => ipcRenderer.invoke('install-ollama'),
    pullModel: (model) => ipcRenderer.invoke('pull-model', model),
    onFileProcessed: (callback) => ipcRenderer.on('file-processed', (event, file) => callback(file)),
    onProcessingStart: (callback) => ipcRenderer.on('processing-start', (event, data) => callback(data)),
    removeFileListener: () => ipcRenderer.removeAllListeners('file-processed'),
    onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (event, data) => callback(data)),
    removeDownloadProgressListener: () => ipcRenderer.removeAllListeners('download-progress'),
    onSystemStats: (callback) => ipcRenderer.on('system-stats', (event, data) => callback(data)),
    removeSystemStatsListener: () => ipcRenderer.removeAllListeners('system-stats'),
    // New events for real-time stage visibility
    onFileProcessingStatus: (callback) => ipcRenderer.on('file-processing-status', (event, data) => callback(data)),
    removeFileProcessingStatusListener: () => ipcRenderer.removeAllListeners('file-processing-status'),
    onFunnelStats: (callback) => ipcRenderer.on('funnel-stats', (event, data) => callback(data)),
    removeFunnelStatsListener: () => ipcRenderer.removeAllListeners('funnel-stats'),
    onFileDuplicateDetected: (callback) => ipcRenderer.on('file-duplicate-detected', (event, data) => callback(data)),
    removeFileDuplicateListener: () => ipcRenderer.removeAllListeners('file-duplicate-detected')
});

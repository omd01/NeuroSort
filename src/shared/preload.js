const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    startProcessing: (path) => ipcRenderer.send('start-sort', path),
    onLog: (callback) => ipcRenderer.on('log-update', (event, data) => callback(data)),
    onProcessingComplete: (callback) => ipcRenderer.on('processing-complete', () => callback()),
    removeLogListener: () => ipcRenderer.removeAllListeners('log-update'),
    removeCompleteListener: () => ipcRenderer.removeAllListeners('processing-complete'),
    checkPrerequisites: () => ipcRenderer.invoke('check-prerequisites'),
    installOllama: () => ipcRenderer.invoke('install-ollama'),
    pullModel: (model) => ipcRenderer.invoke('pull-model', model),
    onFileProcessed: (callback) => ipcRenderer.on('file-processed', (event, data) => callback(data)),
    removeFileListener: () => ipcRenderer.removeAllListeners('file-processed'),
    onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (event, data) => callback(data)),
    removeDownloadProgressListener: () => ipcRenderer.removeAllListeners('download-progress')
});

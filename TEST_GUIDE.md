# NeuroSort Test Guide

## Prerequisites
- Node.js installed
- Ollama installed and running (`ollama serve`)
- `phi3` or `llama3` model pulled (`ollama pull phi3`)

## Manual Verification Steps

### 1. Setup
1.  Clone/Open the repository.
2.  Run `npm install`.
3.  Start the development server: `npm run dev`.

### 2. Mocking Ollama (Optional)
If you don't have Ollama installed, you can mock the API in `src/main/main.js`:
        - `script.js`
        - `invoice.pdf`
        - `notes.txt`
    - Click "Start Arrangement".
5.  **Step 4: Processing**:
    - Watch the logs in the right panel.
    - Verify that files are being moved to `00_Dev`, `01_Assets`, etc. in your file explorer.
6.  **Step 5: Completion**:
    - App should show "Workspace Harmonized".
    - Verify the `test_folder` structure.

## Packaging
To create a distributable executable:

### Windows
```bash
npm run build
npm run dist
```
Output will be in `dist/` folder (e.g., `NeuroSort Setup 1.0.0.exe`).

### macOS
```bash
npm run build
npm run dist
```
Output will be in `dist/` folder (e.g., `NeuroSort-1.0.0.dmg`).

## Troubleshooting
- **Ollama Error**: Ensure Ollama is running on port 11434. Check logs for "Ollama API error".
- **Permission Error**: Ensure the app has read/write access to the selected folder.

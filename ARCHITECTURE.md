# NeuroSort Architecture Documentation

## 1. Overview
NeuroSort is a local-first, AI-powered desktop application designed to organize file chaos. It uses a hybrid approach combining heuristic analysis (file extensions) and local Large Language Models (LLMs) via Ollama to intelligently classify, rename, and sort files into a hierarchical directory structure.

## 2. Tech Stack
- **Frontend**: React, Vite, TailwindCSS
- **Backend**: Electron (Main Process), Node.js
- **AI Engine**: Ollama (Local Inference)
  - **Text Model**: `phi3` (3.8B parameters) - Optimized for speed and reasoning.
  - **Vision Model**: `llava` (7B parameters) - Used for image analysis.
- **Data Storage**: Local File System, `electron-store` for user preferences.

## 3. System Architecture

### 3.1. Process Model
The application runs on Electron's multi-process architecture:
- **Main Process ([src/main/main.js](file:///c:/code/NeuroSort/src/main/main.js))**:
  - Handles OS-level interactions (File System, Shell).
  - Manages the "Hybrid Sort Engine".
  - Communicates with the local Ollama instance via HTTP requests.
  - Exposes safe APIs to the Renderer via [preload.js](file:///c:/code/NeuroSort/src/shared/preload.js).
- **Renderer Process ([src/renderer/App.jsx](file:///c:/code/NeuroSort/src/renderer/App.jsx))**:
  - React-based UI.
  - Visualizes real-time progress, logs, and system stats.
  - Triggers sorting actions via IPC.

### 3.2. Data Flow
1.  **User Selection**: User selects a target directory in the UI.
2.  **Scanning**: Main process reads the directory (`fs.readdir`).
3.  **Queueing**: Files are added to a processing queue with a concurrency limit (Default: 3).
4.  **Hybrid Analysis**:
    *   **Heuristic Check**: Fast check for known extensions (e.g., `.jpg` -> Image, [.js](file:///c:/code/NeuroSort/vite.config.js) -> Code).
    *   **AI Inference**:
        *   **Images**: Sent to `llava` as Base64. Prompt asks for visual description and category.
        *   **Text/Code**: First 1KB read and sent to `phi3`. Prompt asks for context-aware categorization.
5.  **Decision Engine**:
    *   Combines AI output with fallback heuristics.
    *   Determines destination folder (e.g., `Marketing/Social`, `Finance/Invoices`).
6.  **Execution**:
    *   Creates directories (recursive).
    *   Moves/Renames files (handling collisions).
7.  **Feedback**: Emits `file-processed` and `log-update` events to UI.
8.  **Post-Processing**:
    *   Iterates through newly created folders.
    *   Generates `.neurosort` metadata files using `phi3` to summarize folder contents.

## 4. Sorting Algorithm (Hybrid Engine)

```mermaid
graph TD
    A[Start Processing] --> B{Is File?}
    B -- No --> C[Skip]
    B -- Yes --> D{Is Image?}
    D -- Yes --> E[Read Base64]
    D -- No --> F[Read Text Snippet]
    E --> G[Call Ollama (llava)]
    F --> H[Call Ollama (phi3)]
    G --> I[Parse JSON Response]
    H --> I
    I --> J{Valid JSON?}
    J -- Yes --> K[Use AI Category]
    J -- No --> L[Use Extension Heuristic]
    K --> M[Sanitize Path]
    L --> M
    M --> N[Move File]
    N --> O[Update UI]
```

## 5. Key Features
- **Hierarchical Sorting**: AI is prompted to return "Parent/Child" structures (e.g., `Documents/Legal`).
- **Context Awareness**: Generates `.neurosort` JSON files in each folder describing its contents.
- **Auto-Setup**: Automatically detects, downloads, and installs Ollama and required models.
- **Privacy**: 100% Local processing. No data leaves the machine.

## 6. Limitations
- **Performance**: Dependent on user hardware (GPU/RAM). Initial model loading can be slow.
- **File Types**: Deep analysis limited to text and images. Binary files (exe, zip) rely on heuristics.
- **Concurrency**: Limited to 3 parallel tasks to prevent freezing the UI or overloading the local LLM.
- **Context Window**: Only reads the first 1KB of text files to maintain speed.

## 7. Future Roadmap
- **RAG Integration**: Chat with your file system.
- **Custom Rules**: User-defined sorting rules via natural language.
- **Undo System**: Transaction log to reverse sorting actions.

# NeuroSort

<p align="center">
  <img src="NeuroSort_logo.png" alt="NeuroSort Logo" width="200"/>
</p>

<p align="center">
  <strong>Local AI-Powered File Organizer</strong><br>
  Stop wasting time searching through chaotic folders. Let AI organize your workspace.
</p>

<p align="center">
  <a href="https://github.com/omd01/NeuroSort/releases"><img src="https://img.shields.io/github/v/release/omd01/NeuroSort?style=flat-square" alt="Release"></a>
  <a href="#"><img src="https://img.shields.io/github/downloads/omd01/NeuroSort/total?style=flat-square" alt="Downloads"></a>
  <a href="https://github.com/omd01/NeuroSort/blob/main/LICENSE"><img src="https://img.shields.io/github/license/omd01/NeuroSort?style=flat-square" alt="License"></a>
</p>

---

## 🎯 What is NeuroSort?

NeuroSort is a **privacy-first desktop application** that uses a locally-running AI model (Phi-3) to intelligently organize your chaotic "Downloads" folder into a structured Twin-Directory system. **No cloud. No data collection. Just pure, local AI.**

### Key Features

- **🧠 Local LLM Processing** - Runs Phi-3 (3.8B params) entirely on your machine via Ollama
- **⚡ 3-Stage Funnel System** - 90% of files sorted using regex/metadata, only 10% touch AI
- **🔒 100% Privacy** - Zero data ever leaves your computer
- **📊 Real-time Dashboard** - Live funnel statistics showing which classification stage handled each file
- **🎨 Twin-Directory Architecture** - Automated separation of code, assets, and documents
- **💾 Ultra-Efficient** - ~1.2GB RAM usage (vs 6-8GB in v1.0)
- **🚀 150x Faster** - Process 150 files/minute with intelligent resource management

---

## 📥 Installation

### Prerequisites

- **Node.js** (v18 or higher)
- **Ollama** (for AI model serving)
- **~2.4GB Storage** (for Phi-3 model weights)
- **Min 1GB Free RAM**

### Quick Start

1. **Download** the latest release for your platform:
   - [Windows (.exe)](https://github.com/omd01/NeuroSort/releases/latest/download/NeuroSort-Setup.exe)
   - [macOS (.dmg)](https://github.com/omd01/NeuroSort/releases/latest/download/NeuroSort.dmg)
   - [Linux (.AppImage)](https://github.com/omd01/NeuroSort/releases/latest/download/NeuroSort.AppImage)

2. **Install Dependencies** (if not auto-configured):
   ```bash
   # Install Ollama (if not present)
   # Windows/macOS: Download from https://ollama.com
   
   # Pull the Phi-3 model
   ollama pull phi3
   ```

3. **Run NeuroSort** and follow the guided setup

---

## 🚀 Usage

### Basic Workflow

1. **Launch NeuroSort** - The app will automatically check for Ollama and Phi-3
2. **Select Folder** - Point it at your chaotic Downloads/Desktop folder
3. **Watch the Magic** - Real-time dashboard shows:
   - Files being processed
   - Which classification stage handled each file
   - Live funnel statistics (Regex/Metadata/AI breakdown)
4. **Done!** - Your files are now organized into logical categories

### The Twin-Directory System

```
📁 YourWorkspace/
├── 00_Dev_Source/          # All code files (.js, .py, .tsx, etc.)
├── 01_Brand_Identity/      # Logos, icons, fonts, brand assets
├── 02_Marketing_Assets/    # Social graphics, ads, banners
├── 03_Documents_Legal/     # Invoices, contracts, PDFs
├── 04_Design_Work/         # Figma, PSD, Sketch files
├── 05_Raw_Media/           # Camera footage, raw photos
├── 06_Research_Notes/      # Articles, PDFs, text notes
└── 99_Unsorted/            # Ambiguous files for manual review
```

---

## 🏗️ Architecture (v2.0)

NeuroSort uses a **3-Stage Funnel** to maximize speed and minimize AI usage:

### Stage 1: Regex Guard (0ms, 0MB RAM)
- Fast pattern matching on filenames
- Handles ~70% of files instantly
- Example: `*.js` → `00_Dev_Source`

### Stage 2: Metadata Analyst (5ms, 10MB RAM)
-Reads file headers/EXIF data
- Handles another ~20% of files
- Example: JPEG with Canon metadata → `05_Raw_Media`

### Stage 3: AI Arbiter (200ms+, 2GB RAM)
- Falls back to Phi-3 LLM for ambiguous files
- Handles final ~10%
- Auto-sleeps after 60s of inactivity to free RAM

**Result:** 150 files/minute vs 2 files/minute in v1.0

📖 [Read Full Architecture Docs](ARCHITECTURE.md)

---

## 🛠️ Development

### Build from Source

```bash
# Clone repository
git clone https://github.com/omd01/NeuroSort.git
cd NeuroSort

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build
```

### Project Structure

```
NeuroSort/
├── src/
│   ├── main/                 # Electron main process
│   │   ├── main.js          # App entry + IPC handlers
│   │   ├── ModelManager.js  # AI lifecycle management
│   │   ├── RegexGuard.js    # Stage 1 classifier
│   │   ├── MetadataAnalyst.js # Stage 2 classifier
│   │   └── taxonomy.js      # Master folder structure
│   ├── renderer/            # React frontend
│   │   ├── App.jsx          # Main UI orchestration
│   │   ├── ProcessingDashboard.jsx  # Real-time visualization
│   │   └── index.css        # Tailwind styles
│   └── shared/
│       └── preload.js       # IPC bridge
├── index.html               # Landing page (GitHub Pages)
└── package.json
```

---

## 📊 Performance Metrics

| Metric | v1.0 (Legacy) | v2.0 (Current) |
|--------|---------------|----------------|
| RAM Usage | 6-8GB (Persistent) | 1.2-2.5GB (Dynamic) |
| Throughput | ~2 files/min | ~150 files/min |
| AI Model | Llava + Phi3 | Phi3 Mini only |
| Logic | Generative (AI invents folders) | Discriminative (AI picks from list) |

---

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Roadmap

- [ ] M1/M2 Mac native ARM builds
- [ ] Batch processing mode for 1000+ files
- [ ] Custom taxonomy editor
- [ ] Cloud sync option (opt-in)
- [ ] Multi-language support

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

---

## 👨‍💻 Author

**Om Dahale**  
- GitHub: [@omd01](https://github.com/omd01)
- Project: [NeuroSort](https://github.com/omd01/NeuroSort)

---

## 🙏 Acknowledgments

- Built with [Electron](https://www.electronjs.org/)
- AI powered by [Ollama](https://ollama.com/) + [Phi-3](https://huggingface.co/microsoft/Phi-3-mini-4k-instruct)
- UI with [React](https://react.dev/) + [Tailwind CSS](https://tailwindcss.com/)

---

<p align="center">
  <strong>Stop Organizing. Start Creating.</strong><br>
  Download NeuroSort and reclaim your workspace.
</p>

<p align="center">
  <a href="https://github.com/omd01/NeuroSort/releases/latest">
    <img src="https://img.shields.io/badge/Download-Latest%20Release-blue?style=for-the-badge" alt="Download Latest Release"/>
  </a>
</p>

NeuroSort v2.0: High-Efficiency Backend Architecture1. Executive Summary of ImprovementsThis document details the architecture overhaul for NeuroSort v2.0. The primary goals are to eliminate "Taxonomy Hallucination" (preventing the creation of fragmented folders like "Logo" vs "Logos") and drastically reduce system resource usage.Metricv1.0 (Legacy)v2.0 (Current)RAM Usage6GB - 8GB (Persistent)1.2GB - 2.5GB (Dynamic)Sorting LogicGenerative (AI invents folders)Discriminative (AI maps to Master List)AI ModelVision (Llava) + Text (Phi3)Text-Only (Phi3 Mini 4k)Throughput~2 files / minute~150 files / minute2. Core Architecture: The "Funnel" SystemThe v2.0 backend abandons the "AI-for-everything" approach. Instead, it uses a 3-Stage Funnel designed to filter out 90% of files before they ever touch the expensive AI model.Stage 1: The Regex Guard (Cost: 0ms, 0MB RAM)Logic: Before any processing, check the filename against a hard-coded library of regular expressions.Action: If a match is found, move immediately. Do not query AI.^.*\.(svg|eps|ai)$ OR .*(logo|icon|brand).* → 01_Brand_Identity^.*\.(js|jsx|tsx|py|rb|php|css|scss)$ → 00_Dev_Source.*(invoice|receipt|contract|nda).* → 03_Documents_Legal^Screenshot.* → 99_ScreenshotsStage 2: The Metadata Analyst (Cost: 5ms, 10MB RAM)Logic: If Regex fails, read the file header/metadata (not the content).Action: Use specific markers to classify without AI.Images: Check EXIF data.Camera Model present (Canon/Sony/iPhone)? → 05_Raw_Media (Photography)No EXIF + Dimensions < 512x512? → 01_Brand_Identity (Icons)No EXIF + Dimensions > 1920x1080? → 02_Marketing_Assets (Wallpapers/Design)Documents:PDF Author = "Figma"? → 04_Design_SpecsStage 3: The AI Arbiter (Cost: 200ms+, 2GB RAM)Logic: Only for the "Ambiguous 10%". Files that pass Stage 1 and 2 (e.g., draft_v2.pdf, notes.txt, image_03.png).Action:Wake: Load Phi-3 model into RAM (if not loaded).Classify: Send filename + first 500 chars of text (if doc) to LLM.Constraint: Force LLM to pick from MASTER_TAXONOMY.Sleep: Unload model if queue is empty for >60 seconds.3. The "Constrained Classification" AlgorithmWe no longer allow the LLM to generate text. We force it to output a JSON index.The Taxonomy:const MASTER_TAXONOMY = {
  "00_Dev_Source": ["code", "scripts", "config", "json", "env"],
  "01_Brand_Identity": ["logos", "icons", "fonts", "palettes"],
  "02_Marketing_Assets": ["ads", "social_posts", "banners", "copy"],
  "03_Documents_Legal": ["invoices", "contracts", "tax", "licenses"],
  "04_Design_Work": ["psd", "ai", "figma", "sketches"],
  "05_Raw_Media": ["video_footage", "photos_raw", "audio_recordings"],
  "06_Research_Notes": ["pdfs", "articles", "ebooks", "text_notes"],
  "99_Unsorted": ["fallback"]
};
The Prompt Engineering:SYSTEM: You are a JSON categorization engine.
USER: Classify the file "marketing_Q4_budget.xlsx".
OPTIONS: ["00_Dev", "01_Brand", "02_Marketing", "03_Legal", "04_Design", "05_Media"]
RESPONSE RULES:
1. Return ONLY the exact string from OPTIONS.
2. Do not explain.
3. If uncertain, return "99_Unsorted".
4. Resource Management: The "Wake/Sleep" CycleTo prevent the "6-8GB RAM drain," the backend implements a strict lifecycle manager for the Ollama process.The ModelManager Class (Main Process)class ModelManager {
    constructor() {
        this.timer = null;
        this.isLoaded = false;
    }

    async wake() {
        if (this.isLoaded) {
            this.resetSleepTimer();
            return;
        }
        // Trigger Ollama load
        await exec('ollama run phi3 --keepalive 5m'); 
        this.isLoaded = true;
        this.resetSleepTimer();
    }

    resetSleepTimer() {
        clearTimeout(this.timer);
        // Auto-kill after 60s of inactivity
        this.timer = setTimeout(() => this.sleep(), 60000); 
    }

    async sleep() {
        // Free RAM
        await fetch('http://localhost:11434/api/generate', { model: 'phi3', keep_alive: 0 });
        this.isLoaded = false;
        console.log("Resources released.");
    }
}
5. Data Structures & Error HandlingThe Processing QueueWe use a p-limit based queue to ensure disk I/O stability.Concurrency: 5 (Max parallel files processed).Debounce: UI updates are sent in batches of 10, not 1-by-1, to keep the frontend smooth.Collision StrategyWhat happens if Logo.png already exists in 01_Brand_Identity?Check Hash: Calculate MD5 of both files.If Match: Delete source (It's a duplicate).If Diff: Rename source to Logo_{timestamp}.png.6. Implementation Roadmap (Migration from v1.0)Modify main.js: Strip out the vision model calls (llava). Replace with fs.stat calls for heuristics.Create taxonomy.js: Define the rigid folder structure.Update ipcHandlers: Implement the ModelManager class to handle start/stop logic.Refine Prompt: Switch from "Describe this image" to "Classify this filename".7. Professional Insight: "Determinism over Intelligence"Strategic Note: The flaw in v1.0 was relying on "Intelligence" (AI) for a task that requires "Determinism" (Sorting).In systems architecture, predictability is valuable. A heuristic rule (.jpg < 50kb = Icon) is 100% predictable and instant. An AI judgment is probabilistic and slow.The "Golden Rule" for Local AI Apps:"Only use the AI when traditional code fails."By moving 90% of the logic to Regex/Heuristics, you transform the app from a "Cool Demo" into a "Production Tool."
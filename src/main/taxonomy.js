/**
 * NeuroSort v2.0 - Master Taxonomy & Regex Rules
 * 
 * This module defines the rigid folder structure and regex patterns
 * to eliminate "Taxonomy Hallucination" from v1.0
 */

// Master Taxonomy - Fixed folder structure (AI must choose from these only)
const MASTER_TAXONOMY = {
    "00_Dev_Source": {
        keywords: ["code", "scripts", "config", "json", "env", "development"],
        extensions: [".js", ".jsx", ".ts", ".tsx", ".py", ".html", ".css", ".json", ".java", ".cpp", ".c", ".h", ".sql", ".php", ".rb", ".go", ".rs"]
    },
    "01_Brand_Identity": {
        keywords: ["logos", "icons", "fonts", "palettes", "brand", "logo", "icon"],
        extensions: [".svg", ".eps", ".ai"]
    },
    "02_Marketing_Assets": {
        keywords: ["ads", "social_posts", "banners", "copy", "marketing", "promo", "campaign"],
        extensions: []
    },
    "03_Documents_Legal": {
        keywords: ["invoices", "contracts", "tax", "licenses", "invoice", "receipt", "contract", "nda", "legal"],
        extensions: [".pdf", ".docx", ".doc"]
    },
    "04_Design_Work": {
        keywords: ["psd", "figma", "sketches", "design", "mockup"],
        extensions: [".psd", ".ai", ".sketch", ".fig", ".xd"]
    },
    "05_Raw_Media": {
        keywords: ["video_footage", "photos_raw", "audio_recordings", "raw", "footage"],
        extensions: [".mp4", ".mov", ".avi", ".mkv", ".raw", ".cr2", ".nef", ".wav", ".flac"]
    },
    "06_Research_Notes": {
        keywords: ["pdfs", "articles", "ebooks", "text_notes", "research", "notes", "paper"],
        extensions: [".pdf", ".txt", ".md", ".epub"]
    },
    "99_Unsorted": {
        keywords: ["fallback"],
        extensions: []
    }
};

// Regex Rules for Stage 1 (Instant Classification)
const REGEX_RULES = [
    // Brand Identity - SVG, EPS, AI files or logo/icon keywords
    {
        pattern: /^.*\.(svg|eps|ai)$/i,
        folder: "01_Brand_Identity",
        reason: "Vector graphics file"
    },
    {
        pattern: /.*(logo|icon|brand).*/i,
        folder: "01_Brand_Identity",
        reason: "Brand-related filename"
    },

    // Dev Source - Code files
    {
        pattern: /^.*\.(js|jsx|tsx|ts|py|rb|php|css|scss|less|sass|json|yml|yaml|env|sh|bat)$/i,
        folder: "00_Dev_Source",
        reason: "Source code file"
    },

    // Legal Documents - Invoice/Receipt/Contract keywords
    {
        pattern: /.*(invoice|receipt|contract|nda|legal|agreement).*/i,
        folder: "03_Documents_Legal",
        reason: "Legal document keyword"
    },

    // Screenshots - Screenshot keyword
    {
        pattern: /^screenshot.*/i,
        folder: "99_Unsorted",
        reason: "Screenshot file"
    },

    // Design Work - PSD, Sketch, Figma
    {
        pattern: /^.*\.(psd|sketch|fig|xd)$/i,
        folder: "04_Design_Work",
        reason: "Design source file"
    },

    // Raw Media - Video and RAW photo formats
    {
        pattern: /^.*\.(mp4|mov|avi|mkv|raw|cr2|nef|arw|wav|flac|m4a)$/i,
        folder: "05_Raw_Media",
        reason: "Raw media file"
    },

    // Research/Notes - Text/Markdown/PDF
    {
        pattern: /^.*\.(md|txt|epub)$/i,
        folder: "06_Research_Notes",
        reason: "Text/Note file"
    }
];

/**
 * Sanitize folder name to ensure filesystem compatibility
 * @param {string} folderName - Folder name to sanitize
 * @returns {string} - Sanitized folder name
 */
function sanitizeFolderName(folderName) {
    // Remove special characters, keep only alphanumeric, underscore, hyphen, space
    let sanitized = folderName.replace(/[^a-zA-Z0-9_\- ]/g, '').trim();

    // If empty after sanitization, return default
    if (sanitized.length === 0) {
        return '99_Unsorted';
    }

    return sanitized;
}

/**
 * Get all valid folder names from taxonomy
 * @returns {string[]} - Array of valid folder names
 */
function getValidFolders() {
    return Object.keys(MASTER_TAXONOMY);
}

/**
 * Validate if a folder name exists in taxonomy
 * @param {string} folderName - Folder name to validate
 * @returns {boolean} - True if valid
 */
function isValidFolder(folderName) {
    return MASTER_TAXONOMY.hasOwnProperty(folderName);
}

module.exports = {
    MASTER_TAXONOMY,
    REGEX_RULES,
    sanitizeFolderName,
    getValidFolders,
    isValidFolder
};

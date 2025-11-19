/**
 * NeuroSort v2.0 - Stage 1: Regex Guard
 * 
 * Fast filename-based classification using regex patterns.
 * Cost: <1ms per file, 0MB RAM
 * Expected Hit Rate: 40-50% of files
 */

const { REGEX_RULES } = require('./taxonomy');

class RegexGuard {
    /**
     * Attempt to classify a file based on filename patterns
     * @param {string} filename - Name of the file to classify
     * @returns {Object|null} - Classification result or null if no match
     */
    static classify(filename) {
        for (const rule of REGEX_RULES) {
            if (rule.pattern.test(filename)) {
                return {
                    folder: rule.folder,
                    reason: rule.reason,
                    stage: 'Stage 1: Regex Guard',
                    confidence: 'high'
                };
            }
        }

        // No regex match found
        return null;
    }

    /**
     * Get statistics about regex rules
     * @returns {Object} - Statistics object
     */
    static getStats() {
        return {
            totalRules: REGEX_RULES.length,
            rulesByFolder: this._groupRulesByFolder()
        };
    }

    /**
     * Group rules by destination folder
     * @private
     */
    static _groupRulesByFolder() {
        const grouped = {};
        for (const rule of REGEX_RULES) {
            if (!grouped[rule.folder]) {
                grouped[rule.folder] = 0;
            }
            grouped[rule.folder]++;
        }
        return grouped;
    }
}

module.exports = RegexGuard;

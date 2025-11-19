/**
 * NeuroSort v2.0 - Model Manager
 * 
 * Manages Ollama model lifecycle with wake/sleep pattern.
 * Reduces RAM usage from 6-8GB (persistent) to 1.2-2.5GB (dynamic)
 */

class ModelManager {
    constructor() {
        this.timer = null;
        this.isLoaded = false;
        this.modelName = 'phi3';
        this.keepAliveSeconds = 300; // 5 minutes keepalive during active use
        this.autoUnloadSeconds = 60; // Auto-unload after 60 seconds of inactivity
        this.lastAccessTime = null;

        console.log('[ModelManager] Initialized with auto-unload after', this.autoUnloadSeconds, 'seconds');
    }

    /**
     * Wake up the model (load into RAM)
     * @returns {Promise<boolean>} - True if successfully loaded
     */
    async wake() {
        if (this.isLoaded) {
            console.log('[ModelManager] Model already loaded, resetting sleep timer');
            this.resetSleepTimer();
            return true;
        }

        try {
            console.log('[ModelManager] Waking model... Loading into RAM');

            // Trigger model load with keepalive
            const response = await fetch('http://localhost:11434/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.modelName,
                    prompt: 'test', // Simple prompt to load model
                    stream: false,
                    keep_alive: `${this.keepAliveSeconds}s`
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to load model: ${response.statusText}`);
            }

            this.isLoaded = true;
            this.lastAccessTime = Date.now();
            this.resetSleepTimer();

            console.log('[ModelManager] ✓ Model loaded successfully');
            return true;

        } catch (error) {
            console.error('[ModelManager] ✗ Failed to wake model:', error.message);
            return false;
        }
    }

    /**
     * Reset the auto-sleep timer
     */
    resetSleepTimer() {
        this.lastAccessTime = Date.now();

        // Clear existing timer
        if (this.timer) {
            clearTimeout(this.timer);
        }

        // Set new timer for auto-unload
        this.timer = setTimeout(() => {
            this.sleep();
        }, this.autoUnloadSeconds * 1000);
    }

    /**
     * Sleep the model (unload from RAM)
     * @returns {Promise<void>}
     */
    async sleep() {
        if (!this.isLoaded) {
            console.log('[ModelManager] Model already unloaded');
            return;
        }

        try {
            console.log('[ModelManager] Sleeping model... Freeing RAM');

            // Unload model by setting keep_alive to 0
            const response = await fetch('http://localhost:11434/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.modelName,
                    prompt: '',
                    keep_alive: 0
                })
            });

            this.isLoaded = false;
            this.lastAccessTime = null;

            console.log('[ModelManager] ✓ Model unloaded, RAM released');

        } catch (error) {
            console.error('[ModelManager] ✗ Error during sleep:', error.message);
            // Mark as unloaded anyway
            this.isLoaded = false;
        }
    }

    /**
     * Force immediate unload (cleanup on app exit)
     */
    async forceUnload() {
        if (this.timer) {
            clearTimeout(this.timer);
        }
        await this.sleep();
    }

    /**
     * Get current status
     * @returns {Object} - Status information
     */
    getStatus() {
        return {
            isLoaded: this.isLoaded,
            modelName: this.modelName,
            lastAccessTime: this.lastAccessTime,
            autoUnloadSeconds: this.autoUnloadSeconds,
            idleSeconds: this.lastAccessTime ? Math.floor((Date.now() - this.lastAccessTime) / 1000) : null
        };
    }

    /**
     * Change model name (if needed)
     * @param {string} modelName - New model name
     */
    setModel(modelName) {
        if (this.isLoaded) {
            console.warn('[ModelManager] Cannot change model while loaded. Unload first.');
            return false;
        }
        this.modelName = modelName;
        console.log('[ModelManager] Model changed to:', modelName);
        return true;
    }
}

// Singleton instance
const modelManager = new ModelManager();

module.exports = modelManager;

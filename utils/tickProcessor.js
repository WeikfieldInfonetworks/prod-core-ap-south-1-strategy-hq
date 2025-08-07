class TickProcessor {
    constructor(maxConcurrent = 10) {
        this.maxConcurrent = maxConcurrent;
        this.activeProcessors = 0;
        this.queue = [];
        this.processingStats = {
            totalProcessed: 0,
            totalErrors: 0,
            averageProcessingTime: 0,
            lastProcessedAt: null
        };
    }

    /**
     * Process ticks for a user asynchronously
     * @param {string} userId - The user ID
     * @param {Array} tickData - The tick data to process
     * @param {Function} processFunction - The function to process ticks
     * @param {Function} emitFunction - The function to emit results
     * @returns {Promise} - Promise that resolves when processing is complete
     */
    async processUserTicks(userId, tickData, processFunction, emitFunction) {
        return new Promise((resolve, reject) => {
            const processTask = () => {
                const startTime = Date.now();
                
                try {
                    const userData = processFunction(userId, tickData);
                    const processingTime = Date.now() - startTime;
                    
                    // Update stats
                    this.updateStats(processingTime, false);
                    
                    if (userData) {
                        emitFunction(`user_${userId}`, "node_update", userData);
                        console.log(`✅ Processed ticks for user ${userId} in ${processingTime}ms`);
                    } else {
                        console.warn(`⚠️ No user data returned for user ${userId}`);
                    }
                    
                    resolve({ userId, success: true, processingTime });
                } catch (error) {
                    const processingTime = Date.now() - startTime;
                    this.updateStats(processingTime, true);
                    
                    console.error(`❌ Error processing ticks for user ${userId}:`, error);
                    
                    // Emit error to the specific user
                    emitFunction(`user_${userId}`, "processing_error", {
                        error: "Failed to process ticks",
                        timestamp: new Date().toISOString()
                    });
                    
                    reject({ userId, error, processingTime });
                } finally {
                    this.activeProcessors--;
                    this.processNextInQueue();
                }
            };

            // Add to queue or process immediately
            if (this.activeProcessors >= this.maxConcurrent) {
                this.queue.push(processTask);
            } else {
                this.activeProcessors++;
                setImmediate(processTask);
            }
        });
    }

    /**
     * Process ticks for multiple users with controlled concurrency
     * @param {Array} activeUsers - Array of user IDs
     * @param {Array} tickData - The tick data to process
     * @param {Function} processFunction - The function to process ticks
     * @param {Function} emitFunction - The function to emit results
     * @returns {Promise} - Promise that resolves when all processing is complete
     */
    async processMultipleUsers(activeUsers, tickData, processFunction, emitFunction) {
        if (activeUsers.length === 0) {
            console.log('📊 No active users to process ticks for');
            return [];
        }

        console.log(`📊 Processing ticks for ${activeUsers.length} active users with controlled concurrency`);

        const promises = activeUsers.map(userId => 
            this.processUserTicks(userId, tickData, processFunction, emitFunction)
        );

        try {
            const results = await Promise.allSettled(promises);
            
            // Log summary
            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;
            
            console.log(`📊 Tick processing complete: ${successful} successful, ${failed} failed`);
            
            return results;
        } catch (error) {
            console.error('❌ Error in batch tick processing:', error);
            throw error;
        }
    }

    /**
     * Process next item in the queue
     */
    processNextInQueue() {
        if (this.queue.length > 0 && this.activeProcessors < this.maxConcurrent) {
            this.activeProcessors++;
            const task = this.queue.shift();
            setImmediate(task);
        }
    }

    /**
     * Update processing statistics
     * @param {number} processingTime - Time taken to process
     * @param {boolean} isError - Whether this was an error
     */
    updateStats(processingTime, isError) {
        this.processingStats.totalProcessed++;
        this.processingStats.lastProcessedAt = new Date();
        
        if (isError) {
            this.processingStats.totalErrors++;
        }
        
        // Update average processing time
        const currentAvg = this.processingStats.averageProcessingTime;
        const newAvg = (currentAvg * (this.processingStats.totalProcessed - 1) + processingTime) / this.processingStats.totalProcessed;
        this.processingStats.averageProcessingTime = newAvg;
    }

    /**
     * Get current processing statistics
     * @returns {Object} Processing statistics
     */
    getStats() {
        return {
            ...this.processingStats,
            queueLength: this.queue.length,
            activeProcessors: this.activeProcessors,
            maxConcurrent: this.maxConcurrent
        };
    }

    /**
     * Reset processing statistics
     */
    resetStats() {
        this.processingStats = {
            totalProcessed: 0,
            totalErrors: 0,
            averageProcessingTime: 0,
            lastProcessedAt: null
        };
    }
}

module.exports = TickProcessor; 
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
            const processTask = async () => {
                const startTime = Date.now();
                
                try {
                    const userData = await processFunction(userId, tickData);
                    const processingTime = Date.now() - startTime;
                    
                    // Update stats
                    this.updateStats(processingTime, false);
                    
                    if (userData) {
                        try {
                            emitFunction(`user_${userId}`, "node_update", userData);
                            console.log(`Processed ticks for user ${userId} in ${processingTime}ms`);
                            resolve({ userId, success: true, processingTime });
                        } catch (emitError) {
                            console.error(`Error emitting data for user ${userId}:`, emitError);
                            reject({ userId, error: emitError, processingTime });
                        }
                    } else {
                        console.warn(`⚠️ No user data returned for user ${userId}`);
                        resolve({ userId, success: false, processingTime, reason: 'No data' });
                    }
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
                setImmediate(async () => {
                    try {
                        await processTask();
                    } catch (error) {
                        console.error('Error in processTask:', error);
                        reject({ userId, error, processingTime: Date.now() - Date.now() });
                    }
                });
            }
        });
    }

    /**
     * Create an immutable snapshot of tick data to ensure all instances see the same prices
     * @param {Array} tickData - The original tick data array
     * @returns {Object} Snapshot object with cloned tick data and timestamp
     */
    createTickSnapshot(tickData) {
        const snapshotTimestamp = Date.now();
        const snapshotTimeISO = new Date(snapshotTimestamp).toISOString();
        
        // Deep clone the tick data array to create an immutable snapshot
        // This ensures all instances see the same prices even if the original tick objects are mutated
        const clonedTickData = tickData.map(tick => {
            // Create a new object with all properties from the original tick
            // This prevents mutation of the original tick objects
            return {
                instrument_token: tick.instrument_token,
                symbol: tick.symbol,
                last_price: tick.last_price,  // Capture the price at snapshot time
            };
        });
        
        return {
            tickData: clonedTickData,
            snapshotTimestamp,
            snapshotTimeISO,
            originalTickCount: tickData.length
        };
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
            console.log('No active users to process ticks for');
            return;
        }
        
        // Create an immutable snapshot of tick data before processing
        // This ensures all instances see the same prices even if tick objects are mutated
        const snapshot = this.createTickSnapshot(tickData);
        console.log(`📸 Created tick snapshot at ${snapshot.snapshotTimeISO} for ${snapshot.originalTickCount} ticks`);
        console.log(`Processing ticks for ${activeUsers.length} active users with controlled concurrency`);
        
        // Process users with controlled concurrency, each getting the same snapshot
        const promises = activeUsers.map(userId => 
            this.processUserTicks(userId, snapshot.tickData, processFunction, emitFunction)
        );
        
        try {
            const results = await Promise.allSettled(promises);
            
            const successful = results.filter(r => r.status === 'fulfilled' && r.value?.success === true).length;
            const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value?.success === false)).length;
            const errors = results.filter(r => r.status === 'rejected').length;
            
            console.log(`Tick processing complete: ${successful} successful, ${failed} failed, ${errors} errors`);
            
            // Log detailed error information for debugging
            const rejectedResults = results.filter(r => r.status === 'rejected');
            if (rejectedResults.length > 0) {
                console.log(`Rejected promises details:`, rejectedResults.map(r => ({
                    reason: r.reason,
                    userId: r.reason?.userId,
                    error: r.reason?.error?.message || r.reason?.error
                })));
            }
            
        } catch (error) {
            console.error('Error in batch tick processing:', error);
        }
    }

    /**
     * Process next item in the queue
     */
    processNextInQueue() {
        if (this.queue.length > 0 && this.activeProcessors < this.maxConcurrent) {
            this.activeProcessors++;
            const task = this.queue.shift();
            setImmediate(async () => {
                try {
                    await task();
                } catch (error) {
                    console.error('Error in queued task:', error);
                    // The error handling should be already handled in the task itself
                }
            });
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
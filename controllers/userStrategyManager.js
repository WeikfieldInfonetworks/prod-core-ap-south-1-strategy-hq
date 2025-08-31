const StrategyManager = require('./strategyController');
const TradingUtils = require('../utils/tradingUtils');

class UserStrategyManager {
    constructor() {
        this.userInstances = new Map(); // userId -> StrategyManager instance
        this.userTradingUtils = new Map(); // userId -> TradingUtils instance
        this.userLogFiles = new Map(); // userId -> log file path
        this.socketIo = null; // Socket.IO server instance for real-time communication
    }

    // Set Socket.IO reference for real-time communication
    setSocketIo(socketIo) {
        this.socketIo = socketIo;
        console.log('✅ Socket.IO reference set in UserStrategyManager');
    }

    // Get or create user-specific strategy manager
    getUserStrategyManager(userId) {
        if (!this.userInstances.has(userId)) {
            console.log(`Creating new strategy manager for user: ${userId}`);
            const strategyManager = new StrategyManager();
            this.userInstances.set(userId, strategyManager);
        }
        return this.userInstances.get(userId);
    }

    // Get or create user-specific trading utils
    getUserTradingUtils(userId) {
        if (!this.userTradingUtils.has(userId)) {
            console.log(`Creating new trading utils for user: ${userId}`);
            const tradingUtils = new TradingUtils();
            this.userTradingUtils.set(userId, tradingUtils);
        }
        return this.userTradingUtils.get(userId);
    }

    // Set user credentials and initialize trading utils
    setUserCredentials(userId, userName, apiKey, secretKey, accessToken) {
        console.log(`Setting credentials for user: ${userId} (${userName})`);
        
        // Initialize trading utils for user
        const tradingUtils = this.getUserTradingUtils(userId);
        const initialized = tradingUtils.initializeKiteConnect(apiKey, accessToken);
        
        // Set user info in strategy manager
        const strategyManager = this.getUserStrategyManager(userId);
        strategyManager.setUserCredentials(userName, userId, apiKey, secretKey, accessToken);
        
        // Set user-specific log file
        const logFile = `logs/trading-logs-${userId}.txt`;
        this.userLogFiles.set(userId, logFile);
        tradingUtils.ensureLogDirectory(logFile);
        
        console.log(`User credentials set for ${userName} (${userId})`);
        console.log(`Log file: ${logFile}`);
        
        return initialized;
    }

    // Get strategy data without processing ticks (for parameter updates)
    getStrategyDataForUser(userId) {
        const strategyManager = this.getUserStrategyManager(userId);
        
        if (!strategyManager) {
            console.error(`No strategy manager found for user: ${userId}`);
            return null;
        }
        
        try {
            
            // Get current strategy info without processing ticks
            const currentStrategy = strategyManager.getCurrentStrategy();
            const selectedInstrument = currentStrategy?.selectedInstrument;
            
            return {
                tickData: [], // Empty since no ticks were processed
                ...strategyManager.getCurrentDictionaries(),
                currentStrategy: currentStrategy,
                selectedInstrument: selectedInstrument
            };
        } catch (error) {
            console.error(`Error getting strategy data for user ${userId}:`, error);
            return null;
        }
    }

    // Process ticks for specific user
    async processTicksForUser(userId, ticks) {
        const strategyManager = this.getUserStrategyManager(userId);
        const tradingUtils = this.getUserTradingUtils(userId);
        
        if (!strategyManager) {
            console.error(`No strategy manager found for user: ${userId}`);
            return;
        }
        
        try {
            console.log(`🔄 Processing ${ticks.length} ticks for user ${userId}`);
            
            // CRITICAL FIX: Ensure TradingUtils and Socket.IO are always injected before processing
            if (strategyManager.currentStrategy) {
                // Double-check that TradingUtils is available
                if (!strategyManager.currentStrategy.tradingUtils) {
                    console.log(`Re-injecting TradingUtils for user ${userId} before tick processing`);
                    strategyManager.currentStrategy.tradingUtils = tradingUtils;
                }
                
                // Double-check that Socket.IO is available
                if (!strategyManager.currentStrategy.socketIo && this.socketIo) {
                    console.log(`Re-injecting Socket.IO for user ${userId} before tick processing`);
                    const userName = strategyManager.userName || `User_${userId}`;
                    strategyManager.currentStrategy.setSocketIo(this.socketIo, userId, userName);
                }
                
                // Verify both TradingUtils and Socket.IO are properly injected
                if (!strategyManager.currentStrategy.tradingUtils) {
                    console.error(`CRITICAL ERROR: TradingUtils still not available for user ${userId} after injection attempt`);
                    return; // Skip processing if TradingUtils is not available
                }
                
                console.log(`✅ TradingUtils and Socket.IO verified for user ${userId} before tick processing`);
                console.log(`Socket.IO status: ${strategyManager.currentStrategy.socketIo ? 'Available' : 'Not Available'}`);
            } else {
                console.warn(`No current strategy for user ${userId} - skipping tick processing`);
                return;
            }
            
            // Process ticks through user's strategy manager (now async)
            await strategyManager.processTicks(ticks);
            
            // Get current strategy info
            const currentStrategy = strategyManager.getCurrentStrategy();
            const selectedInstrument = currentStrategy?.selectedInstrument;
            
            return {
                tickData: ticks,
                ...strategyManager.getCurrentDictionaries(),
                currentStrategy: currentStrategy,
                selectedInstrument: selectedInstrument
            };
        } catch (error) {
            console.error(`Error processing ticks for user ${userId}:`, error);
            return null;
        }
    }

    // Set strategy for specific user
    setStrategyForUser(userId, strategyName) {
        console.log('setStrategyForUser called:', { userId, strategyName });
        
        const strategyManager = this.getUserStrategyManager(userId);
        
        if (!strategyManager) {
            throw new Error(`No strategy manager found for user: ${userId}`);
        }
        
        // Get user info for logging
        const userLogFile = this.userLogFiles.get(userId);
        const userName = strategyManager.userName;
        const tradingUtils = this.getUserTradingUtils(userId);
        
        console.log(`Setting strategy ${strategyName} for user ${userName} (${userId})`);
        console.log('Strategy manager state:', {
            hasGlobalDict: !!strategyManager.globalDict,
            hasUniversalDict: !!strategyManager.globalDict,
            hasBlockDict: !!strategyManager.blockDict,
            hasTradingUtils: !!tradingUtils,
            hasApiKey: !!strategyManager.globalDict?.api_key,
            hasAccessToken: !!strategyManager.globalDict?.access_token
        });
        
        // Ensure credentials are available in globalDict
        if (!strategyManager.globalDict.api_key || !strategyManager.globalDict.access_token) {
            console.error('Missing credentials in globalDict for strategy initialization');
            console.error('Available keys:', Object.keys(strategyManager.globalDict || {}));
            throw new Error('Missing user credentials for strategy initialization');
        }
        
        const result = strategyManager.setStrategy(
            strategyName,
            strategyManager.globalDict,
            strategyManager.globalDict,
            strategyManager.blockDict
        );
        
        console.log('Strategy set result:', {
            name: result.name,
            hasUniversalDict: !!result.universalDict,
            instrumentMapKeys: result.universalDict?.instrumentMap ? Object.keys(result.universalDict.instrumentMap) : 'none'
        });
        
        // CRITICAL FIX: Inject TradingUtils and Socket.IO immediately after strategy initialization
        if (strategyManager.currentStrategy && userName && userId) {
            strategyManager.currentStrategy.setUserInfo(userName, userId);
            
            // Inject user's trading utils immediately and verify
            strategyManager.currentStrategy.tradingUtils = tradingUtils;
            
            // Inject Socket.IO reference for real-time communication
            if (this.socketIo) {
                strategyManager.currentStrategy.setSocketIo(this.socketIo, userId, userName);
                console.log(`✅ Socket.IO injected into strategy for user: ${userName} (${userId})`);
            } else {
                console.warn(`⚠️ Socket.IO not available for strategy injection for user: ${userName} (${userId})`);
            }
            
            // Verify that the strategy has access to credentials, TradingUtils, and Socket.IO
            console.log('Strategy integration verification:', {
                hasApiKey: !!strategyManager.currentStrategy.globalDict?.api_key,
                hasAccessToken: !!strategyManager.currentStrategy.accessToken,
                tradingUtilsInitialized: !!strategyManager.currentStrategy.tradingUtils?.kite,
                tradingUtilsInstance: !!strategyManager.currentStrategy.tradingUtils,
                socketIoInjected: !!strategyManager.currentStrategy.socketIo,
                userIdSet: strategyManager.currentStrategy.userId === userId,
                userNameSet: strategyManager.currentStrategy.userName === userName
            });
            
            // Additional safety check - ensure TradingUtils is properly injected
            if (!strategyManager.currentStrategy.tradingUtils) {
                console.error('CRITICAL ERROR: TradingUtils injection failed for user:', userId);
                throw new Error('TradingUtils injection failed - strategy cannot function properly');
            }
        }
        
        return result;
    }

    // Update global parameter for specific user
    updateGlobalParameterForUser(userId, parameter, value) {
        const strategyManager = this.getUserStrategyManager(userId);
        
        if (!strategyManager) {
            throw new Error(`No strategy manager found for user: ${userId}`);
        }
        
        return strategyManager.updateGlobalDictParameter(parameter, value);
    }

    // Update universal parameter for specific user
    updateUniversalParameterForUser(userId, parameter, value) {
        const strategyManager = this.getUserStrategyManager(userId);
        
        if (!strategyManager) {
            throw new Error(`No strategy manager found for user: ${userId}`);
        }
        
        return strategyManager.updateUniversalDictParameter(parameter, value);
    }

    // Get available strategies for user
    getAvailableStrategiesForUser(userId) {
        const strategyManager = this.getUserStrategyManager(userId);
        
        if (!strategyManager) {
            return [];
        }
        
        return strategyManager.getAvailableStrategies();
    }

    // Get current strategy for user
    getCurrentStrategyForUser(userId) {
        const strategyManager = this.getUserStrategyManager(userId);
        
        if (!strategyManager) {
            return null;
        }
        
        return strategyManager.getCurrentStrategy();
    }

    // Get user's trading utils
    getTradingUtilsForUser(userId) {
        return this.getUserTradingUtils(userId);
    }

    // Get user's log file
    getUserLogFile(userId) {
        return this.userLogFiles.get(userId);
    }

    // Remove user instance (cleanup)
    removeUserInstance(userId) {
        console.log(`Removing strategy manager for user: ${userId}`);
        this.userInstances.delete(userId);
        this.userTradingUtils.delete(userId);
        this.userLogFiles.delete(userId);
    }

    // Get all active users
    getActiveUsers() {
        return Array.from(this.userInstances.keys());
    }

    // Get user instance count
    getUserCount() {
        return this.userInstances.size;
    }
}

module.exports = UserStrategyManager; 
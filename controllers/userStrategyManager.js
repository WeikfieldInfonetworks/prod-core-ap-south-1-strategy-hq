const StrategyManager = require('./strategyController');
const TradingUtils = require('../utils/tradingUtils');

class UserStrategyManager {
    constructor() {
        this.userInstances = new Map(); // userId -> StrategyManager instance
        this.userTradingUtils = new Map(); // userId -> TradingUtils instance
        this.userLogFiles = new Map(); // userId -> log file path
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
            console.log(`📊 Getting strategy data for user ${userId} (no tick processing)`);
            
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
    processTicksForUser(userId, ticks) {
        const strategyManager = this.getUserStrategyManager(userId);
        const tradingUtils = this.getUserTradingUtils(userId);
        
        if (!strategyManager) {
            console.error(`No strategy manager found for user: ${userId}`);
            return;
        }
        
        try {
            console.log(`🔄 Processing ${ticks.length} ticks for user ${userId}`);
            
            // Inject the user's trading utils into the current strategy
            if (strategyManager.currentStrategy) {
                strategyManager.currentStrategy.tradingUtils = tradingUtils;
            }
            
            // Process ticks through user's strategy manager
            strategyManager.processTicks(ticks);
            
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
            hasUniversalDict: !!strategyManager.universalDict,
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
            strategyManager.universalDict,
            strategyManager.blockDict
        );
        
        console.log('Strategy set result:', {
            name: result.name,
            hasUniversalDict: !!result.universalDict,
            instrumentMapKeys: result.universalDict?.instrumentMap ? Object.keys(result.universalDict.instrumentMap) : 'none'
        });
        
        // Ensure the strategy has user info set and uses the user's trading utils
        if (strategyManager.currentStrategy && userName && userId) {
            strategyManager.currentStrategy.setUserInfo(userName, userId);
            strategyManager.currentStrategy.tradingUtils = tradingUtils; // Inject user's trading utils
            
            // Verify that the strategy has access to credentials
            console.log('Strategy credentials verification:', {
                hasApiKey: !!strategyManager.currentStrategy.globalDict?.api_key,
                hasAccessToken: !!strategyManager.currentStrategy.accessToken,
                tradingUtilsInitialized: !!strategyManager.currentStrategy.tradingUtils?.kite
            });
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
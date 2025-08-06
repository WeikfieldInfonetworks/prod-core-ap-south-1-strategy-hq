const fs = require('fs');
const path = require('path');

class StrategyManager {
    constructor() {
        this.strategies = new Map();
        this.currentStrategy = null;
        this.globalDict = {};
        this.universalDict = {};
        this.blockDict = {};
        this.accessToken = null;
        this.loadStrategies();
    }

    loadStrategies() {
        const strategiesDir = path.join(__dirname, '..', 'strategies');
        
        try {
            console.log('Loading strategies from:', strategiesDir);
            
            if (!fs.existsSync(strategiesDir)) {
                console.error('Strategies directory does not exist:', strategiesDir);
                return;
            }
            
            const files = fs.readdirSync(strategiesDir)
                .filter(file => file !== 'base.js' && file.endsWith('.js'));

            console.log('Found strategy files:', files);

            for (const file of files) {
                try {
                    const filePath = path.join(strategiesDir, file);
                    console.log('Loading strategy from:', filePath);
                    
                    const StrategyClass = require(filePath);
                    const strategy = new StrategyClass();
                    
                    this.strategies.set(strategy.name, strategy);
                    console.log(`Successfully loaded strategy: ${strategy.name}`);
                } catch (error) {
                    console.error(`Error loading strategy from ${file}:`, error);
                }
            }
            
            console.log(`Total strategies loaded: ${this.strategies.size}`);
            console.log('Available strategies:', Array.from(this.strategies.keys()));
        } catch (error) {
            console.error('Error loading strategies:', error);
        }
    }

    setAccessToken(accessToken) {
        this.accessToken = accessToken;
    }

    getAvailableStrategies() {
        const strategies = Array.from(this.strategies.values()).map(strategy => strategy.getConfig());
        console.log('Returning available strategies:', strategies.map(s => s.name));
        return strategies;
    }

    // Set strategy with user info
    setStrategy(strategyName, globalDict, universalDict, blockDict) {
        console.log('🔧 Setting strategy:', strategyName);
        console.log('📊 Dictionaries provided:', {
            globalDict: globalDict ? 'present' : 'missing',
            universalDict: universalDict ? 'present' : 'missing',
            blockDict: blockDict ? 'present' : 'missing'
        });
        
        const strategy = this.strategies.get(strategyName);
        if (!strategy) {
            throw new Error(`Strategy ${strategyName} not found`);
        }

        // Store references to the main dictionaries
        this.globalDict = globalDict || {};
        this.universalDict = universalDict || {};
        this.blockDict = blockDict || {};

        // Set user info if available
        if (this.userName && this.userId) {
            strategy.setUserInfo(this.userName, this.userId);
        }

        // Initialize the new strategy with access token
        strategy.initialize(this.globalDict, this.universalDict, this.blockDict, this.accessToken);
        this.currentStrategy = strategy;
        
        console.log(`✅ Strategy set to: ${strategyName}`);
        const config = strategy.getConfig();
        console.log('📊 Strategy config after initialization:', {
            name: config.name,
            universalDict: config.universalDict ? 'present' : 'missing',
            instrumentMap: config.universalDict?.instrumentMap ? 'present' : 'missing'
        });
        return config;
    }

    processTicks(ticks) {
        if (!this.currentStrategy) {
            console.warn('No strategy selected for tick processing');
            return;
        }
        
        try {
            this.currentStrategy.processTicks(ticks);
        } catch (error) {
            console.error('Error processing ticks:', error);
        }
    }

    getCurrentStrategy() {
        return this.currentStrategy ? this.currentStrategy.getConfig() : null;
    }

    getCurrentDictionaries() {
        return {
            globalDict: this.globalDict || {},
            universalDict: this.universalDict || {},
            blockDict: this.blockDict || {}
        };
    }

    updateGlobalDictParameter(parameterName, value) {
        if (!this.currentStrategy) {
            return false;
        }

        try {
            const success = this.currentStrategy.updateGlobalDictParameter(parameterName, value);
            if (success) {
                console.log(`Successfully updated globalDict parameter ${parameterName} to ${value}`);
            } else {
                console.error(`Failed to update globalDict parameter ${parameterName}`);
            }
            return success;
        } catch (error) {
            console.error(`Error updating globalDict parameter ${parameterName}:`, error);
            return false;
        }
    }

    updateUniversalDictParameter(parameterName, value) {
        if (!this.currentStrategy) {
            return false;
        }

        try {
            const success = this.currentStrategy.updateUniversalDictParameter(parameterName, value);
            if (success) {
                console.log(`Successfully updated universalDict parameter ${parameterName} to ${value}`);
            } else {
                console.error(`Failed to update universalDict parameter ${parameterName}`);
            }
            return success;
        } catch (error) {
            console.error(`Error updating universalDict parameter ${parameterName}:`, error);
            return false;
        }
    }

    setUserCredentials(userName, userId, apiKey, secretKey, accessToken) {
        this.userName = userName;
        this.userId = userId;
        this.globalDict.api_key = apiKey;
        this.globalDict.secret_key = secretKey;
        this.globalDict.access_token = accessToken;
        
        console.log(`👤 User credentials set: ${userName} (${userId})`);
        
        // Update current strategy with new credentials if exists
        if (this.currentStrategy) {
            this.currentStrategy.setUserInfo(userName, userId);
            this.currentStrategy.initialize(
                this.globalDict,
                this.universalDict,
                this.blockDict,
                accessToken
            );
        }
    }

    // Method to help with debugging dictionary updates
    debugDictionaryState() {
        if (!this.currentStrategy) {
            console.log("No strategy currently active");
            return;
        }
        
        console.log("Current Strategy:", this.currentStrategy.name);
        console.log("GlobalDict keys:", Object.keys(this.globalDict || {}));
        console.log("UniversalDict keys:", Object.keys(this.universalDict || {}));
        console.log("BlockDict keys:", Object.keys(this.blockDict || {}));
    }
}

module.exports = StrategyManager; 
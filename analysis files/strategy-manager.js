const fs = require('fs');
const path = require('path');

class StrategyManager {
    constructor() {
        this.strategies = new Map();
        this.currentStrategy = null;
        this.globalDict = null;
        this.universalDict = null;
        this.blockDict = null;
        this.accessToken = null;
        this.loadStrategies();
    }

    loadStrategies() {
        const strategiesDir = path.join(__dirname, 'strategies');
        const files = fs.readdirSync(strategiesDir)
            .filter(file => file !== 'base.js' && file.endsWith('.js'));

        for (const file of files) {
            const StrategyClass = require(path.join(strategiesDir, file));
            const strategy = new StrategyClass();
            this.strategies.set(strategy.name, strategy);
        }
    }

    setAccessToken(accessToken) {
        this.accessToken = accessToken;
    }

    getAvailableStrategies() {
        return Array.from(this.strategies.values()).map(strategy => strategy.getConfig());
    }

    setStrategy(strategyName, globalDict, universalDict, blockDict) {
        const strategy = this.strategies.get(strategyName);
        if (!strategy) {
            throw new Error(`Strategy ${strategyName} not found`);
        }

        // Store references to the main dictionaries
        this.globalDict = globalDict;
        this.universalDict = universalDict;
        this.blockDict = blockDict;

        // Initialize the new strategy with access token
        strategy.initialize(globalDict, universalDict, blockDict, this.accessToken);
        this.currentStrategy = strategy;
        return strategy.getConfig();
    }

    processTicks(ticks) {
        if (!this.currentStrategy) {
            throw new Error('No strategy selected');
        }
        this.currentStrategy.processTicks(ticks);
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
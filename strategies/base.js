/**
 * Abstract Base Strategy Class
 * All trading strategies must extend this class and implement required methods
 */
class BaseStrategy {
    constructor() {
        // Prevent direct instantiation of abstract class
        if (this.constructor === BaseStrategy) {
            throw new Error('BaseStrategy is an abstract class and cannot be instantiated directly');
        }
        
        // Ensure required methods are implemented
        this.validateRequiredMethods();
        
        // Common properties
        this.name = 'Base Strategy';
        this.description = 'Abstract base strategy class';
        this.globalDict = {};
        this.universalDict = {};
        this.blockDict = {};
        this.accessToken = null;
    }

    /**
     * Validate that all required methods are implemented
     * @throws {Error} If required methods are missing
     */
    validateRequiredMethods() {
        const requiredMethods = [
            'initialize',
            'processTicks', 
            'getConfig',
            'getGlobalDictParameters',
            'getUniversalDictParameters'
        ];

        const missingMethods = requiredMethods.filter(method => 
            typeof this[method] !== 'function'
        );

        if (missingMethods.length > 0) {
            throw new Error(
                `Strategy ${this.constructor.name} must implement required methods: ${missingMethods.join(', ')}`
            );
        }
    }

    /**
     * Initialize strategy with dictionaries and access token
     * @param {Object} globalDict - Global parameters dictionary
     * @param {Object} universalDict - Universal parameters dictionary  
     * @param {Object} blockDict - Block-specific parameters dictionary
     * @param {string} accessToken - Trading API access token
     * @abstract
     */
    initialize(globalDict, universalDict, blockDict, accessToken) {
        throw new Error('initialize() method must be implemented by subclass');
    }

    /**
     * Process incoming tick data
     * @param {Array} ticks - Array of tick objects
     * @abstract
     */
    processTicks(ticks) {
        throw new Error('processTicks() method must be implemented by subclass');
    }

    /**
     * Get strategy configuration
     * @returns {Object} Strategy configuration object
     * @abstract
     */
    getConfig() {
        throw new Error('getConfig() method must be implemented by subclass');
    }

    /**
     * Get global dictionary parameters definition
     * @returns {Object} Global parameters definition
     * @abstract
     */
    getGlobalDictParameters() {
        throw new Error('getGlobalDictParameters() method must be implemented by subclass');
    }

    /**
     * Get universal dictionary parameters definition
     * @returns {Object} Universal parameters definition
     * @abstract
     */
    getUniversalDictParameters() {
        throw new Error('getUniversalDictParameters() method must be implemented by subclass');
    }

    /**
     * Update global dictionary parameter
     * @param {string} parameter - Parameter name
     * @param {*} value - Parameter value
     * @returns {boolean} Success status
     */
    updateGlobalDictParameter(parameter, value) {
        if (this.globalDict.hasOwnProperty(parameter)) {
            this.globalDict[parameter] = value;
            console.log(`✅ Updated globalDict.${parameter} = ${value}`);
            return true;
        } else {
            console.error(`❌ Parameter '${parameter}' not found in globalDict`);
            return false;
        }
    }

    /**
     * Update universal dictionary parameter
     * @param {string} parameter - Parameter name
     * @param {*} value - Parameter value
     * @returns {boolean} Success status
     */
    updateUniversalDictParameter(parameter, value) {
        if (this.universalDict.hasOwnProperty(parameter)) {
            this.universalDict[parameter] = value;
            console.log(`✅ Updated universalDict.${parameter} = ${value}`);
            return true;
        } else {
            console.error(`❌ Parameter '${parameter}' not found in universalDict`);
            return false;
        }
    }

    /**
     * Get current strategy information
     * @returns {Object} Current strategy state
     */
    getCurrentStrategy() {
        return {
            name: this.name,
            description: this.description,
            hasActivePosition: this.hasActivePosition || false,
            buyPrice: this.buyPrice || null,
            buySymbol: this.buySymbol || null,
            cycleCount: this.cycleCount || 0,
            buyCompleted: this.buyCompleted || false,
            sellCompleted: this.sellCompleted || false
        };
    }

    /**
     * Get current dictionaries
     * @returns {Object} Current dictionaries state
     */
    getCurrentDictionaries() {
        return {
            globalDict: this.globalDict,
            universalDict: this.universalDict,
            blockDict: this.blockDict
        };
    }

    /**
     * Get available strategies (to be overridden by strategy manager)
     * @returns {Array} Available strategies
     */
    getAvailableStrategies() {
        return [];
    }

    /**
     * Set strategy (to be overridden by strategy manager)
     * @param {string} strategyName - Strategy name
     * @param {Object} globalDict - Global dictionary
     * @param {Object} universalDict - Universal dictionary
     * @param {Object} blockDict - Block dictionary
     * @returns {Object} Strategy configuration
     */
    setStrategy(strategyName, globalDict, universalDict, blockDict) {
        console.log(`🔧 Setting strategy: ${strategyName}`);
        return {
            name: strategyName,
            globalDict,
            universalDict,
            blockDict
        };
    }

    /**
     * Validate strategy implementation
     * @returns {boolean} Validation result
     */
    validateImplementation() {
        try {
            this.validateRequiredMethods();
            return true;
        } catch (error) {
            console.error('❌ Strategy validation failed:', error.message);
            return false;
        }
    }

    /**
     * Get strategy metadata
     * @returns {Object} Strategy metadata
     */
    getMetadata() {
        return {
            name: this.name,
            description: this.description,
            version: this.version || '1.0.0',
            author: this.author || 'Unknown',
            requiredMethods: [
                'initialize',
                'processTicks',
                'getConfig',
                'getGlobalDictParameters',
                'getUniversalDictParameters'
            ],
            optionalMethods: [
                'setUserInfo',
                'resetForNextCycle',
                'resetCycleForNewInstrument'
            ]
        };
    }
}

module.exports = BaseStrategy; 
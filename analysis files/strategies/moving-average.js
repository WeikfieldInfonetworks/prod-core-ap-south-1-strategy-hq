const BaseStrategy = require('./base');

class MovingAverageStrategy extends BaseStrategy {
    constructor() {
        super();
        this.name = 'Moving Average Strategy';
        this.description = 'Strategy based on moving averages for all instruments';
        this.shortPeriod = 5;
        this.longPeriod = 20;
        this.maxInstruments = 1000; // Maximum number of instruments to track
    }

    initialize(globalDict, universalDict, blockDict) {
        super.initialize(globalDict, universalDict, blockDict);
        
        // Initialize strategy-specific data structures
        this.universalDict.movingAverages = {};
        this.blockDict.priceHistory = {};
        this.blockDict.activeInstruments = new Set(); // Track active instruments

        // Initialize dictionary parameters with default values
        const globalParams = this.getGlobalDictParameters();
        const universalParams = this.getUniversalDictParameters();

        // Set default values for globalDict parameters
        for (const [key, param] of Object.entries(globalParams)) {
            if (this.globalDict[key] === undefined) {
                this.globalDict[key] = param.default;
            }
        }

        // Set default values for universalDict parameters
        for (const [key, param] of Object.entries(universalParams)) {
            if (this.universalDict[key] === undefined) {
                this.universalDict[key] = param.default;
            }
        }
    }

    processTicks(ticks) {
        for (const tick of ticks) {
            const token = tick.instrument_token;
            
            // Update active instruments set
            this.blockDict.activeInstruments.add(token);
            
            // Limit the number of instruments we track
            if (this.blockDict.activeInstruments.size > this.globalDict.maxInstruments) {
                const oldestToken = Array.from(this.blockDict.activeInstruments)[0];
                this.blockDict.activeInstruments.delete(oldestToken);
                delete this.blockDict.priceHistory[oldestToken];
                delete this.universalDict.movingAverages[oldestToken];
            }

            // Update price history
            if (!this.blockDict.priceHistory[token]) {
                this.blockDict.priceHistory[token] = [];
            }
            this.blockDict.priceHistory[token].push(tick.last_price);
            
            // Keep only necessary history
            if (this.blockDict.priceHistory[token].length > this.globalDict.longPeriod) {
                this.blockDict.priceHistory[token].shift();
            }

            // Calculate moving averages
            if (this.blockDict.priceHistory[token].length >= this.globalDict.longPeriod) {
                const shortMA = this.calculateMA(token, this.globalDict.shortPeriod);
                const longMA = this.calculateMA(token, this.globalDict.longPeriod);
                
                this.universalDict.movingAverages[token] = {
                    shortMA,
                    longMA,
                    signal: shortMA > longMA ? 'BUY' : 'SELL',
                    lastUpdate: Date.now()
                };
            }

            // Update global price
            this.globalDict[token] = tick.last_price;
        }

        // Clean up inactive instruments (optional)
        this.cleanupInactiveInstruments();
    }

    calculateMA(token, period) {
        const prices = this.blockDict.priceHistory[token].slice(-period);
        return prices.reduce((sum, price) => sum + price, 0) / period;
    }

    cleanupInactiveInstruments() {
        const now = Date.now();
        const inactiveThreshold = 5 * 60 * 1000; // 5 minutes

        for (const token of this.blockDict.activeInstruments) {
            const ma = this.universalDict.movingAverages[token];
            if (ma && (now - ma.lastUpdate > inactiveThreshold)) {
                this.blockDict.activeInstruments.delete(token);
                delete this.blockDict.priceHistory[token];
                delete this.universalDict.movingAverages[token];
                delete this.globalDict[token];
            }
        }
    }

    getParameters() {
        // This method is deprecated - all parameters should be in dictionaries
        return {};
    }

    getGlobalDictParameters() {
        return {
            shortPeriod: {
                type: 'number',
                default: 5,
                min: 2,
                max: 50,
                description: 'Short period for moving average'
            },
            longPeriod: {
                type: 'number',
                default: 20,
                min: 5,
                max: 200,
                description: 'Long period for moving average'
            },
            maxInstruments: {
                type: 'number',
                default: 1000,
                min: 100,
                max: 10000,
                description: 'Maximum number of instruments to track'
            },
            priceThreshold: {
                type: 'number',
                default: 100,
                min: 0,
                max: 10000,
                description: 'Minimum price threshold for instrument tracking'
            },
            enableTracking: {
                type: 'boolean',
                default: true,
                description: 'Enable/disable instrument tracking'
            }
        };
    }

    getUniversalDictParameters() {
        return {
            signalThreshold: {
                type: 'number',
                default: 0.01,
                min: 0,
                max: 1,
                description: 'Signal strength threshold for trading decisions'
            },
            enableSignals: {
                type: 'boolean',
                default: true,
                description: 'Enable/disable signal generation'
            },
            updateInterval: {
                type: 'integer',
                default: 1000,
                min: 100,
                max: 10000,
                description: 'Update interval in milliseconds'
            }
        };
    }
}

module.exports = MovingAverageStrategy; 
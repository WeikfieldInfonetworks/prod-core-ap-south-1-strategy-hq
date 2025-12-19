const fs = require('fs');
const path = require('path');

class StrategyUtils {
    constructor() {
        this.userName = null;
        this.userId = null;
        this.logDir = null;
        this.orderLogFile = null;
        this.strategyLogFile = null;
    }

    setUserInfo(userName, userId) {
        this.userName = userName;
        this.userId = userId;
        this.logDir = `logs/user_${userId}`;
        this.orderLogFile = `${this.logDir}/orders.log`;
        this.strategyLogFile = `${this.logDir}/strategy.log`;
        
        // Ensure log directory exists
        this.ensureLogDirectory(this.logDir);
        
        console.log(`User info set for logging: ${userName} (ID: ${userId})`);
        console.log(`User log directory: ${this.logDir}`);
        console.log(`Order log file: ${this.orderLogFile}`);
        console.log(`Strategy log file: ${this.strategyLogFile}`);
    }

    ensureLogDirectory() {
        if (!this.logDir) {
            console.warn('Log directory not set, using default path');
            this.logDir = path.join(__dirname, '..', 'logs', 'default_user');
        }
        
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    /**
     * Write log entry to file
     * @param {string} logFile - Path to log file
     * @param {string} level - Log level (INFO, WARN, ERROR, DEBUG)
     * @param {string} message - Log message
     */
    writeLogEntry(logFile, level, message) {
        if (!logFile) {
            console.error('Log file path not set');
            return;
        }

        const timestamp = new Date().toISOString();
        const logLine = `[${timestamp}] - [${level}] - ${message}\n`;
        
        try {
            fs.appendFileSync(logFile, logLine);
        } catch (error) {
            console.error('Error writing to log file:', error);
            console.error('Log file path:', logFile);
        }
    }

    /**
     * Log order-related activities (buy/sell executions)
     * @param {string} level - Log level
     * @param {string} message - Log message
     */
    logOrder(level, message) {
        if (!this.orderLogFile) {
            console.warn('Order log file not set, using default');
            this.orderLogFile = path.join(__dirname, '..', 'logs', 'default_user', 'orders.log');
            this.ensureLogDirectory();
        }
        
        this.writeLogEntry(this.orderLogFile, level, message);
    }

    /**
     * Log strategy-related activities (console logs, strategy decisions)
     * @param {string} level - Log level
     * @param {string} message - Log message
     */
    logStrategy(level, message) {
        if (!this.strategyLogFile) {
            console.warn('Strategy log file not set, using default');
            this.strategyLogFile = path.join(__dirname, '..', 'logs', 'default_user', 'strategy.log');
            this.ensureLogDirectory();
        }
        
        this.writeLogEntry(this.strategyLogFile, level, message);
    }

    // Order-related logging methods
    logOrderPlaced(action, symbol, price, quantity, token) {
        const message = `ORDER_PLACED: ${action} ${quantity} ${symbol} @ ${price} (Token: ${token})`;
        this.logOrder('INFO', message);
    }

    logOrderExecuted(action, symbol, price, quantity, token, orderId) {
        const message = `ORDER_EXECUTED: ${action} ${quantity} ${symbol} @ ${price} (Token: ${token}, OrderID: ${orderId})`;
        this.logOrder('INFO', message);
    }

    logOrderFailed(action, symbol, price, quantity, token, error) {
        const message = `ORDER_FAILED: ${action} ${quantity} ${symbol} @ ${price} (Token: ${token}, Error: ${error})`;
        this.logOrder('ERROR', message);
    }

    logPositionOpened(action, symbol, price, quantity, token) {
        const message = `POSITION_OPENED: ${action} ${quantity} ${symbol} @ ${price} (Token: ${token})`;
        this.logOrder('INFO', message);
    }

    logPositionClosed(action, symbol, buyPrice, sellPrice, quantity, token, pnl) {
        const message = `POSITION_CLOSED: ${action} ${quantity} ${symbol} (Buy: ${buyPrice}, Sell: ${sellPrice}, PnL: ${pnl}) (Token: ${token})`;
        this.logOrder('INFO', message);
    }

    // Strategy-related logging methods
    logStrategyInfo(message) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [INFO] [${this.userName || 'Unknown'}] ${message}\n`;
        
        if (!this.strategyLogFile) {
            console.error('Log file path not set');
            return;
        }
        
        try {
            fs.appendFileSync(this.strategyLogFile, logEntry);
            console.log(`[STRATEGY] ${message}`);
        } catch (error) {
            console.error('Error writing to log file:', error);
        }
    }

    logStrategyWarn(message) {
        this.logStrategy('WARN', message);
    }

    logStrategyError(message) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [ERROR] [${this.userName || 'Unknown'}] ${message}\n`;
        
        if (!this.strategyLogFile) {
            console.error('Log file path not set');
            return;
        }
        
        try {
            fs.appendFileSync(this.strategyLogFile, logEntry);
            console.error(`[STRATEGY ERROR] ${message}`);
        } catch (error) {
            console.error('Error writing to log file:', error);
        }
    }

    logStrategyDebug(message) {
        this.logStrategy('DEBUG', message);
    }

    logInstrumentSelection(symbol, price, distance, token, cycleNumber) {
        const message = `INSTRUMENT_SELECTED: ${symbol} @ ${price} (Distance: ${distance.toFixed(2)}, Token: ${token}, Cycle: ${cycleNumber})`;
        this.logStrategy('INFO', message);
    }

    logCycleStarted(cycleNumber) {
        const message = `CYCLE_STARTED: Cycle ${cycleNumber}`;
        this.logStrategy('INFO', message);
    }

    logCycleCompleted(cycleNumber, symbol, totalTicks, pnl) {
        const message = `CYCLE_COMPLETED: Cycle ${cycleNumber} - ${symbol} (Ticks: ${totalTicks}, PnL: ${pnl})`;
        this.logStrategy('INFO', message);
    }

    logStrategyState(state) {
        const message = `STRATEGY_STATE: ${JSON.stringify(state)}`;
        this.logStrategy('DEBUG', message);
    }

    // Legacy method for backward compatibility
    logTradeAction(action, data, strategyName) {
        const message = `${action.toUpperCase()}: ${JSON.stringify(data)}`;
        this.logStrategy('INFO', message);
    }

    isOptionsInstrument(symbol) {
        const isOptions = symbol && (symbol.includes('CE') || symbol.includes('PE'));
        return isOptions;
    }

    /**
     * Separate CE tokens from accepted tokens
     * @param {Array} acceptedTokens - Array of accepted token IDs
     * @param {Function} getSymbolFromToken - Function to get symbol from token
     * @returns {Array} Array of CE token IDs
     */
    separateCETokens(acceptedTokens, getSymbolFromToken) {
        return acceptedTokens.filter(token => {
            const symbol = getSymbolFromToken(token);
            return this.isOptionsInstrument(symbol) && symbol.includes('CE');
        });
    }

    /**
     * Separate PE tokens from accepted tokens
     * @param {Array} acceptedTokens - Array of accepted token IDs
     * @param {Function} getSymbolFromToken - Function to get symbol from token
     * @returns {Array} Array of PE token IDs
     */
    separatePETokens(acceptedTokens, getSymbolFromToken) {
        return acceptedTokens.filter(token => {
            const symbol = getSymbolFromToken(token);
            return this.isOptionsInstrument(symbol) && symbol.includes('PE');
        });
    }

    /**
     * Separate both CE and PE tokens from accepted tokens
     * @param {Array} acceptedTokens - Array of accepted token IDs
     * @param {Function} getSymbolFromToken - Function to get symbol from token
     * @returns {Object} Object containing ceTokens and peTokens arrays
     */
    separateCETokensAndPETokens(acceptedTokens, getSymbolFromToken) {
        const ceTokens = this.separateCETokens(acceptedTokens, getSymbolFromToken);
        const peTokens = this.separatePETokens(acceptedTokens, getSymbolFromToken);
        
        return {
            ceTokens,
            peTokens
        };
    }

    

    selectBestInstrument(ticks, targetPrice = 100, cycleCount = 0) {
        this.logStrategyInfo(`Selecting best instrument nearest to ${targetPrice} for Cycle ${cycleCount + 1}`);
        
        let bestInstrument = null;
        let minDistance = Infinity;
        
        // Find the options instrument closest to target price
        for (const tick of ticks) {
            const symbol = tick.symbol || `TOKEN_${tick.instrument_token}`;
            
            if (this.isOptionsInstrument(symbol)) {
                const distance = Math.abs(tick.last_price - targetPrice);
                
                this.logStrategyDebug(`Candidate: ${symbol} at ${tick.last_price}, distance: ${distance.toFixed(2)}`);
                
                if (distance < minDistance) {
                    minDistance = distance;
                    bestInstrument = {
                        symbol: symbol,
                        token: tick.instrument_token,
                        price: tick.last_price,
                        distance: distance
                    };
                }
            }
        }
        
        if (bestInstrument) {
            this.logInstrumentSelection(bestInstrument.symbol, bestInstrument.price, bestInstrument.distance, bestInstrument.token, cycleCount + 1);
            return bestInstrument;
        } else {
            this.logStrategyWarn('No suitable options instruments found in this tick batch');
            return null;
        }
    }

    selectBestInstrumentUnder100(ticks, cycleCount = 0) {
        this.logStrategyInfo(`Selecting best instrument nearest and under 100 for Cycle ${cycleCount + 1}`);
        
        let bestInstrument = null;
        let minDistance = Infinity;
        
        // Find the options instrument closest to 100 but under 100
        for (const tick of ticks) {
            const symbol = tick.symbol || `TOKEN_${tick.instrument_token}`;
            
            if (this.isOptionsInstrument(symbol)) {
                const price = tick.last_price;
                
                // Only consider instruments under 100
                if (price < 100) {
                    const distance = 100 - price; // Distance from 100 (closer to 100 is better)
                    
                    this.logStrategyDebug(`Candidate under 100: ${symbol} at ${price}, distance from 100: ${distance.toFixed(2)}`);
                    
                    if (distance < minDistance) {
                        minDistance = distance;
                        bestInstrument = {
                            symbol: symbol,
                            token: tick.instrument_token,
                            price: price,
                            distance: distance
                        };
                    }
                }
            }
        }
        
        if (bestInstrument) {
            this.logInstrumentSelection(bestInstrument.symbol, bestInstrument.price, bestInstrument.distance, bestInstrument.token, cycleCount + 1);
            this.logStrategyInfo(`Selected instrument under 100: ${bestInstrument.symbol} @ ${bestInstrument.price} (distance from 100: ${bestInstrument.distance.toFixed(2)})`);
            return bestInstrument;
        } else {
            this.logStrategyWarn('No suitable options instruments found under 100 in this tick batch');
            return null;
        }
    }

    calculatePnL(buyPrice, sellPrice, quantity = 75) {
        const priceDifference = sellPrice - buyPrice;
        const totalPnL = priceDifference * quantity;
        
        return {
            priceDifference,
            totalPnL,
            quantity
        };
    }

    formatCurrency(amount) {
        return `₹${amount.toFixed(2)}`;
    }

    getCurrentTimestamp() {
        return new Date().toISOString();
    }

    formatTime(timestamp) {
        return new Date(timestamp).toLocaleTimeString();
    }

    validateOrderParams(symbol, price, quantity) {
        const errors = [];
        
        if (!symbol) {
            errors.push('Symbol is required');
        }
        
        if (!price || price <= 0) {
            errors.push('Valid price is required');
        }
        
        if (!quantity || quantity <= 0) {
            errors.push('Valid quantity is required');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    logPositionRecorded(action, symbol, price, quantity, token, strategyName) {
        this.logPositionOpened(action, symbol, price, quantity, token);
    }

    logPositionCompleted(action, symbol, buyPrice, sellPrice, quantity, token, strategyName) {
        const pnl = this.calculatePnL(buyPrice, sellPrice, quantity);
        this.logPositionClosed(action, symbol, buyPrice, sellPrice, quantity, token, pnl.totalPnL);
    }

    logCycleCompleted(cycleNumber, symbol, totalTicks, quantity, priceDifference, totalPnL, strategyName) {
        const message = `CYCLE_COMPLETED: Cycle ${cycleNumber} - ${symbol} - Ticks: ${totalTicks} - Qty: ${quantity} - P&L: ${priceDifference.toFixed(2)} (Total: ${totalPnL.toFixed(2)}) - Strategy: ${strategyName}`;
        this.logStrategy('INFO', message);
    }

    /**
     * Find the closest trading symbol below a certain price for a specific instrument type
     * @param {Object} instrumentMap - The instrument map from universalDict
     * @param {number} targetPrice - The target price to find symbols below
     * @param {string} instrumentType - The instrument type ('CE' or 'PE')
     * @param {number} maxPrice - Maximum price to consider (defaults to 200)
     * @returns {Object|null} - Object containing token, symbol, and price, or null if not found
     */
    findClosestSymbolBelowPrice(instrumentMap, targetPrice, instrumentType, maxPrice = 200) {
        if (!instrumentMap || typeof instrumentMap !== 'object') {
            console.warn('Invalid instrument map provided to findClosestSymbolBelowPrice');
            this.logStrategyDebug(`Invalid instrument map provided to findClosestSymbolBelowPrice`);
            return null;
        }

        if (!instrumentType || !['CE', 'PE'].includes(instrumentType.toUpperCase())) {
            console.warn('Invalid instrument type. Must be "CE" or "PE"');
            this.logStrategyDebug(`Invalid instrument type. Must be "CE" or "PE"`);
            return null;
        }

        const upperLimit = maxPrice;
        let closestSymbol = null;
        let smallestDifference = Infinity;

        // Iterate through all instruments in the map
        for (const [token, instrument] of Object.entries(instrumentMap)) {
            if (!instrument || !instrument.symbol || instrument.last === undefined) {
                this.logStrategyDebug(`Instrument not found: ${token}`);
                continue;
            }

            const symbol = instrument.symbol;
            const price = instrument.last;

            // Check if this is the correct instrument type
            if (!this.isOptionsInstrument(symbol) || !symbol.includes(instrumentType.toUpperCase())) {
                this.logStrategyDebug(`Instrument not found: ${token}`);
                continue;
            }

            // Check if price is below the upper limit
            if (price > upperLimit) {
                this.logStrategyDebug(`Instrument price above upper limit: ${token}`);
                continue;
            }

            // Calculate the difference from target price
            const difference = targetPrice - price;

            // If this is closer to target price than previous best, update
            if (difference >= 0 && difference < smallestDifference) {
                smallestDifference = difference;
                closestSymbol = {
                    token: parseInt(token),
                    symbol: symbol,
                    price: price,
                    difference: difference
                };
            }
        }

        if (closestSymbol) {
            this.logStrategyDebug(`Found closest ${instrumentType} symbol below ${targetPrice}: ${closestSymbol.symbol} @ ${closestSymbol.price} (diff: ${closestSymbol.difference.toFixed(2)})`);
        } else {
            this.logStrategyWarn(`No ${instrumentType} symbols found below ${targetPrice}`);
        }

        return closestSymbol;
    }

    /**
     * Find the closest CE trading symbol below a certain price
     * @param {Object} instrumentMap - The instrument map from universalDict
     * @param {number} targetPrice - The target price to find symbols below
     * @param {number} maxPrice - Maximum price to consider (defaults to 200)
     * @returns {Object|null} - Object containing token, symbol, and price, or null if not found
     */
    findClosestCEBelowPrice(instrumentMap, targetPrice, maxPrice = 200) {
        return this.findClosestSymbolBelowPrice(instrumentMap, targetPrice, 'CE', maxPrice);
    }

    /**
     * Find the closest PE trading symbol below a certain price
     * @param {Object} instrumentMap - The instrument map from universalDict
     * @param {number} targetPrice - The target price to find symbols below
     * @param {number} maxPrice - Maximum price to consider (defaults to 200)
     * @returns {Object|null} - Object containing token, symbol, and price, or null if not found
     */
    findClosestPEBelowPrice(instrumentMap, targetPrice, maxPrice = 200) {
        return this.findClosestSymbolBelowPrice(instrumentMap, targetPrice, 'PE', maxPrice);
    }

    /**
     * Find the closest trading symbol above a certain price
     * @param {Object} instrumentMap - The instrument map from universalDict
     * @param {number} targetPrice - The target price to find symbols above
     * @param {string} instrumentType - Type of instrument ('CE' or 'PE')
     * @param {number} minPrice - Minimum price to consider (defaults to 0)
     * @returns {Object|null} - Object containing token, symbol, and price, or null if not found
     */
    findClosestSymbolAbovePrice(instrumentMap, targetPrice, instrumentType, minPrice = 0) {
        if (!instrumentMap || typeof instrumentMap !== 'object') {
            console.warn('Invalid instrument map provided to findClosestSymbolAbovePrice');
            this.logStrategyDebug(`Invalid instrument map provided to findClosestSymbolAbovePrice`);
            return null;
        }

        if (!instrumentType || !['CE', 'PE'].includes(instrumentType.toUpperCase())) {
            console.warn('Invalid instrument type. Must be "CE" or "PE"');
            this.logStrategyDebug(`Invalid instrument type. Must be "CE" or "PE"`);
            return null;
        }

        const lowerLimit = minPrice;
        let closestSymbol = null;
        let smallestDifference = Infinity;

        // Iterate through all instruments in the map
        for (const [token, instrument] of Object.entries(instrumentMap)) {
            if (!instrument || !instrument.symbol || instrument.last === undefined) {
                this.logStrategyDebug(`Instrument not found: ${token}`);
                continue;
            }

            const symbol = instrument.symbol;
            const price = instrument.last;

            // Check if this is the correct instrument type
            if (!this.isOptionsInstrument(symbol) || !symbol.includes(instrumentType.toUpperCase())) {
                this.logStrategyDebug(`Instrument not found: ${token}`);
                continue;
            }

            // Check if price is above the lower limit
            if (price < lowerLimit) {
                this.logStrategyDebug(`Instrument price below lower limit: ${token}`);
                continue;
            }

            // Calculate the difference from target price
            const difference = price - targetPrice;

            // If this is closer to target price than previous best, update
            if (difference >= 0 && difference < smallestDifference) {
                smallestDifference = difference;
                closestSymbol = {
                    token: parseInt(token),
                    symbol: symbol,
                    price: price,
                    difference: difference
                };
            }
        }

        if (closestSymbol) {
            this.logStrategyDebug(`Found closest ${instrumentType} symbol above ${targetPrice}: ${closestSymbol.symbol} @ ${closestSymbol.price} (diff: ${closestSymbol.difference.toFixed(2)})`);
        } else {
            this.logStrategyWarn(`No ${instrumentType} symbols found above ${targetPrice}`);
        }

        return closestSymbol;
    }

    /**
     * Find the closest CE trading symbol above a certain price
     * @param {Object} instrumentMap - The instrument map from universalDict
     * @param {number} targetPrice - The target price to find symbols above
     * @param {number} minPrice - Minimum price to consider (defaults to 0)
     * @returns {Object|null} - Object containing token, symbol, and price, or null if not found
     */
    findClosestCEAbovePrice(instrumentMap, targetPrice, minPrice = 0) {
        return this.findClosestSymbolAbovePrice(instrumentMap, targetPrice, 'CE', minPrice);
    }

    /**
     * Find the closest PE trading symbol above a certain price
     * @param {Object} instrumentMap - The instrument map from universalDict
     * @param {number} targetPrice - The target price to find symbols above
     * @param {number} minPrice - Minimum price to consider (defaults to 0)
     * @returns {Object|null} - Object containing token, symbol, and price, or null if not found
     */
    findClosestPEAbovePrice(instrumentMap, targetPrice, minPrice = 0) {
        return this.findClosestSymbolAbovePrice(instrumentMap, targetPrice, 'PE', minPrice);
    }

    /**
     * Apply Plus3 filter to tokens
     * @param {Array} tokens - Array of token IDs
     * @param {Object} instrumentMap - The instrument map
     * @param {Array} ceTokens - Array of CE token IDs
     * @param {Array} peTokens - Array of PE token IDs
     * @param {Object} flags - Object containing strategy flags
     * @param {Object} globalDict - Global dictionary with parameters
     * @returns {Object} - Object containing filtered tokens and updated flags
     */
    applyPlus3Filter(tokens, instrumentMap, ceTokens, peTokens, flags, globalDict) {
        const filteredTokens = [];
        let ceFound = false;
        let peFound = false;
        const result = {
            tokens: [],
            mainToken: flags.mainToken,
            oppToken: flags.oppToken,
            cePlus3: flags.cePlus3,
            pePlus3: flags.pePlus3
        };
        
        for (const token of tokens) {
            const instrument = instrumentMap[token];
            if (!instrument) continue;

            // Check CE plus3 - only check until first CE is found
            if (!ceFound && ceTokens.includes(token) && !flags.interimLowReached && !flags.calcRefReached) {
                // Check if current price is at least peakDef points above the opening price (firstPrice)
                const priceDifference = instrument.last - instrument.firstPrice;
                if (priceDifference >= globalDict.peakDef && !instrument.flagPlus3) {
                    this.logStrategyInfo(`PLUS ${globalDict.peakDef}: ${instrument.symbol} LAST: ${instrument.last} OPENING: ${instrument.firstPrice} DIFF: ${priceDifference.toFixed(2)}`);
                    result.cePlus3 = true;
                    instrument.flagPlus3 = true;
                    ceFound = true;
                    
                    if (!result.mainToken) {
                        result.mainToken = token;
                        this.logStrategyInfo(`Main token assigned: ${instrument.symbol} (CE)`);
                    } else if (!result.oppToken) {
                        result.oppToken = token;
                        this.logStrategyInfo(`Opposite token assigned: ${instrument.symbol} (CE)`);
                    } else {
                        this.logStrategyInfo(`Token ${instrument.symbol} (CE) qualified but mainToken and oppToken already set - skipping assignment`);
                    }
                }
                
                // Add to race if it has passed plus3 checkpoint
                if (instrument.flagPlus3) {
                    filteredTokens.push(token);
                }
            }
            
            // Check PE plus3 - only check until first PE is found
            if (!peFound && peTokens.includes(token) && !flags.interimLowReached && !flags.calcRefReached) {
                // Check if current price is at least peakDef points above the opening price (firstPrice)
                const priceDifference = instrument.last - instrument.firstPrice;
                if (priceDifference >= globalDict.peakDef && !instrument.flagPlus3) {
                    this.logStrategyInfo(`PLUS ${globalDict.peakDef}: ${instrument.symbol} LAST: ${instrument.last} OPENING: ${instrument.firstPrice} DIFF: ${priceDifference.toFixed(2)}`);
                    result.pePlus3 = true;
                    instrument.flagPlus3 = true;
                    peFound = true;
                    
                    if (!result.mainToken) {
                        result.mainToken = token;
                        this.logStrategyInfo(`Main token assigned: ${instrument.symbol} (PE)`);
                    } else if (!result.oppToken) {
                        result.oppToken = token;
                        this.logStrategyInfo(`Opposite token assigned: ${instrument.symbol} (PE)`);
                    } else {
                        this.logStrategyInfo(`Token ${instrument.symbol} (PE) qualified but mainToken and oppToken already set - skipping assignment`);
                    }
                }
                
                // Add to race if it has passed plus3 checkpoint
                if (instrument.flagPlus3) {
                    filteredTokens.push(token);
                }
            }
        }
        
        // If mainToken is assigned but oppToken is not, assign the first available token of opposite type
        if (result.mainToken && !result.oppToken) {
            this.assignOppositeToken(result, instrumentMap, ceTokens, peTokens);
        }
        
        result.tokens = filteredTokens;
        return result;
    }

    /**
     * Apply Peak and Fall filter to tokens
     * @param {Array} tokens - Array of token IDs
     * @param {Object} instrumentMap - The instrument map
     * @param {Object} flags - Object containing strategy flags
     * @returns {Array} - Array of tokens that have passed peak and fall checkpoint
     */
    applyPeakAndFallFilter(tokens, instrumentMap, flags, globalDict) {
        // Return tokens that have passed the peak and fall checkpoint
        const tokensInRace = [];
        
        for (const token of tokens) {
            const instrument = instrumentMap[token];
            if (!instrument) continue;

            // Only process tokens that have passed plus3 checkpoint
            if (instrument.flagPlus3 && !flags.calcRefReached && !flags.interimLowReached) {
                // Check if there's a difference of at least 2.5 between current price and peak
                const peakFallDifference = instrument.peak - instrument.last;
                if (peakFallDifference >= globalDict.peakAndFallDef && !instrument.flagPeakAndFall) {
                    this.logStrategyInfo(`PEAK AND FALL by ${instrument.symbol}. PEAK: ${instrument.peak} LAST: ${instrument.last} DIFF: ${peakFallDifference.toFixed(2)}`);
                    instrument.peakAtRef = instrument.peak;
                    instrument.peakTime = instrument.time;
                    instrument.flagPeakAndFall = true;
                }
                
                // Add to race if it has passed peak and fall checkpoint
                if (instrument.flagPeakAndFall) {
                    tokensInRace.push(token);
                }
            }
        }
        
        return tokensInRace;
    }

    /**
     * Apply Calc Ref filter to tokens
     * @param {Array} tokens - Array of token IDs
     * @param {Object} instrumentMap - The instrument map
     * @param {Object} flags - Object containing strategy flags
     * @returns {Array} - Array of tokens that have passed calc ref checkpoint
     */
    applyCalcRefFilter(tokens, instrumentMap, flags) {
        // Return tokens that have passed the calc ref checkpoint
        const tokensInRace = [];
        
        for (const token of tokens) {
            const instrument = instrumentMap[token];
            if (!instrument) continue;

            // Only process tokens that have passed peak and fall checkpoint
            if (instrument.flagPeakAndFall && !instrument.flagCalcRef) {
                // Calculate reference point
                const calcRef = this.calculateRefPoint(instrument);
                if (calcRef !== instrument.prevCalcRef) {
                    instrument.prevCalcRef = instrument.calcRef;
                    instrument.calcRef = calcRef;
                    this.logStrategyInfo(`CALCULATED REFERENCE FOR ${instrument.symbol} IS ${instrument.calcRef}`);
                    instrument.flagCalcRef = true;
                }
                
                // Check if it has reached calc ref condition
                if (instrument.last <= instrument.calcRef && false) {
                    instrument.flagCalcRef = true;
                    flags.calcRefReached = true;
                    this.logStrategyInfo(`${instrument.symbol} REACHED CALC REF PRICE ${instrument.calcRef}`);
                }
                
                // Add to race if it has passed calc ref checkpoint
                if (instrument.flagCalcRef) {
                    tokensInRace.push(token);
                }
            }
        }
        
        return tokensInRace;
    }

    /**
     * Apply Interim Low filter to tokens
     * @param {Array} tokens - Array of token IDs
     * @param {Object} instrumentMap - The instrument map
     * @param {Object} flags - Object containing strategy flags
     * @param {Object} globalDict - Global dictionary with parameters
     * @returns {Object} - Object containing filtered tokens and updated flags
     */
    applyInterimLowFilter(tokens, instrumentMap, flags, globalDict) {
        const filteredTokens = [];
        const result = {
            tokens: [],
            interimLowReached: flags.interimLowReached,
            mtmFirstOption: flags.mtmFirstOption
        };
        
        for (const token of tokens) {
            const instrument = instrumentMap[token];
            if (!instrument) continue;

            // Only process tokens that have passed calc ref checkpoint
            if (instrument.flagCalcRef && !flags.interimLowReached) {
                // Track new lows - update lowAtRef if current price is lower
                if (instrument.lowAtRef === -1 || instrument.last < instrument.lowAtRef) {
                    instrument.lowAtRef = instrument.last;
                    if (!flags.interimLowDisabled) {
                        this.logStrategyInfo(`NEW LOW AT REF: ${instrument.lowAtRef} FOR ${instrument.symbol}`);
                    }
                }
                
                // Check if price has made at least peakDef high from its lowest point
                if (instrument.lowAtRef > -1) {
                    const recoveryFromLow = instrument.last - instrument.lowAtRef;
                    if (recoveryFromLow >= globalDict.upperLimit && !flags.interimLowDisabled && !instrument.flagInterim) {
                        instrument.flagInterim = true;
                        result.interimLowReached = true;
                        result.mtmFirstOption = {
                            symbol: instrument.symbol,
                            token: token
                        };
                        this.logStrategyInfo(`INTERIM LOW REACHED: ${instrument.lowAtRef} FOR ${instrument.symbol} RECOVERY: ${recoveryFromLow.toFixed(2)}`);
                    }
                }
                
                // Add to race if it has passed interim low checkpoint
                if (instrument.flagInterim) {
                    filteredTokens.push(token);
                }
            }
        }
        
        result.tokens = filteredTokens;
        return result;
    }

    /**
     * Assign opposite token based on main token type
     * @param {Object} result - Result object containing mainToken and oppToken
     * @param {Object} instrumentMap - The instrument map
     * @param {Array} ceTokens - Array of CE token IDs
     * @param {Array} peTokens - Array of PE token IDs
     */
    assignOppositeToken(result, instrumentMap, ceTokens, peTokens) {
        if (!result.mainToken) {
            this.logStrategyWarn('Cannot assign opposite token - main token not set');
            return;
        }

        const mainInstrument = instrumentMap[result.mainToken];
        if (!mainInstrument) {
            this.logStrategyWarn('Cannot assign opposite token - main instrument not found');
            return;
        }

        const mainSymbol = mainInstrument.symbol;
        let oppositeTokens = [];
        let oppositeType = '';

        // Determine opposite type based on main token
        if (ceTokens.includes(result.mainToken)) {
            // Main token is CE, so opposite should be PE
            oppositeTokens = peTokens;
            oppositeType = 'PE';
        } else if (peTokens.includes(result.mainToken)) {
            // Main token is PE, so opposite should be CE
            oppositeTokens = ceTokens;
            oppositeType = 'CE';
        } else {
            this.logStrategyWarn('Cannot determine opposite type - main token not in CE or PE lists');
            return;
        }

        // Assign the first available token of opposite type
        if (oppositeTokens.length > 0) {
            const oppositeToken = oppositeTokens[0];
            const oppositeInstrument = instrumentMap[oppositeToken];
            
            if (oppositeInstrument) {
                result.oppToken = oppositeToken;
                this.logStrategyInfo(`Opposite token auto-assigned: ${oppositeInstrument.symbol} (${oppositeType})`);
                this.logStrategyInfo(`Main: ${mainSymbol} (${ceTokens.includes(result.mainToken) ? 'CE' : 'PE'})`);
                this.logStrategyInfo(`Opposite: ${oppositeInstrument.symbol} (${oppositeType})`);
            } else {
                this.logStrategyWarn(`Opposite instrument not found for token: ${oppositeToken}`);
            }
        } else {
            this.logStrategyWarn(`No ${oppositeType} tokens available for opposite assignment`);
        }
    }

    /**
     * Calculate reference point for an instrument
     * @param {Object} instrument - Instrument object
     * @returns {number} - Calculated reference point
     */
    calculateRefPoint(instrument) {
        // Simplified reference point calculation
        // In real implementation, this would be more complex
        return instrument.peak * 0.5; // Example calculation
    }

    /**
     * Find tokens within a dynamic range that adjusts if no tokens are found
     * @param {Array} sortedTicks - Array of ticks sorted by deviation from target
     * @param {number} strikeBase - Initial base strike price
     * @param {number} strikeDiff - Initial strike difference/range
     * @param {number} strikeLowest - Lowest allowed strike price
     * @param {number} adjustmentStep - How much to adjust range by (default: 5)
     * @returns {Object} - Object containing accepted and rejected tokens
     */
    findTokensInDynamicRange(sortedTicks, strikeBase, strikeDiff, strikeLowest, adjustmentStep = 5) {
        this.logStrategyInfo(`Finding tokens with dynamic range adjustment`);
        this.logStrategyInfo(`Initial range: ${strikeBase} to ${strikeBase + strikeDiff} (diff: ${strikeDiff})`);
        this.logStrategyInfo(`Lowest allowed: ${strikeLowest}, Adjustment step: ${adjustmentStep}`);
        
        const acceptedTokens = [];
        const rejectedTokens = [];
        
        let currentBase = strikeBase;
        let currentDiff = strikeDiff;
        let rangeAdjusted = false;
        let attempts = 0;
        
        while (currentBase >= strikeLowest) {
            attempts++;
            this.logStrategyInfo(`Attempt ${attempts}: Checking range ${currentBase} to ${currentBase + currentDiff}`);
            
            // Clear previous results for this attempt
            acceptedTokens.length = 0;
            rejectedTokens.length = 0;
            
            // Check all ticks against current range
            for (const tick of sortedTicks) {
                const price = tick.last_price;
                
                if (currentBase <= price && price <= currentBase + currentDiff) {
                    acceptedTokens.push(tick.instrument_token);
                } else {
                    rejectedTokens.push(tick.instrument_token);
                }
            }
            
            // Check if we have at least one CE and one PE token
            if (acceptedTokens.length > 0) {
                const { ceTokens, peTokens } = this.separateCETokensAndPETokens(
                    acceptedTokens,
                    (token) => {
                        const tick = sortedTicks.find(t => t.instrument_token === token);
                        return tick ? tick.symbol : null;
                    }
                );
                
                this.logStrategyInfo(`Found ${acceptedTokens.length} tokens: ${ceTokens.length} CE, ${peTokens.length} PE`);
                
                // If we have at least one CE and one PE, we're good
                if (ceTokens.length > 0 && peTokens.length > 0) {
                    if (rangeAdjusted) {
                        this.logStrategyInfo(`Found sufficient tokens after adjusting range to ${currentBase}-${currentBase + currentDiff}`);
                    } else {
                        this.logStrategyInfo(`Found sufficient tokens in initial range ${currentBase}-${currentBase + currentDiff}`);
                    }
                    break;
                } else {
                    this.logStrategyInfo(`Insufficient token types - CE: ${ceTokens.length}, PE: ${peTokens.length}. Continuing search...`);
                }
            }
            
            // If no tokens found or insufficient types, adjust range and try again
            if (currentBase - adjustmentStep >= strikeLowest) {
                currentBase -= adjustmentStep;
                currentDiff += adjustmentStep;
                rangeAdjusted = true;
                
                this.logStrategyInfo(`Adjusting range to ${currentBase}-${currentBase + currentDiff}`);
            } else {
                this.logStrategyWarn(`No sufficient tokens found even after adjusting range down to ${strikeLowest}`);
                break;
            }
        }
        
        // Final summary
        if (acceptedTokens.length === 0) {
            this.logStrategyWarn(`No tokens found in any range. Lowest attempted: ${strikeLowest}`);
        } else {
            const { ceTokens, peTokens } = this.separateCETokensAndPETokens(
                acceptedTokens,
                (token) => {
                    const tick = sortedTicks.find(t => t.instrument_token === token);
                    return tick ? tick.symbol : null;
                }
            );
            
            if (ceTokens.length > 0 && peTokens.length > 0) {
                this.logStrategyInfo(`Final result: ${acceptedTokens.length} accepted (${ceTokens.length} CE, ${peTokens.length} PE), ${rejectedTokens.length} rejected tokens`);
            } else {
                this.logStrategyWarn(`Final result: ${acceptedTokens.length} accepted but insufficient types (${ceTokens.length} CE, ${peTokens.length} PE), ${rejectedTokens.length} rejected tokens`);
            }
        }
        
        return {
            acceptedTokens,
            rejectedTokens,
            finalBase: currentBase,
            finalDiff: currentDiff,
            rangeAdjusted,
            attempts
        };
    }

    /**
     * Find token by trading symbol's last 7 characters
     * @param {Object} instrumentMap - The instrument map from universalDict
     * @param {string} symbolSuffix - The last 7 characters of the trading symbol
     * @returns {string|null} - Token ID if found, null otherwise
     */
    findTokenBySymbolSuffix(instrumentMap, symbolSuffix) {
        if (!instrumentMap || typeof instrumentMap !== 'object') {
            console.warn('Invalid instrument map provided to findTokenBySymbolSuffix');
            this.logStrategyDebug(`Invalid instrument map provided to findTokenBySymbolSuffix`);
            return null;
        }

        if (!symbolSuffix || typeof symbolSuffix !== 'string' || symbolSuffix.length !== 7) {
            console.warn('Invalid symbol suffix. Must be exactly 7 characters');
            this.logStrategyDebug(`Invalid symbol suffix: ${symbolSuffix}`);
            return null;
        }

        // Iterate through all instruments in the map
        for (const [token, instrument] of Object.entries(instrumentMap)) {
            if (!instrument || !instrument.symbol) {
                continue;
            }

            const symbol = instrument.symbol;
            
            // Check if symbol has at least 7 characters
            if (symbol.length >= 7) {
                const last7Chars = symbol.slice(-7);
                
                if (last7Chars === symbolSuffix) {
                    this.logStrategyDebug(`Found token ${token} for symbol suffix ${symbolSuffix} (full symbol: ${symbol})`);
                    return token;
                }
            }
        }

        this.logStrategyWarn(`No token found for symbol suffix: ${symbolSuffix}`);
        return null;
    }

    /**
     * Apply complete sequential filtering flow
     * @param {Array} acceptedTokens - Array of accepted token IDs
     * @param {Object} instrumentMap - The instrument map
     * @param {Array} ceTokens - Array of CE token IDs
     * @param {Array} peTokens - Array of PE token IDs
     * @param {Object} flags - Object containing strategy flags
     * @param {Object} globalDict - Global dictionary with parameters
     * @returns {Object} - Object containing final results and updated flags
     */
    applySequentialFilterFlow(acceptedTokens, instrumentMap, ceTokens, peTokens, flags, globalDict) {
        // this.logStrategyInfo(`Starting sequential filtering with ${acceptedTokens.length} tokens`);

        // Track tokens that have passed each checkpoint
        let tokensPassedPlus3 = [];
        let tokensPassedPeakFall = [];
        let tokensPassedCalcRef = [];
        let tokensPassedInterimLow = [];

        // Filter 1: Plus3 Conditions - Apply to all tokens
        const plus3Result = this.applyPlus3Filter(acceptedTokens, instrumentMap, ceTokens, peTokens, flags, globalDict);
        tokensPassedPlus3 = plus3Result.tokens;
        console.log(`Plus3 filter: ${tokensPassedPlus3.length} tokens passed`);
        
        // Check if plus3 filter produced any tokens
        if (tokensPassedPlus3.length === 0) {
            console.log(`Plus3 filter produced no tokens - stopping all filters`);
            return { success: false, reason: 'No tokens passed plus3 filter' };
        }

        // Update flags with plus3 results
        const updatedFlags = { ...flags, ...plus3Result };
        updatedFlags.mainToken = plus3Result.mainToken;
        updatedFlags.oppToken = plus3Result.oppToken;
        updatedFlags.cePlus3 = plus3Result.cePlus3;
        updatedFlags.pePlus3 = plus3Result.pePlus3;

        // Filter 2: Peak and Fall Conditions - Apply to tokens that passed plus3
        const peakFallResult = this.applyPeakAndFallFilter(tokensPassedPlus3, instrumentMap, updatedFlags, globalDict);
        tokensPassedPeakFall = peakFallResult;
        console.log(`Peak and Fall filter: ${tokensPassedPeakFall.length} tokens passed`);
        
        // Check if peak and fall filter produced any tokens
        if (tokensPassedPeakFall.length === 0) {
            console.log(`Peak and Fall filter produced no tokens - continuing with plus3 tokens`);
            // Continue with plus3 tokens if no peak and fall tokens found
            tokensPassedPeakFall = tokensPassedPlus3;
        }

        // Filter 3: Calc Ref Conditions - Apply to tokens that passed peak and fall
        const calcRefResult = this.applyCalcRefFilter(tokensPassedPeakFall, instrumentMap, updatedFlags);
        tokensPassedCalcRef = calcRefResult;
        console.log(`Calc Ref filter: ${tokensPassedCalcRef.length} tokens passed`);
        
        // Check if calc ref filter produced any tokens
        if (tokensPassedCalcRef.length === 0) {
            console.log(`Calc Ref filter produced no tokens - continuing with peak and fall tokens`);
            // Continue with peak and fall tokens if no calc ref tokens found
            tokensPassedCalcRef = tokensPassedPeakFall;
        }

        // Filter 4: Interim Low Conditions - Apply to tokens that passed calc ref
        const interimLowResult = this.applyInterimLowFilter(tokensPassedCalcRef, instrumentMap, updatedFlags, globalDict);
        tokensPassedInterimLow = interimLowResult.tokens;
        console.log(`Interim Low filter: ${tokensPassedInterimLow.length} tokens passed`);
        
        // Check if interim low filter produced any tokens
        if (tokensPassedInterimLow.length === 0) {
            console.log(`Interim Low filter produced no tokens - continuing with calc ref tokens`);
            // Continue with calc ref tokens if no interim low tokens found
            tokensPassedInterimLow = tokensPassedCalcRef;
        }

        // Update flags with interim low results
        updatedFlags.interimLowReached = interimLowResult.interimLowReached;
        updatedFlags.mtmFirstOption = interimLowResult.mtmFirstOption;

        return {
            success: true,
            flags: updatedFlags,
            finalTokens: tokensPassedInterimLow,
            interimLowReached: updatedFlags.interimLowReached
        };
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = StrategyUtils; 
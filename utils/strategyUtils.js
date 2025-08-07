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
        
        // Create user-specific log directory
        this.logDir = path.join(__dirname, '..', 'logs', `user_${userId}`);
        this.ensureLogDirectory();
        
        // Set log file paths
        this.orderLogFile = path.join(this.logDir, 'orders.log');
        this.strategyLogFile = path.join(this.logDir, 'strategy.log');
        
        console.log(`👤 User info set for logging: ${userName} (ID: ${userId})`);
        console.log(`📁 User log directory: ${this.logDir}`);
        console.log(`📝 Order log file: ${this.orderLogFile}`);
        console.log(`📝 Strategy log file: ${this.strategyLogFile}`);
    }

    ensureLogDirectory() {
        if (!this.logDir) {
            console.warn('⚠️ Log directory not set, using default path');
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
            console.error('❌ Log file path not set');
            return;
        }

        const timestamp = new Date().toISOString();
        const logLine = `[${timestamp}] - [${level}] - ${message}\n`;
        
        try {
            fs.appendFileSync(logFile, logLine);
        } catch (error) {
            console.error('❌ Error writing to log file:', error);
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
            console.warn('⚠️ Order log file not set, using default');
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
            console.warn('⚠️ Strategy log file not set, using default');
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
        this.logStrategy('INFO', message);
    }

    logStrategyWarn(message) {
        this.logStrategy('WARN', message);
    }

    logStrategyError(message) {
        this.logStrategy('ERROR', message);
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
            console.warn('⚠️ Invalid instrument map provided to findClosestSymbolBelowPrice');
            return null;
        }

        if (!instrumentType || !['CE', 'PE'].includes(instrumentType.toUpperCase())) {
            console.warn('⚠️ Invalid instrument type. Must be "CE" or "PE"');
            return null;
        }

        const upperLimit = maxPrice;
        let closestSymbol = null;
        let smallestDifference = Infinity;

        // Iterate through all instruments in the map
        for (const [token, instrument] of Object.entries(instrumentMap)) {
            if (!instrument || !instrument.symbol || instrument.last === undefined) {
                continue;
            }

            const symbol = instrument.symbol;
            const price = instrument.last;

            // Check if this is the correct instrument type
            if (!this.isOptionsInstrument(symbol) || !symbol.includes(instrumentType.toUpperCase())) {
                continue;
            }

            // Check if price is below the upper limit
            if (price > upperLimit) {
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
            this.logStrategyDebug(`🎯 Found closest ${instrumentType} symbol below ${targetPrice}: ${closestSymbol.symbol} @ ${closestSymbol.price} (diff: ${closestSymbol.difference.toFixed(2)})`);
        } else {
            this.logStrategyWarn(`⚠️ No ${instrumentType} symbols found below ${targetPrice}`);
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
                if (instrument.plus3 >= globalDict.peakDef) {
                    this.logStrategyInfo(`📈 PLUS ${globalDict.peakDef}: ${instrument.symbol} LAST: ${instrument.last}`);
                    result.cePlus3 = true;
                    instrument.flagPlus3 = true;
                    ceFound = true;
                    
                    if (!result.mainToken) {
                        result.mainToken = token;
                        this.logStrategyInfo(`🎯 Main token assigned: ${instrument.symbol} (CE)`);
                    } else {
                        result.oppToken = token;
                        this.logStrategyInfo(`🎯 Opposite token assigned: ${instrument.symbol} (CE)`);
                    }
                    filteredTokens.push(token);
                }
            }
            
            // Check PE plus3 - only check until first PE is found
            if (!peFound && peTokens.includes(token) && !flags.interimLowReached && !flags.calcRefReached) {
                if (instrument.plus3 >= globalDict.peakDef) {
                    this.logStrategyInfo(`📈 PLUS ${globalDict.peakDef}: ${instrument.symbol} LAST: ${instrument.last}`);
                    result.pePlus3 = true;
                    instrument.flagPlus3 = true;
                    peFound = true;
                    
                    if (!result.mainToken) {
                        result.mainToken = token;
                        this.logStrategyInfo(`🎯 Main token assigned: ${instrument.symbol} (PE)`);
                    } else {
                        result.oppToken = token;
                        this.logStrategyInfo(`🎯 Opposite token assigned: ${instrument.symbol} (PE)`);
                    }
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
     * @returns {Array} - Array of filtered tokens
     */
    applyPeakAndFallFilter(tokens, instrumentMap, flags) {
        const filteredTokens = [];
        
        for (const token of tokens) {
            const instrument = instrumentMap[token];
            if (!instrument) continue;

            if (instrument.flagPlus3 && !flags.calcRefReached && !flags.interimLowReached) {
                if (instrument.peak - instrument.last >= 2.5 && !instrument.flagPeakAndFall) {
                    this.logStrategyInfo(`📉 PEAK AND FALL by ${instrument.symbol}. PEAK: ${instrument.peak} LAST: ${instrument.last}`);
                    instrument.peakAtRef = instrument.peak;
                    instrument.peakTime = instrument.time;
                    instrument.flagPeakAndFall = true;
                    filteredTokens.push(token);
                }
            }
        }
        
        return filteredTokens;
    }

    /**
     * Apply Calc Ref filter to tokens
     * @param {Array} tokens - Array of token IDs
     * @param {Object} instrumentMap - The instrument map
     * @param {Object} flags - Object containing strategy flags
     * @returns {Array} - Array of filtered tokens
     */
    applyCalcRefFilter(tokens, instrumentMap, flags) {
        const filteredTokens = [];
        
        for (const token of tokens) {
            const instrument = instrumentMap[token];
            if (!instrument) continue;

            if (instrument.flagPeakAndFall && !instrument.flagCalcRef) {
                // Calculate reference point
                const calcRef = this.calculateRefPoint(instrument);
                if (calcRef !== instrument.prevCalcRef) {
                    instrument.prevCalcRef = instrument.calcRef;
                    instrument.calcRef = calcRef;
                    this.logStrategyInfo(`🎯 CALCULATED REFERENCE FOR ${instrument.symbol} IS ${instrument.calcRef}`);
                }
                
                if (instrument.last <= instrument.calcRef && false) {
                    instrument.flagCalcRef = true;
                    flags.calcRefReached = true;
                    this.logStrategyInfo(`🎯 ${instrument.symbol} REACHED CALC REF PRICE ${instrument.calcRef}`);
                    filteredTokens.push(token);
                }
            }
        }
        
        return filteredTokens;
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

            if (instrument.lowAtRef > -1 && !flags.interimLowReached && !flags.calcRefReached) {
                if (instrument.lowAtRef > instrument.last) {
                    instrument.lowAtRef = instrument.last;
                    if (!flags.interimLowDisabled) {
                        this.logStrategyInfo(`📉 NEW LOW AT REF: ${instrument.lowAtRef} FOR ${instrument.symbol}`);
                    }
                }
                
                if (instrument.last - instrument.lowAtRef >= globalDict.upperLimit && !flags.interimLowDisabled) {
                    instrument.flagInterim = true;
                    result.interimLowReached = true;
                    result.mtmFirstOption = {
                        symbol: instrument.symbol,
                        token: token
                    };
                    this.logStrategyInfo(`🎯 INTERIM LOW REACHED: ${instrument.lowAtRef} FOR ${instrument.symbol}`);
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
            this.logStrategyWarn('⚠️ Cannot assign opposite token - main token not set');
            return;
        }

        const mainInstrument = instrumentMap[result.mainToken];
        if (!mainInstrument) {
            this.logStrategyWarn('⚠️ Cannot assign opposite token - main instrument not found');
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
            this.logStrategyWarn('⚠️ Cannot determine opposite type - main token not in CE or PE lists');
            return;
        }

        // Assign the first available token of opposite type
        if (oppositeTokens.length > 0) {
            const oppositeToken = oppositeTokens[0];
            const oppositeInstrument = instrumentMap[oppositeToken];
            
            if (oppositeInstrument) {
                result.oppToken = oppositeToken;
                this.logStrategyInfo(`🎯 Opposite token auto-assigned: ${oppositeInstrument.symbol} (${oppositeType})`);
                this.logStrategyInfo(`📊 Main: ${mainSymbol} (${ceTokens.includes(result.mainToken) ? 'CE' : 'PE'})`);
                this.logStrategyInfo(`📊 Opposite: ${oppositeInstrument.symbol} (${oppositeType})`);
            } else {
                this.logStrategyWarn(`⚠️ Opposite instrument not found for token: ${oppositeToken}`);
            }
        } else {
            this.logStrategyWarn(`⚠️ No ${oppositeType} tokens available for opposite assignment`);
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
        this.logStrategyInfo(`🔍 Starting sequential filtering with ${acceptedTokens.length} tokens`);

        // Filter 1: Plus3 Conditions
        const plus3Result = this.applyPlus3Filter(acceptedTokens, instrumentMap, ceTokens, peTokens, flags, globalDict);
        this.logStrategyInfo(`✅ Plus3 filter: ${plus3Result.tokens.length} tokens passed`);
        
        // Check if plus3 filter produced any tokens
        if (plus3Result.tokens.length === 0) {
            this.logStrategyInfo(`🛑 Plus3 filter produced no tokens - stopping all filters`);
            return { success: false, reason: 'No tokens passed plus3 filter' };
        }

        // Update flags with plus3 results
        const updatedFlags = { ...flags, ...plus3Result };
        updatedFlags.mainToken = plus3Result.mainToken;
        updatedFlags.oppToken = plus3Result.oppToken;
        updatedFlags.cePlus3 = plus3Result.cePlus3;
        updatedFlags.pePlus3 = plus3Result.pePlus3;

        // Stop all filters if interim low is reached
        if (updatedFlags.interimLowReached) {
            this.logStrategyInfo(`🛑 Interim low reached - stopping all filters for this cycle`);
            return { success: true, flags: updatedFlags, interimLowReached: true };
        }

        // Filter 2: Peak and Fall Conditions
        const peakFallTokens = this.applyPeakAndFallFilter(plus3Result.tokens, instrumentMap, updatedFlags);
        this.logStrategyInfo(`✅ Peak and Fall filter: ${peakFallTokens.length} tokens passed`);
        
        // Check if peak and fall filter produced any tokens
        if (peakFallTokens.length === 0) {
            this.logStrategyInfo(`🛑 Peak and Fall filter produced no tokens - stopping all filters`);
            return { success: false, reason: 'No tokens passed peak and fall filter' };
        }

        // Stop all filters if interim low is reached
        if (updatedFlags.interimLowReached) {
            this.logStrategyInfo(`🛑 Interim low reached - stopping all filters for this cycle`);
            return { success: true, flags: updatedFlags, interimLowReached: true };
        }

        // Filter 3: Calc Ref Conditions
        const calcRefTokens = this.applyCalcRefFilter(peakFallTokens, instrumentMap, updatedFlags);
        this.logStrategyInfo(`✅ Calc Ref filter: ${calcRefTokens.length} tokens passed`);
        
        // Check if calc ref filter produced any tokens
        if (calcRefTokens.length === 0) {
            this.logStrategyInfo(`🛑 Calc Ref filter produced no tokens - stopping all filters`);
            return { success: false, reason: 'No tokens passed calc ref filter' };
        }

        // Stop all filters if interim low is reached
        if (updatedFlags.interimLowReached) {
            this.logStrategyInfo(`🛑 Interim low reached - stopping all filters for this cycle`);
            return { success: true, flags: updatedFlags, interimLowReached: true };
        }

        // Filter 4: Interim Low Conditions
        const interimLowResult = this.applyInterimLowFilter(calcRefTokens, instrumentMap, updatedFlags, globalDict);
        this.logStrategyInfo(`✅ Interim Low filter: ${interimLowResult.tokens.length} tokens passed`);
        
        // Check if interim low filter produced any tokens
        if (interimLowResult.tokens.length === 0) {
            this.logStrategyInfo(`🛑 Interim Low filter produced no tokens - stopping all filters`);
            return { success: false, reason: 'No tokens passed interim low filter' };
        }

        // Update flags with interim low results
        updatedFlags.interimLowReached = interimLowResult.interimLowReached;
        updatedFlags.mtmFirstOption = interimLowResult.mtmFirstOption;

        return {
            success: true,
            flags: updatedFlags,
            finalTokens: interimLowResult.tokens,
            interimLowReached: updatedFlags.interimLowReached
        };
    }
}

module.exports = StrategyUtils; 
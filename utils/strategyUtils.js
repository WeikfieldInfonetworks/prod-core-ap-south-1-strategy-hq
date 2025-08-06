const fs = require('fs');
const path = require('path');

class StrategyUtils {
    constructor() {
        this.logFile = null;
        this.userName = null;
        this.userId = null;
    }

    setUserInfo(userName, userId) {
        this.userName = userName;
        this.userId = userId;
        
        // Create user-specific log file
        this.logFile = path.join(__dirname, '..', 'logs', `trading-logs-${userId}.txt`);
        this.ensureLogDirectory();
        
        console.log(`👤 User info set for logging: ${userName} (ID: ${userId})`);
        console.log(`📝 User-specific log file: ${this.logFile}`);
    }

    ensureLogDirectory() {
        if (!this.logFile) {
            console.warn('⚠️ Log file path not set, using default path');
            this.logFile = path.join(__dirname, '..', 'logs', 'trading-logs-default.txt');
        }
        
        const logDir = path.dirname(this.logFile);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
    }

    logTradeAction(action, data, strategyName) {
        // Ensure log file is set
        if (!this.logFile) {
            console.warn('⚠️ Log file not set, using default path');
            this.logFile = path.join(__dirname, '..', 'logs', 'trading-logs-default.txt');
            this.ensureLogDirectory();
        }
        
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            action,
            userName: this.userName || 'Unknown',
            userId: this.userId || 'Unknown',
            data,
            strategy: strategyName
        };
        
        const logLine = `[${timestamp}] ${action.toUpperCase()}: ${JSON.stringify(logEntry, null, 2)}\n`;
        
        try {
            fs.appendFileSync(this.logFile, logLine);
            console.log(`📝 Trade log written to: ${this.logFile}`);
        } catch (error) {
            console.error('❌ Error writing to trade log:', error);
            console.error('Log file path:', this.logFile);
        }
    }

    isOptionsInstrument(symbol) {
        const isOptions = symbol && (symbol.includes('CE') || symbol.includes('PE'));
        return isOptions;
    }

    selectBestInstrument(ticks, targetPrice = 100, cycleCount = 0) {
        console.log(`\n🔍 Selecting best instrument nearest to ${targetPrice} for Cycle ${cycleCount + 1}...`);
        
        let bestInstrument = null;
        let minDistance = Infinity;
        
        // Find the options instrument closest to target price
        for (const tick of ticks) {
            const symbol = tick.symbol || `TOKEN_${tick.instrument_token}`;
            
            if (this.isOptionsInstrument(symbol)) {
                const distance = Math.abs(tick.last_price - targetPrice);
                
                console.log(`📊 Candidate: ${symbol} at ${tick.last_price}, distance: ${distance.toFixed(2)}`);
                
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
            console.log(`✅ Instrument selection complete for Cycle ${cycleCount + 1}!`);
            console.log(`🎯 Selected Instrument: ${bestInstrument.symbol}`);
            console.log(`💰 Price: ${bestInstrument.price}`);
            console.log(`📏 Distance from ${targetPrice}: ${bestInstrument.distance.toFixed(2)}`);
            console.log(`🔢 Token: ${bestInstrument.token}`);
            console.log(`🔄 Cycle: ${cycleCount + 1}`);
            
            // Log instrument selection
            this.logTradeAction('instrument_selected', {
                cycleNumber: cycleCount + 1,
                symbol: bestInstrument.symbol,
                price: bestInstrument.price,
                distance: bestInstrument.distance,
                token: bestInstrument.token,
                timestamp: new Date().toISOString()
            }, 'Strategy');
            
            return bestInstrument;
        } else {
            console.log('❌ No suitable options instruments found in this tick batch');
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
        this.logTradeAction('position_recorded', {
            action,
            symbol,
            price,
            token,
            quantity,
            timestamp: this.getCurrentTimestamp(),
            status: 'ACTIVE'
        }, strategyName);
    }

    logPositionCompleted(action, symbol, buyPrice, sellPrice, quantity, token, strategyName) {
        const pnl = this.calculatePnL(buyPrice, sellPrice, quantity);
        
        this.logTradeAction('position_completed', {
            action,
            symbol,
            buyPrice,
            sellPrice,
            quantity,
            priceDifference: pnl.priceDifference,
            totalPnL: pnl.totalPnL,
            token,
            timestamp: this.getCurrentTimestamp(),
            status: 'COMPLETED'
        }, strategyName);
    }

    logCycleCompleted(cycleNumber, symbol, totalTicks, quantity, priceDifference, totalPnL, strategyName) {
        this.logTradeAction('cycle_completed', {
            cycleNumber,
            selectedInstrument: symbol,
            totalTicks,
            quantity,
            priceDifference,
            totalPnL,
            timestamp: this.getCurrentTimestamp()
        }, strategyName);
    }
}

module.exports = StrategyUtils; 
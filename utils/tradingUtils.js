const { KiteConnect } = require('kiteconnect');
const fs = require('fs');
const path = require('path');

class TradingUtils {
    constructor() {
        this.kite = null;
    }

    initializeKiteConnect(apiKey, accessToken) {
        if (!apiKey || !accessToken) {
            console.log('KiteConnect not initialized - missing credentials');
            return false;
        }
        
        try {
            this.kite = new KiteConnect({ api_key: apiKey });
            this.kite.setAccessToken(accessToken);
            
            console.log('KiteConnect initialized with credentials');
            console.log('API Key:', apiKey);
            console.log('Access Token:', accessToken.substring(0, 10) + '...');
            
            return true;
        } catch (error) {
            console.error('Error initializing KiteConnect:', error);
            return false;
        }
    }

    placeBuyOrder(symbol, price, quantity = 75) {
        console.log('Placing buy order for', symbol, price, quantity);
        console.log('Kite instance available:', !!this.kite);
        console.log('Kite type:', typeof this.kite);
        
        if (!this.kite) {
            console.log('Paper trading mode - simulating buy order');
            console.log(`Simulated BUY: ${symbol} @ ${price} x ${quantity}`);
            return { success: true, orderId: 'PAPER_BUY_' + Date.now() };
        }
        
        try {
            console.log('About to call kite.placeOrder...');
            console.log('Parameters:', { symbol, price, quantity });
            
            // Use correct KiteConnect API format with exchange field
            const orderParams = {
                tradingsymbol: symbol,
                exchange: "NFO", // Required field for options trading
                transaction_type: "BUY",
                quantity: parseInt(quantity),
                product: "MIS",
                order_type: "MARKET"
            };
            
            console.log('Order params:', orderParams);
            
            // Call KiteConnect API with correct format - synchronous
            const response = this.kite.placeOrder("regular", orderParams);
            
            console.log('Kite API call completed');
            console.log(`Buy order placed successfully for ${symbol}`);
            console.log('Order ID:', response);
            
            return { success: true, orderId: response };
        } catch (error) {
            console.error(`Error buying ${symbol}:`, error);
            console.error('Error details:', {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
            
            // Check if it's an authentication error
            if (error.message.includes('Request method not allowed') || 
                error.message.includes('unauthorized') || 
                error.message.includes('authentication')) {
                console.log('Authentication error detected - using paper trading');
                return { success: true, orderId: 'PAPER_BUY_' + Date.now(), paper: true };
            }
            
            return { success: false, error: error.message };
        }
    }

    placeSellOrder(symbol, price, quantity = 75) {
        if (!this.kite) {
            console.log('Paper trading mode - simulating sell order');
            console.log(`Simulated SELL: ${symbol} @ ${price} x ${quantity}`);
            return { success: true, orderId: 'PAPER_SELL_' + Date.now() };
        }
        
        try {
            console.log('About to call kite.placeOrder for sell...');
            console.log('Parameters:', { symbol, price, quantity });
            
            // Use correct KiteConnect API format with exchange field
            const orderParams = {
                tradingsymbol: symbol,
                exchange: "NFO", // Required field for options trading
                transaction_type: "SELL",
                quantity: parseInt(quantity),
                product: "MIS",
                order_type: "MARKET"
            };
            
            console.log('Order params:', orderParams);
            
            // Call KiteConnect API with correct format - synchronous
            const response = this.kite.placeOrder("regular", orderParams);
            
            console.log(`Sell order placed successfully for ${symbol}`);
            console.log('Order ID:', response);
            
            return { success: true, orderId: response };
        } catch (error) {
            console.error(`Error selling ${symbol}:`, error);
            
            // Check if it's an authentication error
            if (error.message.includes('Request method not allowed') || 
                error.message.includes('unauthorized') || 
                error.message.includes('authentication')) {
                console.log('Authentication error detected - using paper trading');
                return { success: true, orderId: 'PAPER_SELL_' + Date.now(), paper: true };
            }
            
            return { success: false, error: error.message };
        }
    }

    ensureLogDirectory(logFile) {
        const logDir = path.dirname(logFile);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
    }

    logTradeAction(action, data, strategyName) {
        const logFile = this.logFile || 'logs/trading-actions.log';
        this.ensureLogDirectory(logFile);
        
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${action.toUpperCase()}: ${JSON.stringify(data)} (Strategy: ${strategyName})\n`;
        
        try {
            fs.appendFileSync(logFile, logEntry);
            console.log(`Trade log written to: ${logFile}`);
        } catch (error) {
            console.error('Error writing to trade log:', error);
        }
    }
}

module.exports = TradingUtils; 
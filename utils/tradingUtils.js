const { KiteConnect } = require('kiteconnect');
const fs = require('fs');
const path = require('path');

class TradingUtils {
    constructor() {
        this.kite = null;
    }

    initializeKiteConnect(apiKey, accessToken) {
        if (!apiKey || !accessToken) {
            console.log('❌ KiteConnect not initialized - missing credentials');
            return false;
        }

        try {
            this.kite = new KiteConnect({
                api_key: apiKey
            });
            
            this.kite.setAccessToken(accessToken);
            
            console.log('✅ KiteConnect initialized with credentials');
            console.log('API Key:', apiKey);
            console.log('Access Token:', accessToken.substring(0, 10) + '...');
            return true;
        } catch (error) {
            console.error('❌ Error initializing KiteConnect:', error);
            return false;
        }
    }

    async placeBuyOrder(symbol, price, quantity = 75) {
        if (!this.kite) {
            console.log('📝 Paper trading mode - simulating buy order');
            return {
                success: true,
                paper: true,
                symbol,
                price,
                quantity,
                message: 'Paper trading - buy order simulated'
            };
        }

        try {
            console.log('📞 Placing actual buy order via KiteConnect');
            
            const orderParams = {
                tradingsymbol: symbol,
                exchange: 'NFO',
                transaction_type: 'BUY',
                quantity: quantity,
                product: 'MIS',
                order_type: 'MARKET'
            };
            
            console.log('📋 Order Parameters:', JSON.stringify(orderParams, null, 2));
            console.log('📦 Lot Size:', quantity);
            
            const response = await this.kite.placeOrder('regular', orderParams);
            
            console.log(`✅ Buy order placed successfully for ${symbol}`);
            console.log(`📄 Order Response:`, response);
            console.log(`📦 Quantity: ${quantity}`);
            
            return {
                success: true,
                paper: false,
                symbol,
                price,
                quantity,
                orderResponse: response,
                message: 'Buy order placed successfully'
            };
        } catch (error) {
            console.error(`❌ Error buying ${symbol}:`, error);
            console.error('Error details:', JSON.stringify(error, null, 2));
            
            return {
                success: false,
                paper: false,
                symbol,
                price,
                quantity,
                error: error.message,
                errorDetails: error,
                message: 'Buy order failed'
            };
        }
    }

    async placeSellOrder(symbol, price, quantity = 75) {
        if (!this.kite) {
            console.log('📝 Paper trading mode - simulating sell order');
            return {
                success: true,
                paper: true,
                symbol,
                price,
                quantity,
                message: 'Paper trading - sell order simulated'
            };
        }

        try {
            console.log('📞 Placing actual sell order via KiteConnect');
            
            const orderParams = {
                tradingsymbol: symbol,
                exchange: 'NFO',
                transaction_type: 'SELL',
                quantity: quantity,
                product: 'MIS',
                order_type: 'MARKET'
            };
            
            console.log('📋 Order Parameters:', JSON.stringify(orderParams, null, 2));
            console.log('📦 Lot Size:', quantity);
            
            const response = await this.kite.placeOrder('regular', orderParams);
            
            console.log(`✅ Sell order placed successfully for ${symbol}`);
            console.log(`📄 Order Response:`, response);
            console.log(`📦 Quantity: ${quantity}`);
            
            return {
                success: true,
                paper: false,
                symbol,
                price,
                quantity,
                orderResponse: response,
                message: 'Sell order placed successfully'
            };
        } catch (error) {
            console.error(`❌ Error selling ${symbol}:`, error);
            console.error('Error details:', JSON.stringify(error, null, 2));
            
            return {
                success: false,
                paper: false,
                symbol,
                price,
                quantity,
                error: error.message,
                errorDetails: error,
                message: 'Sell order failed'
            };
        }
    }

    logTradeAction(logFile, action, data) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            action,
            data
        };
        
        const logLine = `[${timestamp}] ${action.toUpperCase()}: ${JSON.stringify(logEntry, null, 2)}\n`;
        
        try {
            fs.appendFileSync(logFile, logLine);
            console.log(`📝 Trade log written to: ${logFile}`);
        } catch (error) {
            console.error('❌ Error writing to trade log:', error);
        }
    }

    ensureLogDirectory(logFile) {
        const logDir = path.dirname(logFile);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
    }
}

module.exports = TradingUtils; 
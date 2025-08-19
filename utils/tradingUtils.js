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

    async getOrderHistory(orderId){

        console.log('Getting order history for', orderId);

        if(!this.kite){
            console.log('Paper trading mode - simulating order history');
            return {success: false, error: 'Paper trading mode - cannot get order history'};
        }

        const orderHistory = await this.kite.getOrderHistory(orderId);
        return orderHistory;
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
                order_type: "MARKET",
                price: parseFloat(price)
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

    placeMarketSellOrder(symbol, price, quantity = 75) {
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
                order_type: "MARKET",
                price: parseFloat(price)
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

    placeLimitSellOrder(symbol, price, quantity = 75) {
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
                order_type: "LIMIT",
                price: parseFloat(price)
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

    placeLimitThenMarketSellOrder(symbol, price, quantity = 75) {
        if (!this.kite) {
            console.log('Paper trading mode - simulating limit sell order');
            console.log(`Simulated LIMIT SELL: ${symbol} @ ${price} x ${quantity}`);
            return { success: true, orderId: 'PAPER_LIMIT_SELL_' + Date.now() };
        }
        
        try {
            // First, place a limit sell order
            console.log('Placing limit sell order...');
            const limitOrderResult = this.placeLimitSellOrder(symbol, price, quantity);
            
            if (!limitOrderResult.success) {
                console.error('Failed to place limit sell order:', limitOrderResult.error);
                return limitOrderResult;
            }
            
            console.log('Limit sell order placed, getting order ID...');
            
            // Get order history to check status - orderId is a promise
            return limitOrderResult.orderId
                .then(orderId => {
                    console.log('Limit sell order placed with ID:', orderId.order_id);
                    
                    // Get order history to check status
                    console.log('Checking order history for status...');
                    return this.getOrderHistory(orderId.order_id)
                        .then(orderHistory => {
                            if (!orderHistory || orderHistory.length === 0) {
                                console.error('Could not retrieve order history');
                                return { success: false, error: 'Could not retrieve order history' };
                            }
                            
                            // Get the last status from order history
                            const lastOrder = orderHistory[orderHistory.length - 1];
                            const lastStatus = lastOrder.status;
                            
                            console.log('Last order status:', lastStatus);
                            
                            // If the order is not complete, cancel it and place market order
                            if (lastStatus !== 'COMPLETE') {
                                console.log('Order is not complete, cancelling and placing market sell order...');
                                
                                // Cancel the limit order
                                return this.kite.cancelOrder("regular", orderId.order_id)
                                    .then(() => {
                                        console.log('Limit order cancelled successfully');
                                        
                                        // Place market sell order
                                        const marketOrderResult = this.placeMarketSellOrder(symbol, price, quantity);
                                        console.log('Market sell order placed:', marketOrderResult);
                                        
                                        return marketOrderResult;
                                    })
                                    .catch(cancelError => {
                                        console.error('Error cancelling limit order:', cancelError);
                                        return { success: false, error: `Failed to cancel limit order: ${cancelError.message}` };
                                    });
                            } else {
                                console.log('Order is complete, status:', lastStatus);
                                return { success: true, orderId: orderId.order_id, status: lastStatus };
                            }
                        })
                        .catch(error => {
                            console.error('Error getting order history:', error);
                            return { success: false, error: `Failed to get order history: ${error.message}` };
                        });
                })
                .catch(error => {
                    console.error('Error getting order ID:', error);
                    return { success: false, error: `Failed to get order ID: ${error.message}` };
                });
            
        } catch (error) {
            console.error('Error in placeLimitThenMarketSellOrder:', error);
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
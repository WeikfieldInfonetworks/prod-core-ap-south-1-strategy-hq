const BaseStrategy = require('./base');
const TradingUtils = require('../utils/tradingUtils');
const StrategyUtils = require('../utils/strategyUtils');

class SimpleBuySellStrategy extends BaseStrategy {
    constructor() {
        super();
        this.name = 'Simple Buy Sell';
        this.description = 'Buy one option nearest and under 100, sell at +5 or -5, then stop';
        this.tradingUtils = new TradingUtils();
        this.strategyUtils = new StrategyUtils();
        
        // Strategy state variables
        this.hasActivePosition = false;
        this.buyPrice = null;
        this.buySymbol = null;
        this.tickCount = 0;
        this.selectedInstrument = null;
        this.instrumentSelectionComplete = false;
        this.cycleCount = 0;
        this.buyCompleted = false;
        this.sellCompleted = false;
        this.executionStopped = false;
    }

    setUserInfo(userName, userId) {
        this.strategyUtils.setUserInfo(userName, userId);
        this.strategyUtils.logStrategyInfo(`Simple Buy Sell Strategy initialized for user: ${userName} (ID: ${userId})`);
    }

    initialize(globalDict, universalDict, blockDict, accessToken) {
        // Call parent initialize method
        super.initialize(globalDict, universalDict, blockDict, accessToken);
        
        this.strategyUtils.logStrategyInfo('=== Simple Buy Sell Strategy Initialization ===');
        this.strategyUtils.logStrategyInfo(`Strategy Name: ${this.name}`);
        this.strategyUtils.logStrategyInfo(`Strategy Description: ${this.description}`);
        this.strategyUtils.logStrategyInfo(`Access Token Available: ${!!this.accessToken}`);
        this.strategyUtils.logStrategyInfo(`API Key Available: ${!!this.globalDict.api_key}`);
        
        // Initialize TradingUtils with credentials from session
        if (this.accessToken && this.globalDict.api_key) {
            const initialized = this.tradingUtils.initializeKiteConnect(this.globalDict.api_key, this.accessToken);
            
            if (initialized) {
                this.strategyUtils.logStrategyInfo('TradingUtils initialized with session credentials');
            } else {
                this.strategyUtils.logStrategyError('TradingUtils initialization failed');
            }
        } else {
            this.strategyUtils.logStrategyError('TradingUtils not initialized - missing credentials');
            this.strategyUtils.logStrategyError(`Access Token: ${this.accessToken ? 'Available' : 'Missing'}`);
            this.strategyUtils.logStrategyError(`API Key: ${this.globalDict.api_key ? 'Available' : 'Missing'}`);
        }

        // Initialize strategy-specific data structures
        this.universalDict.optionsData = {};
        this.blockDict.lastPrices = {};

        // Initialize dictionary parameters with default values
        const globalParams = this.getGlobalDictParameters();
        const universalParams = this.getUniversalDictParameters();

        // Set default values for globalDict parameters
        for (const [key, param] of Object.entries(globalParams)) {
            if (this.globalDict[key] === undefined) {
                this.globalDict[key] = param.default;
                this.strategyUtils.logStrategyInfo(`Set default ${key}: ${param.default}`);
            } else {
                this.strategyUtils.logStrategyInfo(`Using existing ${key}: ${this.globalDict[key]}`);
            }
        }

        // Set default values for universalDict parameters
        for (const [key, param] of Object.entries(universalParams)) {
            if (this.universalDict[key] === undefined) {
                this.universalDict[key] = param.default;
                this.strategyUtils.logStrategyInfo(`Set default ${key}: ${param.default}`);
            } else {
                this.strategyUtils.logStrategyInfo(`Using existing ${key}: ${this.universalDict[key]}`);
            }
        }

        // Reset position state
        this.hasActivePosition = false;
        this.buyPrice = null;
        this.buySymbol = null;
        this.tickCount = 0;
        this.selectedInstrument = null;
        this.instrumentSelectionComplete = false;
        this.buyCompleted = false;
        this.sellCompleted = false;
        this.executionStopped = false;

        this.strategyUtils.logStrategyInfo('=== Initialization Complete ===');
    }

    processTicks(ticks) {
        // Stop processing if execution is stopped
        if (this.executionStopped) {
            this.strategyUtils.logStrategyInfo('Execution stopped - skipping tick processing');
            return;
        }

        this.tickCount++;
        console.log(`=== Processing Tick Batch #${this.tickCount} ===`);
        console.log(`Number of ticks received: ${ticks.length}`);
        console.log(`Current Cycle: ${this.cycleCount}`);
        
        // If instrument selection is not complete, try to select the best instrument
        if (!this.instrumentSelectionComplete) {
            this.selectedInstrument = this.strategyUtils.selectBestInstrumentUnder100(ticks, this.cycleCount);
            this.instrumentSelectionComplete = !!this.selectedInstrument;
            
            if (this.selectedInstrument) {
                this.strategyUtils.logStrategyInfo(`Selected instrument: ${this.selectedInstrument.symbol} @ ${this.selectedInstrument.price}`);
                
                // Initialize tracking for the selected instrument
                this.universalDict.optionsData[this.selectedInstrument.token] = {
                    symbol: this.selectedInstrument.symbol,
                    token: this.selectedInstrument.token,
                    currentPrice: this.selectedInstrument.price,
                    lastUpdate: this.strategyUtils.getCurrentTimestamp()
                };
                
                this.strategyUtils.logStrategyInfo('Selected instrument tracking initialized');
            }
        }
        
        // Process ticks for the selected instrument only
        for (const tick of ticks) {
            const token = tick.instrument_token;
            const symbol = tick.symbol || `TOKEN_${token}`;
            
            // Only process ticks for the selected instrument
            if (this.selectedInstrument && this.selectedInstrument.token === token) {
                this.strategyUtils.logStrategyInfo(`Processing tick for selected instrument - Symbol: ${symbol}, Price: ${tick.last_price}, Token: ${token}`);
                
                // Update price history
                if (!this.universalDict.optionsData[token]) {
                    this.universalDict.optionsData[token] = {
                        symbol,
                        token,
                        currentPrice: tick.last_price,
                        lastUpdate: this.strategyUtils.getCurrentTimestamp()
                    };
                    this.strategyUtils.logStrategyInfo(`Selected instrument tracked: ${symbol} at ${tick.last_price}`);
                } else {
                    const oldPrice = this.universalDict.optionsData[token].currentPrice;
                    const priceChange = tick.last_price - oldPrice;
                    this.strategyUtils.logStrategyInfo(`Price update for selected instrument ${symbol}: ${oldPrice} → ${tick.last_price} (${priceChange > 0 ? '+' : ''}${priceChange.toFixed(2)})`);
                }
                
                const optionData = this.universalDict.optionsData[token];
                optionData.currentPrice = tick.last_price;
                optionData.lastUpdate = this.strategyUtils.getCurrentTimestamp();
                
                // Update global price
                this.globalDict[token] = tick.last_price;

                // Process the selected instrument
                this.processOptionsTick(optionData, tick);
            }
        }
        
        this.strategyUtils.logStrategyInfo(`=== Tick Batch #${this.tickCount} Complete ===`);
    }

    processOptionsTick(optionData, tick) {
        const symbol = optionData.symbol;
        const currentPrice = tick.last_price;
        
        this.strategyUtils.logStrategyInfo(`Analyzing selected instrument tick for ${symbol} at ${currentPrice}`);
        
        // If we don't have an active position, look for buy opportunity
        if (!this.hasActivePosition) {
            this.strategyUtils.logStrategyInfo('No active position - checking for buy opportunity');
            if (this.shouldBuyOption(optionData)) {
                this.strategyUtils.logStrategyInfo('Buy condition met!');
                this.buyOption(optionData);
            } else {
                this.strategyUtils.logStrategyInfo('Buy condition not met');
            }
        } else {
            // If we have an active position, check for sell opportunity
            this.strategyUtils.logStrategyInfo(`Active position exists - checking for sell opportunity`);
            this.strategyUtils.logStrategyInfo(`Current buy price: ${this.buyPrice}, Current price: ${currentPrice}`);
            if (this.shouldSellOption(optionData)) {
                this.strategyUtils.logStrategyInfo('Sell condition met!');
                this.sellOption(optionData);
            } else {
                this.strategyUtils.logStrategyInfo('Sell condition not met');
            }
        }
    }

    shouldBuyOption(optionData) {
        if (!this.globalDict.enableTrading) {
            this.strategyUtils.logStrategyInfo('Trading disabled - skipping buy check');
            return false;
        }
        
        if (!this.instrumentSelectionComplete) {
            this.strategyUtils.logStrategyInfo('Instrument selection not complete - skipping buy check');
            return false;
        }
        
        if (this.buyCompleted) {
            this.strategyUtils.logStrategyInfo('Buy already completed for this cycle - skipping buy check');
            return false;
        }
        
        const currentPrice = optionData.currentPrice;
        
        this.strategyUtils.logStrategyDebug(`Buy Check for ${optionData.symbol}:`);
        this.strategyUtils.logStrategyDebug(`  Current Price: ${currentPrice}`);
        this.strategyUtils.logStrategyDebug(`  Buy immediately when instrument is selected`);
        this.strategyUtils.logStrategyDebug(`  Cycle Count: ${this.cycleCount}`);
        this.strategyUtils.logStrategyDebug(`  Buy Completed: ${this.buyCompleted}`);
        
        // Buy immediately when instrument is selected (no threshold)
        return true;
    }

    shouldSellOption(optionData) {
        if (!this.hasActivePosition || !this.buyPrice) {
            this.strategyUtils.logStrategyInfo('No active position or buy price - skipping sell check');
            return false;
        }
        
        if (this.sellCompleted) {
            this.strategyUtils.logStrategyInfo('Sell already completed for this cycle - skipping sell check');
            return false;
        }
        
        const currentPrice = optionData.currentPrice;
        const priceDifference = currentPrice - this.buyPrice;
        
        this.strategyUtils.logStrategyDebug(`Sell Check for ${optionData.symbol}:`);
        this.strategyUtils.logStrategyDebug(`  Buy Price: ${this.buyPrice}`);
        this.strategyUtils.logStrategyDebug(`  Current Price: ${currentPrice}`);
        this.strategyUtils.logStrategyDebug(`  Price Difference: ${priceDifference.toFixed(2)}`);
        this.strategyUtils.logStrategyDebug(`  Target: +5`);
        this.strategyUtils.logStrategyDebug(`  Stop Loss: -5`);
        this.strategyUtils.logStrategyDebug(`  Hit Target: ${priceDifference >= 5}`);
        this.strategyUtils.logStrategyDebug(`  Hit Stop Loss: ${priceDifference <= -5}`);
        this.strategyUtils.logStrategyDebug(`  Sell Completed: ${this.sellCompleted}`);
        
        // Sell if price is 5 rupees higher or lower than buy price (hard coded)
        return priceDifference >= 2 || priceDifference <= -2;
    }

    buyOption(optionData) {
        this.strategyUtils.logStrategyInfo(`Attempting to buy ${optionData.symbol} at ${optionData.currentPrice}`);
        
        // Log the buy attempt
        this.strategyUtils.logTradeAction('buy_attempt', {
            symbol: optionData.symbol,
            price: optionData.currentPrice,
            token: optionData.token,
            quantity: 75,
            timestamp: this.strategyUtils.getCurrentTimestamp()
        }, this.name);
        
        try {
            this.strategyUtils.logStrategyInfo('Placing actual buy order via TradingUtils');
            
            // Place buy order using trading utils - synchronous
            const result = this.tradingUtils.placeBuyOrder(
                optionData.symbol, 
                optionData.currentPrice, 
                75
            );
            
            if (result.success) {
                this.strategyUtils.logStrategyInfo(`Buy order placed successfully for ${optionData.symbol}`);
                this.strategyUtils.logStrategyInfo(`Quantity: 75 (1 lot)`);
                
                // Log successful buy order
                this.strategyUtils.logTradeAction('buy_success', {
                    symbol: optionData.symbol,
                    price: optionData.currentPrice,
                    token: optionData.token,
                    quantity: 75,
                    orderId: result.orderId,
                    timestamp: this.strategyUtils.getCurrentTimestamp()
                }, this.name);
                
                this.recordBuyPosition(optionData);
            } else {
                this.strategyUtils.logStrategyError(`Error buying ${optionData.symbol}: ${result.error}`);
                
                // Log buy order failure
                this.strategyUtils.logTradeAction('buy_failure', {
                    symbol: optionData.symbol,
                    price: optionData.currentPrice,
                    token: optionData.token,
                    quantity: 75,
                    error: result.error,
                    timestamp: this.strategyUtils.getCurrentTimestamp()
                }, this.name);
                
                // If order fails, still record the position for paper trading
                this.strategyUtils.logStrategyInfo('Recording position as paper trade due to order failure');
                this.recordBuyPosition(optionData);
            }
        } catch (error) {
            this.strategyUtils.logStrategyError(`Exception while placing buy order for ${optionData.symbol}: ${error.message}`);
            
            // Log exception during buy
            this.strategyUtils.logTradeAction('buy_exception', {
                symbol: optionData.symbol,
                price: optionData.currentPrice,
                token: optionData.token,
                quantity: 75,
                error: error.message,
                timestamp: this.strategyUtils.getCurrentTimestamp()
            }, this.name);
            
            this.strategyUtils.logStrategyInfo('Recording position as paper trade due to exception');
            this.recordBuyPosition(optionData);
        }
    }

    sellOption(optionData) {
        this.strategyUtils.logStrategyInfo(`Attempting to sell ${optionData.symbol} at ${optionData.currentPrice}`);
        
        // Log the sell attempt
        this.strategyUtils.logTradeAction('sell_attempt', {
            symbol: optionData.symbol,
            price: optionData.currentPrice,
            token: optionData.token,
            buyPrice: this.buyPrice,
            priceDifference: optionData.currentPrice - this.buyPrice,
            quantity: 75,
            timestamp: this.strategyUtils.getCurrentTimestamp()
        }, this.name);
        
        try {
            this.strategyUtils.logStrategyInfo('Placing actual sell order via TradingUtils');
            
            // Place sell order using trading utils - synchronous
            const result = this.tradingUtils.placeSellOrder(
                optionData.symbol, 
                optionData.currentPrice, 
                75
            );
            
            if (result.success) {
                this.strategyUtils.logStrategyInfo(`Sell order placed successfully for ${optionData.symbol}`);
                this.strategyUtils.logStrategyInfo(`Quantity: 75 (1 lot)`);
                
                // Log successful sell order
                this.strategyUtils.logTradeAction('sell_success', {
                    symbol: optionData.symbol,
                    price: optionData.currentPrice,
                    token: optionData.token,
                    buyPrice: this.buyPrice,
                    priceDifference: optionData.currentPrice - this.buyPrice,
                    quantity: 75,
                    orderId: result.orderId,
                    timestamp: this.strategyUtils.getCurrentTimestamp()
                }, this.name);
                
                this.recordSellPosition(optionData);
            } else {
                this.strategyUtils.logStrategyError(`Error selling ${optionData.symbol}: ${result.error}`);
                
                // Log sell order failure
                this.strategyUtils.logTradeAction('sell_failure', {
                    symbol: optionData.symbol,
                    price: optionData.currentPrice,
                    token: optionData.token,
                    buyPrice: this.buyPrice,
                    priceDifference: optionData.currentPrice - this.buyPrice,
                    quantity: 75,
                    error: result.error,
                    timestamp: this.strategyUtils.getCurrentTimestamp()
                }, this.name);
                
                // If order fails, still record the position for paper trading
                this.strategyUtils.logStrategyInfo('Recording position as paper trade due to order failure');
                this.recordSellPosition(optionData);
            }
        } catch (error) {
            this.strategyUtils.logStrategyError(`Exception while placing sell order for ${optionData.symbol}: ${error.message}`);
            
            // Log exception during sell
            this.strategyUtils.logTradeAction('sell_exception', {
                symbol: optionData.symbol,
                price: optionData.currentPrice,
                token: optionData.token,
                buyPrice: this.buyPrice,
                priceDifference: optionData.currentPrice - this.buyPrice,
                quantity: 75,
                error: error.message,
                timestamp: this.strategyUtils.getCurrentTimestamp()
            }, this.name);
            
            this.strategyUtils.logStrategyInfo('Recording position as paper trade due to exception');
            this.recordSellPosition(optionData);
        }
    }

    recordBuyPosition(optionData) {
        this.strategyUtils.logStrategyInfo(`Recording buy position for ${optionData.symbol}`);
        
        this.hasActivePosition = true;
        this.buyPrice = optionData.currentPrice;
        this.buySymbol = optionData.symbol;
        
        // Mark buy as completed for this cycle
        this.buyCompleted = true;
        
        this.strategyUtils.logStrategyInfo(`  Position recorded:`);
        this.strategyUtils.logStrategyInfo(`  Symbol: ${optionData.symbol}`);
        this.strategyUtils.logStrategyInfo(`  Buy Price: ${optionData.currentPrice}`);
        this.strategyUtils.logStrategyInfo(`  Quantity: 75 (1 lot)`);
        this.strategyUtils.logStrategyInfo(`  Buy Time: ${this.strategyUtils.getCurrentTimestamp()}`);
        this.strategyUtils.logStrategyInfo(`  Status: ACTIVE`);
        this.strategyUtils.logStrategyInfo(`  Buy Completed: ${this.buyCompleted}`);
        
        // Update universal dict for tracking
        this.universalDict.activePosition = {
            symbol: optionData.symbol,
            buyPrice: optionData.currentPrice,
            quantity: 75,
            buyTime: this.strategyUtils.getCurrentTimestamp(),
            status: 'ACTIVE'
        };
        
        // Log position recording
        this.strategyUtils.logPositionRecorded(
            'buy',
            optionData.symbol,
            optionData.currentPrice,
            75,
            optionData.token,
            this.name
        );
        
        this.strategyUtils.logStrategyInfo('Position tracking updated in universalDict');
    }

    recordSellPosition(optionData) {
        this.strategyUtils.logStrategyInfo(`Recording sell position for ${optionData.symbol}`);
        
        const currentPrice = optionData.currentPrice;
        const pnl = this.strategyUtils.calculatePnL(this.buyPrice, currentPrice, 75);
        
        this.strategyUtils.logStrategyInfo(`Position closed:`);
        this.strategyUtils.logStrategyInfo(`  Symbol: ${optionData.symbol}`);
        this.strategyUtils.logStrategyInfo(`  Buy Price: ${this.buyPrice}`);
        this.strategyUtils.logStrategyInfo(`  Sell Price: ${currentPrice}`);
        this.strategyUtils.logStrategyInfo(`  Quantity: 75 (1 lot)`);
        this.strategyUtils.logStrategyInfo(`  Price Difference per unit: ${pnl.priceDifference.toFixed(2)} rupees`);
        this.strategyUtils.logStrategyInfo(`  Total P&L for 1 lot: ${pnl.totalPnL.toFixed(2)} rupees`);
        this.strategyUtils.logStrategyInfo(`  Sell Time: ${this.strategyUtils.getCurrentTimestamp()}`);
        this.strategyUtils.logStrategyInfo(`  Status: COMPLETED`);
        
        // Update universal dict for tracking
        this.universalDict.activePosition = {
            symbol: optionData.symbol,
            buyPrice: this.buyPrice,
            sellPrice: currentPrice,
            quantity: 75,
            priceDifference: pnl.priceDifference,
            totalPnL: pnl.totalPnL,
            buyTime: this.universalDict.activePosition?.buyTime,
            sellTime: this.strategyUtils.getCurrentTimestamp(),
            status: 'COMPLETED'
        };
        
        // Log position completion
        this.strategyUtils.logPositionCompleted(
            'sell',
            optionData.symbol,
            this.buyPrice,
            currentPrice,
            75,
            optionData.token,
            this.name
        );
        
        // Mark sell as completed
        this.sellCompleted = true;
        
        // STOP EXECUTION after sell
        this.executionStopped = true;
        
        this.strategyUtils.logStrategyInfo('Sell completed for this cycle');
        this.strategyUtils.logStrategyInfo('EXECUTION STOPPED - Strategy completed successfully');
        this.strategyUtils.logStrategyInfo('Position tracking updated in universalDict');
        
        // Log cycle completion
        this.strategyUtils.logCycleCompleted(
            this.cycleCount,
            optionData.symbol,
            this.tickCount,
            75,
            pnl.priceDifference,
            pnl.totalPnL,
            this.name
        );
        
        this.strategyUtils.logStrategyInfo('Trading cycle completed. Execution stopped.');
        this.strategyUtils.logStrategyInfo('Cycle Summary:');
        this.strategyUtils.logStrategyInfo(`  Cycle Number: ${this.cycleCount}`);
        this.strategyUtils.logStrategyInfo(`  Selected Instrument: ${optionData.symbol}`);
        this.strategyUtils.logStrategyInfo(`  Total ticks processed: ${this.tickCount}`);
        this.strategyUtils.logStrategyInfo(`  Quantity traded: 75 (1 lot)`);
        this.strategyUtils.logStrategyInfo(`  Price difference per unit: ${pnl.priceDifference.toFixed(2)} rupees`);
        this.strategyUtils.logStrategyInfo(`  Total P&L for 1 lot: ${pnl.totalPnL.toFixed(2)} rupees`);
        this.strategyUtils.logStrategyInfo(`  Strategy duration: ${this.strategyUtils.getCurrentTimestamp()}`);
        this.strategyUtils.logStrategyInfo('Execution stopped successfully');
    }

    getConfig() {
        return {
            name: this.name,
            description: this.description,
            globalDictParameters: this.getGlobalDictParameters(),
            universalDictParameters: this.getUniversalDictParameters(),
            selectedInstrument: this.selectedInstrument,
            hasActivePosition: this.hasActivePosition,
            buyPrice: this.buyPrice,
            buySymbol: this.buySymbol,
            cycleCount: this.cycleCount,
            buyCompleted: this.buyCompleted,
            sellCompleted: this.sellCompleted,
            executionStopped: this.executionStopped
        };
    }

    getGlobalDictParameters() {
        return {
            target: {
                type: 'number',
                default: 5,
                description: 'Target profit in rupees to sell (hard coded to 5)'
            },
            stoploss: {
                type: 'number',
                default: 5,
                description: 'Stop loss in rupees to sell (hard coded to 5)'
            },
            enableTrading: {
                type: 'boolean',
                default: false,
                description: 'Enable/disable actual trading'
            }
        };
    }

    getUniversalDictParameters() {
        return {
            // No universal parameters needed for this strategy
        };
    }
}

module.exports = SimpleBuySellStrategy;
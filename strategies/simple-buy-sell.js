const BaseStrategy = require('./base');
const TradingUtils = require('../utils/tradingUtils');
const StrategyUtils = require('../utils/strategyUtils');

class SimpleBuySellStrategy extends BaseStrategy {
    constructor() {
        super();
        this.name = 'Simple Buy Sell';
        this.description = 'Buy one option nearest to 100 and sell at +5 or -5 rupees';
        this.tradingUtils = new TradingUtils();
        this.strategyUtils = new StrategyUtils();
        this.hasActivePosition = false;
        this.buyPrice = null;
        this.buySymbol = null;
        this.tickCount = 0;
        this.selectedInstrument = null;
        this.instrumentSelectionComplete = false;
        this.cycleCount = 0;
        this.lastSellTime = null;
        this.buyCompleted = false;
        this.sellCompleted = false;
        this.debugMode = false; // Paper trading mode after first cycle
    }

    setUserInfo(userName, userId) {
        this.strategyUtils.setUserInfo(userName, userId);
        this.strategyUtils.logStrategyInfo(`Simple Buy Sell Strategy initialized for user: ${userName} (ID: ${userId})`);
    }

    initialize(globalDict, universalDict, blockDict, accessToken) {
        super.initialize(globalDict, universalDict, blockDict, accessToken);
        
        this.strategyUtils.logStrategyInfo('=== Simple Buy Sell Strategy Initialization ===');
        this.strategyUtils.logStrategyInfo(`Strategy Name: ${this.name}`);
        this.strategyUtils.logStrategyInfo(`Strategy Description: ${this.description}`);
        this.strategyUtils.logStrategyInfo(`Access Token Available: ${!!this.accessToken}`);
        this.strategyUtils.logStrategyInfo(`API Key Available: ${!!this.globalDict.api_key}`);
        this.strategyUtils.logStrategyDebug(`Global Dict API Key: ${this.globalDict.api_key}`);
        this.strategyUtils.logStrategyDebug(`Access Token Value: ${this.accessToken ? this.accessToken.substring(0, 20) + '...' : 'None'}`);
        
        // Initialize TradingUtils with credentials from session
        if (this.accessToken && this.globalDict.api_key) {
            console.log('🔧 Initializing TradingUtils with credentials...');
            const initialized = this.tradingUtils.initializeKiteConnect(this.globalDict.api_key, this.accessToken);
            
            if (initialized) {
                this.strategyUtils.logStrategyInfo('✅ TradingUtils initialized with session credentials');
                this.strategyUtils.logStrategyDebug(`API Key: ${this.globalDict.api_key}`);
                this.strategyUtils.logStrategyDebug(`Access Token: ${this.accessToken.substring(0, 10)}...`);
            } else {
                this.strategyUtils.logStrategyError('❌ TradingUtils initialization failed');
            }
        } else {
            this.strategyUtils.logStrategyError('❌ TradingUtils not initialized - missing credentials');
            this.strategyUtils.logStrategyError(`Access Token: ${this.accessToken ? 'Available' : 'Missing'}`);
            this.strategyUtils.logStrategyError(`API Key: ${this.globalDict.api_key ? 'Available' : 'Missing'}`);
        }

        // Initialize strategy-specific data structures
        this.universalDict.optionsData = {};
        this.blockDict.lastPrices = {};

        // Initialize dictionary parameters with default values
        const globalParams = this.getGlobalDictParameters();
        const universalParams = this.getUniversalDictParameters();

        this.strategyUtils.logStrategyInfo('=== Strategy Parameters ===');
        this.strategyUtils.logStrategyInfo(`Global Parameters: ${Object.keys(globalParams)}`);
        this.strategyUtils.logStrategyInfo(`Universal Parameters: ${Object.keys(universalParams)}`);

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
        this.lastSellTime = null;
        this.buyCompleted = false;
        this.sellCompleted = false;
        this.debugMode = false; // Reset debug mode for new strategy

        this.strategyUtils.logStrategyDebug('=== Strategy State ===');
        this.strategyUtils.logStrategyDebug(`Has Active Position: ${this.hasActivePosition}`);
        this.strategyUtils.logStrategyDebug(`Buy Price: ${this.buyPrice}`);
        this.strategyUtils.logStrategyDebug(`Buy Symbol: ${this.buySymbol}`);
        this.strategyUtils.logStrategyDebug(`Enable Trading: ${this.globalDict.enableTrading}`);
        this.strategyUtils.logStrategyDebug(`Selected Instrument: ${this.selectedInstrument}`);
        this.strategyUtils.logStrategyDebug(`Instrument Selection Complete: ${this.instrumentSelectionComplete}`);
        this.strategyUtils.logStrategyDebug(`TradingUtils Kite Instance: ${!!this.tradingUtils.kite}`);
        this.strategyUtils.logStrategyDebug(`Buy Completed: ${this.buyCompleted}`);
        this.strategyUtils.logStrategyDebug(`Sell Completed: ${this.sellCompleted}`);
        this.strategyUtils.logStrategyDebug(`Last Sell Time: ${this.lastSellTime}`);
        this.strategyUtils.logStrategyDebug(`Debug Mode: ${this.debugMode}`);
        this.strategyUtils.logStrategyInfo('=== Initialization Complete ===');
    }

    processTicks(ticks) {
        this.tickCount++;
        this.strategyUtils.logStrategyInfo(`=== Processing Tick Batch #${this.tickCount} ===`);
        this.strategyUtils.logStrategyInfo(`Number of ticks received: ${ticks.length}`);
        this.strategyUtils.logStrategyInfo(`Current Cycle: ${this.cycleCount}`);
        
        // Check if we need to reset cycle after sell completion
        if (this.sellCompleted && this.lastSellTime) {
            const timeSinceLastSell = Date.now() - this.lastSellTime;
            const requiredDelay = 15 * 1000; // 15 seconds in milliseconds
            
            if (timeSinceLastSell >= requiredDelay) {
                this.strategyUtils.logStrategyInfo('⏰ 15-second delay completed, resetting cycle for new instrument selection');
                this.resetCycleForNewInstrument();
            } else {
                const remainingTime = Math.ceil((requiredDelay - timeSinceLastSell) / 1000);
                this.strategyUtils.logStrategyInfo(`⏰ Waiting ${remainingTime} more seconds before next cycle (15s delay required)`);
                return; // Skip processing until delay is complete
            }
        }
        
        // If instrument selection is not complete, try to select the best instrument
        if (!this.instrumentSelectionComplete) {
            this.selectedInstrument = this.strategyUtils.selectBestInstrument(ticks, 100, this.cycleCount);
            this.instrumentSelectionComplete = !!this.selectedInstrument;
            
            if (this.selectedInstrument) {
                // Initialize tracking for the selected instrument
                this.universalDict.optionsData[this.selectedInstrument.token] = {
                    symbol: this.selectedInstrument.symbol,
                    token: this.selectedInstrument.token,
                    currentPrice: this.selectedInstrument.price,
                    lastUpdate: this.strategyUtils.getCurrentTimestamp()
                };
                
                this.strategyUtils.logStrategyInfo('📈 Selected instrument tracking initialized');
            }
        }
        
        // Process ticks for the selected instrument only
        for (const tick of ticks) {
            const token = tick.instrument_token;
            const symbol = tick.symbol || `TOKEN_${token}`;
            
            // Only process ticks for the selected instrument
            if (this.selectedInstrument && this.selectedInstrument.token === token) {
                this.strategyUtils.logStrategyInfo(`🎯 Processing tick for selected instrument - Symbol: ${symbol}, Price: ${tick.last_price}, Token: ${token}`);
                
                // Update price history
                if (!this.universalDict.optionsData[token]) {
                    this.universalDict.optionsData[token] = {
                        symbol,
                        token,
                        currentPrice: tick.last_price,
                        lastUpdate: this.strategyUtils.getCurrentTimestamp()
                    };
                    this.strategyUtils.logStrategyInfo(`📊 Selected instrument tracked: ${symbol} at ${tick.last_price}`);
                } else {
                    const oldPrice = this.universalDict.optionsData[token].currentPrice;
                    const priceChange = tick.last_price - oldPrice;
                    this.strategyUtils.logStrategyInfo(`📈 Price update for selected instrument ${symbol}: ${oldPrice} → ${tick.last_price} (${priceChange > 0 ? '+' : ''}${priceChange.toFixed(2)})`);
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
        
        this.strategyUtils.logStrategyInfo(`🔍 Analyzing selected instrument tick for ${symbol} at ${currentPrice}`);
        
        // If we don't have an active position, look for buy opportunity
        if (!this.hasActivePosition) {
            this.strategyUtils.logStrategyInfo('📋 No active position - checking for buy opportunity');
            if (this.shouldBuyOption(optionData)) {
                this.strategyUtils.logStrategyInfo('✅ Buy condition met!');
                this.buyOption(optionData);
            } else {
                this.strategyUtils.logStrategyInfo('❌ Buy condition not met');
            }
        } else {
            // If we have an active position, check for sell opportunity
            this.strategyUtils.logStrategyInfo(`📋 Active position exists - checking for sell opportunity`);
            this.strategyUtils.logStrategyInfo(`Current buy price: ${this.buyPrice}, Current price: ${currentPrice}`);
            if (this.shouldSellOption(optionData)) {
                this.strategyUtils.logStrategyInfo('✅ Sell condition met!');
                this.sellOption(optionData);
            } else {
                this.strategyUtils.logStrategyInfo('❌ Sell condition not met');
            }
        }
    }

    shouldBuyOption(optionData) {
        if (!this.globalDict.enableTrading) {
            this.strategyUtils.logStrategyInfo('🚫 Trading disabled - skipping buy check');
            return false;
        }
        
        if (!this.instrumentSelectionComplete) {
            this.strategyUtils.logStrategyInfo('⏳ Instrument selection not complete - skipping buy check');
            return false;
        }
        
        if (this.buyCompleted) {
            this.strategyUtils.logStrategyInfo('✅ Buy already completed for this cycle - skipping buy check');
            return false;
        }
        
        // Check if enough time has passed since last sell (15 seconds)
        if (this.lastSellTime) {
            const timeSinceLastSell = Date.now() - this.lastSellTime;
            const requiredDelay = 15 * 1000; // 15 seconds in milliseconds
            
            if (timeSinceLastSell < requiredDelay) {
                const remainingTime = Math.ceil((requiredDelay - timeSinceLastSell) / 1000);
                this.strategyUtils.logStrategyInfo(`⏰ Waiting ${remainingTime} more seconds before next buy (15s delay required)`);
                return false;
            }
        }
        
        const currentPrice = optionData.currentPrice;
        
        this.strategyUtils.logStrategyDebug(`🔍 Buy Check for ${optionData.symbol}:`);
        this.strategyUtils.logStrategyDebug(`  Current Price: ${currentPrice}`);
        this.strategyUtils.logStrategyDebug(`  Buy immediately when instrument is selected`);
        this.strategyUtils.logStrategyDebug(`  Cycle Count: ${this.cycleCount}`);
        this.strategyUtils.logStrategyDebug(`  Buy Completed: ${this.buyCompleted}`);
        this.strategyUtils.logStrategyDebug(`  Time since last sell: ${this.lastSellTime ? Math.floor((Date.now() - this.lastSellTime) / 1000) : 'N/A'}s`);
        
        // Buy immediately when instrument is selected (no threshold)
        return true;
    }

    shouldSellOption(optionData) {
        if (!this.hasActivePosition || !this.buyPrice) {
            this.strategyUtils.logStrategyInfo('🚫 No active position or buy price - skipping sell check');
            return false;
        }
        
        if (this.sellCompleted) {
            this.strategyUtils.logStrategyInfo('✅ Sell already completed for this cycle - skipping sell check');
            return false;
        }
        
        const currentPrice = optionData.currentPrice;
        const priceDifference = currentPrice - this.buyPrice;
        
        this.strategyUtils.logStrategyDebug(`🔍 Sell Check for ${optionData.symbol}:`);
        this.strategyUtils.logStrategyDebug(`  Buy Price: ${this.buyPrice}`);
        this.strategyUtils.logStrategyDebug(`  Current Price: ${currentPrice}`);
        this.strategyUtils.logStrategyDebug(`  Price Difference: ${priceDifference.toFixed(2)}`);
        this.strategyUtils.logStrategyDebug(`  Target: ${this.globalDict.target}`);
        this.strategyUtils.logStrategyDebug(`  Stop Loss: ${this.globalDict.stoploss}`);
        this.strategyUtils.logStrategyDebug(`  Hit Target: ${priceDifference >= this.globalDict.target}`);
        this.strategyUtils.logStrategyDebug(`  Hit Stop Loss: ${priceDifference <= -this.globalDict.stoploss}`);
        this.strategyUtils.logStrategyDebug(`  Sell Completed: ${this.sellCompleted}`);
        
        // Sell if price is 5 rupees higher or lower than buy price
        return priceDifference >= this.globalDict.target || 
               priceDifference <= -this.globalDict.stoploss;
    }

    async buyOption(optionData) {
        this.strategyUtils.logStrategyInfo(`🛒 Attempting to buy ${optionData.symbol} at ${optionData.currentPrice}`);
        this.strategyUtils.logStrategyDebug('🔍 TradingUtils Status Check:');
        this.strategyUtils.logStrategyDebug(`  - TradingUtils instance: ${!!this.tradingUtils}`);
        this.strategyUtils.logStrategyDebug(`  - Kite instance: ${!!this.tradingUtils.kite}`);
        this.strategyUtils.logStrategyDebug(`  - API Key available: ${!!this.globalDict.api_key}`);
        this.strategyUtils.logStrategyDebug(`  - Access Token available: ${!!this.accessToken}`);
        this.strategyUtils.logStrategyDebug(`  - Debug Mode: ${this.debugMode}`);
        
        // Log the buy attempt
        this.strategyUtils.logTradeAction('buy_attempt', {
            symbol: optionData.symbol,
            price: optionData.currentPrice,
            token: optionData.token,
            quantity: 75,
            debugMode: this.debugMode,
            timestamp: this.strategyUtils.getCurrentTimestamp()
        }, this.name);
        
        // Check if debug mode is enabled or TradingUtils is not initialized
        if (this.debugMode || !this.tradingUtils.kite) {
            const reason = this.debugMode ? 'Debug mode enabled' : 'TradingUtils not initialized';
            this.strategyUtils.logStrategyInfo('📝 Paper trading mode - simulating buy order');
            this.strategyUtils.logStrategyInfo(`❌ ${reason} - using paper trading`);
            
            // Log paper trading buy
            this.strategyUtils.logTradeAction('paper_buy', {
                symbol: optionData.symbol,
                price: optionData.currentPrice,
                token: optionData.token,
                quantity: 75,
                reason: reason,
                debugMode: this.debugMode,
                timestamp: this.strategyUtils.getCurrentTimestamp()
            }, this.name);
            
            this.recordBuyPosition(optionData);
            return;
        }
        
        try {
            this.strategyUtils.logStrategyInfo('📞 Placing actual buy order via TradingUtils');
            this.strategyUtils.logStrategyDebug(`🔑 TradingUtils Status: ${JSON.stringify({
                apiKey: this.globalDict.api_key ? 'Set' : 'Missing',
                accessToken: this.accessToken ? 'Set' : 'Missing',
                tradingUtilsInstance: this.tradingUtils ? 'Initialized' : 'Not initialized',
                debugMode: this.debugMode
            })}`);
            
            // Place buy order using trading utils
            const result = await this.tradingUtils.placeBuyOrder(
                optionData.symbol, 
                optionData.currentPrice, 
                75
            );
            
            if (result.success) {
                this.strategyUtils.logStrategyInfo(`✅ Buy order placed successfully for ${optionData.symbol}`);
                this.strategyUtils.logStrategyInfo(`📦 Quantity: 75 (1 lot)`);
                
                // Log successful buy order
                this.strategyUtils.logTradeAction('buy_success', {
                    symbol: optionData.symbol,
                    price: optionData.currentPrice,
                    token: optionData.token,
                    quantity: 75,
                    orderResponse: result.orderResponse,
                    paper: result.paper,
                    debugMode: this.debugMode,
                    timestamp: this.strategyUtils.getCurrentTimestamp()
                }, this.name);
                
                this.recordBuyPosition(optionData);
            } else {
                this.strategyUtils.logStrategyError(`❌ Error buying ${optionData.symbol}: ${result.error}`);
                
                // Log buy order failure
                this.strategyUtils.logTradeAction('buy_failure', {
                    symbol: optionData.symbol,
                    price: optionData.currentPrice,
                    token: optionData.token,
                    quantity: 75,
                    error: result.error,
                    debugMode: this.debugMode,
                    timestamp: this.strategyUtils.getCurrentTimestamp()
                }, this.name);
                
                // If order fails, still record the position for paper trading
                this.strategyUtils.logStrategyInfo('📝 Recording position as paper trade due to order failure');
                this.strategyUtils.logTradeAction('paper_buy', {
                    symbol: optionData.symbol,
                    price: optionData.currentPrice,
                    token: optionData.token,
                    quantity: 75,
                    reason: 'Order placement failed',
                    error: result.error,
                    debugMode: this.debugMode,
                    timestamp: this.strategyUtils.getCurrentTimestamp()
                }, this.name);
                
                this.recordBuyPosition(optionData);
            }
        } catch (error) {
            this.strategyUtils.logStrategyError(`❌ Exception while placing buy order for ${optionData.symbol}: ${error.message}`);
            
            // Log exception during buy
            this.strategyUtils.logTradeAction('buy_exception', {
                symbol: optionData.symbol,
                price: optionData.currentPrice,
                token: optionData.token,
                quantity: 75,
                error: error.message,
                errorDetails: error,
                debugMode: this.debugMode,
                timestamp: this.strategyUtils.getCurrentTimestamp()
            }, this.name);
            
            this.strategyUtils.logStrategyInfo('📝 Recording position as paper trade due to exception');
            this.strategyUtils.logTradeAction('paper_buy', {
                symbol: optionData.symbol,
                price: optionData.currentPrice,
                token: optionData.token,
                quantity: 75,
                reason: 'Exception during order placement',
                error: error.message,
                debugMode: this.debugMode,
                timestamp: this.strategyUtils.getCurrentTimestamp()
            }, this.name);
            
            this.recordBuyPosition(optionData);
        }
    }

    async sellOption(optionData) {
        this.strategyUtils.logStrategyInfo(`💰 Attempting to sell ${optionData.symbol} at ${optionData.currentPrice}`);
        this.strategyUtils.logStrategyDebug('🔍 TradingUtils Status Check:');
        this.strategyUtils.logStrategyDebug(`  - TradingUtils instance: ${!!this.tradingUtils}`);
        this.strategyUtils.logStrategyDebug(`  - Kite instance: ${!!this.tradingUtils.kite}`);
        this.strategyUtils.logStrategyDebug(`  - API Key available: ${!!this.globalDict.api_key}`);
        this.strategyUtils.logStrategyDebug(`  - Access Token available: ${!!this.accessToken}`);
        this.strategyUtils.logStrategyDebug(`  - Debug Mode: ${this.debugMode}`);
        
        // Log the sell attempt
        this.strategyUtils.logTradeAction('sell_attempt', {
            symbol: optionData.symbol,
            price: optionData.currentPrice,
            token: optionData.token,
            buyPrice: this.buyPrice,
            priceDifference: optionData.currentPrice - this.buyPrice,
            quantity: 75,
            debugMode: this.debugMode,
            timestamp: this.strategyUtils.getCurrentTimestamp()
        }, this.name);
        
        // Check if debug mode is enabled or TradingUtils is not initialized
        if (this.debugMode || !this.tradingUtils.kite) {
            const reason = this.debugMode ? 'Debug mode enabled' : 'TradingUtils not initialized';
            this.strategyUtils.logStrategyInfo('📝 Paper trading mode - simulating sell order');
            this.strategyUtils.logStrategyInfo(`❌ ${reason} - using paper trading`);
            
            // Log paper trading sell
            this.strategyUtils.logTradeAction('paper_sell', {
                symbol: optionData.symbol,
                price: optionData.currentPrice,
                token: optionData.token,
                buyPrice: this.buyPrice,
                priceDifference: optionData.currentPrice - this.buyPrice,
                quantity: 75,
                reason: reason,
                debugMode: this.debugMode,
                timestamp: this.strategyUtils.getCurrentTimestamp()
            }, this.name);
            
            this.recordSellPosition(optionData);
            return;
        }
        
        try {
            this.strategyUtils.logStrategyInfo('📞 Placing actual sell order via TradingUtils');
            this.strategyUtils.logStrategyDebug(`🔑 TradingUtils Status: ${JSON.stringify({
                apiKey: this.globalDict.api_key ? 'Set' : 'Missing',
                accessToken: this.accessToken ? 'Set' : 'Missing',
                tradingUtilsInstance: this.tradingUtils ? 'Initialized' : 'Not initialized',
                debugMode: this.debugMode
            })}`);
            
            // Place sell order using trading utils
            const result = await this.tradingUtils.placeSellOrder(
                optionData.symbol, 
                optionData.currentPrice, 
                75
            );
            
            if (result.success) {
                this.strategyUtils.logStrategyInfo(`✅ Sell order placed successfully for ${optionData.symbol}`);
                this.strategyUtils.logStrategyInfo(`📦 Quantity: 75 (1 lot)`);
                
                // Log successful sell order
                this.strategyUtils.logTradeAction('sell_success', {
                    symbol: optionData.symbol,
                    price: optionData.currentPrice,
                    token: optionData.token,
                    buyPrice: this.buyPrice,
                    priceDifference: optionData.currentPrice - this.buyPrice,
                    quantity: 75,
                    orderResponse: result.orderResponse,
                    paper: result.paper,
                    debugMode: this.debugMode,
                    timestamp: this.strategyUtils.getCurrentTimestamp()
                }, this.name);
                
                this.recordSellPosition(optionData);
            } else {
                this.strategyUtils.logStrategyError(`❌ Error selling ${optionData.symbol}: ${result.error}`);
                
                // Log sell order failure
                this.strategyUtils.logTradeAction('sell_failure', {
                    symbol: optionData.symbol,
                    price: optionData.currentPrice,
                    token: optionData.token,
                    buyPrice: this.buyPrice,
                    priceDifference: optionData.currentPrice - this.buyPrice,
                    quantity: 75,
                    error: result.error,
                    debugMode: this.debugMode,
                    timestamp: this.strategyUtils.getCurrentTimestamp()
                }, this.name);
                
                // If order fails, still record the position for paper trading
                this.strategyUtils.logStrategyInfo('📝 Recording position as paper trade due to order failure');
                this.strategyUtils.logTradeAction('paper_sell', {
                    symbol: optionData.symbol,
                    price: optionData.currentPrice,
                    token: optionData.token,
                    buyPrice: this.buyPrice,
                    priceDifference: optionData.currentPrice - this.buyPrice,
                    quantity: 75,
                    reason: 'Order placement failed',
                    error: result.error,
                    debugMode: this.debugMode,
                    timestamp: this.strategyUtils.getCurrentTimestamp()
                }, this.name);
                
                this.recordSellPosition(optionData);
            }
        } catch (error) {
            this.strategyUtils.logStrategyError(`❌ Exception while placing sell order for ${optionData.symbol}: ${error.message}`);
            
            // Log exception during sell
            this.strategyUtils.logTradeAction('sell_exception', {
                symbol: optionData.symbol,
                price: optionData.currentPrice,
                token: optionData.token,
                buyPrice: this.buyPrice,
                priceDifference: optionData.currentPrice - this.buyPrice,
                quantity: 75,
                error: error.message,
                errorDetails: error,
                debugMode: this.debugMode,
                timestamp: this.strategyUtils.getCurrentTimestamp()
            }, this.name);
            
            this.strategyUtils.logStrategyInfo('📝 Recording position as paper trade due to exception');
            this.strategyUtils.logTradeAction('paper_sell', {
                symbol: optionData.symbol,
                price: optionData.currentPrice,
                token: optionData.token,
                buyPrice: this.buyPrice,
                priceDifference: optionData.currentPrice - this.buyPrice,
                quantity: 75,
                reason: 'Exception during order placement',
                error: error.message,
                debugMode: this.debugMode,
                timestamp: this.strategyUtils.getCurrentTimestamp()
            }, this.name);
            
            this.recordSellPosition(optionData);
        }
    }

    recordBuyPosition(optionData) {
        this.strategyUtils.logStrategyInfo(`📊 Recording buy position for ${optionData.symbol}`);
        
        this.hasActivePosition = true;
        this.buyPrice = optionData.currentPrice;
        this.buySymbol = optionData.symbol;
        
        // Mark buy as completed for this cycle
        this.buyCompleted = true;
        
        this.strategyUtils.logStrategyInfo(`✅ Position recorded:`);
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
        
        this.strategyUtils.logStrategyInfo('📈 Position tracking updated in universalDict');
    }

    recordSellPosition(optionData) {
        this.strategyUtils.logStrategyInfo(`📊 Recording sell position for ${optionData.symbol}`);
        
        const currentPrice = optionData.currentPrice;
        const pnl = this.strategyUtils.calculatePnL(this.buyPrice, currentPrice, 75);
        
        this.strategyUtils.logStrategyInfo(`✅ Position closed:`);
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
        
        // Mark sell as completed and record sell time
        this.sellCompleted = true;
        this.lastSellTime = Date.now();
        
        // Enable debug mode after first cycle
        if (this.cycleCount === 1) {
            this.debugMode = true;
            this.strategyUtils.logStrategyInfo('🔧 DEBUG MODE ENABLED - Paper trading mode activated after first cycle');
            this.strategyUtils.logStrategyInfo('📝 All subsequent trades will be simulated (no actual orders placed)');
        }
        
        this.strategyUtils.logStrategyInfo('🔄 Sell completed for this cycle');
        this.strategyUtils.logStrategyInfo('⏰ 15-second delay timer started');
        this.strategyUtils.logStrategyInfo('📈 Position tracking updated in universalDict');
        this.strategyUtils.logStrategyInfo(`🔧 Debug Mode: ${this.debugMode}`);
        
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
        
        this.strategyUtils.logStrategyInfo('🎉 Trading cycle completed. Waiting 15 seconds before next cycle...');
        this.strategyUtils.logStrategyInfo('📊 Cycle Summary:');
        this.strategyUtils.logStrategyInfo(`  Cycle Number: ${this.cycleCount}`);
        this.strategyUtils.logStrategyInfo(`  Selected Instrument: ${optionData.symbol}`);
        this.strategyUtils.logStrategyInfo(`  Total ticks processed: ${this.tickCount}`);
        this.strategyUtils.logStrategyInfo(`  Quantity traded: 75 (1 lot)`);
        this.strategyUtils.logStrategyInfo(`  Price difference per unit: ${pnl.priceDifference.toFixed(2)} rupees`);
        this.strategyUtils.logStrategyInfo(`  Total P&L for 1 lot: ${pnl.totalPnL.toFixed(2)} rupees`);
        this.strategyUtils.logStrategyInfo(`  Strategy duration: ${this.strategyUtils.getCurrentTimestamp()}`);
        this.strategyUtils.logStrategyInfo(`  Debug Mode: ${this.debugMode ? 'ENABLED' : 'DISABLED'}`);
        this.strategyUtils.logStrategyInfo('⏰ Will wait 15 seconds before starting new cycle');
    }

    // Method to reset cycle for new instrument selection
    resetCycleForNewInstrument() {
        this.strategyUtils.logStrategyInfo('🔄 Resetting cycle for new instrument selection...');
        
        // Reset position state
        this.hasActivePosition = false;
        this.buyPrice = null;
        this.buySymbol = null;
        
        // Increment cycle count
        this.cycleCount++;
        
        // Reset instrument selection for new cycle
        this.selectedInstrument = null;
        this.instrumentSelectionComplete = false;
        
        // Reset cycle completion flags
        this.buyCompleted = false;
        this.sellCompleted = false;
        
        // Debug mode persists across cycles (once enabled, stays enabled)
        this.strategyUtils.logStrategyInfo(`🔄 Cycle ${this.cycleCount} started`);
        this.strategyUtils.logStrategyInfo('🎯 Will select new instrument for this cycle');
        this.strategyUtils.logStrategyInfo('⏰ Ready for new buy-sell cycle');
        this.strategyUtils.logStrategyInfo(`🔧 Debug Mode: ${this.debugMode ? 'ENABLED' : 'DISABLED'}`);
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
            lastSellTime: this.lastSellTime,
            debugMode: this.debugMode
        };
    }

    getGlobalDictParameters() {
        return {
            target: {
                type: 'number',
                default: 5,
                min: 1,
                max: 20,
                description: 'Target profit in rupees to sell'
            },
            stoploss: {
                type: 'number',
                default: 5,
                min: 1,
                max: 20,
                description: 'Stop loss in rupees to sell'
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
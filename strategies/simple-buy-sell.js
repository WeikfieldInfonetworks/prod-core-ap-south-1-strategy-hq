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
    }

    initialize(globalDict, universalDict, blockDict, accessToken) {
        super.initialize(globalDict, universalDict, blockDict, accessToken);
        
        console.log('=== Simple Buy Sell Strategy Initialization ===');
        console.log('Strategy Name:', this.name);
        console.log('Strategy Description:', this.description);
        console.log('Access Token Available:', !!this.accessToken);
        console.log('API Key Available:', !!this.globalDict.api_key);
        console.log('Global Dict API Key:', this.globalDict.api_key);
        console.log('Access Token Value:', this.accessToken ? this.accessToken.substring(0, 20) + '...' : 'None');
        
        // Initialize TradingUtils with credentials from session
        if (this.accessToken && this.globalDict.api_key) {
            console.log('🔧 Initializing TradingUtils with credentials...');
            const initialized = this.tradingUtils.initializeKiteConnect(this.globalDict.api_key, this.accessToken);
            
            if (initialized) {
                console.log('✅ TradingUtils initialized with session credentials');
                console.log('API Key:', this.globalDict.api_key);
                console.log('Access Token:', this.accessToken.substring(0, 10) + '...');
            } else {
                console.log('❌ TradingUtils initialization failed');
            }
        } else {
            console.log('❌ TradingUtils not initialized - missing credentials');
            console.log('Access Token:', this.accessToken ? 'Available' : 'Missing');
            console.log('API Key:', this.globalDict.api_key ? 'Available' : 'Missing');
        }

        // Initialize strategy-specific data structures
        this.universalDict.optionsData = {};
        this.blockDict.lastPrices = {};

        // Initialize dictionary parameters with default values
        const globalParams = this.getGlobalDictParameters();
        const universalParams = this.getUniversalDictParameters();

        console.log('=== Strategy Parameters ===');
        console.log('Global Parameters:', Object.keys(globalParams));
        console.log('Universal Parameters:', Object.keys(universalParams));

        // Set default values for globalDict parameters
        for (const [key, param] of Object.entries(globalParams)) {
            if (this.globalDict[key] === undefined) {
                this.globalDict[key] = param.default;
                console.log(`Set default ${key}: ${param.default}`);
            } else {
                console.log(`Using existing ${key}: ${this.globalDict[key]}`);
            }
        }

        // Set default values for universalDict parameters
        for (const [key, param] of Object.entries(universalParams)) {
            if (this.universalDict[key] === undefined) {
                this.universalDict[key] = param.default;
                console.log(`Set default ${key}: ${param.default}`);
            } else {
                console.log(`Using existing ${key}: ${this.universalDict[key]}`);
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

        console.log('=== Strategy State ===');
        console.log('Has Active Position:', this.hasActivePosition);
        console.log('Buy Price:', this.buyPrice);
        console.log('Buy Symbol:', this.buySymbol);
        console.log('Enable Trading:', this.globalDict.enableTrading);
        console.log('Selected Instrument:', this.selectedInstrument);
        console.log('Instrument Selection Complete:', this.instrumentSelectionComplete);
        console.log('TradingUtils Kite Instance:', !!this.tradingUtils.kite);
        console.log('Buy Completed:', this.buyCompleted);
        console.log('Sell Completed:', this.sellCompleted);
        console.log('Last Sell Time:', this.lastSellTime);
        console.log('Debug Mode:', this.debugMode);
        console.log('=== Initialization Complete ===\n');
    }

    processTicks(ticks) {
        this.tickCount++;
        console.log(`\n=== Processing Tick Batch #${this.tickCount} ===`);
        console.log('Number of ticks received:', ticks.length);
        console.log(`Current Cycle: ${this.cycleCount}`);
        
        // Check if we need to reset cycle after sell completion
        if (this.sellCompleted && this.lastSellTime) {
            const timeSinceLastSell = Date.now() - this.lastSellTime;
            const requiredDelay = 15 * 1000; // 15 seconds in milliseconds
            
            if (timeSinceLastSell >= requiredDelay) {
                console.log('⏰ 15-second delay completed, resetting cycle for new instrument selection');
                this.resetCycleForNewInstrument();
            } else {
                const remainingTime = Math.ceil((requiredDelay - timeSinceLastSell) / 1000);
                console.log(`⏰ Waiting ${remainingTime} more seconds before next cycle (15s delay required)`);
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
                
                console.log('📈 Selected instrument tracking initialized');
            }
        }
        
        // Process ticks for the selected instrument only
        for (const tick of ticks) {
            const token = tick.instrument_token;
            const symbol = tick.symbol || `TOKEN_${token}`;
            
            // Only process ticks for the selected instrument
            if (this.selectedInstrument && this.selectedInstrument.token === token) {
                console.log(`🎯 Processing tick for selected instrument - Symbol: ${symbol}, Price: ${tick.last_price}, Token: ${token}`);
                
                // Update price history
                if (!this.universalDict.optionsData[token]) {
                    this.universalDict.optionsData[token] = {
                        symbol,
                        token,
                        currentPrice: tick.last_price,
                        lastUpdate: this.strategyUtils.getCurrentTimestamp()
                    };
                    console.log(`📊 Selected instrument tracked: ${symbol} at ${tick.last_price}`);
                } else {
                    const oldPrice = this.universalDict.optionsData[token].currentPrice;
                    const priceChange = tick.last_price - oldPrice;
                    console.log(`📈 Price update for selected instrument ${symbol}: ${oldPrice} → ${tick.last_price} (${priceChange > 0 ? '+' : ''}${priceChange.toFixed(2)})`);
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
        
        console.log(`=== Tick Batch #${this.tickCount} Complete ===\n`);
    }

    processOptionsTick(optionData, tick) {
        const symbol = optionData.symbol;
        const currentPrice = tick.last_price;
        
        console.log(`\n🔍 Analyzing selected instrument tick for ${symbol} at ${currentPrice}`);
        
        // If we don't have an active position, look for buy opportunity
        if (!this.hasActivePosition) {
            console.log('📋 No active position - checking for buy opportunity');
            if (this.shouldBuyOption(optionData)) {
                console.log('✅ Buy condition met!');
                this.buyOption(optionData);
            } else {
                console.log('❌ Buy condition not met');
            }
        } else {
            // If we have an active position, check for sell opportunity
            console.log(`📋 Active position exists - checking for sell opportunity`);
            console.log(`Current buy price: ${this.buyPrice}, Current price: ${currentPrice}`);
            if (this.shouldSellOption(optionData)) {
                console.log('✅ Sell condition met!');
                this.sellOption(optionData);
            } else {
                console.log('❌ Sell condition not met');
            }
        }
    }

    shouldBuyOption(optionData) {
        if (!this.globalDict.enableTrading) {
            console.log('🚫 Trading disabled - skipping buy check');
            return false;
        }
        
        if (!this.instrumentSelectionComplete) {
            console.log('⏳ Instrument selection not complete - skipping buy check');
            return false;
        }
        
        if (this.buyCompleted) {
            console.log('✅ Buy already completed for this cycle - skipping buy check');
            return false;
        }
        
        // Check if enough time has passed since last sell (15 seconds)
        if (this.lastSellTime) {
            const timeSinceLastSell = Date.now() - this.lastSellTime;
            const requiredDelay = 15 * 1000; // 15 seconds in milliseconds
            
            if (timeSinceLastSell < requiredDelay) {
                const remainingTime = Math.ceil((requiredDelay - timeSinceLastSell) / 1000);
                console.log(`⏰ Waiting ${remainingTime} more seconds before next buy (15s delay required)`);
                return false;
            }
        }
        
        const currentPrice = optionData.currentPrice;
        
        console.log(`🔍 Buy Check for ${optionData.symbol}:`);
        console.log(`  Current Price: ${currentPrice}`);
        console.log(`  Buy immediately when instrument is selected`);
        console.log(`  Cycle Count: ${this.cycleCount}`);
        console.log(`  Buy Completed: ${this.buyCompleted}`);
        console.log(`  Time since last sell: ${this.lastSellTime ? Math.floor((Date.now() - this.lastSellTime) / 1000) : 'N/A'}s`);
        
        // Buy immediately when instrument is selected (no threshold)
        return true;
    }

    shouldSellOption(optionData) {
        if (!this.hasActivePosition || !this.buyPrice) {
            console.log('🚫 No active position or buy price - skipping sell check');
            return false;
        }
        
        if (this.sellCompleted) {
            console.log('✅ Sell already completed for this cycle - skipping sell check');
            return false;
        }
        
        const currentPrice = optionData.currentPrice;
        const priceDifference = currentPrice - this.buyPrice;
        
        console.log(`🔍 Sell Check for ${optionData.symbol}:`);
        console.log(`  Buy Price: ${this.buyPrice}`);
        console.log(`  Current Price: ${currentPrice}`);
        console.log(`  Price Difference: ${priceDifference.toFixed(2)}`);
        console.log(`  Target: ${this.globalDict.target}`);
        console.log(`  Stop Loss: ${this.globalDict.stoploss}`);
        console.log(`  Hit Target: ${priceDifference >= this.globalDict.target}`);
        console.log(`  Hit Stop Loss: ${priceDifference <= -this.globalDict.stoploss}`);
        console.log(`  Sell Completed: ${this.sellCompleted}`);
        
        // Sell if price is 5 rupees higher or lower than buy price
        return priceDifference >= this.globalDict.target || 
               priceDifference <= -this.globalDict.stoploss;
    }

    async buyOption(optionData) {
        console.log(`\n🛒 Attempting to buy ${optionData.symbol} at ${optionData.currentPrice}`);
        console.log('🔍 TradingUtils Status Check:');
        console.log('  - TradingUtils instance:', !!this.tradingUtils);
        console.log('  - Kite instance:', !!this.tradingUtils.kite);
        console.log('  - API Key available:', !!this.globalDict.api_key);
        console.log('  - Access Token available:', !!this.accessToken);
        console.log('  - Debug Mode:', this.debugMode);
        
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
            console.log('📝 Paper trading mode - simulating buy order');
            console.log(`❌ ${reason} - using paper trading`);
            
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
            console.log('📞 Placing actual buy order via TradingUtils');
            console.log('🔑 TradingUtils Status:', {
                apiKey: this.globalDict.api_key ? 'Set' : 'Missing',
                accessToken: this.accessToken ? 'Set' : 'Missing',
                tradingUtilsInstance: this.tradingUtils ? 'Initialized' : 'Not initialized',
                debugMode: this.debugMode
            });
            
            // Place buy order using trading utils
            const result = await this.tradingUtils.placeBuyOrder(
                optionData.symbol, 
                optionData.currentPrice, 
                75
            );
            
            if (result.success) {
                console.log(`✅ Buy order placed successfully for ${optionData.symbol}`);
                console.log(`📦 Quantity: 75 (1 lot)`);
                
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
                console.error(`❌ Error buying ${optionData.symbol}:`, result.error);
                
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
                console.log('📝 Recording position as paper trade due to order failure');
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
            console.error(`❌ Exception while placing buy order for ${optionData.symbol}:`, error);
            
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
            
            console.log('📝 Recording position as paper trade due to exception');
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
        console.log(`\n💰 Attempting to sell ${optionData.symbol} at ${optionData.currentPrice}`);
        console.log('🔍 TradingUtils Status Check:');
        console.log('  - TradingUtils instance:', !!this.tradingUtils);
        console.log('  - Kite instance:', !!this.tradingUtils.kite);
        console.log('  - API Key available:', !!this.globalDict.api_key);
        console.log('  - Access Token available:', !!this.accessToken);
        console.log('  - Debug Mode:', this.debugMode);
        
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
            console.log('📝 Paper trading mode - simulating sell order');
            console.log(`❌ ${reason} - using paper trading`);
            
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
            console.log('📞 Placing actual sell order via TradingUtils');
            console.log('🔑 TradingUtils Status:', {
                apiKey: this.globalDict.api_key ? 'Set' : 'Missing',
                accessToken: this.accessToken ? 'Set' : 'Missing',
                tradingUtilsInstance: this.tradingUtils ? 'Initialized' : 'Not initialized',
                debugMode: this.debugMode
            });
            
            // Place sell order using trading utils
            const result = await this.tradingUtils.placeSellOrder(
                optionData.symbol, 
                optionData.currentPrice, 
                75
            );
            
            if (result.success) {
                console.log(`✅ Sell order placed successfully for ${optionData.symbol}`);
                console.log(`📦 Quantity: 75 (1 lot)`);
                
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
                console.error(`❌ Error selling ${optionData.symbol}:`, result.error);
                
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
                console.log('📝 Recording position as paper trade due to order failure');
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
            console.error(`❌ Exception while placing sell order for ${optionData.symbol}:`, error);
            
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
            
            console.log('📝 Recording position as paper trade due to exception');
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
        console.log(`\n📊 Recording buy position for ${optionData.symbol}`);
        
        this.hasActivePosition = true;
        this.buyPrice = optionData.currentPrice;
        this.buySymbol = optionData.symbol;
        
        // Mark buy as completed for this cycle
        this.buyCompleted = true;
        
        console.log(`✅ Position recorded:`);
        console.log(`  Symbol: ${optionData.symbol}`);
        console.log(`  Buy Price: ${optionData.currentPrice}`);
        console.log(`  Quantity: 75 (1 lot)`);
        console.log(`  Buy Time: ${this.strategyUtils.getCurrentTimestamp()}`);
        console.log(`  Status: ACTIVE`);
        console.log(`  Buy Completed: ${this.buyCompleted}`);
        
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
        
        console.log('📈 Position tracking updated in universalDict');
    }

    recordSellPosition(optionData) {
        console.log(`\n📊 Recording sell position for ${optionData.symbol}`);
        
        const currentPrice = optionData.currentPrice;
        const pnl = this.strategyUtils.calculatePnL(this.buyPrice, currentPrice, 75);
        
        console.log(`✅ Position closed:`);
        console.log(`  Symbol: ${optionData.symbol}`);
        console.log(`  Buy Price: ${this.buyPrice}`);
        console.log(`  Sell Price: ${currentPrice}`);
        console.log(`  Quantity: 75 (1 lot)`);
        console.log(`  Price Difference per unit: ${pnl.priceDifference.toFixed(2)} rupees`);
        console.log(`  Total P&L for 1 lot: ${pnl.totalPnL.toFixed(2)} rupees`);
        console.log(`  Sell Time: ${this.strategyUtils.getCurrentTimestamp()}`);
        console.log(`  Status: COMPLETED`);
        
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
            console.log('🔧 DEBUG MODE ENABLED - Paper trading mode activated after first cycle');
            console.log('📝 All subsequent trades will be simulated (no actual orders placed)');
        }
        
        console.log('🔄 Sell completed for this cycle');
        console.log('⏰ 15-second delay timer started');
        console.log('📈 Position tracking updated in universalDict');
        console.log('🔧 Debug Mode:', this.debugMode);
        
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
        
        console.log('\n🎉 Trading cycle completed. Waiting 15 seconds before next cycle...');
        console.log('📊 Cycle Summary:');
        console.log(`  Cycle Number: ${this.cycleCount}`);
        console.log(`  Selected Instrument: ${optionData.symbol}`);
        console.log(`  Total ticks processed: ${this.tickCount}`);
        console.log(`  Quantity traded: 75 (1 lot)`);
        console.log(`  Price difference per unit: ${pnl.priceDifference.toFixed(2)} rupees`);
        console.log(`  Total P&L for 1 lot: ${pnl.totalPnL.toFixed(2)} rupees`);
        console.log(`  Strategy duration: ${this.strategyUtils.getCurrentTimestamp()}`);
        console.log(`  Debug Mode: ${this.debugMode ? 'ENABLED' : 'DISABLED'}`);
        console.log('⏰ Will wait 15 seconds before starting new cycle');
    }

    // Method to reset cycle for new instrument selection
    resetCycleForNewInstrument() {
        console.log('\n🔄 Resetting cycle for new instrument selection...');
        
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
        console.log(`🔄 Cycle ${this.cycleCount} started`);
        console.log('🎯 Will select new instrument for this cycle');
        console.log('⏰ Ready for new buy-sell cycle');
        console.log('🔧 Debug Mode:', this.debugMode ? 'ENABLED' : 'DISABLED');
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
            enableLogging: {
                type: 'boolean',
                default: true,
                description: 'Enable/disable detailed logging'
            }
        };
    }
}

module.exports = SimpleBuySellStrategy;
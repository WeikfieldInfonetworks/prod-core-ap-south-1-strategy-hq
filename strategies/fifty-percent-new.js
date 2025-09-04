const BaseStrategy = require('./base');
const TradingUtils = require('../utils/tradingUtils');
const StrategyUtils = require('../utils/strategyUtils');

class FiftyPercentStrategyNew extends BaseStrategy {

    constructor() {
        super();
        this.name = 'Fifty Percent Strategy New';
        this.description = 'Fifty percent strategy with interim low detection and dual option trading';
        this.strategyUtils = new StrategyUtils();
        this.tickCount = 0;
        this.cycleCount = 0;
        
        //State Variables
        this.acceptedTokens = null;
        this.mainToken = null;
        this.oppToken = null;
        this.halfdrop_instrument = null;
        this.other_instrument = null;
        this.lossAtFirst = 0;

        // Block states
        this.blockInit = true;
        this.blockUpdate = true;
        this.blockDiff10 = false;
        this.blockNextCycle = false;

        // Flags
        this.halfdrop_flag = false;
        this.halfdrop_bought = false;
        this.halfdrop_sold = false;
        this.other_bought = false;
        this.other_sold = false;
        this.boughtSold = false;
        this.soldAt10 = false;

        this.buyToken = null;
        this.oppBuyToken = null;
        this.instrumentAt10 = null;
        this.instrumentAt10Sell = null;
        this.halfdropAssisstedTarget = 0;
        this.instrumentAtStoploss = null;
        this.instrumentAtStoplossSell = 0;
        this.remainingSellAtTarget = false;
        
        // Buy back logic variables
        this.buyBackAfterStoploss = false;
        this.buyBackToken = null;
        this.buyBackPrice = null;
        this.buyBackTarget = null;
        this.soldBuyBackAfterStoploss = false;

        // Strategy counters (missing properties)
        this.tickCount = 0;
        this.cycleCount = 0;
    }

    setUserInfo(userName, userId) {
        this.strategyUtils.setUserInfo(userName, userId);
        this.strategyUtils.logStrategyInfo(`Fifty Percent Strategy Old initialized for user: ${userName} (ID: ${userId})`);
    }

    initialize(globalDict, universalDict, blockDict, accessToken) {
        // Call parent initialize method
        super.initialize(globalDict, universalDict, blockDict, accessToken);
        
        console.log('=== Fifty Percent Strategy Old Initialization ===');
        console.log(`Strategy Name: ${this.name}`);
        console.log(`Strategy Description: ${this.description}`);
        console.log(`Access Token Available: ${!!this.accessToken}`);
        console.log(`API Key Available: ${!!this.globalDict.api_key}`);

        // Note: TradingUtils will be injected by UserStrategyManager
        // No need to initialize here as it will be set by the manager

        // Initialize state variables
        this.acceptedTokens = [];
        this.mainToken = null;
        this.oppToken = null;
        this.halfdrop_instrument = null;
        this.other_instrument = null;
        this.lossAtFirst = 0;
        this.buyToken = null;
        this.oppBuyToken = null;
        this.instrumentAt10 = null;
        this.soldAt10 = false;
        this.instrumentAt10Sell = null;
        this.instrumentAtStoploss = null;
        this.instrumentAtStoplossSell = 0;
        this.halfdropAssisstedTarget = 0;
        this.remainingSellAtTarget = false;
        
        // Initialize buy back logic variables
        this.buyBackAfterStoploss = false;
        this.buyBackToken = null;
        this.buyBackPrice = null;
        this.buyBackTarget = null;
        this.soldBuyBackAfterStoploss = false;
        
        // Initialize strategy-specific data structures
        this.universalDict.instrumentMap = {};
        this.universalDict.ceTokens = [];
        this.universalDict.peTokens = [];
        this.universalDict.strikePriceMap = {};
        this.universalDict.observedTicks = [];

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

        // Log enableTrading status
        this.strategyUtils.logStrategyInfo(`Enable Trading Status: ${this.globalDict.enableTrading}`);

        // Block states
        this.blockInit = true;
        this.blockUpdate = true;
        this.blockDiff10 = false;
        this.blockNextCycle = false;

        // Flags
        this.halfdrop_flag = false;
        this.halfdrop_bought = false;
        this.halfdrop_sold = false;
        this.other_bought = false;
        this.other_sold = false;
        this.boughtSold = false;
        this.soldAt10 = false;
        this.instrumentAt10 = null;
        this.instrumentAtStoploss = null;
        this.instrumentAtStoplossSell = 0;
        console.log('=== Initialization Complete ===');
    }

    // Override parameter update methods to add debugging and real-time notifications
    updateGlobalDictParameter(parameter, value) {
        const success = super.updateGlobalDictParameter(parameter, value);
        
        if (success) {
            if (parameter === 'enableTrading') {
                this.strategyUtils.logStrategyInfo(`🔧 Enable Trading Updated: ${value}`);
                
                // Emit specific trading toggle notification
                this.emitStatusUpdate('Trading mode updated', {
                    enableTrading: value,
                    message: value ? 'Live trading is now ENABLED' : 'Live trading is now DISABLED',
                    criticalUpdate: true
                });
            }
            
            // Emit Fifty Percent specific parameter update notifications
            if (['target', 'stoploss', 'quantity'].includes(parameter)) {
                this.emitStatusUpdate(`Fifty Percent Strategy parameter updated`, {
                    parameter,
                    value,
                    category: 'trading_rules',
                    impact: 'immediate'
                });
            }
        }

        return success;
    }

    updateUniversalDictParameter(parameter, value) {
        const success = super.updateUniversalDictParameter(parameter, value);
        
        if (success) {
            if (parameter === 'cycles') {
                this.strategyUtils.logStrategyInfo(`🔧 Cycles Updated: ${value}`);
                
                // Emit cycle update notification
                this.emitStatusUpdate(`Cycle count updated`, {
                    parameter,
                    value,
                    category: 'strategy_state',
                    impact: 'informational'
                });
            }
            
            // Emit Fifty Percent specific universal parameter update notifications
            if (['expiry'].includes(parameter)) {
                this.emitStatusUpdate(`Fifty Percent Strategy configuration updated`, {
                    parameter,
                    value,
                    category: 'strategy_config',
                    impact: 'immediate'
                });
            }
        }
        
        return success;
    }

    async processTicks(ticks) {
        try {
            this.tickCount++;
            console.log(`=== Processing Tick Batch #${this.tickCount} ===`);
            console.log(`Number of ticks received: ${ticks.length}`);
            console.log(`Current Cycle: ${this.cycleCount}`);

            // Process ticks based on current block state
            // Use separate if statements to allow multiple blocks to be processed in the same tick cycle
            if (this.blockInit) {
                this.processInitBlock(ticks);
            }

            if (this.blockUpdate) {
                this.processUpdateBlock(ticks);
            }

            if (this.blockDiff10) {
                this.processDiff10Block(ticks);
            }

            if (this.blockNextCycle) {
                this.processNextCycleBlock(ticks);
            }

            console.log(`=== Tick Batch #${this.tickCount} Complete ===`);
        } catch (error) {
    
            console.error('Error in processTicks:', error);
            this.strategyUtils.logStrategyError('Error in processTicks');
        }
    }

    processInitBlock(ticks) {
        // this.strategyUtils.logStrategyInfo('Processing INIT block');
        // this.strategyUtils.logStrategyInfo(`Received ticks: ${ticks.length}`);
        // this.strategyUtils.logStrategyDebug(`Sample tick data: ${JSON.stringify(ticks.slice(0, 3).map(t => ({
        //     token: t.instrument_token,
        //     symbol: t.symbol,
        //     price: t.last_price
        // })))}`);

        if (this.universalDict.cycles === undefined) {
            this.universalDict.cycles = 0;
        }
        
        // Skip buy after first cycle
        if (this.universalDict.cycles >= 1) {
            this.universalDict.skipBuy = true;
        }

        // Set strike base and diff based on weekday
        const today = new Date().getDay();
        const expiryDay = parseInt(this.universalDict.expiry || 3);
        
        if (today === expiryDay) {
            this.universalDict.strikeBase = 100;
            this.universalDict.strikeDiff = 39;
            this.universalDict.strikeLowest = 100;
        } else if (today === expiryDay - 1) {
            this.universalDict.strikeBase = 100;
            this.universalDict.strikeDiff = 39;
            this.universalDict.strikeLowest = 100;
        } else {
            this.universalDict.strikeBase = 100;
            this.universalDict.strikeDiff = 39;
            this.universalDict.strikeLowest = 100;
        }

        this.strategyUtils.logStrategyInfo(`Checking Range: ${this.universalDict.strikeBase} - ${this.universalDict.strikeBase + this.universalDict.strikeDiff}`);

        // Sort ticks by least deviation from target price (200 on normal days, 100 on expiry day)
        // const targetPrice = today === expiryDay ? 100 : 200;
        const targetPrice = 100;
        const sortedTicks = ticks.sort((a, b) => {
            const deviationA = Math.abs(a.last_price - targetPrice);
            const deviationB = Math.abs(b.last_price - targetPrice);
            return deviationA - deviationB;
        });
        
        // Find accepted tokens within range with dynamic adjustment
        const rangeResult = this.strategyUtils.findTokensInDynamicRange(
            sortedTicks,
            this.universalDict.strikeBase,
            this.universalDict.strikeDiff,
            this.universalDict.strikeLowest,
            5 // adjustment step
        );
        
        const acceptedTokens = rangeResult.acceptedTokens;
        const rejectedTokens = rangeResult.rejectedTokens;

        this.strategyUtils.logStrategyInfo(`Accepted tokens: ${acceptedTokens.length}`);
        this.strategyUtils.logStrategyInfo(`Rejected tokens: ${rejectedTokens.length}`);
        this.strategyUtils.logStrategyDebug(`Accepted token prices: ${acceptedTokens.slice(0, 5).map(token => {
            const tick = ticks.find(t => t.instrument_token === token);
            return tick ? tick.last_price : 'unknown';
        })}`);

        // Check if we have any accepted tokens
        if (acceptedTokens.length === 0) {
            this.strategyUtils.logStrategyInfo('No accepted tokens found - waiting for next tick batch');
            return; // Stay in INIT block and wait for more ticks
        }

        // Separate CE and PE tokens using utility functions
        const { ceTokens, peTokens } = this.strategyUtils.separateCETokensAndPETokens(
            acceptedTokens, 
            (token) => {
                const tick = ticks.find(t => t.instrument_token == token); // Use == for type coercion
                return tick ? tick.symbol : null;
            }
        );
        
        // Convert to strings for consistency with instrumentMap keys
        this.universalDict.ceTokens = [ceTokens.map(token => token.toString()).sort((a, b) => {
            const aTick = Math.abs(ticks.find(t => t.instrument_token.toString() === a).last_price);
            const bTick = Math.abs(ticks.find(t => t.instrument_token.toString() === b).last_price);
            return aTick - bTick;
        })[0]];

        this.universalDict.peTokens = [peTokens.map(token => token.toString()).sort((a, b) => {
            const aTick = Math.abs(ticks.find(t => t.instrument_token.toString() === a).last_price);
            const bTick = Math.abs(ticks.find(t => t.instrument_token.toString() === b).last_price);
            return aTick - bTick;
        })[0]];

        // TEMPORARY FIX: For testing
        // this.universalDict.ceTokens = ["18424322"]
        // this.universalDict.peTokens = ["18425090"]

        this.strategyUtils.logStrategyInfo(`CE Tokens: ${this.universalDict.ceTokens.length}`);
        this.strategyUtils.logStrategyInfo(`PE Tokens: ${this.universalDict.peTokens.length}`);

        // Check if we have at least one CE token and one PE token
        if (this.universalDict.ceTokens.length === 0 || this.universalDict.peTokens.length === 0) {
            this.strategyUtils.logStrategyInfo(`Insufficient token types - CE: ${this.universalDict.ceTokens.length}, PE: ${this.universalDict.peTokens.length}. Waiting for more ticks...`);
            return; // Stay in INIT block and wait for more ticks
        }

        this.strategyUtils.logStrategyInfo(`Token requirements met - CE: ${this.universalDict.ceTokens.length}, PE: ${this.universalDict.peTokens.length}`);

        // Set observed ticks - convert to strings for consistency with instrumentMap keys
        this.universalDict.observedTicks = acceptedTokens.map(token => token.toString()).sort((a, b) => {
            const aTick = ticks.find(t => t.instrument_token.toString() === a);
            const bTick = ticks.find(t => t.instrument_token.toString() === b);
            return aTick.last_price - bTick.last_price;
        });

        this.strategyUtils.logStrategyInfo(`Observed ticks set: ${this.universalDict.observedTicks.length}`);

        // Transition to next block only if we have sufficient tokens
        this.blockInit = false;
        this.blockUpdate = true;
        
        console.log('Transitioning from INIT to UPDATE block');
        
        // Emit block transition notification
        this.emitStatusUpdate('Block transition: INIT → UPDATE', {
            blockTransition: true,
            fromBlock: 'INIT',
            toBlock: 'UPDATE',
            message: 'Token selection complete - starting price monitoring',
            acceptedTokens: acceptedTokens.length,
            ceTokens: this.universalDict.ceTokens.length,
            peTokens: this.universalDict.peTokens.length
        });
    }    

    processUpdateBlock(ticks) {
        console.log('Processing UPDATE block');
        
        const currentTime = new Date().toISOString();
        this.globalDict.timestamp = currentTime;
        
        // Emit instrument data update for real-time dashboard updates
        this.emitStatusUpdate('instrument_data_update', {
            instrumentMap: this.universalDict.instrumentMap,
            ceTokens: this.universalDict.ceTokens,
            peTokens: this.universalDict.peTokens,
            halfdrop_flag: this.halfdrop_flag,
            halfdrop_instrument: this.halfdrop_instrument,
            buyToken: this.buyToken,
            oppBuyToken: this.oppBuyToken,
            timestamp: currentTime
        });

        // Initialize or update instrument data for all observed tokens
        for (const tick of ticks) {
            const token = tick.instrument_token.toString();
            
            // if (!this.universalDict.observedTicks.includes(Number(token))) {
            //     continue;
            // }

            // Initialize instrument data if not exists
            if (!this.universalDict.instrumentMap[token]) {
                this.universalDict.instrumentMap[token] = {
                    token: token,
                    time: currentTime,
                    symbol: tick.symbol,
                    firstPrice: tick.last_price,
                    last: tick.last_price,
                    open: -1,
                    peak: -1,
                    prevPeak: -1,
                    lowAtRef: -1,
                    plus3: -1,
                    change: -1,
                    peakAtRef: -1,
                    peakTime: null,
                    buyPrice: -1,
                    changeFromBuy: -1,
                    calcRef: -1,
                    prevCalcRef: -1,
                    flagPlus3: false,
                    flagPeakAndFall: false,
                    flagCalcRef: false,
                    flagInterim: false
                };
            } 
            
            const instrument = this.universalDict.instrumentMap[token];
            const oldPrice = instrument.last;
            const newPrice = tick.last_price;

            // Update basic metrics
            instrument.time = currentTime;
            instrument.plus3 = newPrice - instrument.firstPrice;
            instrument.change = newPrice - oldPrice;
            instrument.last = newPrice;

            // TEMPORARY FIX: For testing
            // if (token === "18424322"){
            //     instrument.firstPrice = 120.7
            // }

            // if (token === "18425090"){
            //     instrument.firstPrice = 103.7
            // }
            
            // Other updates only for selected instruments.
            if (this.universalDict.ceTokens.includes(token) || this.universalDict.peTokens.includes(token)) {

                if (newPrice > instrument.peak) {
                    instrument.prevPeak = instrument.peak;
                    instrument.peak = newPrice;
                    instrument.peakTime = currentTime;
                    this.strategyUtils.logStrategyInfo(`NEW PEAK: ${instrument.symbol}: ${instrument.peak}`);
                }

                if (newPrice < instrument.lowAtRef || instrument.lowAtRef === -1) {
                    instrument.lowAtRef = newPrice;
                    this.strategyUtils.logStrategyInfo(`NEW LOW AT REF: ${instrument.symbol}: ${instrument.lowAtRef}`);
                }

                if (instrument.lowAtRef <= instrument.firstPrice*0.5 && !this.halfdrop_flag) {
                    this.halfdrop_flag = true;
                    this.halfdrop_instrument = instrument;
                    this.mainToken = instrument.token
                    this.strategyUtils.logStrategyInfo(`HALF DROP FLAG: ${instrument.symbol} at ${instrument.lowAtRef}`);
                    
                    // Emit half drop detection notification
                    this.emitStatusUpdate('Half drop detected - 50% price drop reached', {
                        halfDropDetected: true,
                        instrument: instrument.symbol,
                        lowAtRef: instrument.lowAtRef,
                        firstPrice: instrument.firstPrice,
                        dropPercentage: ((instrument.lowAtRef / instrument.firstPrice) * 100).toFixed(2),
                        message: `50% drop detected in ${instrument.symbol} - preparing for trading`
                    });
                }

                if (instrument.buyPrice > -1) {
                    instrument.changeFromBuy = newPrice - instrument.buyPrice;
                }
            }
        }

        if (this.halfdrop_flag) {
            this.blockDiff10 = true;
            console.log('Transitioning from UPDATE to DIFF10 block');
            
            // Emit block transition notification
            this.emitStatusUpdate('Block transition: UPDATE → DIFF10', {
                blockTransition: true,
                fromBlock: 'UPDATE',
                toBlock: 'DIFF10',
                message: 'Half drop detected - starting trading execution',
                halfDropInstrument: this.halfdrop_instrument?.symbol,
                halfDropPrice: this.halfdrop_instrument?.lowAtRef
            });
        }
    }

    processDiff10Block(ticks) {
        this.strategyUtils.logStrategyDebug(`Processing DIFF10 block - boughtSold: ${this.boughtSold}, soldAt10: ${this.soldAt10}, remainingSellAtTarget: ${this.remainingSellAtTarget}, buyBackAfterStoploss: ${this.buyBackAfterStoploss}, sellBuyBackAfterStoploss: ${this.sellBuyBackAfterStoploss}`);

        if (!this.halfdrop_bought) {
            this.buyToken = this.strategyUtils.findClosestCEBelowPrice(this.universalDict.instrumentMap, 200, 200);
            this.oppBuyToken = this.strategyUtils.findClosestPEBelowPrice(this.universalDict.instrumentMap, 200, 200);
            this.halfdrop_bought = true;
            this.strategyUtils.logStrategyInfo(`BUY HALF DROP: ${this.halfdrop_instrument.symbol} at ${this.halfdrop_instrument.last}`);
            this.placeOrdersForTokens();
        }
        
        if (shouldSellAt10() && !this.boughtSold && !this.soldAt10) {

            this.soldAt10 = true;
            
            let ce_instrument = this.universalDict.instrumentMap[this.buyToken];
            let pe_instrument = this.universalDict.instrumentMap[this.oppBuyToken];
            this.instrumentAt10 = ce_instrument.last - ce_instrument.buyPrice <= this.globalDict.limitAt10 ? ce_instrument : pe_instrument;
            let other_instrument = this.instrumentAt10 === ce_instrument ? pe_instrument : ce_instrument;
            other_instrument.buyPrice = other_instrument.last;
            this.sellOption();
            this.halfdropAssisstedTarget = this.globalDict.target - ((this.instrumentAt10Sell - this.instrumentAt10.buyPrice) + (other_instrument.last - other_instrument.buyPrice));
        }

        if ((shouldSellRemainingAtTargetAfter10() || shouldSellRemainingAtStoplossAfter10()) && !this.boughtSold && this.soldAt10 && !this.remainingSellAtTarget) {
            this.remainingSellAtTarget = true;
            if (shouldSellRemainingAtTargetAfter10()) {
                this.sellRemainingAtTargetAfter10();
            } else {
                this.sellRemainingAtStoplossAfter10();
            }
        }

        if (shouldSellBuyBackAfterStoploss() && !this.boughtSold && !this.soldBuyBackAfterStoploss && this.buyBackAfterStoploss) {
            this.strategyUtils.logStrategyInfo('Buy back instrument ready to sell - checking conditions');
            this.sellBuyBackAfterStoploss();
        }

        if (this.boughtSold) {
            this.blockDiff10 = false;
            this.blockNextCycle = true;
            this.strategyUtils.logStrategyInfo('Transitioning from DIFF10 to NEXT CYCLE block');
            
            // Emit cycle completion notification
            this.emitStatusUpdate('Cycle completed - preparing for next cycle', {
                blockTransition: true,
                fromBlock: 'DIFF10',
                toBlock: 'NEXT_CYCLE',
                cycleCompleted: true,
                message: 'All trading actions completed - cycle finished'
            });
        }

        
    }

    placeOrdersForTokens() {
        if (!this.buyToken || !this.oppBuyToken) {
            this.strategyUtils.logStrategyError('Cannot place orders - buyToken/oppBuyToken not set');
            return;
        }

        const instrument = this.universalDict.instrumentMap[this.buyToken];
        const other_instrument = this.universalDict.instrumentMap[this.oppBuyToken];

        instrument.buyPrice = instrument.last;
        other_instrument.buyPrice = other_instrument.last;
        
        if (!instrument || !other_instrument) {
            this.strategyUtils.logStrategyError('Cannot place orders - instrument data not found');
            return;
        }

        this.strategyUtils.logStrategyInfo('Placing order for fifty percent strategy token');
        this.strategyUtils.logStrategyInfo(`Token: ${instrument.symbol} @ ${instrument.last}`);
        this.strategyUtils.logStrategyInfo(`Other Token: ${other_instrument.symbol} @ ${other_instrument.last}`);
        
        // Emit trading start notification
        this.emitStatusUpdate('Starting Fifty Percent Strategy trading', {
            tradingStarted: true,
            ceToken: instrument.symbol,
            peToken: other_instrument.symbol,
            cePrice: instrument.last,
            pePrice: other_instrument.last,
            quantity: this.globalDict.quantity || 75,
            message: 'Placing buy orders for CE and PE tokens'
        });

        // Check if trading is enabled
        const tradingEnabled = this.globalDict.enableTrading === true;
        this.strategyUtils.logStrategyInfo(`Trading enabled: ${tradingEnabled}`);

        // CRITICAL FIX: Ensure TradingUtils is available before proceeding
        if (!this.tradingUtils) {
            this.strategyUtils.logStrategyError('CRITICAL ERROR: TradingUtils not available - cannot place orders');
            this.strategyUtils.logStrategyError('This usually indicates a timing issue with TradingUtils injection');
            return;
        }

        // Use the injected TradingUtils instance
        const tradingUtils = this.tradingUtils;

        try {
            if (tradingEnabled) {
                // Place buy order - synchronous
                const buyOrderResult = tradingUtils.placeBuyOrder(
                    instrument.symbol,
                    instrument.last,
                    this.globalDict.quantity || 75
                );

                if (buyOrderResult.success) {
                    this.strategyUtils.logStrategyInfo(`Buy order placed for ${instrument.symbol}`);
                    this.strategyUtils.logOrderPlaced('buy', instrument.symbol, instrument.last, this.globalDict.quantity || 75, instrument.token);
                    
                    // Emit trade action notification
                    this.emitTradeAction('buy', {
                        symbol: instrument.symbol,
                        price: instrument.last,
                        quantity: this.globalDict.quantity || 75,
                        token: instrument.token,
                        orderType: 'CE Token',
                        success: true
                    });
                    
                    // Get executed price from order history
                    buyOrderResult.orderId.then(orderId => {
                        tradingUtils.getOrderHistory(orderId.order_id)
                        .then(result => {
                            this.strategyUtils.logStrategyInfo(`Order history: ${typeof result === 'object' ? JSON.stringify(result) : result}`);
                            const executedPrice = result.at(-1).average_price;
                            this.strategyUtils.logStrategyInfo(`Executed Price: ${executedPrice}`);
                            instrument.buyPrice = executedPrice;
                            this.strategyUtils.logStrategyInfo(`Halfdrop Instrument Buy Price: ${this.universalDict.instrumentMap[instrument.token].buyPrice}`);
                        })
                        .catch(error => {
                            this.strategyUtils.logStrategyError(`Error getting order history: ${JSON.stringify(error)}`);
                        });
                    }).catch(error => {
                        this.strategyUtils.logStrategyError(`Error getting order ID: ${JSON.stringify(error)}`);
                    });
                } else {
                    this.strategyUtils.logStrategyError(`Failed to place buy order for ${instrument.symbol}: ${buyOrderResult.error}`);
                    this.strategyUtils.logOrderFailed('buy', instrument.symbol, instrument.last, this.globalDict.quantity || 75, instrument.token, buyOrderResult.error);
                }

                const buyOrderResultOther = tradingUtils.placeBuyOrder(
                    other_instrument.symbol,
                    other_instrument.last,
                    this.globalDict.quantity || 75
                );
                
                if (buyOrderResultOther.success) {
                    this.strategyUtils.logStrategyInfo(`Buy order placed for ${other_instrument.symbol}`);
                    this.strategyUtils.logOrderPlaced('buy', other_instrument.symbol, other_instrument.last, this.globalDict.quantity || 75, other_instrument.token);
                    
                    // Emit trade action notification
                    this.emitTradeAction('buy', {
                        symbol: other_instrument.symbol,
                        price: other_instrument.last,
                        quantity: this.globalDict.quantity || 75,
                        token: other_instrument.token,
                        orderType: 'PE Token',
                        success: true
                    });
                } else {
                    this.strategyUtils.logStrategyError(`Failed to place buy order for ${other_instrument.symbol}: ${buyOrderResultOther.error}`);
                    this.strategyUtils.logOrderFailed('buy', other_instrument.symbol, other_instrument.last, this.globalDict.quantity || 75, other_instrument.token, buyOrderResultOther.error);
                }

                buyOrderResultOther.orderId.then(orderId => {
                    tradingUtils.getOrderHistory(orderId.order_id)
                    .then(result => {
                        this.strategyUtils.logStrategyInfo(`Order history: ${typeof result === 'object' ? JSON.stringify(result) : result}`);
                        const executedPrice = result.at(-1).average_price;
                        this.strategyUtils.logStrategyInfo(`Executed Price: ${executedPrice}`);
                        other_instrument.buyPrice = executedPrice;
                        this.strategyUtils.logStrategyInfo(`Other Instrument Buy Price: ${this.universalDict.instrumentMap[other_instrument.token].buyPrice}`);
                    })
                    .catch(error => {
                        this.strategyUtils.logStrategyError(`Error getting order history: ${JSON.stringify(error)}`);
                    });
                })
            } else {
                // Paper trading - log the order without placing it
                this.strategyUtils.logStrategyInfo(`PAPER TRADING: Buy order for ${instrument.symbol} @ ${instrument.last}`);
                this.strategyUtils.logStrategyInfo(`PAPER TRADING: Buy order for ${other_instrument.symbol} @ ${other_instrument.last}`);
                this.strategyUtils.logOrderPlaced('buy', instrument.symbol, instrument.last, this.globalDict.quantity || 75, instrument.token);
                this.strategyUtils.logOrderPlaced('buy', other_instrument.symbol, other_instrument.last, this.globalDict.quantity || 75, other_instrument.token);
                
                // For paper trading, use last price as buy price
                instrument.buyPrice = instrument.last;
                other_instrument.buyPrice = other_instrument.last;
            }

            this.strategyUtils.logStrategyInfo('Order placed successfully for fifty percent strategy');
            this.strategyUtils.logStrategyInfo(`Investment: ${(instrument.last * (this.globalDict.quantity || 75)) + (other_instrument.last * (this.globalDict.quantity || 75))}`);

        } catch (error) {
            this.strategyUtils.logStrategyError(`Exception while placing order: ${error.message}`);
        }
    }

    sellOption() {
        if (!this.instrumentAt10) {
            this.strategyUtils.logStrategyError('Cannot sell option - instrumentAt10 not set');
            return;
        }

        const instrument = this.universalDict.instrumentMap[this.instrumentAt10.token];
        this.strategyUtils.logStrategyInfo(`Selling option: ${instrument.symbol} at ${instrument.last}`);
        this.instrumentAt10Sell = instrument.last

        // Check if trading is enabled
        const tradingEnabled = this.globalDict.enableTrading === true;
        this.strategyUtils.logStrategyInfo(`Trading enabled: ${tradingEnabled}`);

        // CRITICAL FIX: Ensure TradingUtils is available before proceeding
        if (!this.tradingUtils) {
            this.strategyUtils.logStrategyError('CRITICAL ERROR: TradingUtils not available - cannot place sell orders');
            this.strategyUtils.logStrategyError('This usually indicates a timing issue with TradingUtils injection');
            return;
        }

        // Use the injected TradingUtils instance
        const tradingUtils = this.tradingUtils;

        try {
            if (tradingEnabled) {
                // Place market sell order - synchronous
                const sellOrderResult = tradingUtils.placeMarketSellOrder(
                    instrument.symbol,
                    instrument.last,
                    this.globalDict.quantity || 75
                );

                if (sellOrderResult.success) {
                    this.strategyUtils.logOrderPlaced('SELL', instrument.symbol, instrument.last, this.globalDict.quantity || 75, this.instrumentAt10.token);
                    this.strategyUtils.logStrategyInfo(`Market sell order placed successfully for ${instrument.symbol}`);
                    this.strategyUtils.logStrategyInfo(`Order ID: ${sellOrderResult.orderId}`);
                    
                    // Emit trade action notification
                    this.emitTradeAction('sell', {
                        symbol: instrument.symbol,
                        price: instrument.last,
                        quantity: this.globalDict.quantity || 75,
                        token: this.instrumentAt10.token,
                        orderType: 'Sold at -10',
                        success: true
                    });
                    
                    // Get order history to find executed price using MTM pattern
                    let sellPrice = instrument.last;
                    sellOrderResult.orderId.then(orderId => {
                        this.strategyUtils.logStrategyInfo(`Getting order history for sell order ID: ${orderId.order_id}`);
                        tradingUtils.getOrderHistory(orderId.order_id)
                        .then(result => {
                            this.strategyUtils.logStrategyInfo(`Order history: ${typeof result === 'object' ? JSON.stringify(result) : result}`);
                            sellPrice = result.at(-1).average_price;
                            this.strategyUtils.logStrategyInfo(`Executed Sell Price: ${sellPrice}`);
                            this.instrumentAt10Sell = sellPrice != 0 ? sellPrice : instrument.last;
                            this.strategyUtils.logStrategyInfo(`Updated instrumentAt10Sell to: ${this.instrumentAt10Sell}`);
                            
                            // Log the executed order
                            this.strategyUtils.logOrderExecuted('SELL', instrument.symbol, sellPrice, this.globalDict.quantity || 75, this.instrumentAt10.token, orderId.order_id);
                        })
                        .catch(error => {
                            this.strategyUtils.logStrategyError(`Error getting sell order history: ${JSON.stringify(error)}`);
                            // Fallback to current market price
                            this.instrumentAt10Sell = instrument.last;
                            this.strategyUtils.logStrategyInfo(`Using current market price as fallback: ${this.instrumentAt10Sell}`);
                        });
                    }).catch(error => {
                        this.strategyUtils.logStrategyError(`Error getting sell order ID: ${JSON.stringify(error)}`);
                        // Fallback to current market price
                        this.instrumentAt10Sell = instrument.last;
                        this.strategyUtils.logStrategyInfo(`Using current market price as fallback: ${this.instrumentAt10Sell}`);
                    });
                    
                } else {
                    this.strategyUtils.logOrderFailed('SELL', instrument.symbol, instrument.last, this.globalDict.quantity || 75, this.instrumentAt10.token, sellOrderResult.error);
                    this.strategyUtils.logStrategyError(`Failed to place market sell order: ${sellOrderResult.error}`);
                }
            } else {
                this.strategyUtils.logStrategyInfo('Trading disabled - simulating market sell order');
                this.strategyUtils.logStrategyInfo(`Simulated SELL: ${instrument.symbol} @ ${instrument.last} x ${this.globalDict.quantity || 75}`);
                // For simulation, set the sell price to current market price
                this.instrumentAt10Sell = instrument.last;
                this.strategyUtils.logOrderExecuted('SELL', instrument.symbol, instrument.last, this.globalDict.quantity || 75, this.instrumentAt10.token, 'SIMULATED');
            }
        } catch (error) {
            this.strategyUtils.logStrategyError(`Error in sellOption: ${error.message}`);
            console.error('Sell option error:', error);
        }

    }

    sellRemainingAtTargetAfter10() {
        this.strategyUtils.logStrategyInfo('Selling remaining instrument at target after 10 point');
        this.boughtSold = true;
        
        if (!this.buyToken || !this.oppBuyToken) {
            this.strategyUtils.logStrategyError('Cannot sell remaining instrument - buyToken or oppBuyToken not set');
            return;
        }

        const ce_instrument = this.universalDict.instrumentMap[this.buyToken];
        const pe_instrument = this.universalDict.instrumentMap[this.oppBuyToken];
        
        if (!ce_instrument || !pe_instrument) {
            this.strategyUtils.logStrategyError('Cannot sell remaining instrument - instrument data not found');
            return;
        }

        // Determine which instrument is the remaining one (not sold at 10)
        const remainingInstrument = this.instrumentAt10 === ce_instrument ? pe_instrument : ce_instrument;
        
        this.strategyUtils.logStrategyInfo(`Selling remaining instrument: ${remainingInstrument.symbol} @ ${remainingInstrument.last}`);
        this.strategyUtils.logStrategyInfo(`Target achieved: ${remainingInstrument.last - remainingInstrument.buyPrice} >= ${this.halfdropAssisstedTarget}`);

        // Check if trading is enabled
        const tradingEnabled = this.globalDict.enableTrading === true;
        this.strategyUtils.logStrategyInfo(`Trading enabled: ${tradingEnabled}`);

        // CRITICAL FIX: Ensure TradingUtils is available before proceeding
        if (!this.tradingUtils) {
            this.strategyUtils.logStrategyError('CRITICAL ERROR: TradingUtils not available - cannot place sell orders');
            this.strategyUtils.logStrategyError('This usually indicates a timing issue with TradingUtils injection');
            return;
        }

        // Use the injected TradingUtils instance
        const tradingUtils = this.tradingUtils;

        try {
            if (tradingEnabled) {
                // Place market sell order for the remaining instrument - synchronous
                const sellOrderResult = tradingUtils.placeMarketSellOrder(
                    remainingInstrument.symbol,
                    remainingInstrument.last,
                    this.globalDict.quantity || 75
                );

                if (sellOrderResult.success) {
                    this.strategyUtils.logOrderPlaced('SELL', remainingInstrument.symbol, remainingInstrument.last, this.globalDict.quantity || 75, remainingInstrument.token);
                    this.strategyUtils.logStrategyInfo(`Market sell order placed successfully for ${remainingInstrument.symbol}`);
                    this.strategyUtils.logStrategyInfo(`Order ID: ${sellOrderResult.orderId}`);
                    
                    // Get order history to find executed price using MTM pattern
                    let sellPrice = remainingInstrument.last;
                    sellOrderResult.orderId.then(orderId => {
                        this.strategyUtils.logStrategyInfo(`Getting order history for remaining sell order ID: ${orderId.order_id}`);
                        tradingUtils.getOrderHistory(orderId.order_id)
                        .then(result => {
                            this.strategyUtils.logStrategyInfo(`Order history: ${typeof result === 'object' ? JSON.stringify(result) : result}`);
                            sellPrice = result.at(-1).average_price;
                            this.strategyUtils.logStrategyInfo(`Executed Remaining Sell Price: ${sellPrice}`);
                            
                            // Log the executed order
                            this.strategyUtils.logOrderExecuted('SELL', remainingInstrument.symbol, sellPrice, this.globalDict.quantity || 75, remainingInstrument.token, orderId.order_id);
                            
                            // Calculate and log P&L for the remaining instrument
                            const remainingPnL = (sellPrice - remainingInstrument.buyPrice) * (this.globalDict.quantity || 75);
                            this.strategyUtils.logStrategyInfo(`Remaining instrument P&L: ${remainingPnL.toFixed(2)}`);
                            
                            // Calculate total P&L from both trades
                            const soldAt10PnL = (this.instrumentAt10Sell - this.instrumentAt10.buyPrice) * (this.globalDict.quantity || 75);
                            const totalPnL = soldAt10PnL + remainingPnL;
                            
                            this.strategyUtils.logStrategyInfo(`Total P&L from both trades: ${totalPnL.toFixed(2)} (Sold at -10: ${soldAt10PnL.toFixed(2)}, Remaining: ${remainingPnL.toFixed(2)})`);
                        })
                        .catch(error => {
                            this.strategyUtils.logStrategyError(`Error getting remaining sell order history: ${JSON.stringify(error)}`);
                        });
                    }).catch(error => {
                        this.strategyUtils.logStrategyError(`Error getting remaining sell order ID: ${JSON.stringify(error)}`);
                    });
                    
                } else {
                    this.strategyUtils.logOrderFailed('SELL', remainingInstrument.symbol, remainingInstrument.last, this.globalDict.quantity || 75, remainingInstrument.token, sellOrderResult.error);
                    this.strategyUtils.logStrategyError(`Failed to place market sell order: ${sellOrderResult.error}`);
                }
            } else {
                this.strategyUtils.logStrategyInfo('Trading disabled - simulating remaining sell order');
                this.strategyUtils.logStrategyInfo(`Simulated SELL: ${remainingInstrument.symbol} @ ${remainingInstrument.last} x ${this.globalDict.quantity || 75}`);
                
                // For simulation, calculate P&L
                const remainingPnL = (remainingInstrument.last - remainingInstrument.buyPrice) * (this.globalDict.quantity || 75);
                const soldAt10PnL = (this.instrumentAt10Sell - this.instrumentAt10.buyPrice) * (this.globalDict.quantity || 75);
                const totalPnL = soldAt10PnL + remainingPnL;
                
                this.strategyUtils.logStrategyInfo(`Simulated P&L - Remaining: ${remainingPnL.toFixed(2)}, Total: ${totalPnL.toFixed(2)}`);
                this.strategyUtils.logOrderExecuted('SELL', remainingInstrument.symbol, remainingInstrument.last, this.globalDict.quantity || 75, remainingInstrument.token, 'SIMULATED');
            }
        } catch (error) {
            this.strategyUtils.logStrategyError(`Error in sellRemainingAtTargetAfter10: ${error.message}`);
            console.error('Sell remaining at target after 10 error:', error);
        }
    }

    sellRemainingAtStoplossAfter10() {
        this.strategyUtils.logStrategyInfo('Selling remaining instrument at stoploss after 10 point');
        
        if (!this.buyToken || !this.oppBuyToken) {
            this.strategyUtils.logStrategyError('Cannot sell remaining instrument - buyToken or oppBuyToken not set');
            return;
        }

        const ce_instrument = this.universalDict.instrumentMap[this.buyToken];
        const pe_instrument = this.universalDict.instrumentMap[this.oppBuyToken];
        
        if (!ce_instrument || !pe_instrument) {
            this.strategyUtils.logStrategyError('Cannot sell remaining instrument - instrument data not found');
            return;
        }

        // Determine which instrument is the remaining one (not sold at 10)
        const remainingInstrument = this.instrumentAt10 === ce_instrument ? pe_instrument : ce_instrument;
        this.instrumentAtStoploss = remainingInstrument;
        this.instrumentAtStoplossSell = remainingInstrument.last;

        this.strategyUtils.logStrategyInfo(`Selling remaining instrument at stoploss: ${remainingInstrument.symbol} @ ${remainingInstrument.last}`);
        this.strategyUtils.logStrategyInfo(`Stoploss reached: ${remainingInstrument.last - remainingInstrument.buyPrice} <= ${this.globalDict.stoploss}`);

        // Check if trading is enabled
        const tradingEnabled = this.globalDict.enableTrading === true;
        this.strategyUtils.logStrategyInfo(`Trading enabled: ${tradingEnabled}`);

        // CRITICAL FIX: Ensure TradingUtils is available before proceeding
        if (!this.tradingUtils) {
            this.strategyUtils.logStrategyError('CRITICAL ERROR: TradingUtils not available - cannot place sell orders');
            this.strategyUtils.logStrategyError('This usually indicates a timing issue with TradingUtils injection');
            return;
        }

        // Use the injected TradingUtils instance
        const tradingUtils = this.tradingUtils;

        try {
            if (tradingEnabled) {
                // Place market sell order for the remaining instrument - synchronous
                const sellOrderResult = tradingUtils.placeMarketSellOrder(
                    remainingInstrument.symbol,
                    remainingInstrument.last,
                    this.globalDict.quantity || 75
                );

                if (sellOrderResult.success) {
                    this.strategyUtils.logOrderPlaced('SELL', remainingInstrument.symbol, remainingInstrument.last, this.globalDict.quantity || 75, remainingInstrument.token);
                    this.strategyUtils.logStrategyInfo(`Market sell order placed successfully for ${remainingInstrument.symbol}`);
                    this.strategyUtils.logStrategyInfo(`Order ID: ${sellOrderResult.orderId}`);
                    
                    // Get order history to find executed price using MTM pattern
                    let sellPrice = remainingInstrument.last;
                    sellOrderResult.orderId.then(orderId => {
                        this.strategyUtils.logStrategyInfo(`Getting order history for stoploss sell order ID: ${orderId.order_id}`);
                        tradingUtils.getOrderHistory(orderId.order_id)
                        .then(result => {
                            this.strategyUtils.logStrategyInfo(`Order history: ${typeof result === 'object' ? JSON.stringify(result) : result}`);
                            sellPrice = result.at(-1).average_price;
                            this.strategyUtils.logStrategyInfo(`Executed Stoploss Sell Price: ${sellPrice}`);
                            
                            // Log the executed order
                            this.strategyUtils.logOrderExecuted('SELL', remainingInstrument.symbol, sellPrice, this.globalDict.quantity || 75, remainingInstrument.token, orderId.order_id);
                            
                            // Calculate P&L for the remaining instrument
                            const remainingPnL = (sellPrice - remainingInstrument.buyPrice) * (this.globalDict.quantity || 75);
                            this.strategyUtils.logStrategyInfo(`Remaining instrument P&L (stoploss): ${remainingPnL.toFixed(2)}`);
                            
                            // Calculate total P&L from both trades
                            const soldAt10PnL = (this.instrumentAt10Sell - this.instrumentAt10.buyPrice) * (this.globalDict.quantity || 75);
                            const totalPnL = soldAt10PnL + remainingPnL;
                            
                            this.strategyUtils.logStrategyInfo(`Total P&L from both trades: ${totalPnL.toFixed(2)} (Sold at -10: ${soldAt10PnL.toFixed(2)}, Stoploss: ${remainingPnL.toFixed(2)})`);
                            
                            // Trigger buy back logic
                            this.instrumentAtStoplossSell = sellPrice;
                            this.triggerBuyBackAfterStoploss(remainingInstrument, tradingUtils);
                        })
                        .catch(error => {
                            this.strategyUtils.logStrategyError(`Error getting stoploss sell order history: ${JSON.stringify(error)}`);
                            // Still trigger buy back even if order history fails
                            this.triggerBuyBackAfterStoploss(remainingInstrument, tradingUtils);
                        });
                    }).catch(error => {
                        this.strategyUtils.logStrategyError(`Error getting stoploss sell order ID: ${JSON.stringify(error)}`);
                        // Still trigger buy back even if order ID fails
                        this.triggerBuyBackAfterStoploss(remainingInstrument, tradingUtils);
                    });
                    
                } else {
                    this.strategyUtils.logOrderFailed('SELL', remainingInstrument.symbol, remainingInstrument.last, this.globalDict.quantity || 75, remainingInstrument.token, sellOrderResult.error);
                    this.strategyUtils.logStrategyError(`Failed to place market sell order: ${sellOrderResult.error}`);
                }
            } else {
                this.strategyUtils.logStrategyInfo('Trading disabled - simulating stoploss sell order');
                this.strategyUtils.logStrategyInfo(`Simulated SELL: ${remainingInstrument.symbol} @ ${remainingInstrument.last} x ${this.globalDict.quantity || 75}`);
                
                // For simulation, calculate P&L
                const remainingPnL = (remainingInstrument.last - remainingInstrument.buyPrice) * (this.globalDict.quantity || 75);
                const soldAt10PnL = (this.instrumentAt10Sell - this.instrumentAt10.buyPrice) * (this.globalDict.quantity || 75);
                const totalPnL = soldAt10PnL + remainingPnL;
                
                this.strategyUtils.logStrategyInfo(`Simulated P&L - Stoploss: ${remainingPnL.toFixed(2)}, Total: ${totalPnL.toFixed(2)}`);
                this.strategyUtils.logOrderExecuted('SELL', remainingInstrument.symbol, remainingInstrument.last, this.globalDict.quantity || 75, remainingInstrument.token, 'SIMULATED');
                
                // Trigger buy back logic for simulation
                this.triggerBuyBackAfterStoploss(remainingInstrument, tradingUtils);
            }
        } catch (error) {
            this.strategyUtils.logStrategyError(`Error in sellRemainingAtStoplossAfter10: ${error.message}`);
            console.error('Sell remaining at stoploss after 10 error:', error);
        }
    }

    triggerBuyBackAfterStoploss(soldInstrument, tradingUtils) {
        this.strategyUtils.logStrategyInfo('Triggering buy back after stoploss');
        this.buyBackAfterStoploss = true;
        
        // Determine opposite instrument type
        const oppositeType = soldInstrument.symbol.includes('CE') ? 'PE' : 'CE';
        
        // Find the closest instrument of opposite type below 200
        const closestOpposite = this.strategyUtils.findClosestSymbolBelowPrice(
            this.universalDict.instrumentMap,
            200,
            oppositeType,
            200
        );
        
        if (!closestOpposite) {
            this.strategyUtils.logStrategyError(`No suitable ${oppositeType} instrument found below 200 for buy back`);
            return;
        }
        
        this.buyBackToken = closestOpposite.token;
        this.buyBackPrice = closestOpposite.price;
        
        // Calculate buy back target: target - (soldAt10PnL + stoplossPnL)
        const soldAt10PnL = (this.instrumentAt10Sell - this.instrumentAt10.buyPrice);
        const stoplossPnL = (this.instrumentAtStoplossSell - this.instrumentAtStoploss.buyPrice);
        this.buyBackTarget = this.globalDict.target - (soldAt10PnL + stoplossPnL);
        
        this.strategyUtils.logStrategyInfo(`Buy back instrument selected: ${closestOpposite.symbol} @ ${closestOpposite.price}`);
        this.strategyUtils.logStrategyInfo(`Buy back target: ${this.buyBackTarget.toFixed(2)}`);
        
        // Check if trading is enabled
        const tradingEnabled = this.globalDict.enableTrading === true;
        
        if (tradingEnabled) {
            // Place buy order for the buy back instrument
            const buyBackOrderResult = tradingUtils.placeBuyOrder(
                closestOpposite.symbol,
                closestOpposite.price,
                this.globalDict.quantity || 75
            );

            if (buyBackOrderResult.success) {
                this.strategyUtils.logStrategyInfo(`Buy back order placed for ${closestOpposite.symbol}`);
                this.strategyUtils.logOrderPlaced('BUY', closestOpposite.symbol, closestOpposite.price, this.globalDict.quantity || 75, this.buyBackToken);
                
                // Emit trade action notification
                this.emitTradeAction('buy', {
                    symbol: closestOpposite.symbol,
                    price: closestOpposite.price,
                    quantity: this.globalDict.quantity || 75,
                    token: this.buyBackToken,
                    orderType: 'Buy Back',
                    success: true
                });
                
                // Get order history to find executed price
                let buyBackExecutedPrice = closestOpposite.price;
                buyBackOrderResult.orderId.then(orderId => {
                    this.strategyUtils.logStrategyInfo(`Getting order history for buy back order ID: ${orderId.order_id}`);
                    tradingUtils.getOrderHistory(orderId.order_id)
                    .then(result => {
                        this.strategyUtils.logStrategyInfo(`Order history: ${typeof result === 'object' ? JSON.stringify(result) : result}`);
                        buyBackExecutedPrice = result.at(-1).average_price;
                        this.strategyUtils.logStrategyInfo(`Executed Buy Back Price: ${buyBackExecutedPrice}`);
                        
                        // Update buy back price with executed price
                        this.buyBackPrice = buyBackExecutedPrice != 0 ? buyBackExecutedPrice : closestOpposite.price;
                        
                        // Log the executed order
                        this.strategyUtils.logOrderExecuted('BUY', closestOpposite.symbol, this.buyBackPrice, this.globalDict.quantity || 75, this.buyBackToken, orderId.order_id);
                        
                        this.strategyUtils.logStrategyInfo(`Buy back completed at ${this.buyBackPrice} with target: ${this.buyBackTarget.toFixed(2)}`);
                    })
                    .catch(error => {
                        this.strategyUtils.logStrategyError(`Error getting buy back order history: ${JSON.stringify(error)}`);
                        this.buyBackPrice = closestOpposite.price;
                    });
                }).catch(error => {
                    this.strategyUtils.logStrategyError(`Error getting buy back order ID: ${JSON.stringify(error)}`);
                    this.buyBackPrice = closestOpposite.price;
                });
                
            } else {
                this.strategyUtils.logStrategyError(`Failed to place buy back order for ${closestOpposite.symbol}: ${buyBackOrderResult.error}`);
                this.strategyUtils.logOrderFailed('BUY', closestOpposite.symbol, closestOpposite.price, this.globalDict.quantity || 75, this.buyBackToken, buyBackOrderResult.error);
            }
        } else {
            // Paper trading - log the buy back order without placing it
            this.strategyUtils.logStrategyInfo(`PAPER TRADING: Buy back order for ${closestOpposite.symbol} @ ${closestOpposite.price}`);
            this.strategyUtils.logOrderPlaced('BUY', closestOpposite.symbol, closestOpposite.price, this.globalDict.quantity || 75, this.buyBackToken);
            
            // Update buy back price for simulation
            this.buyBackPrice = closestOpposite.price;
            this.strategyUtils.logStrategyInfo(`Buy back completed at ${this.buyBackPrice} with target: ${this.buyBackTarget.toFixed(2)}`);
        }
    }

    shouldSellBuyBackAfterStoploss() {
        // Debug logging
        this.strategyUtils.logStrategyDebug(`Checking buy back sell conditions: buyBackAfterStoploss=${this.buyBackAfterStoploss}, buyBackToken=${this.buyBackToken}, buyBackPrice=${this.buyBackPrice}, buyBackTarget=${this.buyBackTarget}`);
        
        if (this.buyBackAfterStoploss && this.buyBackToken && this.buyBackPrice && this.buyBackTarget) {
            const buyBackInstrument = this.universalDict.instrumentMap[this.buyBackToken];
            
            if (!buyBackInstrument) {
                this.strategyUtils.logStrategyError('Cannot check buy back sell - instrument data not found');
                return false;
            }
            
            const currentPrice = buyBackInstrument.last;
            const changeFromBuy = currentPrice - this.buyBackPrice;
            const targetPrice = this.buyBackPrice + this.buyBackTarget;
            
            this.strategyUtils.logStrategyInfo(`Buy back instrument: ${buyBackInstrument.symbol} @ ${currentPrice}, Target: ${targetPrice.toFixed(2)}, Change: ${changeFromBuy.toFixed(2)}`);
            
            const shouldSell = currentPrice >= targetPrice;
            this.strategyUtils.logStrategyInfo(`Should sell buy back: ${shouldSell} (target: ${currentPrice >= targetPrice}, stoploss: ${changeFromBuy <= this.globalDict.stoploss})`);
            
            return shouldSell;
        }
        
        this.strategyUtils.logStrategyDebug('Buy back conditions not met - not ready to sell');
        return false;
    }

    sellBuyBackAfterStoploss() {
        this.strategyUtils.logStrategyInfo('Selling buy back instrument after stoploss');
        this.soldBuyBackAfterStoploss = true;
        this.boughtSold = true;
        
        if (!this.buyBackToken) {
            this.strategyUtils.logStrategyError('Cannot sell buy back - buyBackToken not set');
            return;
        }

        const buyBackInstrument = this.universalDict.instrumentMap[this.buyBackToken];
        
        if (!buyBackInstrument) {
            this.strategyUtils.logStrategyError('Cannot sell buy back - instrument data not found');
            return;
        }

        this.strategyUtils.logStrategyInfo(`Selling buy back instrument: ${buyBackInstrument.symbol} @ ${buyBackInstrument.last}`);

        // Check if trading is enabled
        const tradingEnabled = this.globalDict.enableTrading === true;
        this.strategyUtils.logStrategyInfo(`Trading enabled: ${tradingEnabled}`);

        // CRITICAL FIX: Ensure TradingUtils is available before proceeding
        if (!this.tradingUtils) {
            this.strategyUtils.logStrategyError('CRITICAL ERROR: TradingUtils not available - cannot place sell orders');
            this.strategyUtils.logStrategyError('This usually indicates a timing issue with TradingUtils injection');
            return;
        }

        // Use the injected TradingUtils instance
        const tradingUtils = this.tradingUtils;

        try {
            if (tradingEnabled) {
                // Place market sell order for the buy back instrument - synchronous
                const sellOrderResult = tradingUtils.placeMarketSellOrder(
                    buyBackInstrument.symbol,
                    buyBackInstrument.last,
                    this.globalDict.quantity || 75
                );

                if (sellOrderResult.success) {
                    this.strategyUtils.logOrderPlaced('SELL', buyBackInstrument.symbol, buyBackInstrument.last, this.globalDict.quantity || 75, this.buyBackToken);
                    this.strategyUtils.logStrategyInfo(`Market sell order placed successfully for ${buyBackInstrument.symbol}`);
                    this.strategyUtils.logStrategyInfo(`Order ID: ${sellOrderResult.orderId}`);
                    
                    // Emit trade action notification
                    this.emitTradeAction('sell', {
                        symbol: buyBackInstrument.symbol,
                        price: buyBackInstrument.last,
                        quantity: this.globalDict.quantity || 75,
                        token: this.buyBackToken,
                        orderType: 'Buy Back Sell',
                        success: true
                    });
                    
                    // Get order history to find executed price using MTM pattern
                    let sellPrice = buyBackInstrument.last;
                    sellOrderResult.orderId.then(orderId => {
                        this.strategyUtils.logStrategyInfo(`Getting order history for buy back sell order ID: ${orderId.order_id}`);
                        tradingUtils.getOrderHistory(orderId.order_id)
                        .then(result => {
                            this.strategyUtils.logStrategyInfo(`Order history: ${typeof result === 'object' ? JSON.stringify(result) : result}`);
                            sellPrice = result.at(-1).average_price;
                            this.strategyUtils.logStrategyInfo(`Executed Buy Back Sell Price: ${sellPrice}`);
                            
                            // Log the executed order
                            this.strategyUtils.logOrderExecuted('SELL', buyBackInstrument.symbol, sellPrice, this.globalDict.quantity || 75, this.buyBackToken, orderId.order_id);
                            
                            // Calculate P&L for the buy back instrument
                            const buyBackPnL = (sellPrice - this.buyBackPrice) * (this.globalDict.quantity || 75);
                            this.strategyUtils.logStrategyInfo(`Buy back instrument P&L: ${buyBackPnL.toFixed(2)}`);
                            
                            // Calculate total P&L from all trades
                            const soldAt10PnL = (this.instrumentAt10Sell - this.instrumentAt10.buyPrice) * (this.globalDict.quantity || 75);
                            const totalPnL = soldAt10PnL + buyBackPnL;
                            
                            this.strategyUtils.logStrategyInfo(`Total P&L from all trades: ${totalPnL.toFixed(2)} (Sold at -10: ${soldAt10PnL.toFixed(2)}, Buy Back: ${buyBackPnL.toFixed(2)})`);
                        })
                        .catch(error => {
                            this.strategyUtils.logStrategyError(`Error getting buy back sell order history: ${JSON.stringify(error)}`);
                        });
                    }).catch(error => {
                        this.strategyUtils.logStrategyError(`Error getting buy back sell order ID: ${JSON.stringify(error)}`);
                    });
                    
                } else {
                    this.strategyUtils.logOrderFailed('SELL', buyBackInstrument.symbol, buyBackInstrument.last, this.globalDict.quantity || 75, this.buyBackToken, sellOrderResult.error);
                    this.strategyUtils.logStrategyError(`Failed to place market sell order: ${sellOrderResult.error}`);
                }
            } else {
                this.strategyUtils.logStrategyInfo('Trading disabled - simulating buy back sell order');
                this.strategyUtils.logStrategyInfo(`Simulated SELL: ${buyBackInstrument.symbol} @ ${buyBackInstrument.last} x ${this.globalDict.quantity || 75}`);
                
                // For simulation, calculate P&L
                const buyBackPnL = (buyBackInstrument.last - this.buyBackPrice) * (this.globalDict.quantity || 75);
                const soldAt10PnL = (this.instrumentAt10Sell - this.instrumentAt10.buyPrice) * (this.globalDict.quantity || 75);
                const totalPnL = soldAt10PnL + buyBackPnL;
                
                this.strategyUtils.logStrategyInfo(`Simulated P&L - Buy Back: ${buyBackPnL.toFixed(2)}, Total: ${totalPnL.toFixed(2)}`);
                this.strategyUtils.logOrderExecuted('SELL', buyBackInstrument.symbol, buyBackInstrument.last, this.globalDict.quantity || 75, this.buyBackToken, 'SIMULATED');
            }
        } catch (error) {
            this.strategyUtils.logStrategyError(`Error in sellBuyBackAfterStoploss: ${error.message}`);
            console.error('Sell buy back after stoploss error:', error);
        }
    }

    shouldSellAt10() {
        let ce_instrument = this.universalDict.instrumentMap[this.buyToken];
        let pe_instrument = this.universalDict.instrumentMap[this.oppBuyToken];
        return ce_instrument.last - ce_instrument.buyPrice <= this.globalDict.limitAt10 || pe_instrument.last - pe_instrument.buyPrice <= this.globalDict.limitAt10;
    }

    shouldSellRemainingAtTargetAfter10() {
        let other_instrument = this.instrumentAt10 === ce_instrument ? pe_instrument : ce_instrument;
        return other_instrument.last - other_instrument.buyPrice >= this.halfdropAssisstedTarget;
    }

    shouldSellRemainingAtStoplossAfter10(){
        let other_instrument = this.instrumentAt10 === ce_instrument ? pe_instrument : ce_instrument;
        return other_instrument.last - other_instrument.buyPrice <= this.globalDict.stoploss;
    }

    resetForNextCycle() {
        this.strategyUtils.logStrategyInfo('Resetting for next cycle');
        
        // Increment cycle count
        this.universalDict.cycles = (this.universalDict.cycles || 0) + 1;
        this.cycleCount = this.universalDict.cycles;  // Keep cycleCount in sync
        
        // Reset all flags and state
        this.halfdrop_flag = false;
        this.halfdrop_bought = false;
        this.halfdrop_sold = false;
        this.other_bought = false;
        this.other_sold = false;
        this.boughtSold = false;
        this.soldAt10 = false;
        
        // Reset instruments
        this.halfdrop_instrument = null;
        this.other_instrument = null;
        this.mainToken = null;
        this.oppToken = null;
        this.mtmAssisstedTarget = 0;
        this.lossAtFirst = 0;
        this.buyToken = null;
        this.oppBuyToken = null;
        this.instrumentAt10 = null;
        this.instrumentAt10Sell = null;
        this.instrumentAtStoploss = null;
        this.instrumentAtStoplossSell = 0;
        this.halfdropAssisstedTarget = 0;
        this.remainingSellAtTarget = false;
        
        // Reset buy back logic variables
        this.buyBackAfterStoploss = false;
        this.buyBackToken = null;
        this.buyBackPrice = null;
        this.buyBackTarget = null;
        this.soldBuyBackAfterStoploss = false;
        
        // Reset block states
        this.blockInit = true;
        this.blockUpdate = false;  // Should be true to start processing next cycle
        this.blockDiff10 = false;
        this.blockNextCycle = false;
        
        // Reset data structures
        this.universalDict.instrumentMap = {};
        this.universalDict.ceTokens = [];
        this.universalDict.peTokens = [];
        this.universalDict.observedTicks = [];
        
        this.strategyUtils.logStrategyInfo(`Cycle ${this.universalDict.cycles} started`);
        
        // Emit new cycle notification
        this.emitStatusUpdate('New cycle started', {
            newCycle: true,
            cycleNumber: this.universalDict.cycles,
            blockTransition: true,
            fromBlock: 'NEXT_CYCLE',
            toBlock: 'INIT',
            message: `Starting cycle ${this.universalDict.cycles} - resetting for new trading session`
        });
    }

    getConfig() {
        const config = {
            name: this.name,
            description: this.description,
            globalDictParameters: this.getGlobalDictParameters(),
            universalDictParameters: this.getUniversalDictParameters(),
            // Fifty percent specific config
            halfdrop_flag: this.halfdrop_flag,
            halfdrop_bought: this.halfdrop_bought,
            halfdrop_sold: this.halfdrop_sold,
            other_bought: this.other_bought,
            other_sold: this.other_sold,
            boughtSold: this.boughtSold,
            mainToken: this.mainToken,
            oppToken: this.oppToken,
            mtmAssisstedTarget: this.mtmAssisstedTarget,
            lossAtFirst: this.lossAtFirst,
            blockInit: this.blockInit,
            blockUpdate: this.blockUpdate,
            blockDiff10: this.blockDiff10,
            blockNextCycle: this.blockNextCycle,
            // Include universalDict for frontend display
            universalDict: this.universalDict
        };
        
        return config;
    }

    getGlobalDictParameters() {
        return {
            target: {
                type: 'number',
                default: 7,
                description: 'Target profit in points'
            },
            stoploss: {
                type: 'number',
                default: -100,
                description: 'Stop loss in points'
            },
            enableTrading: {
                type: 'boolean',
                default: false,
                description: 'Enable/disable actual trading'
            },
            quantity: {
                type: 'number',
                default: 75,
                description: 'Quantity to trade'
            }
        };
    }

    getUniversalDictParameters() {
        return {
            expiry: {
                type: 'number',
                default: 3,
                description: 'Expiry day (0=Monday, 3=Thursday)'
            }
        };
    }
}

module.exports = FiftyPercentStrategyNew;
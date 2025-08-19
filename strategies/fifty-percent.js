const BaseStrategy = require('./base');
const TradingUtils = require('../utils/tradingUtils');
const StrategyUtils = require('../utils/strategyUtils');

class FiftyPercentStrategy extends BaseStrategy {

    constructor() {
        super();
        this.name = 'Fifty Percent Strategy';
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
        this.mtmAssisstedTarget = 0;
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

        // Strategy counters (missing properties)
        this.tickCount = 0;
        this.cycleCount = 0;
    }
    
    
    setUserInfo(userName, userId) {
        this.strategyUtils.setUserInfo(userName, userId);
        this.strategyUtils.logStrategyInfo(`Fifty Percent Strategy initialized for user: ${userName} (ID: ${userId})`);
    }

    initialize(globalDict, universalDict, blockDict, accessToken) {
        // Call parent initialize method
        super.initialize(globalDict, universalDict, blockDict, accessToken);
        
        console.log('=== Fifty Percent Strategy Initialization ===');
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
        this.mtmAssisstedTarget = 0;
        this.lossAtFirst = 0;

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

        console.log('=== Initialization Complete ===');
    }

    // Override parameter update methods to add debugging
    updateGlobalDictParameter(parameter, value) {
        const success = super.updateGlobalDictParameter(parameter, value);
        
        if (parameter === 'enableTrading') {
            this.strategyUtils.logStrategyInfo(`🔧 Enable Trading Updated: ${value}`);
        }
        
        return success;
    }

    updateUniversalDictParameter(parameter, value) {
        const success = super.updateUniversalDictParameter(parameter, value);
        
        this.strategyUtils.logStrategyInfo(`🔧 Universal Parameter Updated: ${parameter} = ${value}`);
        
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
        this.universalDict.ceTokens = ceTokens.map(token => token.toString());
        this.universalDict.peTokens = peTokens.map(token => token.toString());

        // TEMPORARY FIX: For testing
        // this.universalDict.ceTokens = ["12091138"]
        // this.universalDict.peTokens = ["12087554"]

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
    }    

    processUpdateBlock(ticks) {
        console.log('Processing UPDATE block');
        
        const currentTime = new Date().toISOString();
        this.globalDict.timestamp = currentTime;

        // Initialize or update instrument data for all observed tokens
        for (const tick of ticks) {
            const token = tick.instrument_token.toString();
            
            if (!this.universalDict.observedTicks.includes(Number(token))) {
                continue;
            }

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
            // if (token === "12091138"){
            //     instrument.firstPrice = 110.95
            // }

            // if (token === "12087554"){
            //     instrument.firstPrice = 117.8
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
                }

                if (instrument.buyPrice > -1) {
                    instrument.changeFromBuy = newPrice - instrument.buyPrice;
                }
            }
        }

        if (this.halfdrop_flag) {
            this.blockDiff10 = true;
            this.strategyUtils.logStrategyInfo('Transitioning from UPDATE to DIFF10 block');
        }
    }

    processDiff10Block(ticks) {
        const instrument = this.universalDict.instrumentMap[this.mainToken];
        
        // Add null check for instrument
        if (!instrument) {
            this.strategyUtils.logStrategyError('Cannot process DIFF10 block - halfdrop instrument not found');
            return;
        }
        
        if (!this.halfdrop_bought) {
            this.halfdrop_bought = true;
            instrument.buyPrice = instrument.last;
            this.strategyUtils.logStrategyInfo(`BUY HALF DROP: ${instrument.symbol} at ${instrument.last}`);

            this.placeOrdersForTokens();
        }

        if (this.halfdrop_bought && !this.halfdrop_sold) {
            const change = instrument.last - instrument.buyPrice;
            if (change >= this.globalDict.target) {
                this.halfdrop_sold = true;
                this.boughtSold = true;
                this.strategyUtils.logStrategyInfo(`SELL HALF DROP: ${instrument.symbol} at ${instrument.last} AS TARGET OF ${this.globalDict.target} REACHED`);
                this.sellOptions();
            }
            else if (change <= this.globalDict.stoploss) {
                this.halfdrop_sold = true;
                this.strategyUtils.logStrategyInfo(`SELL HALF DROP: ${instrument.symbol} at ${instrument.last} AS STOPLOSS OF ${this.globalDict.stoploss} REACHED`);
                this.sellOptions();
            }
        }

        if (this.halfdrop_sold && !this.boughtSold && !this.other_bought) {
            this.other_bought = true;
            
            let insType = instrument.symbol.includes('CE') ? 'PE' : 'CE';
            if (insType === 'CE') {
                this.other_instrument = this.strategyUtils.findClosestCEBelowPrice(
                    this.universalDict.instrumentMap, 
                    200, 
                    200
                );
            } else {
                this.other_instrument = this.strategyUtils.findClosestPEBelowPrice(
                    this.universalDict.instrumentMap, 
                    200, 
                    200
                );
            }

            // Add null check for other_instrument
            if (!this.other_instrument) {
                this.strategyUtils.logStrategyError(`Cannot find suitable ${insType} instrument for opposite trading`);
                this.boughtSold = true; // End cycle if no opposite instrument found
                return;
            }

            this.oppToken = this.other_instrument.token.toString();
            let other_ins = this.universalDict.instrumentMap[this.oppToken];
            
            // Add null check for other_ins
            if (!other_ins) {
                this.strategyUtils.logStrategyError('Cannot find other instrument data in instrumentMap');
                this.boughtSold = true; // End cycle if instrument data not found
                return;
            }
            
            other_ins.buyPrice = other_ins.last;
            this.mtmAssisstedTarget = this.globalDict.target - this.lossAtFirst;
            this.strategyUtils.logStrategyInfo(`BUY OTHER: ${other_ins.symbol} at ${other_ins.last}`);
            this.buyOtherOptions();
        }

        if (this.other_bought && !this.other_sold && !this.boughtSold) {
            let other_ins = this.universalDict.instrumentMap[this.oppToken];
            
            // Add null check for other_ins
            if (!other_ins) {
                this.strategyUtils.logStrategyError('Cannot find other instrument data for selling check');
                this.boughtSold = true; // End cycle if instrument data not found
                return;
            }
            
            const change = other_ins.last - other_ins.buyPrice;
            if (change >= this.mtmAssisstedTarget) {
                this.other_sold = true;
                this.boughtSold = true;
                this.strategyUtils.logStrategyInfo(`SELL OTHER: ${other_ins.symbol} at ${other_ins.last} AS TARGET OF ${this.mtmAssisstedTarget} REACHED`);
                this.sellOtherOptions();
            }
            else if (change <= this.globalDict.stoploss) {
                this.other_sold = true;
                this.boughtSold = true;
                this.strategyUtils.logStrategyInfo(`SELL OTHER: ${other_ins.symbol} at ${other_ins.last} AS STOPLOSS OF ${this.globalDict.stoploss} REACHED`);
                this.sellOtherOptions();
            }

        }

        if (this.boughtSold) {
            this.blockDiff10 = false;
            this.blockNextCycle = true;
            this.strategyUtils.logStrategyInfo('Transitioning from DIFF10 to NEXT CYCLE block');
        }
    }

    processNextCycleBlock(ticks) {
        // Reset for next cycle
        this.resetForNextCycle();
        this.cycleCount++;
        this.strategyUtils.logStrategyInfo('Transitioning from NEXT CYCLE to INIT block');
    }

    placeOrdersForTokens() {
        if (!this.halfdrop_instrument) {
            this.strategyUtils.logStrategyError('Cannot place orders - halfdrop_instrument not set');
            return;
        }

        const instrument = this.halfdrop_instrument;
        
        if (!instrument) {
            this.strategyUtils.logStrategyError('Cannot place orders - instrument data not found');
            return;
        }

        this.strategyUtils.logStrategyInfo('Placing order for fifty percent strategy token');
        this.strategyUtils.logStrategyInfo(`Token: ${instrument.symbol} @ ${instrument.last}`);

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
                } else {
                    this.strategyUtils.logStrategyError(`Failed to place buy order for ${instrument.symbol}: ${buyOrderResult.error}`);
                    this.strategyUtils.logOrderFailed('buy', instrument.symbol, instrument.last, this.globalDict.quantity || 75, instrument.token, buyOrderResult.error);
                }
            } else {
                // Paper trading - log the order without placing it
                this.strategyUtils.logStrategyInfo(`PAPER TRADING: Buy order for ${instrument.symbol} @ ${instrument.last}`);
                this.strategyUtils.logOrderPlaced('buy', instrument.symbol, instrument.last, this.globalDict.quantity || 75, instrument.token);
            }

            // Update instrument buy price
            instrument.buyPrice = instrument.last;

            this.strategyUtils.logStrategyInfo('Order placed successfully for fifty percent strategy');
            this.strategyUtils.logStrategyInfo(`Investment: ${instrument.last * (this.globalDict.quantity || 75)}`);

        } catch (error) {
            this.strategyUtils.logStrategyError(`Exception while placing order: ${error.message}`);
        }
    }

    sellOptions() {
        if (!this.halfdrop_instrument) {
            this.strategyUtils.logStrategyError('Cannot sell - halfdrop_instrument not set');
            return;
        }

        const instrument = this.halfdrop_instrument;
        
        if (!instrument) {
            this.strategyUtils.logStrategyError('Cannot sell - instrument data not found');
            return;
        }

        this.strategyUtils.logStrategyInfo(`Selling ${instrument.symbol} @ ${instrument.last}`);

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
                // Place sell order - synchronous
                const sellResult = tradingUtils.placeSellOrder(
                    instrument.symbol,
                    instrument.last,
                    this.globalDict.quantity || 75
                );

                if (sellResult.success) {
                    this.strategyUtils.logStrategyInfo(`Sell order placed for ${instrument.symbol}`);
                    this.strategyUtils.logOrderPlaced('sell', instrument.symbol, instrument.last, this.globalDict.quantity || 75, instrument.token);
                } else {
                    this.strategyUtils.logStrategyError(`Failed to place sell order for ${instrument.symbol}: ${sellResult.error}`);
                    this.strategyUtils.logOrderFailed('sell', instrument.symbol, instrument.last, this.globalDict.quantity || 75, instrument.token, sellResult.error);
                }
            } else {
                // Paper trading - log the order without placing it
                this.strategyUtils.logStrategyInfo(`PAPER TRADING: Sell order for ${instrument.symbol} @ ${instrument.last}`);
                this.strategyUtils.logOrderPlaced('sell', instrument.symbol, instrument.last, this.globalDict.quantity || 75, instrument.token);
            }

            // Calculate and log P&L
            const pnL = (instrument.last - instrument.buyPrice) * (this.globalDict.quantity || 75);
            this.strategyUtils.logStrategyInfo(`P&L: ${pnL.toFixed(2)}`);
            
            // Store loss for assisted target calculation
            if (pnL < 0) {
                this.lossAtFirst = Math.abs(pnL);
            }

        } catch (error) {
            this.strategyUtils.logStrategyError(`Exception while selling: ${error.message}`);
        }
    }

    buyOtherOptions() {
        if (!this.other_instrument) {
            this.strategyUtils.logStrategyError('Cannot buy other - other_instrument not set');
            return;
        }

        const instrument = this.other_instrument;
        
        if (!instrument) {
            this.strategyUtils.logStrategyError('Cannot buy other - instrument data not found');
            return;
        }

        this.strategyUtils.logStrategyInfo(`Buying other ${instrument.symbol} @ ${instrument.last}`);

        // Check if trading is enabled
        const tradingEnabled = this.globalDict.enableTrading === true;
        this.strategyUtils.logStrategyInfo(`Trading enabled: ${tradingEnabled}`);

        // CRITICAL FIX: Ensure TradingUtils is available before proceeding
        if (!this.tradingUtils) {
            this.strategyUtils.logStrategyError('CRITICAL ERROR: TradingUtils not available - cannot place buy orders');
            this.strategyUtils.logStrategyError('This usually indicates a timing issue with TradingUtils injection');
            return;
        }

        // Use the injected TradingUtils instance
        const tradingUtils = this.tradingUtils;

        try {
            if (tradingEnabled) {
                // Place buy order - synchronous
                const buyResult = tradingUtils.placeBuyOrder(
                    instrument.symbol,
                    instrument.last,
                    this.globalDict.quantity || 75
                );

                if (buyResult.success) {
                    this.strategyUtils.logStrategyInfo(`Buy order placed for ${instrument.symbol}`);
                    this.strategyUtils.logOrderPlaced('buy', instrument.symbol, instrument.last, this.globalDict.quantity || 75, instrument.token);
                } else {
                    this.strategyUtils.logStrategyError(`Failed to place buy order for ${instrument.symbol}: ${buyResult.error}`);
                    this.strategyUtils.logOrderFailed('buy', instrument.symbol, instrument.last, this.globalDict.quantity || 75, instrument.token, buyResult.error);
                }
            } else {
                // Paper trading - log the order without placing it
                this.strategyUtils.logStrategyInfo(`PAPER TRADING: Buy order for ${instrument.symbol} @ ${instrument.last}`);
                this.strategyUtils.logOrderPlaced('buy', instrument.symbol, instrument.last, this.globalDict.quantity || 75, instrument.token);
            }

        } catch (error) {
            this.strategyUtils.logStrategyError(`Exception while buying other: ${error.message}`);
        }
    }

    sellOtherOptions() {
        if (!this.other_instrument) {
            this.strategyUtils.logStrategyError('Cannot sell other - other_instrument not set');
            return;
        }

        const instrument = this.other_instrument;
        
        if (!instrument) {
            this.strategyUtils.logStrategyError('Cannot sell other - instrument data not found');
            return;
        }

        this.strategyUtils.logStrategyInfo(`Selling other ${instrument.symbol} @ ${instrument.last}`);

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
                // Place sell order - synchronous
                const sellResult = tradingUtils.placeSellOrder(
                    instrument.symbol,
                    instrument.last,
                    this.globalDict.quantity || 75
                );

                if (sellResult.success) {
                    this.strategyUtils.logStrategyInfo(`Sell order placed for ${instrument.symbol}`);
                    this.strategyUtils.logOrderPlaced('sell', instrument.symbol, instrument.last, this.globalDict.quantity || 75, instrument.token);
                } else {
                    this.strategyUtils.logStrategyError(`Failed to place sell order for ${instrument.symbol}: ${sellResult.error}`);
                    this.strategyUtils.logOrderFailed('sell', instrument.symbol, instrument.last, this.globalDict.quantity || 75, instrument.token, sellResult.error);
                }
            } else {
                // Paper trading - log the order without placing it
                this.strategyUtils.logStrategyInfo(`PAPER TRADING: Sell order for ${instrument.symbol} @ ${instrument.last}`);
                this.strategyUtils.logOrderPlaced('sell', instrument.symbol, instrument.last, this.globalDict.quantity || 75, instrument.token);
            }

            // Calculate and log P&L
            const pnL = (instrument.last - instrument.buyPrice) * (this.globalDict.quantity || 75);
            const totalPnL = pnL - this.lossAtFirst; // Account for previous loss
            this.strategyUtils.logStrategyInfo(`Other P&L: ${pnL.toFixed(2)}, Total P&L: ${totalPnL.toFixed(2)}`);

        } catch (error) {
            this.strategyUtils.logStrategyError(`Exception while selling other: ${error.message}`);
        }
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
        
        // Reset instruments
        this.halfdrop_instrument = null;
        this.other_instrument = null;
        this.mainToken = null;
        this.oppToken = null;
        this.mtmAssisstedTarget = 0;
        this.lossAtFirst = 0;
        
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

module.exports = FiftyPercentStrategy;

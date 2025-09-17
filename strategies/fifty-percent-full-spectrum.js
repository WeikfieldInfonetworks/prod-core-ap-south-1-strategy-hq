const BaseStrategy = require('./base');
const TradingUtils = require('../utils/tradingUtils');
const StrategyUtils = require('../utils/strategyUtils');

class FiftyPercentFullSpectrum extends BaseStrategy {

    constructor() {
        super();
        this.name = 'Fifty Percent Full Spectrum';
        this.description = 'Fifty percent strategy with full spectrum of tokens';
        this.strategyUtils = new StrategyUtils();
        this.tickCount = 0;
        this.cycleCount = 0;
        
        //State Variables
        this.acceptedTokens = null;
        this.mainToken = null;
        this.oppToken = null;
        this.halfdrop_instrument = null;
        this.other_instrument = null;
        this.buyToken = null;
        this.oppBuyToken = null;
        

        // Block states
        this.blockInit = true;
        this.blockUpdate = true;
        this.blockDiff10 = false;
        this.blockNextCycle = false;

        // Flags
        this.boughtSold = false;
        this.halfdrop_flag = false;
        this.stoplossHit = false;
        this.instrument_bought = null;

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
        this.boughtSold = false;
        this.halfdrop_flag = false;
        this.stoplossHit = false;
        this.instrument_bought = null;
        
        // Additional Full Spectrum properties (only relevant ones)
        this.halfdrop_bought = false;
        this.buyToken = null;
        this.oppBuyToken = null;

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
                await this.processInitBlock(ticks);
            }

            if (this.blockUpdate) {
                await this.processUpdateBlock(ticks);
            }

            if (this.blockDiff10) {
               await this.processDiff10Block(ticks);
            }

            if (this.blockNextCycle) {
                await this.processNextCycleBlock(ticks);
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
        if (this.universalDict.cycles >= this.universalDict.skipAfterCycles) {
            this.universalDict.enableTrading = false;
        }

        // Set strike base and diff based on weekday
        const today = new Date().getDay();
        const expiryDay = parseInt(this.universalDict.expiry || 3);
        
        if (today === expiryDay) {
            this.universalDict.strikeBase = 20;
            this.universalDict.strikeDiff = 80;
            this.universalDict.strikeLowest = 20;
        } else if (today === expiryDay - 1) {
            this.universalDict.strikeBase = 20;
            this.universalDict.strikeDiff = 80;
            this.universalDict.strikeLowest = 20;
        } else {
            this.universalDict.strikeBase = 20;
            this.universalDict.strikeDiff = 80;
            this.universalDict.strikeLowest = 20;
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
        // this.universalDict.ceTokens = ["10388226"]
        // this.universalDict.peTokens = ["10390018"]

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
            halfdrop_bought: this.halfdrop_bought,
            buyToken: this.buyToken,
            oppBuyToken: this.oppBuyToken,
            // Add main and opp tokens for Full Spectrum tracking
            mainToken: this.mainToken,
            oppToken: this.oppToken,
            stoplossHit: this.stoplossHit,
            instrument_bought: this.instrument_bought,
            boughtSold: this.boughtSold,
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
            // if (token === "10390018"){
            //     instrument.firstPrice = 113.35
            // }

            // if (token === "10388226"){
            //     instrument.firstPrice = 116.85
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

                if (instrument.lowAtRef <= instrument.firstPrice*this.globalDict.dropThreshold && !this.halfdrop_flag) {
                    this.halfdrop_flag = true;
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
                    //GET CALL AND PUT INSTRUMENTS UNDER 200
                    this.mainToken = this.strategyUtils.findClosestCEBelowPrice(this.universalDict.instrumentMap, 200, 200).token.toString();
                    this.oppToken = this.strategyUtils.findClosestPEBelowPrice(this.universalDict.instrumentMap, 200, 200).token.toString();
                }

                if (instrument.buyPrice > -1) {
                    instrument.changeFromBuy = newPrice - instrument.buyPrice;
                }
            }
        }

        if (this.halfdrop_flag && !this.blockDiff10) {
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

    async processDiff10Block(ticks) {  
        if (this.mainToken && this.oppToken) {
            let ceInstrument = this.universalDict.instrumentMap[this.mainToken];
            let peInstrument = this.universalDict.instrumentMap[this.oppToken];
            if (ceInstrument.buyPrice === -1) {
                this.strategyUtils.logStrategyInfo(`TRACKING CE: ${ceInstrument.symbol} at ${ceInstrument.last}`);
                ceInstrument.buyPrice = ceInstrument.last;
            }
            if (peInstrument.buyPrice === -1) {
                this.strategyUtils.logStrategyInfo(`TRACKING PE: ${peInstrument.symbol} at ${peInstrument.last}`);
                peInstrument.buyPrice = peInstrument.last;
            }
            
            let ce_change = ceInstrument.last - ceInstrument.buyPrice;
            let pe_change = peInstrument.last - peInstrument.buyPrice;

            if(!this.stoplossHit) {
                console.log(`PREBUY | CE CHANGE: ${ce_change} PE CHANGE: ${pe_change}`);
                this.stoplossHit = ce_change <= this.globalDict.prebuyStoploss || pe_change <= this.globalDict.prebuyStoploss;
            }
            
            if(this.stoplossHit && !this.instrument_bought) {
                let instrument = ce_change <= this.globalDict.prebuyStoploss ? peInstrument : ceInstrument;
                let otherInstrument = ce_change <= this.globalDict.prebuyStoploss ? ceInstrument : peInstrument;
                this.strategyUtils.logStrategyInfo(`STOPLOSS HIT: ${otherInstrument.symbol} at ${otherInstrument.last}`);
                this.strategyUtils.logStrategyInfo(`BUYING ${instrument.symbol} at ${instrument.last}`);
                this.instrument_bought = instrument;
                
                // Set tracking flags for dashboard
                this.halfdrop_bought = true;
                if (instrument === peInstrument) {
                    // We're buying the PE token, so set it as the bought token
                    this.buyToken = this.oppToken; // PE token (the one we're buying)
                    this.oppBuyToken = this.mainToken; // CE token (not bought)
                } else {
                    // We're buying the CE token, so set it as the bought token
                    this.buyToken = this.mainToken; // CE token (the one we're buying)  
                    this.oppBuyToken = this.oppToken; // PE token (not bought)
                }
                
                //BUYING LOGIC - Buy the instrument
                try {
                    const buyResult = await this.buyInstrument(instrument);
                    if (buyResult && buyResult.success) {
                        this.strategyUtils.logStrategyInfo(`Instrument bought - Executed price: ${buyResult.executedPrice}`);
                    }
                }
                catch (error) {
                    this.strategyUtils.logStrategyError(`Error buying instrument: ${error.message}`);
                }
            }

            if(this.instrument_bought) {
                let instrument = this.universalDict.instrumentMap[this.instrument_bought.token];
                const change = instrument.last - instrument.buyPrice;
                console.log(`CHANGE: ${change} TARGET: ${this.globalDict.target}`);
                if(change >= this.globalDict.target) {
                    this.boughtSold = true;
                    this.strategyUtils.logStrategyInfo(`SELLING ${instrument.symbol} at ${instrument.last} AS TARGET OF ${this.globalDict.target} REACHED`);
                    // SELLING LOGIC - Sell the instrument
                    try {
                        const sellResult = await this.sellInstrument(instrument);
                        if (sellResult && sellResult.success) {
                            this.strategyUtils.logStrategyInfo(`Instrument sold - Executed price: ${sellResult.executedPrice}`);
                        }
                    }
                    catch (error) {
                        this.strategyUtils.logStrategyError(`Error selling instrument: ${error.message}`);
                    }
                }
            }
            
            if(this.boughtSold) {
                this.blockDiff10 = false;
                this.blockNextCycle = true;
                this.strategyUtils.logStrategyInfo('Transitioning from DIFF10 to NEXT CYCLE block');
            }
        }
    }

    processNextCycleBlock() {
        this.resetForNextCycle();
        this.blockNextCycle = false;
        this.blockInit = true;
        this.strategyUtils.logStrategyInfo('Transitioning from NEXT CYCLE to INIT block');
        
        // Emit cycle restart notification
        this.emitStatusUpdate('New cycle started', {
            fromBlock: 'NEXT_CYCLE',
            toBlock: 'INIT',
            cycleNumber: this.universalDict.cycles || 0,
            cycleReset: true,
            blockTransition: true,
            message: `Starting cycle ${this.universalDict.cycles || 0}`
        });
    }

    resetForNextCycle() {
        this.strategyUtils.logStrategyInfo('Resetting for next cycle');
        
        // Increment cycle count
        this.universalDict.cycles = (this.universalDict.cycles || 0) + 1;
        this.cycleCount = this.universalDict.cycles;  // Keep cycleCount in sync
        
        // Reset all flags and state
        this.boughtSold = false;
        this.halfdrop_flag = false;
        this.stoplossHit = false;
        this.instrument_bought = null;
        
        // Reset additional Full Spectrum properties
        this.halfdrop_bought = false;
        this.buyToken = null;
        this.oppBuyToken = null;

        // Reset instruments
        this.halfdrop_instrument = null;
        this.other_instrument = null;
        this.mainToken = null;
        this.oppToken = null;
        
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
    
    async sellBothInstruments(instrument1, instrument2) {
        this.strategyUtils.logStrategyInfo('Selling both instruments at target/stoploss');
        
        // Check if trading is enabled
        const tradingEnabled = this.globalDict.enableTrading;
        
        // Ensure TradingUtils is available
        if (!this.tradingUtils) {
            this.strategyUtils.logStrategyError('CRITICAL ERROR: TradingUtils not available for selling both instruments');
            return { success: false, executedPrices: null };
        }

        const tradingUtils = this.tradingUtils;
        const executedPrices = { instrument1: instrument1.last, instrument2: instrument2.last };

        try {
            if (tradingEnabled) {
                // Place sell orders for both instruments
                const sellResult1 = tradingUtils.placeMarketSellOrder(
                    instrument1.symbol,
                    instrument1.last,
                    this.globalDict.quantity || 75
                );

                const sellResult2 = tradingUtils.placeMarketSellOrder(
                    instrument2.symbol,
                    instrument2.last,
                    this.globalDict.quantity || 75
                );

                if (sellResult1.success) {
                    this.strategyUtils.logStrategyInfo(`Sell order placed for ${instrument1.symbol}`);
                    this.strategyUtils.logOrderPlaced('sell', instrument1.symbol, instrument1.last, this.globalDict.quantity || 75, instrument1.token);
                    
                    // Emit trade action for dashboard
                    this.emitTradeAction('sell', {
                        symbol: instrument1.symbol,
                        price: instrument1.last,
                        quantity: this.globalDict.quantity || 75
                    });
                    
                    // Get order history for executed price
                    try {
                        const orderId1 = await sellResult1.orderId;
                        this.strategyUtils.logStrategyInfo(`Order ID: ${orderId1.order_id}`);
                        const result1 = await tradingUtils.getOrderHistory(orderId1.order_id);
                        this.strategyUtils.logStrategyInfo(`Order history: ${typeof result1 === 'object' ? JSON.stringify(result1) : result1}`);
                        executedPrices.instrument1 = result1.at(-1).average_price;
                        this.strategyUtils.logStrategyInfo(`Executed Price: ${executedPrices.instrument1}`);
                    } catch (error) {
                        this.strategyUtils.logStrategyError(`Error getting order history: ${JSON.stringify(error)}`);
                        executedPrices.instrument1 = instrument1.last; // Fallback to current price
                    }
                } else {
                    this.strategyUtils.logStrategyError(`Failed to place sell order for ${instrument1.symbol}: ${sellResult1.error}`);
                }

                if (sellResult2.success) {
                    this.strategyUtils.logStrategyInfo(`Sell order placed for ${instrument2.symbol}`);
                    this.strategyUtils.logOrderPlaced('sell', instrument2.symbol, instrument2.last, this.globalDict.quantity || 75, instrument2.token);
                    
                    // Emit trade action for dashboard
                    this.emitTradeAction('sell', {
                        symbol: instrument2.symbol,
                        price: instrument2.last,
                        quantity: this.globalDict.quantity || 75
                    });
                    
                    // Get order history for executed price
                    try {
                        const orderId2 = await sellResult2.orderId;
                        this.strategyUtils.logStrategyInfo(`Order ID: ${orderId2.order_id}`);
                        const result2 = await tradingUtils.getOrderHistory(orderId2.order_id);
                        this.strategyUtils.logStrategyInfo(`Order history: ${typeof result2 === 'object' ? JSON.stringify(result2) : result2}`);
                        executedPrices.instrument2 = result2.at(-1).average_price;
                        this.strategyUtils.logStrategyInfo(`Executed Price: ${executedPrices.instrument2}`);
                    } catch (error) {
                        this.strategyUtils.logStrategyError(`Error getting order history: ${JSON.stringify(error)}`);
                        executedPrices.instrument2 = instrument2.last; // Fallback to current price
                    }
                } else {
                    this.strategyUtils.logStrategyError(`Failed to place sell order for ${instrument2.symbol}: ${sellResult2.error}`);
                }
            } else {
                // Paper trading
                this.strategyUtils.logStrategyInfo(`PAPER TRADING: Sell order for ${instrument1.symbol} @ ${instrument1.last}`);
                this.strategyUtils.logStrategyInfo(`PAPER TRADING: Sell order for ${instrument2.symbol} @ ${instrument2.last}`);
                this.strategyUtils.logOrderPlaced('sell', instrument1.symbol, instrument1.last, this.globalDict.quantity || 75, instrument1.token);
                this.strategyUtils.logOrderPlaced('sell', instrument2.symbol, instrument2.last, this.globalDict.quantity || 75, instrument2.token);
                
                // Emit trade actions for dashboard (paper trading)
                this.emitTradeAction('sell', {
                    symbol: instrument1.symbol,
                    price: instrument1.last,
                    quantity: this.globalDict.quantity || 75
                });
                this.emitTradeAction('sell', {
                    symbol: instrument2.symbol,
                    price: instrument2.last,
                    quantity: this.globalDict.quantity || 75
                });
                
                executedPrices.instrument1 = instrument1.last;
                executedPrices.instrument2 = instrument2.last;
            }
            
            return { success: true, executedPrices };
        } catch (error) {
            this.strategyUtils.logStrategyError(`Exception while selling both instruments: ${error.message}`);
            return { success: false, executedPrices: null };
        }
    }

    // Helper method to sell a single instrument
    async sellInstrument(instrument) {
        this.strategyUtils.logStrategyInfo(`Selling instrument: ${instrument.symbol}`);
        
        // Check if trading is enabled
        const tradingEnabled = this.globalDict.enableTrading;
        
        // Ensure TradingUtils is available
        if (!this.tradingUtils) {
            this.strategyUtils.logStrategyError('CRITICAL ERROR: TradingUtils not available for selling instrument');
            return { success: false, executedPrice: null };
        }

        const tradingUtils = this.tradingUtils;
        let executedPrice = instrument.last;

        try {
            if (tradingEnabled) {
                // Place sell order for the instrument
                const sellResult = tradingUtils.placeMarketSellOrder(
                    instrument.symbol,
                    instrument.last,
                    this.globalDict.quantity || 75
                );

                if (sellResult.success) {
                    this.strategyUtils.logStrategyInfo(`Sell order placed for ${instrument.symbol}`);
                    this.strategyUtils.logOrderPlaced('sell', instrument.symbol, instrument.last, this.globalDict.quantity || 75, instrument.token);
                    
                    // Emit trade action for dashboard
                    this.emitTradeAction('sell', {
                        symbol: instrument.symbol,
                        price: instrument.last,
                        quantity: this.globalDict.quantity || 75
                    });
                    
                    // Get order history for executed price
                    try {
                        const orderId = await sellResult.orderId;
                        this.strategyUtils.logStrategyInfo(`Order ID: ${orderId.order_id}`);
                        const result = await tradingUtils.getOrderHistory(orderId.order_id);
                        this.strategyUtils.logStrategyInfo(`Order history: ${typeof result === 'object' ? JSON.stringify(result) : result}`);
                        executedPrice = result.at(-1).average_price;
                        this.strategyUtils.logStrategyInfo(`Executed Price: ${executedPrice}`);
                    } catch (error) {
                        this.strategyUtils.logStrategyError(`Error getting order history: ${JSON.stringify(error)}`);
                        executedPrice = instrument.last; // Fallback to current price
                    }
                } else {
                    this.strategyUtils.logStrategyError(`Failed to place sell order for ${instrument.symbol}: ${sellResult.error}`);
                    this.strategyUtils.logOrderFailed('sell', instrument.symbol, instrument.last, this.globalDict.quantity || 75, instrument.token, sellResult.error);
                }
            } else {
                // Paper trading
                this.strategyUtils.logStrategyInfo(`PAPER TRADING: Sell order for ${instrument.symbol} @ ${instrument.last}`);
                this.strategyUtils.logOrderPlaced('sell', instrument.symbol, instrument.last, this.globalDict.quantity || 75, instrument.token);
                
                // Emit trade action for dashboard (paper trading)
                this.emitTradeAction('sell', {
                    symbol: instrument.symbol,
                    price: instrument.last,
                    quantity: this.globalDict.quantity || 75
                });
                
                executedPrice = instrument.last;
            }
            
            return { success: true, executedPrice };
        } catch (error) {
            this.strategyUtils.logStrategyError(`Exception while selling instrument: ${error.message}`);
            return { success: false, executedPrice: null };
        }
    }

    // Helper method to buy a single instrument
    async buyInstrument(instrument) {
        this.strategyUtils.logStrategyInfo(`Buying instrument: ${instrument.symbol}`);
        
        // Check if trading is enabled
        const tradingEnabled = this.globalDict.enableTrading;
        
        // Ensure TradingUtils is available
        if (!this.tradingUtils) {
            this.strategyUtils.logStrategyError('CRITICAL ERROR: TradingUtils not available for buying instrument');
            return { success: false, executedPrice: null };
        }

        const tradingUtils = this.tradingUtils;
        let executedPrice = instrument.last;

        try {
            if (tradingEnabled) {
                // Place buy order for the instrument
                const buyResult = tradingUtils.placeBuyOrder(
                    instrument.symbol,
                    instrument.last,
                    this.globalDict.quantity || 75
                );

                if (buyResult.success) {
                    this.strategyUtils.logStrategyInfo(`Buy order placed for ${instrument.symbol}`);
                    this.strategyUtils.logOrderPlaced('buy', instrument.symbol, instrument.last, this.globalDict.quantity || 75, instrument.token);
                    
                    // Emit trade action for dashboard
                    this.emitTradeAction('buy', {
                        symbol: instrument.symbol,
                        price: instrument.last,
                        quantity: this.globalDict.quantity || 75
                    });
                    
                    // Get order history for executed price and update buy price
                    try {
                        const orderId = await buyResult.orderId;
                        this.strategyUtils.logStrategyInfo(`Order ID: ${orderId.order_id}`);
                        const result = await tradingUtils.getOrderHistory(orderId.order_id);
                        this.strategyUtils.logStrategyInfo(`Order history: ${typeof result === 'object' ? JSON.stringify(result) : result}`);
                        executedPrice = result.at(-1).average_price;
                        this.strategyUtils.logStrategyInfo(`Executed Price: ${executedPrice}`);
                        // Update buy price with executed price
                        instrument.buyPrice = executedPrice != 0 ? executedPrice : instrument.last;
                        this.strategyUtils.logStrategyInfo(`Buy Instrument Buy Price: ${instrument.buyPrice}`);
                    } catch (error) {
                        this.strategyUtils.logStrategyError(`Error getting order history: ${JSON.stringify(error)}`);
                        // Fallback to current price if order history fails
                        executedPrice = instrument.last;
                        instrument.buyPrice = instrument.last;
                    }
                } else {
                    this.strategyUtils.logStrategyError(`Failed to place buy order for ${instrument.symbol}: ${buyResult.error}`);
                    this.strategyUtils.logOrderFailed('buy', instrument.symbol, instrument.last, this.globalDict.quantity || 75, instrument.token, buyResult.error);
                }
            } else {
                // Paper trading
                this.strategyUtils.logStrategyInfo(`PAPER TRADING: Buy order for ${instrument.symbol} @ ${instrument.last}`);
                this.strategyUtils.logOrderPlaced('buy', instrument.symbol, instrument.last, this.globalDict.quantity || 75, instrument.token);
                
                // Emit trade action for dashboard (paper trading)
                this.emitTradeAction('buy', {
                    symbol: instrument.symbol,
                    price: instrument.last,
                    quantity: this.globalDict.quantity || 75
                });
                
                // Update buy price for paper trading
                executedPrice = instrument.last;
                instrument.buyPrice = instrument.last;
            }
            
            return { success: true, executedPrice };
        } catch (error) {
            this.strategyUtils.logStrategyError(`Exception while buying instrument: ${error.message}`);
            return { success: false, executedPrice: null };
        }
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
                default: 12,
                description: 'Target profit in points'
            },
            stoploss: {
                type: 'number',
                default: -5,
                description: 'Stop loss in points'
            },
            enableTrading: {
                type: 'boolean',
                default: false,
                description: 'Enable/disable actual trading'
            },
            dropThreshold: {
                type: 'number',
                default: 0.5,
                description: 'Drop threshold in percentage'
            },
            prebuyStoploss: {
                type: 'number',
                default: -15,
                description: 'Prebuy stoploss in points'
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
                default: 1,
                description: 'Expiry day (0=Monday, 3=Thursday)'
            },
            skipAfterCycles: {
                type: 'number',
                default: 1,
                description: 'Skip buying after this many cycles'
            }
        };
    }
}

module.exports = FiftyPercentFullSpectrum;
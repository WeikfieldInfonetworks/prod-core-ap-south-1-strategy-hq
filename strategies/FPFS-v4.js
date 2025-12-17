const BaseStrategy = require('./base');
const TradingUtils = require('../utils/tradingUtils');
const StrategyUtils = require('../utils/strategyUtils');
const fs = require('fs');

class FPFSV4 extends BaseStrategy {

    constructor() {
        super();
        this.name = 'Fifty Percent Full Spectrum V4';
        this.description = 'Fifty percent strategy with full spectrum of tokens';
        this.strategyUtils = new StrategyUtils();
        this.tickCount = 0;
        this.cycleCount = 1;
        
        //State Variables
        this.acceptedTokens = null;
        this.mainToken = null;
        this.oppToken = null;
        this.halfdrop_instrument = null;
        this.other_instrument = null;
        this.buyToken = null;
        this.oppBuyToken = null;
        this.modeState = {};
        this.manuallyAddedInstruments = [];
        this.manuallyAddedInstrumentsFirstPrices = [];
        this.buyPriceOnce = 0;
        this.buyPriceTwice = 0;
        this.rebuyDone = false;
        this.rebuyPrice = 0;
        this.rebuyAveragePrice = 0;
        this.flagSet = {
            reached_rebuy_price: false,
            reached_average_price: false
        }
        this.droppedBelowSignificantThreshold = false;
        this.reachedHalfTarget = false;
        this.realBuyStoplossHit = false;
        this.savedState = {};
        this.secondBought = false;
        this.finalStoplossHit = false;
        this.finalBought = false;
        this.isExpiryDay = false;
        this.targetNet = false;
        this.firstCycleRebuyHit = false;
        this.firstCycleStoplossHit = false;
        this.secondCycleRebuyHit = false;
        // this.plus7reached = false;
        // Timestamp storage for trading actions
        this.buyTimestamp = null;
        this.rebuyTimestamp = null;
        this.scenario1Adone = false;
        this.scenario1AAdone = false;
        this.scenario1ABdone = false;
        this.scenario1Bdone = false;
        this.scenario1Cdone = false;
        this.scenario1CAdone = false;
        this.thirdBought = false;
        this.prebuyBuyPriceTwice = 0;
        this.prebuyLowTrackingPrice = 0;
        this.lowestCEToken = null;
        this.lowestPEToken = null;
        this.firstPriceMap = {};

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
        this.cycleCount = 1;
    }

    setUserInfo(userName, userId) {
        this.strategyUtils.setUserInfo(userName, userId);
        this.strategyUtils.logStrategyInfo(`Fifty Percent Strategy v3 initialized for user: ${userName} (ID: ${userId})`);
    }

    initialize(globalDict, universalDict, blockDict, accessToken) {
        // Call parent initialize method
        super.initialize(globalDict, universalDict, blockDict, accessToken);
        
        console.log('=== Fifty Percent Strategy v3 Initialization ===');
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
        this.halfdrop_instrument = null;
        this.buyToken = null;
        this.oppBuyToken = null;
        this.modeState = {};
        this.manuallyAddedInstruments = [];
        this.manuallyAddedInstrumentsFirstPrices = [];
        this.buyPriceOnce = 0;
        this.buyPriceTwice = 0;
        this.rebuyDone = false;
        this.rebuyPrice = 0;
        this.rebuyAveragePrice = 0;
        this.flagSet = {
            reached_rebuy_price: false,
            reached_average_price: false
        }
        this.droppedBelowSignificantThreshold = false;
        this.reachedHalfTarget = false;
        this.realBuyStoplossHit = false;
        this.savedState = {};
        this.secondBought = false;
        this.finalBought = false;
        this.finalStoplossHit = false;
        this.isExpiryDay = false;
        this.targetNet = false;
        this.firstCycleRebuyHit = false;
        this.firstCycleStoplossHit = false;
        this.secondCycleRebuyHit = false;
        this.scenario1Adone = false;
        this.scenario1Bdone = false;
        this.scenario1AAdone = false;
        this.scenario1ABdone = false;
        this.scenario1Cdone = false;
        this.scenario1CAdone = false;
        this.thirdBought = false;
        this.prebuyBuyPriceTwice = 0;
        this.prebuyLowTrackingPrice = 0;
        this.lowestCEToken = null;
        this.lowestPEToken = null;
        this.firstPriceMap = {};
        // this.plus7reached = false;
        console.log('=== Initialization Complete ===');
    }

    // Override parameter update methods to add debugging and real-time notifications
    updateGlobalDictParameter(parameter, value) {
        const success = super.updateGlobalDictParameter(parameter, value);
        
        if (success) {
            this.strategyUtils.logStrategyInfo(`🔧 Updated: ${parameter} = ${value}`);
            if (parameter === 'enableTrading') {
                
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
            this.strategyUtils.logStrategyInfo(`🔧 Updated: ${parameter} = ${value}`);
            if (parameter === 'cycles') {
                
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
            this.universalDict.cycles = 1;
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
            this.universalDict.strikeDiff = 110;
            this.universalDict.strikeLowest = 20;
            this.isExpiryDay = true;
        } else if (today === expiryDay - 1) {
            this.universalDict.strikeBase = 20;
            this.universalDict.strikeDiff = 110;
            this.universalDict.strikeLowest = 20;
        } else {
            this.universalDict.strikeBase = 20;
            this.universalDict.strikeDiff = 110;
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
        this.universalDict.ceTokens = ceTokens.map(token => token.toString()).sort((a, b) => {
            const aTick = Math.abs(ticks.find(t => t.instrument_token.toString() === a).last_price);
            const bTick = Math.abs(ticks.find(t => t.instrument_token.toString() === b).last_price);
            return aTick - bTick;
        });

        this.universalDict.peTokens = peTokens.map(token => token.toString()).sort((a, b) => {
            const aTick = Math.abs(ticks.find(t => t.instrument_token.toString() === a).last_price);
            const bTick = Math.abs(ticks.find(t => t.instrument_token.toString() === b).last_price);
            return aTick - bTick;
        });

        // TEMPORARY FIX: For testing
        // this.universalDict.ceTokens = ["15473410", "15487234", "15486722", "15486210", "15485698", "15485186"]
        // this.universalDict.peTokens = ["15479298", "15479810", "15480322", "15481602", "15483394", "15483906"]

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
        this.strategyUtils.logStrategyInfo(`Observed tokens: ${this.universalDict.observedTicks.join(', ')}`);

        
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
        console.log(`Observed tokens to track: ${this.universalDict.observedTicks?.join(', ') || 'None'}`);
        
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
            // Add rebuy information
            rebuyDone: this.rebuyDone,
            buyPriceOnce: this.buyPriceOnce,
            buyPriceTwice: this.buyPriceTwice,
            timestamp: currentTime
        });

        // Initialize or update instrument data for all observed tokens
        let processedCount = 0;
        for (const tick of ticks) {
            const token = tick.instrument_token.toString();
            
            processedCount++;

            // Initialize instrument data if not exists
            if (!this.universalDict.instrumentMap[token]) {
                this.universalDict.instrumentMap[token] = {
                    token: token,
                    time: currentTime,
                    symbol: tick.symbol,
                    firstPrice: this.firstPriceMap[token] ? this.firstPriceMap[token] : tick.last_price,
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

            if(!this.firstPriceMap[token]) {
                this.firstPriceMap[token] = tick.last_price;
            }
            
            const instrument = this.universalDict.instrumentMap[token];
            const oldPrice = instrument.last;
            const newPrice = tick.last_price;

            // Update basic metrics
            instrument.time = currentTime;
            instrument.plus3 = newPrice - instrument.firstPrice;
            instrument.change = newPrice - oldPrice;
            instrument.last = newPrice;

            // Update first price if manually added instrument
            if (this.manuallyAddedInstruments.length > 0 && this.manuallyAddedInstrumentsFirstPrices.length > 0) {
                if (this.manuallyAddedInstruments.includes(instrument.token.toString())) {
                    instrument.firstPrice = parseFloat(this.manuallyAddedInstrumentsFirstPrices[this.manuallyAddedInstruments.indexOf(instrument.token.toString())]);
                }
            }

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

                if (this.globalDict.useManuallyAddedInstruments) {

                    if (this.manuallyAddedInstruments.length === 0) {
                        let manualInstruments = this.globalDict.manuallyAddedInstruments.split(',');
                        let manualInstrumentTokens = manualInstruments.map(instrument => this.strategyUtils.findTokenBySymbolSuffix(this.universalDict.instrumentMap, instrument.split(':')[0]).toString());
                        let manualInstrumentFirstPrices = manualInstruments.map(instrument => instrument.split(':')[1]);
                        this.manuallyAddedInstruments = manualInstrumentTokens;
                        this.manuallyAddedInstrumentsFirstPrices = manualInstrumentFirstPrices;
                        this.strategyUtils.logStrategyInfo(`MANUALLY ADDED INSTRUMENTS: ${this.manuallyAddedInstruments.join(', ')}`);
                    }

                    if (this.manuallyAddedInstruments.includes(instrument.token.toString())) {
                        if (instrument.lowAtRef <= parseFloat(this.manuallyAddedInstrumentsFirstPrices[this.manuallyAddedInstruments.indexOf(instrument.token.toString())])*(1 - this.globalDict.dropThreshold) && !this.halfdrop_flag) {
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
                            this.halfdrop_instrument = instrument;
                        }
                    }
                }
                else {

                if (this.lowestCEToken && this.lowestPEToken && instrument.lowAtRef <= instrument.firstPrice*(1 - this.globalDict.dropThreshold) && !this.halfdrop_flag && (instrument.token.toString() == this.lowestCEToken || instrument.token.toString() == this.lowestPEToken)) {
                    this.halfdrop_flag = true;
                    this.strategyUtils.logStrategyInfo(`HALF DROP FLAG: ${instrument.symbol} at ${instrument.lowAtRef}`);

                    
                    // this.writeToGlobalOutput("HALF DROP")
                    
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
                        this.halfdrop_instrument = instrument;
                    }
                }

                if (instrument.buyPrice > -1) {
                    instrument.changeFromBuy = newPrice - instrument.buyPrice;
                }

                if (this.globalDict.setNoPrebuyStrategy && Object.keys(this.modeState).length === 0) {
                    this.modeState = {
                        "target": this.globalDict.target,
                        "stoploss": this.globalDict.stoploss,
                        "usePrebuy": this.globalDict.usePrebuy,
                        "buySame": this.globalDict.buySame
                    }
                    this.globalDict.target = 12;
                    this.globalDict.stoploss = -100;
                    this.globalDict.usePrebuy = false;
                    this.globalDict.buySame = false;

                }

                if(Object.keys(this.modeState).length > 0 && this.globalDict.setNoPrebuyStrategy === false) {
                    this.globalDict.target = this.modeState.target;
                    this.globalDict.stoploss = this.modeState.stoploss;
                    this.globalDict.usePrebuy = this.modeState.usePrebuy;
                    this.globalDict.buySame = this.modeState.buySame;
                    this.modeState = {};
                }
            }
        }

        if(!this.lowestCEToken) {
            this.lowestCEToken = this.strategyUtils.findClosestCEAbovePrice(this.universalDict.instrumentMap, 20, 20).token.toString();
        }
        if(!this.lowestPEToken) {
            this.lowestPEToken = this.strategyUtils.findClosestPEAbovePrice(this.universalDict.instrumentMap, 20, 20).token.toString();
        }
        console.log(`Processed ${processedCount} observed instruments out of ${ticks.length} total ticks`);

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
            
            if (this.universalDict.usePrebuy) {
                let ce_change = ceInstrument.last - ceInstrument.buyPrice;
                let pe_change = peInstrument.last - peInstrument.buyPrice;
                let stoploss = null;
                if(!this.stoplossHit) {
                    console.log(`PREBUY | CE CHANGE: ${ce_change} PE CHANGE: ${pe_change}`);
                        stoploss = this.globalDict.prebuyStoploss;
                    this.stoplossHit = ce_change <= stoploss || pe_change <= stoploss;
                }
            
                if(this.stoplossHit && !this.instrument_bought) {
                    let instrument = this.globalDict.buySame 
                    ? (ce_change <= stoploss ? ceInstrument : peInstrument) 
                    : (ce_change <= stoploss ? peInstrument : ceInstrument);
                    let otherInstrument = instrument === ceInstrument ? peInstrument : ceInstrument;
                    if(!this.globalDict.buySame) {
                        this.strategyUtils.logStrategyInfo(`STOPLOSS HIT: ${otherInstrument.symbol} at ${otherInstrument.last}`);
                        this.strategyUtils.logStrategyInfo(`BUYING ${instrument.symbol} at ${instrument.last}`);
                    }
                    else {
                        this.strategyUtils.logStrategyInfo(`STOPLOSS HIT: ${instrument.symbol} at ${instrument.last}`);
                        this.strategyUtils.logStrategyInfo(`BUYING ${instrument.symbol} at ${instrument.last}`);
                    }
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
            }
            else {
                let instrument = null;
                if(!this.instrument_bought) {
                    let closestPEto200 = this.universalDict.instrumentMap[this.strategyUtils.findClosestPEBelowPrice(this.universalDict.instrumentMap, 205, 205).token.toString()];
                    let closestCEto200 = this.universalDict.instrumentMap[this.strategyUtils.findClosestCEBelowPrice(this.universalDict.instrumentMap, 205, 205).token.toString()];
                    this.mainToken = closestCEto200.token.toString();
                    this.oppToken = closestPEto200.token.toString();
                    instrument = this.halfdrop_instrument.symbol.includes('CE') 
                    ? (this.globalDict.buySame ? closestCEto200 : closestPEto200) 
                    : (this.globalDict.buySame ? closestPEto200 : closestCEto200);
                    instrument.buyPrice = instrument.last;
                    this.instrument_bought = instrument;
                    this.halfdrop_bought = true;
                    this.strategyUtils.logStrategyInfo(`BUYING ${instrument.symbol} at ${instrument.last}`);

                    if (instrument === peInstrument) {
                        this.buyToken = this.oppToken;
                        this.oppBuyToken = this.mainToken;
                    }
                    else {
                        this.buyToken = this.mainToken;
                        this.oppBuyToken = this.oppToken;
                    }

                    // Store original values before modification
                    this.savedState['target'] = this.globalDict.target;
                    this.savedState['stoploss'] = this.globalDict.stoploss;
                    this.savedState['quantity'] = this.globalDict.quantity;

                    //BUYING LOGIC - Buy the instrument
                    const buyTimestamp = new Date().toISOString();
                    this.buyTimestamp = buyTimestamp; // Store for later use
                    try {
                        const buyResult = await this.buyInstrument(instrument);
                        if (buyResult && buyResult.success) {
                            this.strategyUtils.logStrategyInfo(`Instrument bought - Executed price: ${buyResult.executedPrice}`);
                            this.buyPriceOnce = buyResult.executedPrice == 0 ? instrument.last : buyResult.executedPrice;
                        }
                    }
                    catch (error) {
                        this.strategyUtils.logStrategyError(`Error buying instrument: ${error.message}`);
                    }

                    // Removed: current_cycle_data emit - TradingTable now only uses simple buy/sell trade events from emitSimpleTradeEvent
                    // InstrumentTiles will continue to work using strategy object properties as fallback
                    // this.emitStatusUpdate('current_cycle_data', {
                    //     cycle: this.universalDict.cycles || 0,
                    //     data: {
                    //         halfDropInstrument: {
                    //             symbol: this.halfdrop_instrument?.symbol,
                    //             price: this.halfdrop_instrument?.lowAtRef,
                    //             timestamp: this.halfdrop_instrument?.peakTime || new Date().toISOString(),
                    //             firstPrice: this.halfdrop_instrument?.firstPrice,
                    //             dropPercentage: this.halfdrop_instrument?.firstPrice ? 
                    //                 ((this.halfdrop_instrument.lowAtRef / this.halfdrop_instrument.firstPrice) * 100).toFixed(2) : 'N/A'
                    //         },
                    //         instrumentBought: {
                    //             symbol: instrument.symbol,
                    //             price: this.buyPriceOnce || instrument.buyPrice,
                    //             timestamp: buyTimestamp,
                    //             quantity: 75 // Always show original quantity
                    //         },
                    //         rebuyData: null, // Will be updated when rebuy happens
                    //         sellData: null, // Will be updated when sell happens
                    //         summary: null // Will be updated when cycle completes
                    //     },
                    //     completed: false,
                    //     timestamp: buyTimestamp
                    // });
                }

            }

            if(this.instrument_bought) {
                let instrument = this.universalDict.instrumentMap[this.instrument_bought.token];
                let change = instrument.last - instrument.buyPrice;
                let threshold_change = instrument.last - this.rebuyPrice;
                
                console.log(`CHANGE: ${change} TARGET: ${this.globalDict.target}`);

                // SIGNIFICANT THRESHOLD (DEPRECATED)
                {
                    if(this.rebuyDone && threshold_change <= this.globalDict.prebuySignificantThreshold && !this.droppedBelowSignificantThreshold && false){
                        this.droppedBelowSignificantThreshold = true;
                    }

                    if(this.rebuyDone && this.droppedBelowSignificantThreshold && false){
                        await this.singleRebuyStoplossManagement(instrument, this.rebuyDone, this.rebuyPrice, this.rebuyAveragePrice, this.flagSet);
                    }
                }

                // HALF TARGET
                if(change >= this.globalDict.halfTargetThreshold && !this.reachedHalfTarget && !this.realBuyStoplossHit){
                    this.reachedHalfTarget = true;
                }

                // // FINAL STOPLOSS
                // if(change <= this.globalDict.stoploss && !this.finalStoplossHit && this.rebuyDone){
                //     this.finalStoplossHit = true;
                // }

                // TARGET NET
                if(change >= this.globalDict.target - 0.5 && !this.targetNet && !this.boughtSold){
                    this.strategyUtils.logStrategyInfo(`Target net casted for ${instrument.symbol}`);
                    this.targetNet = true;
                }

                // TARGET
                if((this.targetNet && (change >= this.globalDict.target) && !this.boughtSold) || (this.targetNet && !this.boughtSold && change <= this.globalDict.target - 1)) {
                    this.boughtSold = true;

                    // SELLING LOGIC - Sell the instrument
                    this.strategyUtils.logStrategyInfo(`SELLING ${instrument.symbol} at ${instrument.last} AS TARGET OF ${this.globalDict.target} REACHED`);
                    let sellResult = null;
                    try {
                        sellResult = await this.sellInstrument(instrument);
                        if (sellResult && sellResult.success) {
                            this.strategyUtils.logStrategyInfo(`${instrument.symbol} sold at target price - Executed price: ${sellResult.executedPrice}`);
                        }
                    }
                    catch (error) {
                        this.strategyUtils.logStrategyError(`Error selling instrument: ${error.message}`);
                    }

                    //RESET TARGET, STOPLOSS, AND QUANTITY
                    this.globalDict.target = this.savedState['target'];
                    this.globalDict.stoploss = this.savedState['stoploss'];
                    this.globalDict.quantity = this.savedState['quantity'];

                    this.strategyUtils.logStrategyInfo(`Target: ${this.globalDict.target}, Stoploss: ${this.globalDict.stoploss}, Quantity: ${this.globalDict.quantity} RESET COMPLETED.`);

                    //NEEDS CHANGE.
                    {
                        // Emit structured cycle completion data with sell timestamp
                        const sellTimestamp = new Date().toISOString();
                        // Store quantities correctly
                        const originalQuantity = 75; // Base quantity
                        const sellQuantity = this.rebuyDone && !this.realBuyStoplossHit ? originalQuantity * 2 : originalQuantity; // Doubled if rebuy occurred

                    }
                }

                if(this.shouldPlayScenario1A()){
                    await this.scenario1A();
                }

                if(this.shouldPlayScenario1AA()){
                    await this.scenario1AA();
                }

                if(this.shouldPlayScenario1AB()){
                    await this.scenario1AB();
                }
    
                if(this.shouldPlayScenario1B()){
                    await this.scenario1B();
                }
    
                if(this.shouldPlayScenario1C()){
                    await this.scenario1C();
                }
    
                if(this.shouldPlayScenario1CA()){
                    await this.scenario1CA();
                }
    
                if(this.shouldPlayScenarioSL()){
                    await this.scenarioSL();
                }
    
                if(this.secondBought){
                    this.resetFilters();
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
            cycleNumber: this.universalDict.cycles || 1,
            cycleReset: true,
            blockTransition: true,
            message: `Starting cycle ${this.universalDict.cycles || 1}`
        });
    }

    async scenario1A(){
        let instrument_1 = this.universalDict.instrumentMap[this.instrument_bought.token];
        // this.thirdBought = this.secondBought;
        // this.boughtSold = true;
        this.scenario1Adone = true;

        this.strategyUtils.logStrategyInfo(`Scenario 1A in action.`)

        //SELL
        this.strategyUtils.logStrategyInfo('Selling existing instrument and buying opposite.');
        // this.realBuyStoplossHit = true;
        let sellResult = null;
        let diff = 0;
        try {
            sellResult = await this.sellInstrument(instrument_1);
            if (sellResult && sellResult.success) {
                this.strategyUtils.logStrategyInfo(`Real instrument sold - Executed price: ${sellResult.executedPrice}`);
                diff = sellResult.executedPrice == 0 ? instrument_1.last - instrument_1.buyPrice : sellResult.executedPrice - instrument_1.buyPrice;
                this.globalDict.target = this.globalDict.target + Math.abs(diff);
                this.strategyUtils.logStrategyInfo(`Target: ${this.globalDict.target}`);
            }
        }
        catch (error) {
            this.strategyUtils.logStrategyError(`Error selling instrument 1: ${error.message}`);
        }

        // //RESET TARGET, STOPLOSS, AND QUANTITY
        // this.globalDict.target = this.savedState['target'];
        // this.globalDict.stoploss = this.savedState['stoploss'];
        // this.globalDict.quantity = this.savedState['quantity'];

        // this.strategyUtils.logStrategyInfo(`Target: ${this.globalDict.target}, Stoploss: ${this.globalDict.stoploss}, Quantity: ${this.globalDict.quantity} RESET COMPLETED.`);

        // Select opposite instrument
        // instrument_1 = instrument_1.symbol.includes('CE')
        // ? this.universalDict.instrumentMap[this.strategyUtils.findClosestPEBelowPrice(this.universalDict.instrumentMap, 205, 205).token.toString()]
        // : this.universalDict.instrumentMap[this.strategyUtils.findClosestCEBelowPrice(this.universalDict.instrumentMap, 205, 205).token.toString()];

        // this.instrument_bought = instrument_1;

        // // BUY opposite instrument
        // instrument_1.buyPrice = instrument_1.last;
        // let buyResult = null;
        // try {
        //     buyResult = await this.buyInstrument(instrument_1);
        //     if (buyResult && buyResult.success) {
        //         this.strategyUtils.logStrategyInfo(`Real instrument bought - Executed price: ${buyResult.executedPrice}`);
        //     }
        //     this.prebuyBuyPriceTwice = buyResult.executedPrice == 0 ? instrument_1.last : buyResult.executedPrice;
        //     this.prebuyLowTrackingPrice = this.prebuyBuyPriceTwice;
        //     instrument_1.buyPrice = this.prebuyBuyPriceTwice;
        //     this.universalDict.instrumentMap[this.instrument_bought.token].buyPrice = this.prebuyBuyPriceTwice;
        //     this.rebuyDone = true;
        //     this.rebuyPrice = this.prebuyBuyPriceTwice;
        //     this.rebuyAveragePrice = this.prebuyBuyPriceTwice;
        //     this.buyPriceOnce = this.prebuyBuyPriceTwice;
        // }
        // catch (error) {
        //     this.strategyUtils.logStrategyError(`Error buying instrument 1: ${error.message}`);
        // }

        // Emit instrument data update after second buy
        this.emitInstrumentDataUpdate();

    }

    async scenario1AA(){
        let instrument_1 = this.universalDict.instrumentMap[this.instrument_bought.token];
        this.scenario1AAdone = true;
        this.secondBought = true;
        this.strategyUtils.logStrategyInfo(`Scenario 1AA in action.`)

        // Select opposite instrument
        instrument_1 = instrument_1.symbol.includes('CE')
        ? this.universalDict.instrumentMap[this.strategyUtils.findClosestPEBelowPrice(this.universalDict.instrumentMap, 205, 205).token.toString()]
        : this.universalDict.instrumentMap[this.strategyUtils.findClosestCEBelowPrice(this.universalDict.instrumentMap, 205, 205).token.toString()];

        this.instrument_bought = instrument_1;

        // BUY opposite instrument
        instrument_1.buyPrice = instrument_1.last;
        let buyResult = null;
        try {
            buyResult = await this.buyInstrument(instrument_1);
            if (buyResult && buyResult.success) {
                this.strategyUtils.logStrategyInfo(`Real instrument bought - Executed price: ${buyResult.executedPrice}`);
            }
            this.prebuyBuyPriceTwice = buyResult.executedPrice == 0 ? instrument_1.last : buyResult.executedPrice;
            this.prebuyLowTrackingPrice = this.prebuyBuyPriceTwice;
            instrument_1.buyPrice = this.prebuyBuyPriceTwice;
            this.universalDict.instrumentMap[this.instrument_bought.token].buyPrice = this.prebuyBuyPriceTwice;
            this.rebuyDone = true;
            this.rebuyPrice = this.prebuyBuyPriceTwice;
            this.rebuyAveragePrice = this.prebuyBuyPriceTwice;
            this.buyPriceOnce = this.prebuyBuyPriceTwice;
        }
        catch (error) {
            this.strategyUtils.logStrategyError(`Error buying instrument 1: ${error.message}`);
        }

        this.emitInstrumentDataUpdate();

    }

    async scenario1AB(){
        let instrument_1 = this.universalDict.instrumentMap[this.instrument_bought.token];
        this.scenario1ABdone = true;
        this.secondBought = true;
        this.strategyUtils.logStrategyInfo(`Scenario 1AB in action.`)

        // Select same instrument
        // instrument_1 = instrument_1.symbol.includes('CE')
        // ? this.universalDict.instrumentMap[this.strategyUtils.findClosestCEBelowPrice(this.universalDict.instrumentMap, 205, 205).token.toString()]
        // : this.universalDict.instrumentMap[this.strategyUtils.findClosestPEBelowPrice(this.universalDict.instrumentMap, 205, 205).token.toString()];

        // this.instrument_bought = instrument_1;

        // BUY same instrument
        instrument_1.buyPrice = instrument_1.last;
        let buyResult = null;
        try {
            buyResult = await this.buyInstrument(instrument_1);
            if (buyResult && buyResult.success) {
                this.strategyUtils.logStrategyInfo(`Real instrument bought - Executed price: ${buyResult.executedPrice}`);
            }
            this.prebuyBuyPriceTwice = buyResult.executedPrice == 0 ? instrument_1.last : buyResult.executedPrice;
            this.prebuyLowTrackingPrice = this.prebuyBuyPriceTwice;
            instrument_1.buyPrice = this.prebuyBuyPriceTwice;
            this.universalDict.instrumentMap[this.instrument_bought.token].buyPrice = this.prebuyBuyPriceTwice;
            this.rebuyDone = true;
            this.rebuyPrice = this.prebuyBuyPriceTwice;
            this.rebuyAveragePrice = this.prebuyBuyPriceTwice;
            this.buyPriceOnce = this.prebuyBuyPriceTwice;
        }
        catch (error) {
            this.strategyUtils.logStrategyError(`Error buying instrument 1: ${error.message}`);
        }

        this.emitInstrumentDataUpdate();
    }

    async scenario1B(){
        let instrument_1 = this.universalDict.instrumentMap[this.instrument_bought.token];
        this.scenario1Bdone = true;
        // this.thirdBought = this.secondBought;
        this.secondBought = true;
        this.strategyUtils.logStrategyInfo(`Scenario 1B in action.`)

        //SELL
        this.strategyUtils.logStrategyInfo('Selling existing instrument and buying opposite.');
        // this.realBuyStoplossHit = true;
        let sellResult = null;
        let diff = 0;
        try {
            sellResult = await this.sellInstrument(instrument_1);
            if (sellResult && sellResult.success) {
                this.strategyUtils.logStrategyInfo(`Real instrument sold - Executed price: ${sellResult.executedPrice}`);
                diff = sellResult.executedPrice == 0 ? instrument_1.last - instrument_1.buyPrice : sellResult.executedPrice - instrument_1.buyPrice;
                this.globalDict.target = this.globalDict.target + Math.abs(diff);
                this.strategyUtils.logStrategyInfo(`Target: ${this.globalDict.target}`);
            }
        }
        catch (error) {
            this.strategyUtils.logStrategyError(`Error selling instrument 1: ${error.message}`);
        }

        // Select opposite instrument
        instrument_1 = instrument_1.symbol.includes('CE')
        ? this.universalDict.instrumentMap[this.strategyUtils.findClosestPEBelowPrice(this.universalDict.instrumentMap, 205, 205).token.toString()]
        : this.universalDict.instrumentMap[this.strategyUtils.findClosestCEBelowPrice(this.universalDict.instrumentMap, 205, 205).token.toString()];

        this.instrument_bought = instrument_1;

        // BUY opposite instrument
        instrument_1.buyPrice = instrument_1.last;
        let buyResult = null;
        try {
            buyResult = await this.buyInstrument(instrument_1);
            if (buyResult && buyResult.success) {
                this.strategyUtils.logStrategyInfo(`Real instrument bought - Executed price: ${buyResult.executedPrice}`);
            }
            this.prebuyBuyPriceTwice = buyResult.executedPrice == 0 ? instrument_1.last : buyResult.executedPrice;
            this.prebuyLowTrackingPrice = this.prebuyBuyPriceTwice;
            instrument_1.buyPrice = this.prebuyBuyPriceTwice;
            this.universalDict.instrumentMap[this.instrument_bought.token].buyPrice = this.prebuyBuyPriceTwice;
            this.rebuyDone = true;
            this.rebuyPrice = this.prebuyBuyPriceTwice;
            this.rebuyAveragePrice = this.prebuyBuyPriceTwice;
            this.buyPriceOnce = this.prebuyBuyPriceTwice;
        }
        catch (error) {
            this.strategyUtils.logStrategyError(`Error buying instrument 1: ${error.message}`);
        }

        // Emit instrument data update after second buy
        this.emitInstrumentDataUpdate();


    }

    async scenario1C(){
        let instrument_1 = this.universalDict.instrumentMap[this.instrument_bought.token];
        this.scenario1Cdone = true;
        this.strategyUtils.logStrategyInfo(`Scenario 1C in action.`)

        //REBUY
        this.prebuyBuyPriceTwice = instrument_1.last;
        instrument_1.buyPrice = (this.buyPriceOnce + this.prebuyBuyPriceTwice) / 2;
        this.universalDict.instrumentMap[this.instrument_bought.token].buyPrice = (this.buyPriceOnce + this.prebuyBuyPriceTwice) / 2;
        let buyResult = null;
        try {
            buyResult = await this.buyInstrument(instrument_1);
            if (buyResult && buyResult.success) {
                this.strategyUtils.logStrategyInfo(`Real instrument bought again - Executed price: ${buyResult.executedPrice}`);
            }
            this.prebuyBuyPriceTwice = buyResult.executedPrice == 0 ? instrument_1.last : buyResult.executedPrice;
            this.rebuyDone = true;
            this.rebuyPrice = this.prebuyBuyPriceTwice;
            this.rebuyAveragePrice = (this.buyPriceOnce + this.prebuyBuyPriceTwice) / 2;

            // Update the real instrument's buy price to average of both buys
            instrument_1.buyPrice = (this.buyPriceOnce + this.prebuyBuyPriceTwice) / 2;
            this.universalDict.instrumentMap[this.instrument_bought.token].buyPrice = (this.buyPriceOnce + this.prebuyBuyPriceTwice) / 2;
            this.globalDict.target = this.globalDict.target / 2;
            this.globalDict.stoploss = this.globalDict.stoploss / 2;
            this.globalDict.quantity = this.globalDict.quantity * 2;
            this.strategyUtils.logStrategyInfo(`Target: ${this.globalDict.target}`);
        }
        catch (error) {
            this.strategyUtils.logStrategyError(`Error buying instrument 1: ${error.message}`);
        }

        this.emitInstrumentDataUpdate();

    }

    async scenario1CA(){
        let instrument_1 = this.universalDict.instrumentMap[this.instrument_bought.token];
        this.scenario1CAdone = true;
        this.strategyUtils.logStrategyInfo(`Scenario 1CA in action.`)


        // this.thirdBought = this.secondBought;
        this.secondBought = true;
        //SELL
        this.strategyUtils.logStrategyInfo('Selling existing instrument and buying opposite.');
        // this.realBuyStoplossHit = true;
        let sellResult = null;
        let diff = 0;
        try {
            sellResult = await this.sellInstrument(instrument_1);
            if (sellResult && sellResult.success) {
                this.strategyUtils.logStrategyInfo(`Real instrument sold - Executed price: ${sellResult.executedPrice}`);
                diff = sellResult.executedPrice == 0 ? instrument_1.last - instrument_1.buyPrice : sellResult.executedPrice - instrument_1.buyPrice;
                this.globalDict.target = this.globalDict.target + Math.abs(diff);
            }
            this.globalDict.target = this.globalDict.target * 2;
            this.globalDict.stoploss = this.globalDict.stoploss * 2;
            this.globalDict.quantity = this.globalDict.quantity / 2;
            this.strategyUtils.logStrategyInfo(`Target: ${this.globalDict.target}`);

        }
        catch (error) {
            this.strategyUtils.logStrategyError(`Error selling instrument 1: ${error.message}`);
        }

        // Select opposite instrument
        instrument_1 = instrument_1.symbol.includes('CE')
        ? this.universalDict.instrumentMap[this.strategyUtils.findClosestPEBelowPrice(this.universalDict.instrumentMap, 205, 205).token.toString()]
        : this.universalDict.instrumentMap[this.strategyUtils.findClosestCEBelowPrice(this.universalDict.instrumentMap, 205, 205).token.toString()];

        this.instrument_bought = instrument_1;

        // BUY opposite instrument
        instrument_1.buyPrice = instrument_1.last;
        let buyResult = null;
        try {
            buyResult = await this.buyInstrument(instrument_1);
            if (buyResult && buyResult.success) {
                this.strategyUtils.logStrategyInfo(`Real instrument bought - Executed price: ${buyResult.executedPrice}`);
            }
            this.prebuyBuyPriceTwice = buyResult.executedPrice == 0 ? instrument_1.last : buyResult.executedPrice;
            this.prebuyLowTrackingPrice = this.prebuyBuyPriceTwice;
            instrument_1.buyPrice = this.prebuyBuyPriceTwice;
            this.universalDict.instrumentMap[this.instrument_bought.token].buyPrice = this.prebuyBuyPriceTwice
            this.rebuyDone = true;
            this.rebuyPrice = this.prebuyBuyPriceTwice;
            this.rebuyAveragePrice = this.prebuyBuyPriceTwice;
            this.buyPriceOnce = this.prebuyBuyPriceTwice;
        }
        catch (error) {
            this.strategyUtils.logStrategyError(`Error buying instrument 1: ${error.message}`);
        }

        // Emit instrument data update after second buy
        this.emitInstrumentDataUpdate();

    }

    async scenarioSL(){
        let instrument_1 = this.universalDict.instrumentMap[this.instrument_bought.token];
        this.boughtSold = true;
        this.strategyUtils.logStrategyInfo(`Scenario SL in action.`)

        //SELL
        this.strategyUtils.logStrategyInfo('Selling existing instrument and buying opposite.');
        // this.realBuyStoplossHit = true;
        let sellResult = null;
        let diff = 0;
        try {
            sellResult = await this.sellInstrument(instrument_1);
            if (sellResult && sellResult.success) {
                this.strategyUtils.logStrategyInfo(`Real instrument sold - Executed price: ${sellResult.executedPrice}`);
                // diff = sellResult.executedPrice == 0 ? instrument_1.last - instrument_1.buyPrice : sellResult.executedPrice - instrument_1.buyPrice;
                // this.globalDict.target = this.globalDict.target + Math.abs(diff);
            }
        }
        catch (error) {
            this.strategyUtils.logStrategyError(`Error selling instrument 1: ${error.message}`);
        }
    }

    shouldPlayScenario1A(){
        let instrument_1 = this.universalDict.instrumentMap[this.instrument_bought.token];
        return !this.reachedHalfTarget && (instrument_1.last - instrument_1.buyPrice) <= this.globalDict.realBuyStoploss && !this.scenario1Adone && !this.scenario1Bdone && !this.scenario1Cdone && !this.boughtSold;
    }

    shouldPlayScenario1AA(){
        let instrument_1 = this.universalDict.instrumentMap[this.instrument_bought.token];
        return this.scenario1Adone && !this.scenario1AAdone && !this.scenario1ABdone && !this.boughtSold && (instrument_1.last - instrument_1.buyPrice) <= -20;
    }

    shouldPlayScenario1AB(){
        let instrument_1 = this.universalDict.instrumentMap[this.instrument_bought.token];
        return this.scenario1Adone && !this.scenario1AAdone && !this.scenario1ABdone && !this.boughtSold && (instrument_1.last - instrument_1.buyPrice) >= 0;
    }

    shouldPlayScenario1B(){
        let instrument_1 = this.universalDict.instrumentMap[this.instrument_bought.token];
        return this.reachedHalfTarget && (instrument_1.last <= instrument_1.buyPrice) && !this.scenario1Adone && !this.scenario1Bdone && !this.scenario1Cdone && !this.boughtSold;
    }

    shouldPlayScenario1C(){
        let instrument_1 = this.universalDict.instrumentMap[this.instrument_bought.token];
        return (instrument_1.last - instrument_1.buyPrice >= this.globalDict.rebuyAt) && !this.scenario1Adone && !this.scenario1Bdone && !this.scenario1Cdone && !this.boughtSold;
    }

    shouldPlayScenario1CA(){
        let instrument_1 = this.universalDict.instrumentMap[this.instrument_bought.token];
        return (instrument_1.last <= instrument_1.buyPrice) && this.scenario1Cdone && !this.scenario1CAdone && !this.boughtSold;
    }


    shouldPlayScenarioSL(){
        let instrument_1 = this.universalDict.instrumentMap[this.instrument_bought.token];
        return (instrument_1.last - instrument_1.buyPrice <= this.globalDict.stoploss) && !this.boughtSold;
    }

    resetFilters(){
        this.scenario1Adone = false;
        this.scenario1AAdone = false;
        this.scenario1ABdone = false;
        this.scenario1Bdone = false;
        this.scenario1Cdone = false;
        this.scenario1CAdone = false;
        this.reachedHalfTarget = false;
        this.secondBought = false;
    }

    resetForNextCycle() {
        this.strategyUtils.logStrategyInfo('Resetting for next cycle');
        
        // Increment cycle count
        this.universalDict.cycles = (this.universalDict.cycles || 1) + 1;
        this.cycleCount = this.universalDict.cycles;  // Keep cycleCount in sync
        
        // Reset all flags and state
        this.boughtSold = false;
        this.halfdrop_flag = false;
        this.stoplossHit = false;
        this.instrument_bought = null;
        this.modeState = {};
        this.buyPriceOnce = 0;
        this.buyPriceTwice = 0;
        this.rebuyDone = false;
        this.rebuyPrice = 0;
        this.rebuyAveragePrice = 0;
        this.flagSet = {
            reached_rebuy_price: false,
            reached_average_price: false
        }
        this.droppedBelowSignificantThreshold = false;
        this.reachedHalfTarget = false;
        this.realBuyStoplossHit = false;
        this.savedState = {};
        this.secondBought = false;
        this.finalStoplossHit = false;
        this.isExpiryDay = false;
        this.finalBought = false;
        this.targetNet = false;
        this.firstCycleRebuyHit = false;
        this.firstCycleStoplossHit = false;
        this.secondCycleRebuyHit = false;
        this.scenario1Adone = false;
        this.scenario1Bdone = false;
        this.scenario1AAdone = false;
        this.scenario1ABdone = false;
        this.scenario1Cdone = false;
        this.scenario1CAdone = false;
        this.thirdBought = false;
        this.prebuyBuyPriceTwice = 0;
        this.prebuyLowTrackingPrice = 0;
        this.lowestCEToken = null;
        this.lowestPEToken = null;
        //this.plus7reached = false;
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
        this.manuallyAddedInstruments = [];
        this.manuallyAddedInstrumentsFirstPrices = [];
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
                
                executedPrices.instrument1 = instrument1.last;
                executedPrices.instrument2 = instrument2.last;
            }
            
            // Emit simplified trade events after determining executed prices
            this.emitSimpleTradeEvent('sell', instrument1.symbol, executedPrices.instrument1 != 0 ? executedPrices.instrument1 : instrument1.last, this.globalDict.quantity || 75);
            this.emitSimpleTradeEvent('sell', instrument2.symbol, executedPrices.instrument2 != 0 ? executedPrices.instrument2 : instrument2.last, this.globalDict.quantity || 75);
            
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
                
                executedPrice = instrument.last;
            }
            
            // Emit simplified trade event after determining executed price
            this.emitSimpleTradeEvent('sell', instrument.symbol, executedPrice != 0 ? executedPrice : instrument.last, this.globalDict.quantity || 75);
            
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
                
                // Update buy price for paper trading
                executedPrice = instrument.last;
                instrument.buyPrice = instrument.last;
            }
            
            // Emit simplified trade event after determining executed price
            this.emitSimpleTradeEvent('buy', instrument.symbol, executedPrice != 0 ? executedPrice : instrument.last, this.globalDict.quantity || 75);
            
            return { success: true, executedPrice };
        } catch (error) {
            this.strategyUtils.logStrategyError(`Exception while buying instrument: ${error.message}`);
            return { success: false, executedPrice: null };
        }
    }

    async singleRebuyStoplossManagement(instrument, rebuy_flag, rebuy_price, average_price, flag_set){
        if(rebuy_flag && !this.boughtSold){
            if(instrument.last > rebuy_price && !flag_set.reached_rebuy_price && !this.boughtSold){
                flag_set.reached_rebuy_price = true;
            }
            
            if (flag_set.reached_rebuy_price && !this.boughtSold){
                if(instrument.last > average_price && !flag_set.reached_average_price){
                    flag_set.reached_average_price = true;
                }

                if(instrument.last < rebuy_price && !flag_set.reached_average_price && flag_set.reached_rebuy_price && !this.boughtSold){
                    this.strategyUtils.logStrategyInfo(`SELLING ${instrument.symbol} at ${instrument.last} AS TARGET OF ${this.globalDict.target} REACHED`);
                    let sellResult = null;
                    // SELLING LOGIC - Sell the instrument
                    try {
                        sellResult = await this.sellInstrument(instrument);
                        if (sellResult && sellResult.success) {
                            this.strategyUtils.logStrategyInfo(`${instrument.symbol} sold at rebuy price - Executed price: ${sellResult.executedPrice}`);
                        }
                    }
                    catch (error) {
                        this.strategyUtils.logStrategyError(`Error selling instrument: ${error.message}`);
                    }

                    if(rebuy_flag) {
                        // Store original values before modification
                        const originalTarget = this.globalDict.target;
                        const originalStoploss = this.globalDict.stoploss;
                        const originalQuantity = this.globalDict.quantity;
                        
                        // Reset target, stoploss, and quantity
                        this.globalDict.target = this.globalDict.target * 2;
                        this.globalDict.stoploss = this.globalDict.stoploss * 2;
                        this.globalDict.quantity = this.globalDict.quantity / 2;
                        this.globalDict.useManuallyAddedInstruments = false;
                        this.globalDict.manuallyAddedInstruments = '';
                        
                        this.strategyUtils.logStrategyInfo(`Target: ${this.globalDict.target}, Stoploss: ${this.globalDict.stoploss}, Quantity: ${this.globalDict.quantity} RESET COMPLETED.`);
                        
                        // Emit target reset notification
                        this.emitStatusUpdate('Target reset after completion', {
                            targetChange: true,
                            targetReset: true,
                            originalTarget: originalTarget,
                            newTarget: this.globalDict.target,
                            originalStoploss: originalStoploss,
                            newStoploss: this.globalDict.stoploss,
                            originalQuantity: originalQuantity,
                            newQuantity: this.globalDict.quantity,
                            instrument: instrument.symbol,
                            sellPrice: sellResult.executedPrice == 0 ? instrument.last : sellResult.executedPrice,
                            message: `Target reset to ${this.globalDict.target} points after successful completion`
                        });
                    }

                    // Emit structured cycle completion data with sell timestamp
                    const sellTimestamp = new Date().toISOString();
                    // Store quantities correctly
                    const originalQuantity = 75; // Base quantity
                    const sellQuantity = this.rebuyDone ? originalQuantity * 2 : originalQuantity; // Doubled if rebuy occurred
                    // Removed: cycle_completion_data emit - TradingTable now only uses simple buy/sell trade events from emitSimpleTradeEvent
                    // InstrumentTiles will continue to work using strategy object properties as fallback
                    // this.emitStatusUpdate('cycle_completion_data', {
                    //     cycle: this.universalDict.cycles || 0,
                    //     data: {
                    //         halfDropInstrument: {
                    //             symbol: this.halfdrop_instrument?.symbol,
                    //             price: this.halfdrop_instrument?.lowAtRef,
                    //             timestamp: this.halfdrop_instrument?.peakTime || new Date().toISOString(),
                    //             firstPrice: this.halfdrop_instrument?.firstPrice,
                    //             dropPercentage: this.halfdrop_instrument?.firstPrice ? 
                    //                 ((this.halfdrop_instrument.lowAtRef / this.halfdrop_instrument.firstPrice) * 100).toFixed(2) : 'N/A'
                    //         },
                    //         instrumentBought: {
                    //             symbol: instrument.symbol,
                    //             price: this.buyPriceOnce || instrument.buyPrice,
                    //             timestamp: this.buyTimestamp || sellTimestamp, // Preserve original buy timestamp
                    //             quantity: originalQuantity // Always show original quantity
                    //         },
                    //         rebuyData: this.rebuyDone ? {
                    //             firstBuyPrice: this.buyPriceOnce,
                    //             secondBuyPrice: this.buyPriceTwice,
                    //             averagePrice: (this.buyPriceOnce + this.buyPriceTwice) / 2,
                    //             timestamp: this.rebuyTimestamp || sellTimestamp, // Preserve original rebuy timestamp
                    //             quantity: originalQuantity // Show original quantity for rebuy
                    //         } : null,
                    //         sellData: {
                    //             symbol: instrument.symbol,
                    //             price: sellResult.executedPrice == 0 ? instrument.last : sellResult.executedPrice,
                    //             timestamp: sellTimestamp, // Only sell action uses sell timestamp
                    //             quantity: sellQuantity, // Use the stored quantity (doubled if rebuy occurred)
                    //             pnl: instrument.buyPrice !== -1 ? 
                    //                 ((sellResult.executedPrice == 0 ? instrument.last : sellResult.executedPrice) - instrument.buyPrice) * sellQuantity : 0,
                    //             sellReason: "REBUY_PRICE" // Add sell reason for TradingTable badges
                    //         },
                    //         summary: {
                    //             pnlInPoints: instrument.buyPrice !== -1 ? ((sellResult.executedPrice == 0 ? instrument.last : sellResult.executedPrice) - instrument.buyPrice) : 0,
                    //             pnlActual: instrument.buyPrice !== -1 ? 
                    //                 ((sellResult.executedPrice == 0 ? instrument.last : sellResult.executedPrice) - instrument.buyPrice) * sellQuantity : 0
                    //         }
                    //     },
                    //     completed: true,
                    //     timestamp: sellTimestamp
                    // });

                    this.boughtSold = true;
                }
            }

            if(flag_set.reached_average_price && !this.boughtSold){
                if(instrument.last < average_price && !flag_set.reached_average_price && !this.boughtSold){
                    this.strategyUtils.logStrategyInfo(`SELLING ${instrument.symbol} at ${instrument.last} AS TARGET OF ${this.globalDict.target} REACHED`);
                    let sellResult = null;
                    // SELLING LOGIC - Sell the instrument
                    try {
                        sellResult = await this.sellInstrument(instrument);
                        if (sellResult && sellResult.success) {
                            this.strategyUtils.logStrategyInfo(`${instrument.symbol} sold at average price - Executed price: ${sellResult.executedPrice}`);
                        }
                    }
                    catch (error) {
                        this.strategyUtils.logStrategyError(`Error selling instrument: ${error.message}`);
                    }

                    if(rebuy_flag) {
                        // Store original values before modification
                        const originalTarget = this.globalDict.target;
                        const originalStoploss = this.globalDict.stoploss;
                        const originalQuantity = this.globalDict.quantity;
                        
                        // Reset target, stoploss, and quantity
                        this.globalDict.target = this.globalDict.target * 2;
                        this.globalDict.stoploss = this.globalDict.stoploss * 2;
                        this.globalDict.quantity = this.globalDict.quantity / 2;
                        this.globalDict.useManuallyAddedInstruments = false;
                        this.globalDict.manuallyAddedInstruments = '';
                        
                        this.strategyUtils.logStrategyInfo(`Target: ${this.globalDict.target}, Stoploss: ${this.globalDict.stoploss}, Quantity: ${this.globalDict.quantity} RESET COMPLETED.`);
                        
                        // Emit target reset notification
                        this.emitStatusUpdate('Target reset after completion', {
                            targetChange: true,
                            targetReset: true,
                            originalTarget: originalTarget,
                            newTarget: this.globalDict.target,
                            originalStoploss: originalStoploss,
                            newStoploss: this.globalDict.stoploss,
                            originalQuantity: originalQuantity,
                            newQuantity: this.globalDict.quantity,
                            instrument: instrument.symbol,
                            sellPrice: sellResult.executedPrice == 0 ? instrument.last : sellResult.executedPrice,
                            message: `Target reset to ${this.globalDict.target} points after successful completion`
                        });
                    }

                    // Emit structured cycle completion data with sell timestamp
                    const sellTimestamp = new Date().toISOString();
                    // Store quantities correctly
                    const originalQuantity = 75; // Base quantity
                    const sellQuantity = this.rebuyDone ? originalQuantity * 2 : originalQuantity; // Doubled if rebuy occurred
                    // Removed: cycle_completion_data emit - TradingTable now only uses simple buy/sell trade events from emitSimpleTradeEvent
                    // InstrumentTiles will continue to work using strategy object properties as fallback
                    // this.emitStatusUpdate('cycle_completion_data', {
                    //     cycle: this.universalDict.cycles || 0,
                    //     data: {
                    //         halfDropInstrument: {
                    //             symbol: this.halfdrop_instrument?.symbol,
                    //             price: this.halfdrop_instrument?.lowAtRef,
                    //             timestamp: this.halfdrop_instrument?.peakTime || new Date().toISOString(),
                    //             firstPrice: this.halfdrop_instrument?.firstPrice,
                    //             dropPercentage: this.halfdrop_instrument?.firstPrice ? 
                    //                 ((this.halfdrop_instrument.lowAtRef / this.halfdrop_instrument.firstPrice) * 100).toFixed(2) : 'N/A'
                    //         },
                    //         instrumentBought: {
                    //             symbol: instrument.symbol,
                    //             price: this.buyPriceOnce || instrument.buyPrice,
                    //             timestamp: this.buyTimestamp || sellTimestamp, // Preserve original buy timestamp
                    //             quantity: originalQuantity // Always show original quantity
                    //         },
                    //         rebuyData: this.rebuyDone ? {
                    //             firstBuyPrice: this.buyPriceOnce,
                    //             secondBuyPrice: this.buyPriceTwice,
                    //             averagePrice: (this.buyPriceOnce + this.buyPriceTwice) / 2,
                    //             timestamp: this.rebuyTimestamp || sellTimestamp, // Preserve original rebuy timestamp
                    //             quantity: originalQuantity // Show original quantity for rebuy
                    //         } : null,
                    //         sellData: {
                    //             symbol: instrument.symbol,
                    //             price: sellResult.executedPrice == 0 ? instrument.last : sellResult.executedPrice,
                    //             timestamp: sellTimestamp, // Only sell action uses sell timestamp
                    //             quantity: sellQuantity, // Use the stored quantity (doubled if rebuy occurred)
                    //             pnl: instrument.buyPrice !== -1 ? 
                    //                 ((sellResult.executedPrice == 0 ? instrument.last : sellResult.executedPrice) - instrument.buyPrice) * sellQuantity : 0,
                    //             sellReason: "AVG_PRICE" // Add sell reason for TradingTable badges
                    //         },
                    //         summary: {
                    //             pnlInPoints: instrument.buyPrice !== -1 ? ((sellResult.executedPrice == 0 ? instrument.last : sellResult.executedPrice) - instrument.buyPrice) : 0,
                    //             pnlActual: instrument.buyPrice !== -1 ? 
                    //                 ((sellResult.executedPrice == 0 ? instrument.last : sellResult.executedPrice) - instrument.buyPrice) * sellQuantity : 0
                    //         }
                    //     },
                    //     completed: true,
                    //     timestamp: sellTimestamp
                    // });

                    this.boughtSold = true;
                }
            }

        }


    }

    // Simplified trade event emission
    emitSimpleTradeEvent(action, symbol, price, quantity) {
        const tradeEvent = {
            action, // 'buy' or 'sell'
            symbol,
            price,
            quantity,
            timestamp: this.formatTime24(new Date()),
            cycle: this.universalDict.cycles || 1
        };
        
        this.emitToUser('strategy_trade_event', tradeEvent);
        this.strategyUtils.logStrategyInfo(`Trade event emitted: ${action.toUpperCase()} ${symbol} @ ${price} x ${quantity}`);
    }

    formatTime24(date) {
        let hours = date.getHours();     // 0–23
        let minutes = date.getMinutes(); // 0–59
        let seconds = date.getSeconds(); // 0–59
      
        // add leading zeros if needed
        hours = hours < 10 ? "0" + hours : hours;
        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;
      
        return `${hours}:${minutes}:${seconds}`;
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
                default: -50,
                description: 'Stop loss in points'
            },
            enableTrading: {
                type: 'boolean',
                default: false,
                description: 'Enable/disable actual trading'
            },
            dropThreshold: {
                type: 'number',
                default: 0.25,
                description: 'Drop threshold in percentage'
            },
            prebuyStoploss: {
                type: 'number',
                default: -15,
                description: 'Prebuy stoploss in points'
            },
            realBuyStoploss: {
                type: 'number',
                default: -10,
                description: 'Stoploss to activate second buy.'
            },
            rebuyAt: {
                type: 'number',
                default: 7,
                description: 'Rebuy Threshold.'
            },
            halfTargetThreshold: {
                type: 'number',
                default: 5,
                description: 'Half target threshold'
            },
            prebuySignificantThreshold: {
                type: 'number',
                default: -11,
                description: 'Significant stoploss threshold for pre-buy'
            },
            buySame: {
                type: 'boolean',
                default: false,
                description: 'Buy same instrument again'
            },
            useManuallyAddedInstruments: {
                type: 'boolean',
                default: false,
                description: 'Use manually added instruments'
            },
            manuallyAddedInstruments: {
                type: 'string',
                default: '',
                description: 'Eg. 25000PE:159.3,24950CE:98.1'
            },
            setNoPrebuyStrategy : {
                type: 'boolean',
                default: false,
                description: 'Set strategy for 20 rupee halfdrop'
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
                default: 2,
                description: 'Expiry day (0=Monday, 3=Thursday)'
            },
            skipAfterCycles: {
                type: 'number',
                default: 2,
                description: 'Skip buying after this many cycles'
            },
            usePrebuy: {
                type: 'boolean',
                default: false,
                description: 'Use prebuy or not'
            }
        };
    }

    writeToGlobalOutput(data) {
        let formatted_data = `${data}`;
        fs.writeFileSync("output/global.txt", formatted_data);
    }

    emitInstrumentDataUpdate(){
        return null;
    }
}

module.exports = FPFSV4;
const BaseStrategy = require('./base');
const TradingUtils = require('../utils/tradingUtils');
const StrategyUtils = require('../utils/strategyUtils');
const TradeQueue = require('../collection-framework/TradeQueue');
const fs = require('fs');
const crypto = require('crypto');

class MTMV5SharedStrategyV2 extends BaseStrategy {
    constructor() {
        super();
        this.name = 'MTM V5 Shared Strategy V2';
        this.description = 'Mark to Market strategy with interim low detection and prebuy logic V5 - V2';
        this.strategyUtils = new StrategyUtils();
        
        // Strategy state variables
        this.hasActivePosition = false;
        this.buyPrice = null;
        this.buySymbol = null;
        this.tickCount = 0;
        this.selectedInstrument = null;
        this.instrumentSelectionComplete = false;
        this.cycleCount = 1;
        this.lastSellTime = null;
        this.buyCompleted = false;
        this.sellCompleted = false;
        this.debugMode = false;
        this.cycleInstanceSet = new Set();
        this.setInstanceComplete = false;
        this.cycleInstanceId = null;
        this.announcementDone = false;
        this.previousCompletionMethodAnnounced = false;
        this.rebuyDataAnnounced = false;
        this.rebuyFound = false;
        // MTM specific variables
        this.mainToken = null;
        this.oppToken = null;
        this.boughtToken = null;
        this.prebuyBoughtToken = null;
        this.prebuyOppBoughtToken = null;
        this.oppBoughtToken = null;
        this.mtmFirstOption = null;
        this.interimLowReached = false;
        this.calcRefReached = false;
        this.refCapture = false;
        this.mtmSoldAt24 = false;
        this.mtmSoldAt36 = false;
        this.boughtSold = false;
        this.cancelled_24 = false;
        this.entry_24 = false;
        this.entry_plus_24 = false;
        this.entry_36 = false;
        this.entry_7 = false;
        this.mtmFirstToSell = null;
        this.mtmFirstToSellPrice = null;
        this.mtmNextToSell = null;
        this.changeAt24 = 0;
        this.changeAt36After24 = 0;
        this.mtmAssistedTarget = 0;
        this.mtmAssistedTarget2 = 0;
        this.mtmOriginalBuyPrice = null;
        this.mtmSoldAt24Gain = 0;
        this.mtmSoldAt36Loss = 0;
        this.mtmPriceAt24Sell = null; // Store price of remaining instrument at +24 sell time
        this.mtmPriceAt36Sell = null; // Store price of remaining instrument at -36 sell time
        this.mtmPriceAt10Sell = null; // Store price of remaining instrument at -10 sell time
        this.mtmSoldAt24Symbol = null; // Store symbol of instrument sold at +24 for buy back
        this.mtmBuyBackInstrument = null;
        this.mtmBuyBackPrice = null; // Store buy back price
        this.mtmBuyBackTarget = null; // Store target for buy back scenario
        this.mtmFullData = {};
        this.mtmTotalPreviousPnL = 0; // Store total P&L from previous trades
        this.prebuyBuyPriceOnce = 0;
        this.prebuyBuyPriceTwice = 0;
        this.prebuyFullData = {};
        this.targetHitByTypeArray = [];
        this.repetition = {
            observed: false,
            type: null
        };
        this.isExpiryDay = false;
        this.finalStoplossHit = false;
        this.prebuyHit = false;
        this.plus7reached = false;
        this.firstCycleRebuyHit = false;
        this.firstCycleStoplossHit = false;
        this.secondCycleRebuyHit = false;
        this.scenario1Adone = false;
        this.scenario1Bdone = false;
        this.scenario1Cdone = false;
        this.scenario1CAdone = false;
        this.thirdBought = false;
        this.actualRebuyDone = false;
        this.exit_at_cost = false;
        this.exit_at_stoploss = false;
        this.targetHit = false;
        this.prebuyTokensFound = false;
        this.afterTarget = false;
        this.sl2a = false;
        this.previouslyTargetHit = false;
        this.previouslyExitAtCost = false;
        this.previousRebuyData = {};
        // Block states
        this.blockInit = true;
        this.blockUpdate = false;
        this.blockFinalRef = false;
        this.blockRef3 = false;
        this.blockDiff10 = false;
        this.blockNextCycle = false;
        
        // Flags
        this.buyingCompleted = false;
        this.finalRefCompleted = false;
        this.mtm10tracked = false;
        this.cePlus3 = false;
        this.pePlus3 = false;
        this.interimLowDisabled = false;
        this.calcRefReached = false;
        this.finalRefFlag = false;
        this.skipBuy = false;
        this.boughtSold = false;
        this.mtmBothSold = false;
        this.mtmNextSellAfter24 = false;
        this.buyBackAfter24 = false;
        this.sellBuyBackAfter24 = false;
        this.mtmSoldFirstAt36 = false;
        this.mtmSoldAfterFirst36 = false;
        this.mtmSoldAt10 = false;
        this.mtmNextSellAfter10 = false;
        this.mtm10firstHit = false;
        this.prebuyLowTrackingPrice = 0;
        this.prebuyLowTrackingTime = null;
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
        this.targetNet = false;
        this.secondBought = false;
        
        // Entry stage variables
        this.entry_plus_24_first_stage = false;
        this.entry_plus_24_second_stage = false;
        this.entry_24_first_stage = false;
        this.entry_24_second_stage = false;
        this.entry_24_third_stage = false;
        this.entry_36_first_stage = false;
        this.entry_36_second_stage = false;
        this.entry_36_third_stage = false;
        this.entry_36_fourth_stage = false;
        this.less_than_24 = false;
        this.buyBackInstrument = null;
        this.buyBackTarget = 0;
        this.who_hit_24 = null;
        this.who_hit_36 = null;
    }

    setUserInfo(userName, userId) {
        this.strategyUtils.setUserInfo(userName, userId);
        this.strategyUtils.logStrategyInfo(`MTM V5 Strategy Shared V2 initialized for user: ${userName} (ID: ${userId})`);
    }

    initialize(globalDict, universalDict, blockDict, accessToken) {
        // Call parent initialize method
        super.initialize(globalDict, universalDict, blockDict, accessToken);
        
        console.log('=== MTM V5 Strategy Shared V2 Initialization ===');
        console.log(`Strategy Name: ${this.name}`);
        console.log(`Strategy Description: ${this.description}`);
        console.log(`Access Token Available: ${!!this.accessToken}`);
        console.log(`API Key Available: ${!!this.globalDict.api_key}`);
        
        // Note: TradingUtils will be injected by UserStrategyManager
        // No need to initialize here as it will be set by the manager

        // Initialize strategy-specific data structures
        this.universalDict.optionsData = {};
        this.blockDict.lastPrices = {};
        this.universalDict.instrumentMap = {};
        this.universalDict.ceTokens = [];
        this.universalDict.peTokens = [];
        this.universalDict.observedTicks = [];
        this.universalDict.strikePriceMap = {};

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
        this.strategyUtils.logStrategyInfo(`Enable Trading Status: ${this.universalDict.enableTrading}`);

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
        this.debugMode = false;
        this.cycleInstanceSet = new Set();
        this.setInstanceComplete = false;
        this.cycleInstanceId = null;
        this.announcementDone = false;
        this.prebuyTokensFound = false;
        this.afterTarget = false;
        this.sl2a = false;
        this.targetHit = false;
        this.previousCompletionMethodAnnounced = false;
        this.rebuyDataAnnounced = false;
        this.rebuyFound = false;
        // Reset MTM specific variables
        this.mainToken = null;
        this.oppToken = null;
        this.boughtToken = null;
        this.prebuyBoughtToken = null;
        this.prebuyOppBoughtToken = null;
        this.oppBoughtToken = null;
        this.mtmFirstOption = null;
        this.interimLowReached = false;
        this.calcRefReached = false;
        this.refCapture = false;
        this.changeAt24 = 0;
        this.changeAt36After24 = 0;
        this.mtmSoldAt24 = false;
        this.mtmSoldAt36 = false;
        this.boughtSold = false;
        this.mtmFirstToSell = null;
        this.mtmFirstToSellPrice = null;
        this.mtmNextToSell = null;
        this.mtmAssistedTarget = 0;
        this.mtmAssistedTarget2 = 0;
        this.mtmOriginalBuyPrice = null;
        this.mtmSoldAt24Gain = 0;
        this.mtmSoldAt36Loss = 0;
        this.mtmPriceAt24Sell = null; // Store price of remaining instrument at +24 sell time
        this.mtmPriceAt36Sell = null; // Store price of remaining instrument at -36 sell time
        this.mtmPriceAt10Sell = null; // Store price of remaining instrument at -10 sell time
        this.mtmSoldAt24Symbol = null; // Store symbol of instrument sold at +24 for buy back
        this.mtmBuyBackInstrument = null;
        this.mtmBuyBackPrice = null; // Store buy back price
        this.mtmBuyBackTarget = null; // Store target for buy back scenario
        this.mtmTotalPreviousPnL = 0; // Store total P&L from previous trades
        this.mtmFullData = {};
        this.prebuyBuyPriceOnce = 0;
        this.prebuyBuyPriceTwice = 0;
        this.mtmSoldAt10 = false;
        this.mtmNextSellAfter10 = false;
        this.mtm10firstHit = false;
        this.cancelled_24 = false;
        this.entry_24 = false;
        this.entry_36 = false;
        this.entry_7 = false;
        this.prebuyLowTrackingPrice = 0;
        this.prebuyLowTrackingTime = null;
        this.rebuyDone = false;
        this.rebuyPrice = 0;
        this.rebuyAveragePrice = 0;
        this.flagSet = {
            reached_rebuy_price: false,
            reached_average_price: false
        }
        this.droppedBelowSignificantThreshold = false;
        this.reachedHalfTarget = false;
        this.savedState = {};
        this.realBuyStoplossHit = false;
        this.targetNet = false;
        this.secondBought = false;
        this.repetition = {
            observed: false,
            type: null
        };
        this.targetHitByTypeArray = [];
        this.isExpiryDay = false;
        this.finalStoplossHit = false;
        this.prebuyHit = false;
        this.plus7reached = false;
        this.firstCycleRebuyHit = false;
        this.firstCycleStoplossHit = false;
        this.secondCycleRebuyHit = false;
        this.scenario1Adone = false;
        this.scenario1Bdone = false;
        this.scenario1Cdone = false;
        this.scenario1CAdone = false;
        this.thirdBought = false;
        // Reset entry stage variables
        this.entry_24_first_stage = false;
        this.entry_24_second_stage = false;
        this.entry_24_third_stage = false;
        this.entry_36_first_stage = false;
        this.entry_36_second_stage = false;
        this.entry_36_third_stage = false;
        this.entry_36_fourth_stage = false;
        this.less_than_24 = false;
        this.buyBackInstrument = null;
        this.buyBackTarget = 0;
        this.who_hit_24 = null;
        this.who_hit_36 = null;
        this.exit_at_cost = false;
        this.exit_at_stoploss = false;
        this.previouslyTargetHit = false;
        this.previouslyExitAtCost = false;
        this.previousRebuyData = {};
        // Reset block states
        this.blockInit = true;
        this.blockUpdate = false;
        this.blockFinalRef = false;
        this.blockRef3 = false;
        this.blockDiff10 = false;
        this.blockNextCycle = false;
        this.actualRebuyDone = false;

        // Reset flags
        this.cePlus3 = false;
        this.pePlus3 = false;
        this.interimLowDisabled = false;
        this.calcRefReached = false;
        this.finalRefFlag = false;
        this.skipBuy = false;
        this.mtm10tracked = false;
        this.mtm10firstHit = false;
        this.buyingCompleted = false;
        this.finalRefCompleted = false;

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

            else {
                this.strategyUtils.logStrategyInfo(`🔧 ${parameter} updated : ${value}`)
            }

            // Emit MTM-specific parameter update notifications
            if (['target', 'stoploss', 'sellAt24Limit', 'sellAt10Limit', 'buyBackTrigger'].includes(parameter)) {
                this.emitStatusUpdate(`MTM Strategy parameter updated`, {
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
            this.strategyUtils.logStrategyInfo(`🔧 Universal Parameter Updated: ${parameter} = ${value}`);
            
            // Emit MTM-specific universal parameter notifications
            if (['expiry', 'cycles', 'skipBuy', 'interimLowDisabled'].includes(parameter)) {
                this.emitStatusUpdate(`MTM Strategy configuration updated`, {
                    parameter,
                    value,
                    category: 'strategy_config',
                    impact: 'next_cycle'
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
            
            if (this.blockFinalRef) {
                await this.processFinalRefBlock(ticks);
            }
            
            if (this.blockRef3) {
                await this.processRef3Block(ticks);
            }
            
            if (this.blockDiff10) {
                await this.processDiff10Block(ticks);
            }
            
            if (this.blockNextCycle) {
                await this.processNextCycleBlock(ticks);
            }
            
            // Emit instrument data update for dashboard
            this.emitInstrumentDataUpdate();
            
            console.log(`=== Tick Batch #${this.tickCount} Complete ===`);
        } catch (error) {
            console.error(`Error in processTicks for tick batch #${this.tickCount}:`, error);
            throw error; // Re-throw to be handled by the caller
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

        this.checkRebuyData();
        this.checkPreviousCompletionMethod();

        this.cycleInstanceId = this.getInstanceId();
        // Skip buy after first cycle
        if (this.universalDict.cycles >= this.globalDict.skipAfterCycles) {
            // this.universalDict.skipBuy = true;
            // this.globalDict.sellAt10Live = true;
            // this.universalDict.enableTrading = false;
            this.globalDict.peakDef = 10;
            this.globalDict.peakAndFallDef = 0;
            this.globalDict.upperLimit = 0;
            this.globalDict.prebuyStoploss = 0;
        }

        // Data initialization removed - now using simplified event emission

        // Set strike base and diff based on weekday
        const today = new Date().getDay();
        const expiryDay = parseInt(this.universalDict.expiry || 3);
        
        if (today === expiryDay) {
            this.universalDict.strikeBase = 165;
            this.universalDict.strikeDiff = 35;
            this.universalDict.strikeLowest = 150;
            this.isExpiryDay = true;
        } else if (today === expiryDay - 1) {
            this.universalDict.strikeBase = 165;
            this.universalDict.strikeDiff = 35;
            this.universalDict.strikeLowest = 150;
        } else {
            this.universalDict.strikeBase = 170;
            this.universalDict.strikeDiff = 30;
            this.universalDict.strikeLowest = 150;
        }

        this.strategyUtils.logStrategyInfo(`Range: ${this.universalDict.strikeBase} - ${this.universalDict.strikeBase + this.universalDict.strikeDiff}`);

        // Sort ticks by least deviation from target price (200 on normal days, 100 on expiry day)
        // const targetPrice = today === expiryDay ? 100 : 200;
        const targetPrice = 200;
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
        
        let acceptedTokens = rangeResult.acceptedTokens;
        let rejectedTokens = rangeResult.rejectedTokens;

        // let data = this.checkAcceptedTokens();
        // if(data.status) {
        //     acceptedTokens = data.acceptedTokens;
        // }
        // else {
        //     this.announceAcceptedTokens(acceptedTokens);
        // }

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
                const tick = ticks.find(t => t.instrument_token === token);
                return tick ? tick.symbol : null;
            }
        );
        
        this.universalDict.ceTokens = ceTokens;
        this.universalDict.peTokens = peTokens;

        this.strategyUtils.logStrategyInfo(`CE Tokens: ${this.universalDict.ceTokens.length}`);
        this.strategyUtils.logStrategyInfo(`PE Tokens: ${this.universalDict.peTokens.length}`);

        // Check if we have at least one CE token and one PE token
        if (this.universalDict.ceTokens.length === 0 || this.universalDict.peTokens.length === 0) {
            this.strategyUtils.logStrategyInfo(`Insufficient token types - CE: ${this.universalDict.ceTokens.length}, PE: ${this.universalDict.peTokens.length}. Waiting for more ticks...`);
            return; // Stay in INIT block and wait for more ticks
        }

        this.strategyUtils.logStrategyInfo(`Token requirements met - CE: ${this.universalDict.ceTokens.length}, PE: ${this.universalDict.peTokens.length}`);

        // Set observed ticks
        this.universalDict.observedTicks = acceptedTokens.sort((a, b) => {
            const aTick = ticks.find(t => t.instrument_token === a);
            const bTick = ticks.find(t => t.instrument_token === b);
            return aTick.last_price - bTick.last_price;
        });

        this.strategyUtils.logStrategyInfo(`Observed ticks set: ${this.universalDict.observedTicks.length}`);

        // Transition to next block only if we have sufficient tokens
        this.blockInit = false;
        this.blockUpdate = true;
        
        console.log('Transitioning from INIT to UPDATE block');
        
        // Emit real-time block transition notification
        this.emitBlockTransition('INIT', 'UPDATE', {
            acceptedTokens: acceptedTokens.length,
            ceTokens: this.universalDict.ceTokens.length,
            peTokens: this.universalDict.peTokens.length
        });
    }

    processUpdateBlock(ticks) {
        console.log('Processing UPDATE block');
        
        const currentTime = new Date().toISOString();
        this.globalDict.timestamp = currentTime;

        // Initialize or update instrument data for all observed tokens
        for (const tick of ticks) {
            const token = tick.instrument_token;
            
            // if (!this.universalDict.observedTicks.includes(token)) {
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
                    flagInterim: false,
                    flagCancel24: false,
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

            // Update peak if new high
            if (newPrice > instrument.peak) {
                instrument.prevPeak = instrument.peak;
                instrument.peak = newPrice;
                instrument.peakTime = currentTime;
                
                if (this.universalDict.ceTokens.includes(token) || this.universalDict.peTokens.includes(token)) {
                    this.strategyUtils.logStrategyInfo(`PEAK: ${instrument.peak} SYMBOL: ${instrument.symbol}`);
                }
            }

            // Update buy-related metrics
            if (instrument.buyPrice > -1) {
                instrument.changeFromBuy = newPrice - instrument.buyPrice;
            }

            if(this.prebuyBoughtToken){
                if(instrument.token == this.prebuyBoughtToken && instrument.last < this.prebuyLowTrackingPrice){
                    console.log(`📉 UPDATE Block - New low detected! ${instrument.last} < ${this.prebuyLowTrackingPrice}`);
                    this.prebuyLowTrackingPrice = instrument.last;
                    this.prebuyLowTrackingTime = this.globalDict.timestamp;
                    // Track the low but don't emit real-time updates
                }
            }

            // Update peak2 if applicable
            // if (instrument.peak2 > -1 && newPrice > instrument.peak2) {
            //     instrument.peak2 = newPrice;
            // }
        }

        // Use StrategyUtils sequential filtering flow
        if(!this.interimLowReached){
            const flags = {
                mainToken: this.mainToken,
                oppToken: this.oppToken,
                cePlus3: this.cePlus3,
                pePlus3: this.pePlus3,
                interimLowReached: this.interimLowReached,
                calcRefReached: this.calcRefReached,
                interimLowDisabled: this.interimLowDisabled,
                mtmFirstOption: this.mtmFirstOption
            };

            const result = this.strategyUtils.applySequentialFilterFlow(
                this.universalDict.observedTicks,
                this.universalDict.instrumentMap,
                this.universalDict.ceTokens,
                this.universalDict.peTokens,
                flags,
                this.globalDict
            );
            
            // Update strategy state with results
            if (result.success) {
                this.mainToken = result.flags.mainToken;
                this.oppToken = result.flags.oppToken;
                this.cePlus3 = result.flags.cePlus3;
                this.pePlus3 = result.flags.pePlus3;
                this.interimLowReached = result.flags.interimLowReached;
                this.calcRefReached = result.flags.calcRefReached;
                this.mtmFirstOption = result.flags.mtmFirstOption;
            }
        }

        if(!this.interimLowReached && this.onlyCheckPrebuyTokens()){
            this.strategyUtils.logStrategyInfo('Prebuy tokens found. Jumping to Prebuy.');
            this.interimLowReached = true;
        }
        // Check if we should transition to final ref
        if (this.shouldTransitionToFinalRef() && !this.blockFinalRef && !this.finalRefCompleted) {
            // this.blockUpdate = false;
            this.blockFinalRef = true;
            
            // Emit real-time block transition notification
            this.emitBlockTransition('UPDATE', 'FINAL_REF', {
                reason: this.interimLowReached ? 'Interim low reached' : 'Calc ref reached',
                interimLowReached: this.interimLowReached,
                calcRefReached: this.calcRefReached
            });
        }
        // Note: UPDATE block continues monitoring until transition conditions are met
        // This is by design - the block monitors for interimLowReached or calcRefReached
        // If these conditions are never met, the strategy may need to be reviewed
    }

    async processFinalRefBlock(ticks) {
        // this.strategyUtils.logStrategyInfo('Processing FINAL REF block');
        if(!this.buyingCompleted){
            if (this.interimLowReached && !this.refCapture) {
                this.refCapture = true;
                this.strategyUtils.logStrategyInfo('Interim low reached, capturing reference');

                let mainOption = (this.mainToken != null) ? this.universalDict.instrumentMap[this.mainToken]: null;
                let oppOption = (this.oppToken != null) ? this.universalDict.instrumentMap[this.oppToken]: null;
                let isSumOver390 = false;
                let closestCE = null;
                let closestPE = null;

                if (isSumOver390 || true){
                    // Find closest symbols below 200 for both CE and PE
                    closestCE = this.strategyUtils.findClosestCEBelowPrice(
                        this.universalDict.instrumentMap, 
                        200, 
                        200
                    );
                    
                    closestPE = this.strategyUtils.findClosestPEBelowPrice(
                        this.universalDict.instrumentMap, 
                        200, 
                        200
                    );
                    
                    if (!closestCE || !closestPE) {
                        this.strategyUtils.logStrategyError('Could not find suitable CE or PE symbols below 200');
                        return;
                    }
                }
                else {
                    // If sum is less than 390, use the main token and opp token as the closest CE and PE
                    closestCE = mainOption.symbol.includes('CE') ? mainOption : oppOption;
                    closestPE = mainOption.symbol.includes('PE') ? mainOption : oppOption;
                }
                // Assign boughtToken and oppBoughtToken based on mtmFirstOption
                let closestCEToken = closestCE.token.toString();
                let closestPEToken = closestPE.token.toString();
                
                this.mtmFirstOption = {symbol: '0000CE'};

                if (this.mtmFirstOption) {
                    const firstOptionType = this.mtmFirstOption.symbol.includes('CE') ? 'CE' : 'PE';
                    if (firstOptionType === 'CE') {
                        this.boughtToken = closestCEToken;
                        this.oppBoughtToken = closestPEToken;
                        this.strategyUtils.logStrategyInfo(`MTM First Option is CE ${closestCE.symbol}`);
                        this.strategyUtils.logStrategyInfo(`Opposite Token: ${closestPE.symbol}`);
                    } else {
                        this.boughtToken = closestPEToken;
                        this.oppBoughtToken = closestCEToken;
                        this.strategyUtils.logStrategyInfo(`MTM First Option is PE ${closestPE.symbol}`);
                        this.strategyUtils.logStrategyInfo(`Opposite Token: ${closestCE.symbol}`);
                    }

                    let x = this.universalDict.instrumentMap[this.boughtToken];
                    let y = this.universalDict.instrumentMap[this.oppBoughtToken];

                    let data = this.checkPrebuyTokens();
                    if(data.status){
                        this.boughtToken = data.prebuyTokens[0].token.toString();
                        this.oppBoughtToken = data.prebuyTokens[1].token.toString();
                        this.universalDict.instrumentMap[this.boughtToken] = data.prebuyTokens[0];
                        this.universalDict.instrumentMap[this.oppBoughtToken] = data.prebuyTokens[1];
                    }
                    else {
                        this.announcePrebuy([x, y]);
                    }

                } else {
                    // Fallback: use CE as bought token, PE as opposite
                    this.boughtToken = closestCEToken;
                    this.oppBoughtToken = closestPEToken;
                    this.strategyUtils.logStrategyInfo(`Fallback - Bought Token: ${closestCE.symbol}`);
                    this.strategyUtils.logStrategyInfo(`Opposite Token: ${closestPE.symbol}`);
                }
                
                // Place orders for both tokens
                this.placeOrdersForTokens();
                this.buyingCompleted = true;
            }
            else if (this.calcRefReached) {
                this.strategyUtils.logStrategyInfo('Calc ref reached');
                this.blockFinalRef = false;
                this.blockRef3 = true;
                this.strategyUtils.logStrategyInfo('Transitioning from FINAL REF to REF3 block');
            }
        }
            
        if(!this.universalDict.usePrebuy){
            // Transition to diff10 block
            this.blockFinalRef = false;
            this.blockDiff10 = true;
            this.finalRefCompleted = true;
            this.strategyUtils.logStrategyInfo('Transitioning from FINAL REF to DIFF10 block');
            
            // Emit real-time notifications
            this.emitBlockTransition('FINAL_REF', 'DIFF10', {
                boughtSymbol: this.universalDict.instrumentMap[this.boughtToken]?.symbol,
                oppSymbol: this.universalDict.instrumentMap[this.oppBoughtToken]?.symbol,
                ordersPlaced: true
            });
        }
        else {
            let ce_instrument = this.universalDict.instrumentMap[this.boughtToken].symbol.includes('CE') ? this.universalDict.instrumentMap[this.boughtToken] : this.universalDict.instrumentMap[this.oppBoughtToken];
            let pe_instrument = this.universalDict.instrumentMap[this.oppBoughtToken].symbol.includes('PE') ? this.universalDict.instrumentMap[this.oppBoughtToken] : this.universalDict.instrumentMap[this.boughtToken];
            let ce_change = ce_instrument.last - ce_instrument.buyPrice;
            let pe_change = pe_instrument.last - pe_instrument.buyPrice;
            console.log(`PREBUY: CE CHANGE: ${ce_change} PE CHANGE: ${pe_change}`);
            let real_instrument = null;
            let filter = this.globalDict.prebuyStoploss >= 0 ? (ce_change >= this.globalDict.prebuyStoploss || pe_change >= this.globalDict.prebuyStoploss) : (ce_change <= this.globalDict.prebuyStoploss || pe_change <= this.globalDict.prebuyStoploss);
            // Check if previousRebuyData has required fields before using isPriceAtCost()
            // let filter_x = this.universalDict.cycles >= 2 && this.previouslyTargetHit && this.previousRebuyData.token && this.previousRebuyData.rebuy_price !== undefined ? this.isPriceAtCost() : filter;
            let filter_x = filter;
            if (filter_x && !this.prebuyHit){
                this.prebuyHit = true;
                let closestCEto200 = null;
                let closestPEto200 = null;

                if(this.isPriceAtCost()){
                    closestPEto200 = this.universalDict.instrumentMap[this.previousRebuyData.pe_token];
                    closestCEto200 = this.universalDict.instrumentMap[this.previousRebuyData.ce_token];
                }
                else {
                    closestPEto200 = this.universalDict.instrumentMap[this.strategyUtils.findClosestPEBelowPrice(this.universalDict.instrumentMap, 200, 200).token.toString()];
                    closestCEto200 = this.universalDict.instrumentMap[this.strategyUtils.findClosestCEBelowPrice(this.universalDict.instrumentMap, 200, 200).token.toString()];
                    this.previousRebuyData.ce_token = closestCEto200.token.toString();
                    this.previousRebuyData.pe_token = closestPEto200.token.toString();
                }
                // let closestPEto200 = this.universalDict.instrumentMap[this.mainToken].symbol.includes('PE') ? this.universalDict.instrumentMap[this.mainToken] : this.universalDict.instrumentMap[this.oppToken];
                // let closestCEto200 = this.universalDict.instrumentMap[this.mainToken].symbol.includes('CE') ? this.universalDict.instrumentMap[this.mainToken] : this.universalDict.instrumentMap[this.oppToken];

                // If repetition is not observed.
                let filter_2 = this.globalDict.prebuyStoploss >= 0 ? (ce_change >= this.globalDict.prebuyStoploss) : (ce_change <= this.globalDict.prebuyStoploss);
                if(!this.repetition.observed){
                    real_instrument = filter_2
                    ? (this.globalDict.buySame ? closestCEto200 : closestPEto200)
                    : (this.globalDict.buySame ? closestPEto200 : closestCEto200);
                }

                // If repetition is observed.
                else {
                    real_instrument = this.repetition.type == 'CE' ? closestCEto200 : closestPEto200;
                    this.strategyUtils.logStrategyInfo(`Repetition observed: ${this.repetition.type}. Buying type again.`);
                }

                this.prebuyBuyPriceOnce = real_instrument.last;
                console.log(`REAL INSTRUMENT: ${real_instrument.symbol}`);
                this.prebuyBoughtToken = real_instrument.token;
                // BUY LOGIC - Buy the real instrument
                try {
                    const buyResult = await this.buyInstrument(real_instrument);
                    if (buyResult && buyResult.success) {
                        this.strategyUtils.logStrategyInfo(`Real instrument bought - Executed price: ${buyResult.executedPrice}`);
                    }
                    this.prebuyBuyPriceOnce = buyResult.executedPrice == 0 ? real_instrument.last : buyResult.executedPrice;
                    this.prebuyLowTrackingPrice = this.prebuyBuyPriceOnce;
                }
                catch (error) {
                    this.strategyUtils.logStrategyError(`Error buying real instrument: ${error.message}`);
                }

                // Emit instrument data update to show the real bought instrument
                this.emitInstrumentDataUpdate();

                this.blockFinalRef = false;
                this.blockDiff10 = true;
                this.finalRefCompleted = true;
                this.previouslyTargetHit = false;
                this.previouslyExitAtCost = false;
                this.strategyUtils.logStrategyInfo('Transitioning from FINAL REF to DIFF10 block');
                
                // Emit real-time notifications
                this.emitBlockTransition('FINAL_REF', 'DIFF10', {
                    boughtSymbol: real_instrument?.symbol,
                    oppSymbol: real_instrument.symbol.includes('CE') ? "000PE" : "000CE",
                    ordersPlaced: true
                });
            }
            if(!this.savedState['target']){
                // this.savedState['target'] = this.globalDict.target;
                this.savedState['stoploss'] = this.globalDict.stoploss;
                this.savedState['quantity'] = this.globalDict.quantity;
            }

        }
    }

    processRef3Block(ticks) {
        console.log('Processing REF3 block');
        
        // Check if either token has reached calc ref
        if (this.shouldCaptureRef()) {
            this.refCapture = true;
            this.strategyUtils.logStrategyInfo('Reference captured');
            
            // Transition to diff10 block
            this.blockRef3 = false;
            this.blockDiff10 = true;
            this.strategyUtils.logStrategyInfo('Transitioning from REF3 to DIFF10 block');
        }
    }

    async processDiff10Block(ticks) {

        // In prebuy mode, use the real bought instrument for tracking
        let instrument_1, instrument_2;
        
        if (this.universalDict.usePrebuy && this.prebuyBoughtToken) {
            // Use the real bought instrument for prebuy mode
            instrument_1 = this.universalDict.instrumentMap[this.prebuyBoughtToken];
            instrument_2 = {
                token: "000000",
                time: "N/A",
                symbol: instrument_1.symbol.includes('CE') ? "000PE" : "000CE",
                firstPrice: 0,
                last: 0,
                open: 0,
                peak: 0,
                prevPeak: 0,
                lowAtRef: 0,
                plus3: 0,
                change: 0,
                peakAtRef: 0,
                peakTime: null,
                buyPrice: 0,
                changeFromBuy: 0,
                calcRef: 0,
                prevCalcRef: 0,
                flagPlus3: false,
                flagPeakAndFall: false,
                flagCalcRef: false,
                flagInterim: false,
                flagCancel24: false,
            };
        } else {
            // Regular MTM mode
            instrument_1 = this.universalDict.instrumentMap[this.boughtToken];
            instrument_2 = this.universalDict.instrumentMap[this.oppBoughtToken];
        }

        if (!instrument_1 || !instrument_2) {
            this.strategyUtils.logStrategyError('Cannot process DIFF10 block - instrument data not found');
            return;
        }

        const instrument_1_original_change = instrument_1.last - instrument_1.buyPrice;
        const instrument_2_original_change = instrument_2.last - instrument_2.buyPrice;
        let mtm = instrument_1_original_change + instrument_2_original_change;

        console.log(`${instrument_1.symbol} ${instrument_1_original_change} ${instrument_2.symbol} ${instrument_2_original_change} MTM:${mtm}`);
        console.log(`TARGET: ${this.globalDict.target}, STOPLOSS: ${this.globalDict.stoploss}, QUANTITY: ${this.globalDict.quantity}`);
        console.log(`BUY PRICE: ${instrument_1.buyPrice}`);













        this.updateCycleInstanceSet();

        // PREBUY LOW TRACKING LOGIC.
        if(this.universalDict.usePrebuy && this.prebuyBoughtToken && instrument_1.token == this.prebuyBoughtToken){
            console.log(`🔍 Checking low tracking - Current: ${instrument_1.last}, Tracking: ${this.prebuyLowTrackingPrice}`);
            if(instrument_1.last < this.prebuyLowTrackingPrice){
                console.log(`📉 New low detected! ${instrument_1.last} < ${this.prebuyLowTrackingPrice}`);
                this.strategyUtils.logStrategyInfo(`New low detected! ${instrument_1.last} < ${this.prebuyLowTrackingPrice}`);
                this.prebuyLowTrackingPrice = instrument_1.last;
            }
        }
        
        // PREBUY HALF TARGET OBSERVER.
        if(!this.reachedHalfTarget && this.universalDict.usePrebuy){
            this.reachedHalfTarget = (instrument_1.last - instrument_1.buyPrice) >= this.globalDict.halfTargetThreshold;
        }

        // PREBUY TARGET NET OBSERVER.
        if(!this.targetNet && this.universalDict.usePrebuy && this.actualRebuyDone){
            this.targetNet = (instrument_1.last - instrument_1.buyPrice) >= ((this.globalDict.target/2) - 0.5); // Casting net if price within 1 point of target
            if(this.targetNet){
                this.strategyUtils.logStrategyInfo(`Target net casted for ${instrument_1.symbol}`);
            }
        }

        // SL2A OBSERVER.
        if(this.actualRebuyDone && ((instrument_1.last - instrument_1.buyPrice) >= (0.75*(this.globalDict.target/2))) && !this.sl2a && this.exit_at_stoploss){
            this.strategyUtils.logStrategyInfo('SL2A hit');
            this.sl2a = true
        }

        
        
        // TARGET OBSERVER.
        // ================================
        const hit_7 = (this.actualRebuyDone && ((this.targetNet && mtm >= (this.globalDict.target/2)) || (this.targetNet && mtm <= (this.globalDict.target/2) - 0.5)));
        const reached_stoploss = mtm <= this.globalDict.stoploss && false;
        if(!this.entry_7){
            this.entry_7 = (hit_7 || reached_stoploss) && !this.entry_24 && !this.entry_36 && !this.entry_plus_24;
        }

        if(this.entry_7){
            this.boughtSold = true;
            // if (this.universalDict.cycles == 0){
            //     this.writeToGlobalOutput("MTM HIT");
            // }
            let sellResult = null;
            // SELL LOGIC - Sell both instruments at target or stoploss
            if(!this.universalDict.usePrebuy){
                try {
                    sellResult = await this.sellBothInstruments(instrument_1, instrument_2);
                    if (sellResult && sellResult.success) {
                        this.strategyUtils.logStrategyInfo(`Both instruments sold - Executed prices: ${JSON.stringify(sellResult.executedPrices)}`);
                    } else {
                        this.strategyUtils.logStrategyError('Failed to sell both instruments at target/stoploss');
                    }
                } catch (error) {
                    this.strategyUtils.logStrategyError(`Error selling both instruments: ${error.message}`);
                }
            }
            else {
                // this.targetHitByTypeArray.push(instrument_1.symbol.includes('CE') ? 'CE' : 'PE');
                try {
                    sellResult = await this.sellInstrument(instrument_1);
                    if (sellResult && sellResult.success) {
                        this.strategyUtils.logStrategyInfo(`First instrument sold at target/stoploss - Executed price: ${sellResult.executedPrice}`);
                    } else {
                        this.strategyUtils.logStrategyError('Failed to sell first instrument at target/stoploss');
                    }
                }
                catch (error) {
                    this.strategyUtils.logStrategyError(`Error selling instrument: ${error.message}`);
                }

                // // this.globalDict.target = this.savedState['target'];
                this.globalDict.stoploss = this.savedState['stoploss'];
                this.globalDict.quantity = this.savedState['quantity'];
                this.strategyUtils.logStrategyInfo(`Target: ${this.globalDict.target}, Stoploss: ${this.globalDict.stoploss}, Quantity: ${this.globalDict.quantity} RESET COMPLETED.`);

                this.announceTargetHit();
                // this.previouslyTargetHit = true;
                this.announcePreviousCompletionMethod('TARGET_HIT');

                // this.afterTarget = true;

                // if(!this.secondBought){
                //     this.secondBought = true;
                //     // Select opposite instrument
                //     instrument_1 = instrument_1.symbol.includes('CE')
                //     ? this.universalDict.instrumentMap[this.strategyUtils.findClosestPEBelowPrice(this.universalDict.instrumentMap, 200, 200).token.toString()]
                //     : this.universalDict.instrumentMap[this.strategyUtils.findClosestCEBelowPrice(this.universalDict.instrumentMap, 200, 200).token.toString()];

                //     this.prebuyBoughtToken = instrument_1.token;

                //     // BUY opposite instrument
                //     instrument_1.buyPrice = instrument_1.last;
                //     let buyResult = null;
                //     try {
                //         buyResult = await this.buyInstrument(instrument_1);
                //         if (buyResult && buyResult.success) {
                //             this.strategyUtils.logStrategyInfo(`Real instrument bought - Executed price: ${buyResult.executedPrice}`);
                //         }
                //         this.prebuyBuyPriceTwice = buyResult.executedPrice == 0 ? instrument_1.last : buyResult.executedPrice;
                //         this.prebuyLowTrackingPrice = this.prebuyBuyPriceTwice;
                //         instrument_1.buyPrice = this.prebuyBuyPriceTwice;
                //         this.universalDict.instrumentMap[this.prebuyBoughtToken].buyPrice = this.prebuyBuyPriceTwice;
                //         this.rebuyDone = true;
                //         this.rebuyPrice = this.prebuyBuyPriceTwice;
                //         this.rebuyAveragePrice = this.prebuyBuyPriceTwice;
                //         this.prebuyBuyPriceOnce = this.prebuyBuyPriceTwice;
                //         mtm = 0;
                //     }
                //     catch (error) {
                //         this.strategyUtils.logStrategyError(`Error buying instrument 1: ${error.message}`);
                //     }

                //     this.resetFilters();

                // }
                // else {
                //     this.boughtSold = true;
                // }
                // PREBUY REPETITION OBSERVER.

                if(this.targetHitByTypeArray.length > 1 && false){
                    let repeated = this.targetHitByTypeArray.at(-1) == this.targetHitByTypeArray.at(-2) ? true : false;
                    if(repeated){
                        this.repetition.observed = true;
                        this.repetition.type = this.targetHitByTypeArray.at(-1);
                        this.strategyUtils.logStrategyInfo(`Repetition observed: ${this.repetition.type}`);
                    }
                    else {
                        this.repetition.observed = false;
                        this.repetition.type = null;
                        this.strategyUtils.logStrategyInfo(`Repetition not observed: ${this.repetition.type}`);
                    }
                }
                
            }
        }
        
        // PREBUY SELL LOGIC.
        if(this.universalDict.usePrebuy && !this.entry_7){
            console.log(`🔍 Checking real buy stoploss - Current: ${instrument_1_original_change}, Stoploss: ${this.globalDict.realBuyStoploss}, Real buy stoploss hit: ${this.realBuyStoplossHit}, Reached half target: ${this.reachedHalfTarget}`);

            if(this.shouldPlayScenarioSL1()){
                await this.scenarioSL1();
            }

            if(this.shouldPlayScenarioSL3()){
                await this.scenarioSL3();
            }

            if(this.shouldPlayScenarioSL4()){
                await this.scenarioSL4();
            }

            if(this.shouldPlayScenarioSL2()){
                await this.scenarioSL2();
            }

            if(this.shouldPlayScenarioSL2A()){
                await this.scenarioSL2A();
            }

            if(this.shouldPlayScenario1A()){
                await this.scenario1A();
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

            // if(this.secondBought){
            //     this.resetFilters();
            // }
        }

        // Check if cycle is complete
        if (this.boughtSold) {
            this.blockDiff10 = false;
            this.blockNextCycle = true;
            this.strategyUtils.logStrategyInfo('Transitioning from DIFF10 to NEXT CYCLE block');
            
            // Emit real-time cycle completion notification
            this.emitBlockTransition('DIFF10', 'NEXT_CYCLE', {
                cycleCompleted: true,
                currentCycle: this.universalDict.cycles || 1
            });
        }
        
        // if (instrument_1.flagCancel24 && instrument_2.flagCancel24){
        //     instrument_1.flagCancel24 = false;
        //     instrument_2.flagCancel24 = false;
        //     this.strategyUtils.logStrategyInfo(`24 points cancellation reset for both instruments`);
        // }
    }

    processNextCycleBlock(ticks) {
        // this.strategyUtils.logStrategyInfo('Processing NEXT CYCLE block');


        if(!this.setInstanceComplete){
            this.appendCompletionState();
            this.setInstanceComplete = true;
        }

        this.updateCycleInstanceSet();

        if(this.isInstancesComplete()){
        
            // Reset for next cycle
            this.resetForNextCycle();
            
            this.blockNextCycle = false;
            this.blockInit = true;
            this.strategyUtils.logStrategyInfo('Transitioning from NEXT CYCLE to INIT block');
            
            // Emit cycle restart notification
            this.emitBlockTransition('NEXT_CYCLE', 'INIT', {
                cycleNumber: this.universalDict.cycles || 1,
                cycleReset: true,
                message: `Starting cycle ${this.universalDict.cycles || 1}`
            });
        }
    }

    async scenario1A(){
        let instrument_1 = this.universalDict.instrumentMap[this.prebuyBoughtToken];
        // this.thirdBought = this.secondBought;
        this.boughtSold = true;
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
                // this.globalDict.target = this.globalDict.target + Math.abs(diff);
            }
        }
        catch (error) {
            this.strategyUtils.logStrategyError(`Error selling instrument 1: ${error.message}`);
        }

        this.announceExitAtStoploss();
        // this.globalDict.target = this.savedState['target'];
        this.globalDict.stoploss = this.savedState['stoploss'];
        this.globalDict.quantity = this.savedState['quantity'];
        this.strategyUtils.logStrategyInfo(`Target: ${this.globalDict.target}, Stoploss: ${this.globalDict.stoploss}, Quantity: ${this.globalDict.quantity} RESET COMPLETED.`);

        // // Select opposite instrument
        // instrument_1 = instrument_1.symbol.includes('CE')
        // ? this.universalDict.instrumentMap[this.strategyUtils.findClosestPEBelowPrice(this.universalDict.instrumentMap, 205, 205).token.toString()]
        // : this.universalDict.instrumentMap[this.strategyUtils.findClosestCEBelowPrice(this.universalDict.instrumentMap, 205, 205).token.toString()];

        // this.prebuyBoughtToken = instrument_1.token;

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
        //     this.universalDict.instrumentMap[this.prebuyBoughtToken].buyPrice = this.prebuyBuyPriceTwice;
        //     this.rebuyDone = true;
        //     this.rebuyPrice = this.prebuyBuyPriceTwice;
        //     this.rebuyAveragePrice = this.prebuyBuyPriceTwice;
        //     this.prebuyBuyPriceOnce = this.prebuyBuyPriceTwice;
        // }
        // catch (error) {
        //     this.strategyUtils.logStrategyError(`Error buying instrument 1: ${error.message}`);
        // }

        // Emit instrument data update after second buy
        this.emitInstrumentDataUpdate();

    }

    async scenario1B(){
        let instrument_1 = this.universalDict.instrumentMap[this.prebuyBoughtToken];
        this.boughtSold = true;
        this.scenario1Bdone = true;
        // this.thirdBought = this.secondBought;
        // this.secondBought = true;
        this.strategyUtils.logStrategyInfo(`Scenario 1B in action.`)

        //SELL
        this.strategyUtils.logStrategyInfo('Selling existing instrument and buying opposite.');
        // this.announceExitAtCost();
        // this.realBuyStoplossHit = true;
        let sellResult = null;
        let diff = 0;
        try {
            sellResult = await this.sellInstrument(instrument_1);
            if (sellResult && sellResult.success) {
                this.strategyUtils.logStrategyInfo(`Real instrument sold - Executed price: ${sellResult.executedPrice}`);
                diff = sellResult.executedPrice == 0 ? instrument_1.last - instrument_1.buyPrice : sellResult.executedPrice - instrument_1.buyPrice;
                // this.globalDict.target = this.globalDict.target + Math.abs(diff);
            }
        }
        catch (error) {
            this.strategyUtils.logStrategyError(`Error selling instrument 1: ${error.message}`);
        }

        // this.globalDict.target = this.savedState['target'];
        this.globalDict.stoploss = this.savedState['stoploss'];
        this.globalDict.quantity = this.savedState['quantity'];
        this.strategyUtils.logStrategyInfo(`Target: ${this.globalDict.target}, Stoploss: ${this.globalDict.stoploss}, Quantity: ${this.globalDict.quantity} RESET COMPLETED.`);

        // // Select opposite instrument
        // instrument_1 = instrument_1.symbol.includes('CE')
        // ? this.universalDict.instrumentMap[this.strategyUtils.findClosestPEBelowPrice(this.universalDict.instrumentMap, 205, 205).token.toString()]
        // : this.universalDict.instrumentMap[this.strategyUtils.findClosestCEBelowPrice(this.universalDict.instrumentMap, 205, 205).token.toString()];

        // this.prebuyBoughtToken = instrument_1.token;

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
        //     this.universalDict.instrumentMap[this.prebuyBoughtToken].buyPrice = this.prebuyBuyPriceTwice;
        //     this.rebuyDone = true;
        //     this.rebuyPrice = this.prebuyBuyPriceTwice;
        //     this.rebuyAveragePrice = this.prebuyBuyPriceTwice;
        //     this.prebuyBuyPriceOnce = this.prebuyBuyPriceTwice;
        // }
        // catch (error) {
        //     this.strategyUtils.logStrategyError(`Error buying instrument 1: ${error.message}`);
        // }

        // Emit instrument data update after second buy
        this.emitInstrumentDataUpdate();


    }

    async scenario1C(){
        let instrument_1 = this.universalDict.instrumentMap[this.prebuyBoughtToken];
        this.scenario1Cdone = true;
        this.strategyUtils.logStrategyInfo(`Scenario 1C in action.`)

        //REBUY
        this.actualRebuyDone = true;
        this.prebuyBuyPriceTwice = instrument_1.last;
        // let averagePrice = (this.prebuyBuyPriceOnce + this.prebuyBuyPriceTwice) / 2;
        let averagePrice = this.prebuyBuyPriceOnce + (this.globalDict.rebuyAt/2);
        instrument_1.buyPrice = averagePrice;
        this.universalDict.instrumentMap[this.prebuyBoughtToken].buyPrice = averagePrice;
        let buyResult = null;
        try {
            buyResult = await this.buyInstrument(instrument_1);
            if (buyResult && buyResult.success) {
                this.strategyUtils.logStrategyInfo(`Real instrument bought again - Executed price: ${buyResult.executedPrice}`);
            }
            this.prebuyBuyPriceTwice = buyResult.executedPrice == 0 ? instrument_1.last : buyResult.executedPrice;
            this.rebuyDone = true;
            this.rebuyPrice = this.prebuyBuyPriceTwice;
            this.rebuyAveragePrice = averagePrice;

            // Update the real instrument's buy price to average of both buys
            instrument_1.buyPrice = averagePrice;
            this.universalDict.instrumentMap[this.prebuyBoughtToken].buyPrice = averagePrice;
            this.strategyUtils.logStrategyInfo(`New Buy Price is ${instrument_1.buyPrice}.`)
            // this.globalDict.target = this.globalDict.target / 2;
            this.globalDict.stoploss = this.globalDict.stoploss / 2;
            this.globalDict.quantity = this.globalDict.quantity * 2;
            this.previousRebuyData.rebuy_price = this.prebuyBuyPriceOnce + this.globalDict.rebuyAt;
            this.previousRebuyData.token = this.prebuyBoughtToken;
            this.announceRebuyData();
        }
        catch (error) {
            this.strategyUtils.logStrategyError(`Error buying instrument 1: ${error.message}`);
        }

        this.emitInstrumentDataUpdate();

    }

    async scenario1CA(){
        let instrument_1 = this.universalDict.instrumentMap[this.prebuyBoughtToken];
        this.boughtSold = true;
        this.scenario1CAdone = true;
        this.strategyUtils.logStrategyInfo(`Scenario 1CA in action.`)

        
        // this.thirdBought = this.secondBought;
        // this.secondBought = true;
        //SELL
        this.strategyUtils.logStrategyInfo('Selling existing instrument and buying opposite.');
        this.announceExitAtCost();
        // this.realBuyStoplossHit = true;
        let sellResult = null;
        let diff = 0;
        try {
            sellResult = await this.sellInstrument(instrument_1);
            if (sellResult && sellResult.success) {
                this.strategyUtils.logStrategyInfo(`Real instrument sold - Executed price: ${sellResult.executedPrice}`);
                diff = sellResult.executedPrice == 0 ? instrument_1.last - instrument_1.buyPrice : sellResult.executedPrice - instrument_1.buyPrice;
                // this.globalDict.target = this.globalDict.target + Math.abs(diff);
            }
            // this.globalDict.target = this.globalDict.target * 2;
            this.globalDict.stoploss = this.globalDict.stoploss * 2;
            this.globalDict.quantity = this.globalDict.quantity / 2;

        }
        catch (error) {
            this.strategyUtils.logStrategyError(`Error selling instrument 1: ${error.message}`);
        }

        // this.globalDict.target = this.savedState['target'];
        this.globalDict.stoploss = this.savedState['stoploss'];
        this.globalDict.quantity = this.savedState['quantity'];
        this.strategyUtils.logStrategyInfo(`Target: ${this.globalDict.target}, Stoploss: ${this.globalDict.stoploss}, Quantity: ${this.globalDict.quantity} RESET COMPLETED.`);
        this.announcePreviousCompletionMethod('EXIT_AT_COST');

        // // Select opposite instrument
        // instrument_1 = instrument_1.symbol.includes('CE')
        // ? this.universalDict.instrumentMap[this.strategyUtils.findClosestPEBelowPrice(this.universalDict.instrumentMap, 205, 205).token.toString()]
        // : this.universalDict.instrumentMap[this.strategyUtils.findClosestCEBelowPrice(this.universalDict.instrumentMap, 205, 205).token.toString()];

        // this.prebuyBoughtToken = instrument_1.token;

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
        //     this.universalDict.instrumentMap[this.prebuyBoughtToken].buyPrice = this.prebuyBuyPriceTwice;
        //     this.rebuyDone = true;
        //     this.rebuyPrice = this.prebuyBuyPriceTwice;
        //     this.rebuyAveragePrice = this.prebuyBuyPriceTwice;
        //     this.prebuyBuyPriceOnce = this.prebuyBuyPriceTwice;
        // }
        // catch (error) {
        //     this.strategyUtils.logStrategyError(`Error buying instrument 1: ${error.message}`);
        // }

        // Emit instrument data update after second buy
        this.emitInstrumentDataUpdate();

    }

    async scenarioSL(){
        let instrument_1 = this.universalDict.instrumentMap[this.prebuyBoughtToken];
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

            this.globalDict.stoploss = this.savedState['stoploss'];
            this.globalDict.quantity = this.savedState['quantity'];
            this.strategyUtils.logStrategyInfo(`Target: ${this.globalDict.target}, Stoploss: ${this.globalDict.stoploss}, Quantity: ${this.globalDict.quantity} RESET COMPLETED.`);
        }
        catch (error) {
            this.strategyUtils.logStrategyError(`Error selling instrument 1: ${error.message}`);
        }
    }

    async scenarioSL1(){
        let instrument_1 = this.universalDict.instrumentMap[this.prebuyBoughtToken];
        this.boughtSold = true;
        this.strategyUtils.logStrategyInfo(`Scenario SL1 in action.`)

        //SELL
        // this.strategyUtils.logStrategyInfo('Selling existing instrument and buying opposite.');
        // this.realBuyStoplossHit = true;
        let sellResult = null;
        // let diff = 0;
        try {
            sellResult = await this.sellInstrument(instrument_1);
            if (sellResult && sellResult.success) {
                this.strategyUtils.logStrategyInfo(`Real instrument sold - Executed price: ${sellResult.executedPrice}`);
                // diff = sellResult.executedPrice == 0 ? instrument_1.last - instrument_1.buyPrice : sellResult.executedPrice - instrument_1.buyPrice;
                // this.globalDict.target = this.globalDict.target + Math.abs(diff);
            }

            this.globalDict.stoploss = this.savedState['stoploss'];
            this.globalDict.quantity = this.savedState['quantity'];
            this.strategyUtils.logStrategyInfo(`Target: ${this.globalDict.target}, Stoploss: ${this.globalDict.stoploss}, Quantity: ${this.globalDict.quantity} RESET COMPLETED.`);
        }
        catch (error) {
            this.strategyUtils.logStrategyError(`Error selling instrument 1: ${error.message}`);
        }

        this.emitInstrumentDataUpdate();
    }

    async scenarioSL2(){
        let instrument_1 = this.universalDict.instrumentMap[this.prebuyBoughtToken];
        this.boughtSold = true;
        this.strategyUtils.logStrategyInfo(`Scenario SL2 in action.`)

        //SELL
        // this.strategyUtils.logStrategyInfo('Selling existing instrument and buying opposite.');
        // this.realBuyStoplossHit = true;
        let sellResult = null;
        // let diff = 0;
        try {
            sellResult = await this.sellInstrument(instrument_1);
            if (sellResult && sellResult.success) {
                this.strategyUtils.logStrategyInfo(`Real instrument sold - Executed price: ${sellResult.executedPrice}`);
                // diff = sellResult.executedPrice == 0 ? instrument_1.last - instrument_1.buyPrice : sellResult.executedPrice - instrument_1.buyPrice;
                // this.globalDict.target = this.globalDict.target + Math.abs(diff);
            }

            this.globalDict.stoploss = this.savedState['stoploss'];
            this.globalDict.quantity = this.savedState['quantity'];
            this.strategyUtils.logStrategyInfo(`Target: ${this.globalDict.target}, Stoploss: ${this.globalDict.stoploss}, Quantity: ${this.globalDict.quantity} RESET COMPLETED.`);
        }
        catch (error) {
            this.strategyUtils.logStrategyError(`Error selling instrument 1: ${error.message}`);
        }

        this.emitInstrumentDataUpdate();
    }

    async scenarioSL2A(){
        let instrument_1 = this.universalDict.instrumentMap[this.prebuyBoughtToken];
        this.boughtSold = true;
        this.strategyUtils.logStrategyInfo(`Scenario SL2A in action.`)

        //SELL
        // this.strategyUtils.logStrategyInfo('Selling existing instrument and buying opposite.');
        // this.realBuyStoplossHit = true;
        let sellResult = null;
        // let diff = 0;
        try {
            sellResult = await this.sellInstrument(instrument_1);
            if (sellResult && sellResult.success) {
                this.strategyUtils.logStrategyInfo(`Real instrument sold - Executed price: ${sellResult.executedPrice}`);
                // diff = sellResult.executedPrice == 0 ? instrument_1.last - instrument_1.buyPrice : sellResult.executedPrice - instrument_1.buyPrice;
                // this.globalDict.target = this.globalDict.target + Math.abs(diff);
            }

            this.globalDict.stoploss = this.savedState['stoploss'];
            this.globalDict.quantity = this.savedState['quantity'];
            this.strategyUtils.logStrategyInfo(`Target: ${this.globalDict.target}, Stoploss: ${this.globalDict.stoploss}, Quantity: ${this.globalDict.quantity} RESET COMPLETED.`);
        }
        catch (error) {
            this.strategyUtils.logStrategyError(`Error selling instrument 1: ${error.message}`);
        }

        this.emitInstrumentDataUpdate();
    }

    async scenarioSL3(){
        let instrument_1 = this.universalDict.instrumentMap[this.prebuyBoughtToken];
        this.boughtSold = true;
        this.strategyUtils.logStrategyInfo(`Scenario SL3 in action.`)

        //SELL
        // this.strategyUtils.logStrategyInfo('Selling existing instrument and buying opposite.');
        // this.realBuyStoplossHit = true;
        let sellResult = null;
        try {
            sellResult = await this.sellInstrument(instrument_1);
            if (sellResult && sellResult.success) {
                this.strategyUtils.logStrategyInfo(`Real instrument sold - Executed price: ${sellResult.executedPrice}`);
            }

            this.globalDict.stoploss = this.savedState['stoploss'];
            this.globalDict.quantity = this.savedState['quantity'];
            this.strategyUtils.logStrategyInfo(`Target: ${this.globalDict.target}, Stoploss: ${this.globalDict.stoploss}, Quantity: ${this.globalDict.quantity} RESET COMPLETED.`);
        }

        catch (error) {
            this.strategyUtils.logStrategyError(`Error selling instrument 1: ${error.message}`);
        }

        this.emitInstrumentDataUpdate();
    }

    async scenarioSL4(){
        let instrument_1 = this.universalDict.instrumentMap[this.prebuyBoughtToken];
        this.boughtSold = true;
        this.strategyUtils.logStrategyInfo(`Scenario SL4 in action.`)

        //SELL
        // this.strategyUtils.logStrategyInfo('Selling existing instrument and buying opposite.');
        // this.realBuyStoplossHit = true;
        let sellResult = null;
        try {
            sellResult = await this.sellInstrument(instrument_1);
            if (sellResult && sellResult.success) {
                this.strategyUtils.logStrategyInfo(`Real instrument sold - Executed price: ${sellResult.executedPrice}`);
            }

            this.globalDict.stoploss = this.savedState['stoploss'];
            this.globalDict.quantity = this.savedState['quantity'];
            this.strategyUtils.logStrategyInfo(`Target: ${this.globalDict.target}, Stoploss: ${this.globalDict.stoploss}, Quantity: ${this.globalDict.quantity} RESET COMPLETED.`);
        }

        catch (error) {
            this.strategyUtils.logStrategyError(`Error selling instrument 1: ${error.message}`);
        }

        this.emitInstrumentDataUpdate();
    }

    shouldPlayScenario1A(){
        let instrument_1 = this.universalDict.instrumentMap[this.prebuyBoughtToken];
        return !this.reachedHalfTarget && (instrument_1.last - instrument_1.buyPrice) <= this.globalDict.realBuyStoploss && !this.scenario1Adone && !this.scenario1Bdone && !this.scenario1Cdone && !this.boughtSold && false;
    }

    shouldPlayScenario1B(){
        let instrument_1 = this.universalDict.instrumentMap[this.prebuyBoughtToken];
        return this.reachedHalfTarget && (instrument_1.last <= instrument_1.buyPrice) && !this.scenario1Adone && !this.scenario1Bdone && !this.scenario1Cdone && !this.boughtSold && false;
    }

    shouldPlayScenario1C(){
        let instrument_1 = this.universalDict.instrumentMap[this.prebuyBoughtToken];
        return (instrument_1.last - instrument_1.buyPrice >= this.globalDict.rebuyAt) && !this.scenario1Adone && !this.scenario1Bdone && !this.scenario1Cdone && !this.boughtSold;
    }

    shouldPlayScenario1CA(){
        let instrument_1 = this.universalDict.instrumentMap[this.prebuyBoughtToken];
        return (instrument_1.last <= this.prebuyBuyPriceOnce) && this.scenario1Cdone && !this.scenario1CAdone && !this.boughtSold && !this.exit_at_stoploss;
    }

    shouldPlayScenarioSL(){
        let instrument_1 = this.universalDict.instrumentMap[this.prebuyBoughtToken];
        return (instrument_1.last - instrument_1.buyPrice <= this.globalDict.stoploss) && !this.boughtSold && false;
    }

    shouldPlayScenarioSL1(){
        return this.exit_at_cost && !this.boughtSold && !this.afterTarget && false;
    }

    shouldPlayScenarioSL2(){
        let instrument_1 = this.universalDict.instrumentMap[this.prebuyBoughtToken];
        return (instrument_1.last <= instrument_1.buyPrice) && this.exit_at_stoploss && !this.boughtSold && !this.scenario1Adone && !this.scenario1Bdone && !this.afterTarget;
    }

    shouldPlayScenarioSL2A(){
        let instrument_1 = this.universalDict.instrumentMap[this.prebuyBoughtToken];
        return this.sl2a && this.exit_at_stoploss && ((instrument_1.last - instrument_1.buyPrice) <= (0.5*(this.globalDict.target/2))) && !this.boughtSold && !this.scenario1Adone && !this.scenario1Bdone && false;
    }

    shouldPlayScenarioSL3(){
        return this.targetHit && !this.boughtSold && !this.afterTarget;
    }

    shouldPlayScenarioSL4(){
        return this.rebuyFound && !this.boughtSold && !this.afterTarget && !this.rebuyDataAnnounced;
    }

    resetFilters(){
        this.scenario1Adone = false;
        this.scenario1Bdone = false;
        this.scenario1Cdone = false;
        this.scenario1CAdone = false;
        this.scenarioSLDone = false;
        this.scenarioSL1Done = false;
        this.scenarioSL2Done = false;
        this.reachedHalfTarget = false;
        this.boughtSold = false;
        this.entry_7 = false;
        this.actualRebuyDone = false;
        this.targetNet = false;
        this.exit_at_cost = false;
        this.exit_at_stoploss = false;
        this.sl2a = false;
        this.rebuyFound = false;
    }

    shouldTransitionToFinalRef() {
        return this.interimLowReached || this.calcRefReached;
    }

    placeOrdersForTokens() {
        if (!this.boughtToken || !this.oppBoughtToken) {
            this.strategyUtils.logStrategyError('Cannot place orders - boughtToken or oppBoughtToken not set');
            return;
        }

        const boughtInstrument = this.universalDict.instrumentMap[this.boughtToken];
        const oppInstrument = this.universalDict.instrumentMap[this.oppBoughtToken];

        
        if (!boughtInstrument || !oppInstrument) {
            this.strategyUtils.logStrategyError('Cannot place orders - instrument data not found');
            return;
        }
        
        this.strategyUtils.logStrategyInfo('Placing orders for MTM strategy tokens');
        this.strategyUtils.logStrategyInfo(`Bought Token: ${boughtInstrument.symbol} @ ${boughtInstrument.last}`);
        this.strategyUtils.logStrategyInfo(`Opposite Token: ${oppInstrument.symbol} @ ${oppInstrument.last}`);
        
        // Check if trading is enabled
        const tradingEnabled = this.universalDict.enableTrading === true && this.universalDict.usePrebuy === false;
        this.strategyUtils.logStrategyInfo(`Trading enabled: ${tradingEnabled}`);
        
        // CRITICAL FIX: Ensure TradingUtils is available before proceeding
        if (!this.tradingUtils) {
            this.strategyUtils.logStrategyError('CRITICAL ERROR: TradingUtils not available - cannot place orders');
            this.strategyUtils.logStrategyError('This usually indicates a timing issue with TradingUtils injection');
            return;
        }
        
        // Use the injected TradingUtils instance (with proper credentials) instead of this.tradingUtils
        const tradingUtils = this.tradingUtils;
        
        try {
            if (tradingEnabled) {
                // Place order for bought token (mtmFirstOption) - synchronous
                const boughtOrderResult = tradingUtils.placeBuyOrder(
                    boughtInstrument.symbol,
                    boughtInstrument.last,
                    this.globalDict.quantity || 75
                );
                
                if (boughtOrderResult.success) {
                    this.strategyUtils.logStrategyInfo(`Buy order placed for ${boughtInstrument.symbol}`);
                    this.strategyUtils.logOrderPlaced('buy', boughtInstrument.symbol, boughtInstrument.last, this.globalDict.quantity || 75, this.boughtToken);
                } else {
                    this.strategyUtils.logStrategyError(`Failed to place buy order for ${boughtInstrument.symbol}: ${boughtOrderResult.error}`);
                    this.strategyUtils.logOrderFailed('buy', boughtInstrument.symbol, boughtInstrument.last, this.globalDict.quantity || 75, this.boughtToken, boughtOrderResult.error);
                }
                
                let boughtPrice = boughtInstrument.last;
                boughtOrderResult.orderId.then(orderId => {
                    // this.strategyUtils.logStrategyInfo(`Order ID: ${JSON.stringify(orderId)}`);
                    tradingUtils.getOrderHistory(orderId.order_id)
                    .then(result => {
                        this.strategyUtils.logStrategyInfo(`Order history: ${typeof result === 'object' ? JSON.stringify(result) : result}`);
                        boughtPrice = result.at(-1).average_price;
                        this.strategyUtils.logStrategyInfo(`Executed Price: ${boughtPrice}`);
                        boughtInstrument.buyPrice = boughtPrice != 0 ? boughtPrice : boughtInstrument.last;
                        this.strategyUtils.logStrategyInfo(`Bought Instrument Buy Price: ${this.universalDict.instrumentMap[this.boughtToken].buyPrice}`);
                    })
                    .catch(error => {
                        this.strategyUtils.logStrategyError(`Error getting order history: ${JSON.stringify(error)}`);
                    });
                }).catch(error => {
                    this.strategyUtils.logStrategyError(`Error getting order history: ${JSON.stringify(error)}`);
                });
                
                
                // Place order for opposite token - synchronous
                const oppOrderResult = tradingUtils.placeBuyOrder(
                    oppInstrument.symbol,
                    oppInstrument.last,
                    this.globalDict.quantity || 75
                );

                if (oppOrderResult.success) {
                    this.strategyUtils.logStrategyInfo(`Buy order placed for ${oppInstrument.symbol}`);
                    this.strategyUtils.logOrderPlaced('buy', oppInstrument.symbol, oppInstrument.last, this.globalDict.quantity || 75, this.oppBoughtToken);
                } else {
                    this.strategyUtils.logStrategyError(`Failed to place buy order for ${oppInstrument.symbol}: ${oppOrderResult.error}`);
                    this.strategyUtils.logOrderFailed('buy', oppInstrument.symbol, oppInstrument.last, this.globalDict.quantity || 75, this.oppBoughtToken, oppOrderResult.error);
                }
                
                let oppPrice = oppInstrument.last;
                oppOrderResult.orderId.then(orderId => {
                    tradingUtils.getOrderHistory(orderId.order_id)
                    .then(result => {
                        this.strategyUtils.logStrategyInfo(`Order history: ${typeof result === 'object' ? JSON.stringify(result) : result}`);
                        oppPrice = result.at(-1).average_price;
                        this.strategyUtils.logStrategyInfo(`Executed Price: ${oppPrice}`);
                        oppInstrument.buyPrice = oppPrice != 0 ? oppPrice : oppInstrument.last;
                        this.strategyUtils.logStrategyInfo(`Opposite Instrument Buy Price: ${this.universalDict.instrumentMap[this.oppBoughtToken].buyPrice}`);
                    })
                    .catch(error => {
                        this.strategyUtils.logStrategyError(`Error getting order history: ${JSON.stringify(error)}`);
                    });
                }).catch(error => {
                    this.strategyUtils.logStrategyError(`Error getting order history: ${JSON.stringify(error)}`);
                });
                
            } else {
                // Paper trading - log the orders without placing them
                this.strategyUtils.logStrategyInfo(`PAPER TRADING: Buy order for ${boughtInstrument.symbol} @ ${boughtInstrument.last}`);
                this.strategyUtils.logOrderPlaced('buy', boughtInstrument.symbol, boughtInstrument.last, this.globalDict.quantity || 75, this.boughtToken);
                
                this.strategyUtils.logStrategyInfo(`PAPER TRADING: Buy order for ${oppInstrument.symbol} @ ${oppInstrument.last}`);
                this.strategyUtils.logOrderPlaced('buy', oppInstrument.symbol, oppInstrument.last, this.globalDict.quantity || 75, this.oppBoughtToken);
                
                boughtInstrument.buyPrice = boughtInstrument.last;
                oppInstrument.buyPrice = oppInstrument.last;
            }

            boughtInstrument.buyPrice = boughtInstrument.last;
            oppInstrument.buyPrice = oppInstrument.last;


            this.strategyUtils.logStrategyInfo('Orders placed successfully for MTM strategy');
            this.strategyUtils.logStrategyInfo(`Total investment: ${(boughtInstrument.last + oppInstrument.last) * (this.globalDict.quantity || 75)}`);

            // Emit prebought instruments data
            const preboughtData = {
                type: 'prebought',
                ceInstrument: {
                    symbol: boughtInstrument.symbol.includes('CE') ? boughtInstrument.symbol : oppInstrument.symbol,
                    price: boughtInstrument.symbol.includes('CE') ? boughtInstrument.buyPrice : oppInstrument.buyPrice,
                    quantity: this.globalDict.quantity || 75,
                    token: boughtInstrument.symbol.includes('CE') ? this.boughtToken : this.oppBoughtToken
                },
                peInstrument: {
                    symbol: boughtInstrument.symbol.includes('PE') ? boughtInstrument.symbol : oppInstrument.symbol,
                    price: boughtInstrument.symbol.includes('PE') ? boughtInstrument.buyPrice : oppInstrument.buyPrice,
                    quantity: this.globalDict.quantity || 75,
                    token: boughtInstrument.symbol.includes('PE') ? this.boughtToken : this.oppBoughtToken
                },
                timestamp: this.formatTime24(new Date()),
                cycle: this.universalDict.cycles || 1
            };

            this.emitToUser('strategy_prebought_instruments', preboughtData);

        } catch (error) {
            this.strategyUtils.logStrategyError(`Exception while placing orders: ${error.message}`);
        }
    }

    shouldCaptureRef() {
        // Check if either main or opposite token has reached calc ref
        if (this.mainToken && this.universalDict.instrumentMap[this.mainToken]) {
            const mainInstrument = this.universalDict.instrumentMap[this.mainToken];
            if (mainInstrument.flagCalcRef) {
                return true;
            }
        }
        
        if (this.oppToken && this.universalDict.instrumentMap[this.oppToken]) {
            const oppInstrument = this.universalDict.instrumentMap[this.oppToken];
            if (oppInstrument.flagCalcRef) {
                return true;
            }
        }
        
        return false;
    }
    
    resetForNextCycle() {

        this.strategyUtils.logStrategyInfo('Resetting for next cycle');
        
        // Increment cycle count
        this.universalDict.cycles = (this.universalDict.cycles || 1) + 1;
        
        // Reset all flags and state
        this.setInstanceComplete = false;
        this.cycleInstanceSet = new Set();
        this.cycleInstanceId = null;
        this.cePlus3 = false;
        this.pePlus3 = false;
        this.interimLowReached = false;
        this.calcRefReached = false;
        this.refCapture = false;
        this.changeAt24 = 0;
        this.changeAt36After24 = 0;
        this.mtmSoldAt24 = false;
        this.mtmSoldAt36 = false;
        this.boughtSold = false;
        this.cancelled_24 = false;
        this.entry_24 = false;
        this.entry_plus_24 = false;
        this.entry_36 = false;
        this.entry_7 = false;
        this.mtmFirstToSell = null;
        this.mtmFirstToSellPrice = null;
        this.mtmNextToSell = null;
        this.mtmAssistedTarget = 0;
        this.mtmAssistedTarget2 = 0;
        this.mtmOriginalBuyPrice = null;
        this.mtmSoldAt24Gain = 0;
        this.mtmSoldAt36Loss = 0;
        this.mtmPriceAt24Sell = null; // Store price of remaining instrument at +24 sell time
        this.mtmPriceAt36Sell = null; // Store price of remaining instrument at -36 sell time
        this.mtmPriceAt10Sell = null; // Store price of remaining instrument at -10 sell time
        this.mtmSoldAt24Symbol = null; // Store symbol of instrument sold at +24 for buy back
        this.mtmBuyBackInstrument = null;
        this.mtmBuyBackPrice = null; // Store buy back price
        this.mtmBuyBackTarget = null; // Store target for buy back scenario
        this.mtmTotalPreviousPnL = 0; // Store total P&L from previous trades
        this.mtmBothSold = false;
        this.mtmNextSellAfter24 = false;
        this.buyBackAfter24 = false;
        this.sellBuyBackAfter24 = false;
        this.mtmSoldFirstAt36 = false;
        this.mtmSoldAfterFirst36 = false;
        this.mtmSoldAt10 = false;
        this.mtmNextSellAfter10 = false;
        this.mtm10tracked = false;
        this.buyingCompleted = false;
        this.finalRefCompleted = false;
        this.mtmFullData = {};
        this.prebuyFullData = {};
        this.prebuyBuyPriceOnce = 0;
        this.prebuyBuyPriceTwice = 0;
        this.prebuyLowTrackingPrice = 0;
        this.prebuyLowTrackingTime = null;
        this.rebuyDone = false;
        this.rebuyPrice = 0;
        this.rebuyAveragePrice = 0;
        this.flagSet = {
            reached_rebuy_price: false,
            reached_average_price: false
        }
        this.droppedBelowSignificantThreshold = false;
        this.reachedHalfTarget = false;
        this.savedState = {};
        this.realBuyStoplossHit = false;
        this.targetNet = false;
        this.secondBought = false;
        this.actualRebuyDone = false;
        // this.repetition = {
        //     observed: false,
        //     type: null
        // };
        // this.targetHitByTypeArray = [];
        this.finalStoplossHit = false;
        this.isExpiryDay = false;
        this.prebuyHit = false;
        this.plus7reached = false;
        this.firstCycleRebuyHit = false;
        this.firstCycleStoplossHit = false;
        this.secondCycleRebuyHit = false;
        this.scenario1Adone = false;
        this.scenario1Bdone = false;
        this.scenario1Cdone = false;
        this.scenario1CAdone = false;
        this.thirdBought = false;
        this.exit_at_cost = false;
        this.exit_at_stoploss = false;
        this.targetHit = false;
        this.announcementDone = false;
        this.prebuyTokensFound = false;
        this.afterTarget = false;
        this.previouslyTargetHit = false;
        this.previouslyExitAtCost = false;
        this.previousRebuyData = {};
        this.rebuyDataAnnounced = false;
        this.previousCompletionMethodAnnounced = false;
        this.rebuyFound = false;
    
        // Reset entry stage variables
        this.entry_plus_24_first_stage = false;
        this.entry_plus_24_second_stage = false;
        this.entry_24_first_stage = false;
        this.entry_24_second_stage = false;
        this.entry_24_third_stage = false;
        this.entry_36_first_stage = false;
        this.entry_36_second_stage = false;
        this.entry_36_third_stage = false;
        this.entry_36_fourth_stage = false;
        this.less_than_24 = false;
        this.buyBackInstrument = null;
        this.buyBackTarget = 0;
        this.who_hit_24 = null;
        this.who_hit_36 = null;
        this.sl2a = false;

        // Reset tokens
        this.mainToken = null;
        this.oppToken = null;
        this.boughtToken = null;
        this.prebuyBoughtToken = null;
        this.prebuyOppBoughtToken = null;
        this.oppBoughtToken = null;
        this.mtmFirstOption = null;
        
        // Reset block states
        this.blockInit = true;
        this.blockUpdate = false;
        this.blockFinalRef = false;
        this.blockRef3 = false;
        this.blockDiff10 = false;
        this.blockNextCycle = false;

        this.universalDict.instrumentMap = {};
        this.universalDict.ceTokens = [];
        this.universalDict.peTokens = [];
        this.universalDict.observedTicks = [];
        
        this.strategyUtils.logStrategyInfo(`Cycle ${this.universalDict.cycles} started`);

        if(this.mtmSoldAt10 && !this.mtm10firstHit){
            this.mtm10firstHit = true;
        }
    }

    shouldBuyBack() {
        if((this.globalDict.sellAt24Limit + this.globalDict.sellAt36Limit) < this.globalDict.target){
            return true;
        }
        return false;
    }

    getConfig() {
        const config = {
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
            debugMode: this.debugMode,
            // MTM specific config
            mainToken: this.mainToken,
            oppToken: this.oppToken,
            boughtToken: this.boughtToken,
            oppBoughtToken: this.oppBoughtToken,
            interimLowReached: this.interimLowReached,
            calcRefReached: this.calcRefReached,
            refCapture: this.refCapture,
            mtmSoldAt24: this.mtmSoldAt24,
            mtmSoldAt36: this.mtmSoldAt36,
            boughtSold: this.boughtSold,
            mtmNextToSell: this.mtmNextToSell,
            mtmAssistedTarget: this.mtmAssistedTarget,
            mtmOriginalBuyPrice: this.mtmOriginalBuyPrice,
            mtmSoldAt24Gain: this.mtmSoldAt24Gain,
            mtmSoldAt36Loss: this.mtmSoldAt36Loss,
            mtmPriceAt24Sell: this.mtmPriceAt24Sell,
            mtmSoldAt24Symbol: this.mtmSoldAt24Symbol,
            mtmBuyBackPrice: this.mtmBuyBackPrice,
            mtmBuyBackTarget: this.mtmBuyBackTarget,
            mtmTotalPreviousPnL: this.mtmTotalPreviousPnL,
            blockInit: this.blockInit,
            blockUpdate: this.blockUpdate,
            blockFinalRef: this.blockFinalRef,
            blockRef3: this.blockRef3,
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
                default: 40,
                description: 'Target profit in points'
            },
            stoploss: {
                type: 'number',
                default: -50,
                description: 'Stop loss in points'
            },
            // sellAt10Live: {
            //     type: 'boolean',
            //     default: false,
            //     description: 'Enable/disable selling at 10 points live'
            // },
            // sellFirstAt10: {
            //     type: 'string',
            //     default: 'HIGHER',
            //     description: 'Sell first instrument at 10 points higher or lower. Default is HIGHER'
            // },
            peakDef: {
                type: 'number',
                default: 0,
                description: 'Peak definition in points'
            },
            peakAndFallDef: {
                type: 'number',
                default: 0,
                description: 'Peak and fall definition in points'
            },
            upperLimit: {
                type: 'number',
                default: 0,
                description: 'Upper limit for interim low'
            },
            lowerLimit: {
                type: 'number',
                default: 0,
                description: 'Lower limit for MTM'
            },
            quantity: {
                type: 'number',
                default: 75,
                description: 'Quantity to trade'
            },
            sellAt24Limit: {
                type: 'number',
                default: 24,
                description: 'Limit for selling at 24 points'
            },
            // sellAt10Limit: {
            //     type: 'number',
            //     default: -10,
            //     description: 'Limit for selling at -10 points'
            // },
            buyBackTarget: {
                type: 'number',
                default: 10,
                description: 'Trigger for selling the buy-back instrument'
            },
            sellAt36Limit: {
                type: 'number',
                default: -36,
                description: 'Limit for selling at -36 points'
            },
            prebuyStoploss: {
                type: 'number',
                default: -5,
                description: 'Stoploss for pre-buy'
            },
            realBuyStoploss: {
                type: 'number',
                default: -50,
                description: 'Stoploss for real buy'
            },
            rebuyAt: {
                type: 'number',
                default: 10,
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
            buySame : {
                type: 'boolean',
                default: false,
                description: 'Buy the same instrument again'
            },
            skipAfterCycles: {
                type: 'number',
                default: 2,
                description: 'Skip live trading after this many cycles'
            }
        };
    }

    getUniversalDictParameters() {
        return {
            expiry: {
                type: 'number',
                default: 2,
                description: 'Expiry day (0=Sunday, 2=Tuesday)'
            },
            cycles: {
                type: 'number',
                default: 1,
                description: 'Number of cycles completed'
            },
            skipBuy: {
                type: 'boolean',
                default: false,
                description: 'Skip buying after first cycle'
            },
            interimLowDisabled: {
                type: 'boolean',
                default: false,
                description: 'Disable interim low detection'
            },
            usePrebuy: {
                type: 'boolean',
                default: true,
                description: 'Use pre-buy technique.'
            },
            enableTrading: {
                type: 'boolean',
                default: false,
                description: 'Enable/disable actual trading'
            },
        };
    }

    // Helper method to sell both instruments
    async sellBothInstruments(instrument1, instrument2) {
        this.strategyUtils.logStrategyInfo('Selling both instruments at target/stoploss');
        
        // Check if trading is enabled
        const tradingEnabled = this.universalDict.enableTrading;
        
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
        const tradingEnabled = this.universalDict.enableTrading;
        
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
        const tradingEnabled = this.universalDict.enableTrading;
        
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
                    let sellResult = null;
                    try {
                        sellResult = await this.sellInstrument(instrument);
                        if (sellResult && sellResult.success) {
                            this.strategyUtils.logStrategyInfo(`${instrument.symbol} sold at rebuy price - Executed price: ${sellResult.executedPrice}`);
                        } else {
                            this.strategyUtils.logStrategyError('Failed to sell instrument at rebuy price');
                        }
                    }
                    catch (error) {
                        this.strategyUtils.logStrategyError(`Error selling instrument: ${error.message}`);
                    }
    
                    if(this.prebuyBuyPriceTwice > 0){
                        this.globalDict.target = this.globalDict.target * 2;
                        this.globalDict.stoploss = this.globalDict.stoploss * 2;
                        this.globalDict.quantity = this.globalDict.quantity / 2;
                        this.strategyUtils.logStrategyInfo(`Target: ${this.globalDict.target}, Stoploss: ${this.globalDict.stoploss}, Quantity: ${this.globalDict.quantity} RESET COMPLETED.`);
                    }

                    this.boughtSold = true;
                }
            }

            if(flag_set.reached_average_price && !this.boughtSold){
                if(instrument.last < average_price && !flag_set.reached_average_price && !this.boughtSold){
                    let sellResult = null;
                    try {
                        sellResult = await this.sellInstrument(instrument);
                        if (sellResult && sellResult.success) {
                            this.strategyUtils.logStrategyInfo(`${instrument.symbol} sold at average price - Executed price: ${sellResult.executedPrice}`);
                        } else {
                            this.strategyUtils.logStrategyError('Failed to sell instrument at average price');
                        }
                    }
                    catch (error) {
                        this.strategyUtils.logStrategyError(`Error selling instrument: ${error.message}`);
                    }
    
                    if(this.prebuyBuyPriceTwice > 0){
                        this.globalDict.target = this.globalDict.target * 2;
                        this.globalDict.stoploss = this.globalDict.stoploss * 2;
                        this.globalDict.quantity = this.globalDict.quantity / 2;
                        this.strategyUtils.logStrategyInfo(`Target: ${this.globalDict.target}, Stoploss: ${this.globalDict.stoploss}, Quantity: ${this.globalDict.quantity} RESET COMPLETED.`);
                    }
                    this.boughtSold = true;
                }
            }

        }


    }
    // Dashboard-specific emit methods for real-time updates
    emitInstrumentDataUpdate() {
        // Handle prebuy mode differently
        if (this.universalDict.usePrebuy) {
            this.emitPrebuyInstrumentDataUpdate();
            return;
        }

        // Regular MTM mode - both instruments must be selected
        if (!this.boughtToken || !this.oppBoughtToken) {
            return; // No instruments selected yet
        }

        const boughtInstrument = this.universalDict.instrumentMap[this.boughtToken];
        const oppInstrument = this.universalDict.instrumentMap[this.oppBoughtToken];

        if (!boughtInstrument || !oppInstrument) {
            return; // Instrument data not available
        }

        // Determine which instruments are still active (not sold)
        const isBoughtSold = this.isInstrumentSold(boughtInstrument);
        const isOppSold = this.isInstrumentSold(oppInstrument);
        const bothSold = isBoughtSold && isOppSold;
        
        // Get buy back instrument if it exists
        const buyBackInstrument = this.buyBackInstrument ? this.universalDict.instrumentMap[this.buyBackInstrument.token] : null;

        // Calculate prices and differences based on current state
        let ceInstrument = null, peInstrument = null;
        let cePrice = 0, pePrice = 0, ceBuyPrice = 0, peBuyPrice = 0, ceDiff = 0, peDiff = 0;
        let ceDisplayName = '', peDisplayName = '';
        let ceToken = null, peToken = null;
        let ceIsSold = false, peIsSold = false;

        // Determine CE and PE instruments based on current state
        if (boughtInstrument.symbol.includes('CE')) {
            // boughtInstrument is CE
            ceInstrument = boughtInstrument;
            ceToken = this.boughtToken;
            ceIsSold = isBoughtSold;
            
            if (buyBackInstrument && isOppSold) {
                // Original PE was sold, buy back is active
                peInstrument = buyBackInstrument;
                peToken = buyBackInstrument.token;
                peIsSold = false;
            } else {
                // Original PE is still active or both sold
                peInstrument = oppInstrument;
                peToken = this.oppBoughtToken;
                peIsSold = isOppSold;
            }
        } else {
            // boughtInstrument is PE
            peInstrument = boughtInstrument;
            peToken = this.boughtToken;
            peIsSold = isBoughtSold;
            
            if (buyBackInstrument && isOppSold) {
                // Original CE was sold, buy back is active
                ceInstrument = buyBackInstrument;
                ceToken = buyBackInstrument.token;
                ceIsSold = false;
            } else {
                // Original CE is still active or both sold
                ceInstrument = oppInstrument;
                ceToken = this.oppBoughtToken;
                ceIsSold = isOppSold;
            }
        }

        // Calculate prices and differences
        if (ceInstrument) {
            cePrice = ceIsSold ? this.getSoldPrice(ceInstrument) : ceInstrument.last;
            ceBuyPrice = ceInstrument.buyPrice > 0 ? ceInstrument.buyPrice : ceInstrument.last;
            ceDiff = cePrice - ceBuyPrice;
            ceDisplayName = ceInstrument.symbol || 'Unknown';
        }

        if (peInstrument) {
            pePrice = peIsSold ? this.getSoldPrice(peInstrument) : peInstrument.last;
            peBuyPrice = peInstrument.buyPrice > 0 ? peInstrument.buyPrice : peInstrument.last;
            peDiff = pePrice - peBuyPrice;
            peDisplayName = peInstrument.symbol || 'Unknown';
        }

        // Calculate sum values
        const sumValue = cePrice + pePrice;
        const sumBuyPrice = ceBuyPrice + peBuyPrice;
        const sumDiff = ceDiff + peDiff;

        const instrumentData = {
            status: 'instrument_data_update',
            boughtInstrument: ceInstrument ? {
                symbol: ceInstrument.symbol,
                ltp: cePrice,
                last: cePrice,
                buyPrice: ceBuyPrice,
                diff: ceDiff,
                type: 'CE',
                token: ceToken,
                displayName: ceDisplayName,
                isSold: ceIsSold,
                isActive: !ceIsSold || bothSold, // Show if not sold or if both are sold (for final state)
                isBuyBack: buyBackInstrument && ceInstrument.token === buyBackInstrument.token
            } : null,
            oppInstrument: peInstrument ? {
                symbol: peInstrument.symbol,
                ltp: pePrice,
                last: pePrice,
                buyPrice: peBuyPrice,
                diff: peDiff,
                type: 'PE',
                token: peToken,
                displayName: peDisplayName,
                isSold: peIsSold,
                isActive: !peIsSold || bothSold, // Show if not sold or if both are sold (for final state)
                isBuyBack: buyBackInstrument && peInstrument.token === buyBackInstrument.token
            } : null,
            sum: {
                ltp: sumValue,
                value: sumValue,
                buyPrice: sumBuyPrice,
                diff: sumDiff
            },
            mtm: sumDiff,
            // Additional state information for frontend
            tradingState: {
                bothSold: bothSold,
                hasBuyBack: !!buyBackInstrument,
                entry24Stage: this.entry_24_first_stage || this.entry_24_second_stage || this.entry_24_third_stage,
                entry36Stage: this.entry_36_first_stage || this.entry_36_second_stage || this.entry_36_third_stage,
                entryPlusStage: this.entry_plus_24_first_stage || this.entry_plus_24_second_stage,
                entry7Stage: this.entry_7
            },
            timestamp: new Date().toISOString()
        };

        this.emitStatusUpdate('instrument_data_update', instrumentData);
    }

    // Dashboard-specific emit methods for prebuy mode
    emitPrebuyInstrumentDataUpdate() {
        // In prebuy mode, show both instruments before real buy, then show real bought instrument + N/A after
        if (!this.prebuyBoughtToken) {
            // No real instrument bought yet - show both prebuy instruments (similar to MTM mode)
            if (!this.boughtToken || !this.oppBoughtToken) {
                // No prebuy instruments selected yet - show N/A for both
                const instrumentData = {
                    status: 'instrument_data_update',
                    boughtInstrument: {
                        symbol: 'N/A',
                        ltp: 0,
                        last: 0,
                        buyPrice: 0,
                        diff: 0,
                        type: 'CE',
                        token: null,
                        displayName: 'N/A',
                        isSold: false,
                        isActive: false,
                        isBuyBack: false
                    },
                    oppInstrument: {
                        symbol: 'N/A',
                        ltp: 0,
                        last: 0,
                        buyPrice: 0,
                        diff: 0,
                        type: 'PE',
                        token: null,
                        displayName: 'N/A',
                        isSold: false,
                        isActive: false,
                        isBuyBack: false
                    },
                    sum: {
                        ltp: 0,
                        value: 0,
                        buyPrice: 0,
                        diff: 0
                    },
                    mtm: 0,
                    tradingState: {
                        bothSold: false,
                        hasBuyBack: false,
                        entry24Stage: false,
                        entry36Stage: false,
                        entryPlusStage: false,
                        entry7Stage: false
                    },
                    timestamp: new Date().toISOString()
                };
                this.emitStatusUpdate('instrument_data_update', instrumentData);
                return;
            }

            // Show both prebuy instruments (before real buy)
            const boughtInstrument = this.universalDict.instrumentMap[this.boughtToken];
            const oppInstrument = this.universalDict.instrumentMap[this.oppBoughtToken];

            if (!boughtInstrument || !oppInstrument) {
                return; // Instrument data not available
            }

            // Calculate prices and differences for both prebuy instruments
            let ceInstrument = null, peInstrument = null;
            let cePrice = 0, pePrice = 0, ceBuyPrice = 0, peBuyPrice = 0, ceDiff = 0, peDiff = 0;
            let ceDisplayName = '', peDisplayName = '';
            let ceToken = null, peToken = null;
            let ceIsSold = false, peIsSold = false;

            // Determine CE and PE instruments
            if (boughtInstrument.symbol.includes('CE')) {
                // boughtInstrument is CE
                ceInstrument = {
                    symbol: boughtInstrument.symbol,
                    ltp: boughtInstrument.last,
                    last: boughtInstrument.last,
                    buyPrice: boughtInstrument.buyPrice > 0 ? boughtInstrument.buyPrice : boughtInstrument.last,
                    diff: boughtInstrument.last - (boughtInstrument.buyPrice > 0 ? boughtInstrument.buyPrice : boughtInstrument.last),
                    type: 'CE',
                    token: this.boughtToken,
                    displayName: boughtInstrument.symbol,
                    isSold: false,
                    isActive: true,
                    isBuyBack: false
                };
                peInstrument = {
                    symbol: oppInstrument.symbol,
                    ltp: oppInstrument.last,
                    last: oppInstrument.last,
                    buyPrice: oppInstrument.buyPrice > 0 ? oppInstrument.buyPrice : oppInstrument.last,
                    diff: oppInstrument.last - (oppInstrument.buyPrice > 0 ? oppInstrument.buyPrice : oppInstrument.last),
                    type: 'PE',
                    token: this.oppBoughtToken,
                    displayName: oppInstrument.symbol,
                    isSold: false,
                    isActive: true,
                    isBuyBack: false
                };
            } else {
                // boughtInstrument is PE
                ceInstrument = {
                    symbol: oppInstrument.symbol,
                    ltp: oppInstrument.last,
                    last: oppInstrument.last,
                    buyPrice: oppInstrument.buyPrice > 0 ? oppInstrument.buyPrice : oppInstrument.last,
                    diff: oppInstrument.last - (oppInstrument.buyPrice > 0 ? oppInstrument.buyPrice : oppInstrument.last),
                    type: 'CE',
                    token: this.oppBoughtToken,
                    displayName: oppInstrument.symbol,
                    isSold: false,
                    isActive: true,
                    isBuyBack: false
                };
                peInstrument = {
                    symbol: boughtInstrument.symbol,
                    ltp: boughtInstrument.last,
                    last: boughtInstrument.last,
                    buyPrice: boughtInstrument.buyPrice > 0 ? boughtInstrument.buyPrice : boughtInstrument.last,
                    diff: boughtInstrument.last - (boughtInstrument.buyPrice > 0 ? boughtInstrument.buyPrice : boughtInstrument.last),
                    type: 'PE',
                    token: this.boughtToken,
                    displayName: boughtInstrument.symbol,
                    isSold: false,
                    isActive: true,
                    isBuyBack: false
                };
            }

            // Calculate sum values (both instruments)
            const sumValue = ceInstrument.ltp + peInstrument.ltp;
            const sumBuyPrice = ceInstrument.buyPrice + peInstrument.buyPrice;
            const sumDiff = ceInstrument.diff + peInstrument.diff;

            const instrumentData = {
                status: 'instrument_data_update',
                boughtInstrument: ceInstrument,
                oppInstrument: peInstrument,
                sum: {
                    ltp: sumValue,
                    value: sumValue,
                    buyPrice: sumBuyPrice,
                    diff: sumDiff
                },
                mtm: sumDiff,
                tradingState: {
                    bothSold: false,
                    hasBuyBack: false,
                    entry24Stage: false,
                    entry36Stage: false,
                    entryPlusStage: false,
                    entry7Stage: false
                },
                timestamp: new Date().toISOString()
            };

            this.emitStatusUpdate('instrument_data_update', instrumentData);
            return;
        }

        // After real buy - show only the real bought instrument and N/A for the other
        const realBoughtInstrument = this.universalDict.instrumentMap[this.prebuyBoughtToken];
        if (!realBoughtInstrument) {
            return; // Instrument data not available
        }

        // Determine if the real instrument is sold
        const isRealInstrumentSold = this.isInstrumentSold(realBoughtInstrument);

        // Calculate prices and differences for the real instrument
        const realPrice = isRealInstrumentSold ? this.getSoldPrice(realBoughtInstrument) : realBoughtInstrument.last;
        const realBuyPrice = realBoughtInstrument.buyPrice > 0 ? realBoughtInstrument.buyPrice : realBoughtInstrument.last;
        const realDiff = realPrice - realBuyPrice;

        // Determine CE and PE based on the real instrument
        let ceInstrument = null, peInstrument = null;
        let cePrice = 0, pePrice = 0, ceBuyPrice = 0, peBuyPrice = 0, ceDiff = 0, peDiff = 0;
        let ceDisplayName = '', peDisplayName = '';
        let ceToken = null, peToken = null;
        let ceIsSold = false, peIsSold = false;

        if (realBoughtInstrument.symbol.includes('CE')) {
            // Real instrument is CE
            ceInstrument = {
                symbol: realBoughtInstrument.symbol,
                ltp: realPrice,
                last: realPrice,
                buyPrice: realBuyPrice,
                diff: realDiff,
                type: 'CE',
                token: this.prebuyBoughtToken,
                displayName: realBoughtInstrument.symbol,
                isSold: isRealInstrumentSold,
                isActive: !isRealInstrumentSold,
                isBuyBack: false
            };
            peInstrument = {
                symbol: 'N/A',
                ltp: 0,
                last: 0,
                buyPrice: 0,
                diff: 0,
                type: 'PE',
                token: null,
                displayName: 'N/A',
                isSold: false,
                isActive: false,
                isBuyBack: false
            };
        } else {
            // Real instrument is PE
            ceInstrument = {
                symbol: 'N/A',
                ltp: 0,
                last: 0,
                buyPrice: 0,
                diff: 0,
                type: 'CE',
                token: null,
                displayName: 'N/A',
                isSold: false,
                isActive: false,
                isBuyBack: false
            };
            peInstrument = {
                symbol: realBoughtInstrument.symbol,
                ltp: realPrice,
                last: realPrice,
                buyPrice: realBuyPrice,
                diff: realDiff,
                type: 'PE',
                token: this.prebuyBoughtToken,
                displayName: realBoughtInstrument.symbol,
                isSold: isRealInstrumentSold,
                isActive: !isRealInstrumentSold,
                isBuyBack: false
            };
        }

        // Calculate sum values (only the real instrument contributes)
        const sumValue = realPrice;
        const sumBuyPrice = realBuyPrice;
        const sumDiff = realDiff;

        const instrumentData = {
            status: 'instrument_data_update',
            boughtInstrument: ceInstrument,
            oppInstrument: peInstrument,
            sum: {
                ltp: sumValue,
                value: sumValue,
                buyPrice: sumBuyPrice,
                diff: sumDiff
            },
            mtm: sumDiff,
            // Additional state information for frontend
            tradingState: {
                bothSold: isRealInstrumentSold,
                hasBuyBack: false,
                entry24Stage: false,
                entry36Stage: false,
                entryPlusStage: false,
                entry7Stage: this.entry_7
            },
            timestamp: new Date().toISOString()
        };

        this.emitStatusUpdate('instrument_data_update', instrumentData);
    }

    // Helper method to determine if an instrument has been sold
    isInstrumentSold(instrument) {
        if (!instrument) return false;
        
        // Check if this instrument was sold in +24 logic
        if (this.entry_24_first_stage && this.who_hit_24 && this.who_hit_24.token === instrument.token) {
            return true;
        }
        
        // Check if this instrument was sold in +24 (plus) logic  
        if (this.entry_plus_24_first_stage && this.who_hit_24 && this.who_hit_24 !== instrument) {
            return true; // The lower instrument was sold
        }
        
        // Check if this instrument was sold in -36 logic
        if (this.entry_36_first_stage && this.who_hit_36 && this.who_hit_36.token === instrument.token) {
            return true;
        }
        
        // Check if this instrument was sold in second stage of -36 logic
        if (this.entry_36_second_stage && this.who_hit_36 && this.who_hit_36 !== instrument) {
            return true; // The second instrument was sold
        }
        
        // Check if both instruments were sold in +7 logic
        if (this.entry_7) {
            return true;
        }
        
        return false;
    }

    // Helper method to get the sold price of an instrument
    getSoldPrice(instrument) {
        if (!instrument) return 0;
        
        // Return the stored sell price or fallback to last price
        if (this.mtmPriceAt24Sell && this.isInstrumentSoldAt24(instrument)) {
            return this.mtmPriceAt24Sell;
        }
        
        if (this.mtmPriceAt36Sell && this.isInstrumentSoldAt36(instrument)) {
            return this.mtmPriceAt36Sell;
        }
        
        // For +7 logic or other cases, use last known price
        return instrument.last;
    }

    // Helper method to check if instrument was sold at +24
    isInstrumentSoldAt24(instrument) {
        return (this.entry_24_first_stage && this.who_hit_24 && this.who_hit_24.token === instrument.token) ||
               (this.entry_plus_24_first_stage && this.who_hit_24 && this.who_hit_24 !== instrument);
    }

    // Helper method to check if instrument was sold at -36
    isInstrumentSoldAt36(instrument) {
        return (this.entry_36_first_stage && this.who_hit_36 && this.who_hit_36.token === instrument.token) ||
               (this.entry_36_second_stage && this.who_hit_36 && this.who_hit_36 !== instrument);
    }

    emitBlockTransition(fromBlock, toBlock, additionalData = {}) {
        this.emitStatusUpdate('Block transition', {
            fromBlock,
            toBlock,
            blockTransition: true,
            ...additionalData
        });
    }

    emitCycleUpdate(cycleNumber, message) {
        this.emitStatusUpdate(message, {
            cycleNumber,
            cycleUpdate: true,
            timestamp: new Date().toISOString()
        });
    }

    emitTradingStatusUpdate(status, details = {}) {
        this.emitStatusUpdate(status, {
            tradingStatus: true,
            ...details,
            timestamp: new Date().toISOString()
        });
    }

    getCurrentBlockName() {
        if (this.blockInit) return 'INIT';
        if (this.blockUpdate) return 'UPDATE';
        if (this.blockFinalRef) return 'FINAL_REF';
        if (this.blockRef3) return 'REF3';
        if (this.blockDiff10) return 'DIFF10';
        if (this.blockNextCycle) return 'NEXT_CYCLE';
        return 'UNKNOWN';
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

    writeToGlobalOutput(data) {
        let formatted_data = `${data}`;
        fs.writeFileSync("output/global.txt", formatted_data);
    }

    appendToGlobalOutput(data) {
        let formatted_data = `${data}`;
        fs.appendFileSync("output/global.txt", formatted_data);
    }

    appendCompletionState(){
        let formatted_data = `${this.universalDict.cycles}:${this.cycleInstanceId}:COMPLETE\n`;
        this.appendToGlobalOutput(formatted_data);
    }

    getInstanceId(){
        this.cycleInstanceId = crypto.randomBytes(16).toString('hex');
        return this.cycleInstanceId;
    }

    updateCycleInstanceSet(){
        let corpus = fs.readFileSync("output/global.txt", 'utf8');
        let corpusArray = corpus.split('\n');
        corpusArray.forEach(line => {
            let [cycle, instanceId, state] = line.split(':');
            if(parseInt(cycle) === parseInt(this.universalDict.cycles) && state === 'COMPLETE'){
                this.cycleInstanceSet.add(instanceId);
                console.log("Cycle instance set size: ", this.cycleInstanceSet.size);
            }
            else if(parseInt(cycle) === parseInt(this.universalDict.cycles) && state === 'EXIT_AT_COST' && !this.announcementDone && !this.exit_at_cost){
                this.exit_at_cost = true;
                this.strategyUtils.logStrategyInfo('Exit at cost announced');
            }
            else if(parseInt(cycle) === parseInt(this.universalDict.cycles) && state === 'EXIT_AT_STOPLOSS' && !this.announcementDone && !this.exit_at_stoploss){
                this.exit_at_stoploss = true;
                this.strategyUtils.logStrategyInfo('Exit at stoploss announced');
            }
            else if(parseInt(cycle) === parseInt(this.universalDict.cycles) && state === 'TARGET_HIT' && !this.targetHit){
                this.targetHit = true;
                this.strategyUtils.logStrategyInfo('Target hit announced');
            }
            else if(parseInt(cycle) === parseInt(this.universalDict.cycles) && state === 'REBUY_DATA' && !this.rebuyFound){
                this.rebuyFound = true;
                this.strategyUtils.logStrategyInfo('Rebuy data found');
            }
        });
    }

    isInstancesComplete(){
        return this.cycleInstanceSet.size >= 2;
    }

    announceExitAtCost(){
        if(this.cycleInstanceSet.size < 2){
            this.appendToGlobalOutput(`${this.universalDict.cycles}:${this.cycleInstanceId}:EXIT_AT_COST\n`);
        }
        this.announcementDone = true;
    }

    announceExitAtStoploss(){
        if(this.cycleInstanceSet.size < 2){
            this.appendToGlobalOutput(`${this.universalDict.cycles}:${this.cycleInstanceId}:EXIT_AT_STOPLOSS\n`);
        }
        this.announcementDone = true;
    }

    announcePrebuy(prebuyInstruments){
        if(!this.prebuyTokensFound){
            this.appendToGlobalOutput(`${this.universalDict.cycles}|${JSON.stringify(prebuyInstruments)}|PREBUY_INSTRUMENTS\n`);
        }
    }

    announceTargetHit(){
        if(!this.targetHit){
            this.appendToGlobalOutput(`${this.universalDict.cycles}:${this.cycleInstanceId}:TARGET_HIT\n`);
        }
    }

    announceRebuyData(){
        if(!this.rebuyDataAnnounced){
            let data = JSON.stringify(this.previousRebuyData);
            this.appendToGlobalOutput(`${this.universalDict.cycles}:data:REBUY_DATA\n`);
            this.rebuyDataAnnounced = true;
        }
    }

    announcePreviousCompletionMethod(status){
        if(!this.previousCompletionMethodAnnounced){
            this.appendToGlobalOutput(`${this.universalDict.cycles}|${status}|PREVIOUS_COMPLETION_METHOD\n`);
            this.previousCompletionMethodAnnounced = true;
        }
    }

    checkPrebuyTokens(){
        let corpus = fs.readFileSync("output/global.txt", 'utf8');
        let corpusArray = corpus.split('\n');
        let prebuy_tokens = [];
        corpusArray.forEach(line => {
            if(line.includes('|')){
                let [cycle, prebuyTokens, state] = line.split('|');
                if(parseInt(cycle) === parseInt(this.universalDict.cycles) && state === 'PREBUY_INSTRUMENTS' && !this.prebuyTokensFound){
                    this.prebuyTokensFound = true;
                    this.strategyUtils.logStrategyInfo('Using existing prebuy tokens');
                    prebuy_tokens = JSON.parse(prebuyTokens);
                }
            }
        });
        return {status: this.prebuyTokensFound, prebuyTokens: prebuy_tokens};
    }

    checkRebuyData(){
        let corpus = fs.readFileSync("output/global.txt", 'utf8');
        let corpusArray = corpus.split('\n');
        corpusArray.forEach(line => {
            if(line.includes('|')){
                let [cycle, rebuyData, state] = line.split('|');
                if(parseInt(cycle) === parseInt(this.universalDict.cycles-1) && state === 'REBUY_DATA'){
                    // this.previousRebuyData = JSON.parse(rebuyData);
                    this.previousRebuyData = rebuyData;
                }
            }
        });
    }

    checkPreviousCompletionMethod(){
        let corpus = fs.readFileSync("output/global.txt", 'utf8');
        let corpusArray = corpus.split('\n');
        corpusArray.forEach(line => {
            if(line.includes('|')){
                let [cycle, status, state] = line.split('|');
                if(parseInt(cycle) === parseInt(this.universalDict.cycles-1) && state === 'PREVIOUS_COMPLETION_METHOD'){
                    if(status === 'EXIT_AT_COST'){
                        this.previouslyExitAtCost = true;
                        this.previouslyTargetHit = false;
                    }
                    else if(status === 'TARGET_HIT'){
                        this.previouslyTargetHit = true;
                        this.previouslyExitAtCost = false;
                    }
                }
            }
        });
    }

    onlyCheckPrebuyTokens(){
        let corpus = fs.readFileSync("output/global.txt", 'utf8');
        let corpusArray = corpus.split('\n');
        for (const line of corpusArray) {
            if(line.includes('|')){
                let [cycle, prebuyTokens, state] = line.split('|');
                if(parseInt(cycle) === parseInt(this.universalDict.cycles) && state === 'PREBUY_INSTRUMENTS' && !this.prebuyTokensFound){
                    this.strategyUtils.logStrategyInfo('Prebuy tokens found');
                    return true;  // Early exit - stops immediately when match is found
                }
            }
        }
        return false;  // Only reached if no match found
    }

    resetGlobalOutput(){
        writeToGlobalOutput('');
    }

    isPriceAtCost(){
        // Safety check: ensure previousRebuyData has required fields
        if (!this.previousRebuyData.token || this.previousRebuyData.rebuy_price === undefined) {
            return false;
        }
        
        let instrument_1 = this.universalDict.instrumentMap[this.previousRebuyData.token];
        // Safety check: ensure instrument exists
        if (!instrument_1) {
            return false;
        }
        
        let diff = instrument_1.last - this.previousRebuyData.rebuy_price;
        return (instrument_1.last >= this.previousRebuyData.rebuy_price ? diff <= 2: diff >= 2) && this.universalDict.cycles >= 2 && this.previouslyTargetHit && false;
    }
}

module.exports = MTMV5SharedStrategyV2;
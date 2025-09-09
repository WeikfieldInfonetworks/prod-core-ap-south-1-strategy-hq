const BaseStrategy = require('./base');
const TradingUtils = require('../utils/tradingUtils');
const StrategyUtils = require('../utils/strategyUtils');

class MTMV3Strategy extends BaseStrategy {
    constructor() {
        super();
        this.name = 'MTM V3 Strategy';
        this.description = 'Mark to Market strategy with interim low detection and dual option trading - New';
        this.strategyUtils = new StrategyUtils();
        
        // Strategy state variables
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
        this.debugMode = false;
        
        // MTM specific variables
        this.mainToken = null;
        this.oppToken = null;
        this.boughtToken = null;
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
        this.mtmTotalPreviousPnL = 0; // Store total P&L from previous trades
        
        // Block states
        this.blockInit = true;
        this.blockUpdate = false;
        this.blockFinalRef = false;
        this.blockRef3 = false;
        this.blockDiff10 = false;
        this.blockNextCycle = false;
        
        // Flags
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
        
        // Entry stage variables
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
        this.strategyUtils.logStrategyInfo(`MTM V3 Strategy initialized for user: ${userName} (ID: ${userId})`);
    }

    initialize(globalDict, universalDict, blockDict, accessToken) {
        // Call parent initialize method
        super.initialize(globalDict, universalDict, blockDict, accessToken);
        
        console.log('=== MTM V3 Strategy Initialization ===');
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
        this.strategyUtils.logStrategyInfo(`Enable Trading Status: ${this.globalDict.enableTrading}`);

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

        // Reset MTM specific variables
        this.mainToken = null;
        this.oppToken = null;
        this.boughtToken = null;
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
        this.mtmSoldAt10 = false;
        this.mtmNextSellAfter10 = false;
        this.mtm10firstHit = false;
        this.cancelled_24 = false;
        this.entry_24 = false;
        this.entry_36 = false;
        this.entry_7 = false;
        
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
        
        // Reset block states
        this.blockInit = true;
        this.blockUpdate = false;
        this.blockFinalRef = false;
        this.blockRef3 = false;
        this.blockDiff10 = false;
        this.blockNextCycle = false;

        // Reset flags
        this.cePlus3 = false;
        this.pePlus3 = false;
        this.interimLowDisabled = false;
        this.calcRefReached = false;
        this.finalRefFlag = false;
        this.skipBuy = false;
        this.mtm10tracked = false;
        this.mtm10firstHit = false;

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
        
        // Skip buy after first cycle
        if (this.universalDict.cycles >= 1) {
            // this.universalDict.skipBuy = true;
            this.globalDict.sellAt10Live = true;
            this.globalDict.enableTrading = false;
        }

        // Set strike base and diff based on weekday
        const today = new Date().getDay();
        const expiryDay = parseInt(this.universalDict.expiry || 3);
        
        if (today === expiryDay) {
            this.universalDict.strikeBase = 165;
            this.universalDict.strikeDiff = 35;
            this.universalDict.strikeLowest = 150;
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

            // Update peak2 if applicable
            // if (instrument.peak2 > -1 && newPrice > instrument.peak2) {
            //     instrument.peak2 = newPrice;
            // }
        }

        // Use StrategyUtils sequential filtering flow
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

        // Check if we should transition to final ref
        if (this.shouldTransitionToFinalRef()) {
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

    processFinalRefBlock(ticks) {
        // this.strategyUtils.logStrategyInfo('Processing FINAL REF block');
        
        if (this.interimLowReached && !this.refCapture) {
            this.refCapture = true;
            this.strategyUtils.logStrategyInfo('Interim low reached, capturing reference');

            const mainOption = this.universalDict.instrumentMap[this.mainToken];
            const oppOption = this.universalDict.instrumentMap[this.oppToken];
            const isSumOver390 = (mainOption.last + oppOption.last) > 390;
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
            if (this.mtmFirstOption) {
                const firstOptionType = this.mtmFirstOption.symbol.includes('CE') ? 'CE' : 'PE';
                
                if (firstOptionType === 'CE') {
                    this.boughtToken = closestCE.token;
                    this.oppBoughtToken = closestPE.token;
                    this.strategyUtils.logStrategyInfo(`MTM First Option is CE ${closestCE.symbol}`);
                    this.strategyUtils.logStrategyInfo(`Opposite Token: ${closestPE.symbol}`);
                } else {
                    this.boughtToken = closestPE.token;
                    this.oppBoughtToken = closestCE.token;
                    this.strategyUtils.logStrategyInfo(`MTM First Option is PE ${closestPE.symbol}`);
                    this.strategyUtils.logStrategyInfo(`Opposite Token: ${closestCE.symbol}`);
                }
            } else {
                // Fallback: use CE as bought token, PE as opposite
                this.boughtToken = closestCE.token;
                this.oppBoughtToken = closestPE.token;
                this.strategyUtils.logStrategyInfo(`Fallback - Bought Token: ${closestCE.symbol}`);
                this.strategyUtils.logStrategyInfo(`Opposite Token: ${closestPE.symbol}`);
            }
            
            // Place orders for both tokens
            this.placeOrdersForTokens();
            
            // Transition to diff10 block
            this.blockFinalRef = false;
            this.blockDiff10 = true;
            this.strategyUtils.logStrategyInfo('Transitioning from FINAL REF to DIFF10 block');
            
            // Emit real-time notifications
            this.emitBlockTransition('FINAL_REF', 'DIFF10', {
                boughtSymbol: this.universalDict.instrumentMap[this.boughtToken]?.symbol,
                oppSymbol: this.universalDict.instrumentMap[this.oppBoughtToken]?.symbol,
                ordersPlaced: true
            });
        } else if (this.calcRefReached) {
            this.strategyUtils.logStrategyInfo('Calc ref reached');
            this.blockFinalRef = false;
            this.blockRef3 = true;
            this.strategyUtils.logStrategyInfo('Transitioning from FINAL REF to REF3 block');
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

        const instrument_1 = this.universalDict.instrumentMap[this.boughtToken];
        const instrument_2 = this.universalDict.instrumentMap[this.oppBoughtToken];

        if (!instrument_1 || !instrument_2) {
            this.strategyUtils.logStrategyError('Cannot process DIFF10 block - instrument data not found');
            return;
        }

        const instrument_1_original_change = instrument_1.last - instrument_1.buyPrice;
        const instrument_2_original_change = instrument_2.last - instrument_2.buyPrice;
        const mtm = instrument_1_original_change + instrument_2_original_change;

        console.log(`${instrument_1.symbol} ${instrument_1_original_change} ${instrument_2.symbol} ${instrument_2_original_change} MTM:${mtm}`);

        const hit_24 = instrument_1_original_change >= this.globalDict.sellAt24Limit || instrument_2_original_change >= this.globalDict.sellAt24Limit;
        let who_hit_24_temp = null;

        if(hit_24){
            who_hit_24_temp = instrument_1_original_change >= this.globalDict.sellAt24Limit ? instrument_1 : instrument_2;
        }

        if(who_hit_24_temp){
            if(!who_hit_24_temp.flagCancel24){
                who_hit_24_temp.flagCancel24 = hit_24 && mtm >= 0;
                if (who_hit_24_temp.flagCancel24){
                    this.strategyUtils.logStrategyInfo(`24 points cancelled for ${who_hit_24_temp.symbol} due to mtm >= 0`);
                }
            }
        }
        

        if(!this.entry_24){
            this.entry_24 = hit_24 && mtm < 0 && !who_hit_24_temp.flagCancel24 && !this.entry_36 && !this.entry_7;
            this.who_hit_24 = who_hit_24_temp;
        }

        const hit_36 = instrument_1_original_change <= this.globalDict.sellAt36Limit || instrument_2_original_change <= this.globalDict.sellAt36Limit;
        const checkLessThan24 = (instrument) => instrument.token == instrument_1.token ? instrument_1_original_change < this.globalDict.sellAt24Limit : instrument_2_original_change < this.globalDict.sellAt24Limit;

        if(!this.entry_36){
            this.entry_36 = hit_36 && !this.entry_24 && !this.entry_7;
            this.who_hit_36 = instrument_1_original_change <= this.globalDict.sellAt36Limit ? instrument_1 : instrument_2;
        }
        
        const hit_7 = mtm >= this.globalDict.target;
        const reached_stoploss = mtm <= this.globalDict.stoploss;
        if(!this.entry_7){
            this.entry_7 = (hit_7 || reached_stoploss) && !this.entry_24 && !this.entry_36;
        }
        
        if(this.entry_7){
            this.boughtSold = true;
            // SELL LOGIC - Sell both instruments at target or stoploss
            try {
                const sellResult = await this.sellBothInstruments(instrument_1, instrument_2);
                if (sellResult && sellResult.success) {
                    this.strategyUtils.logStrategyInfo(`Both instruments sold - Executed prices: ${JSON.stringify(sellResult.executedPrices)}`);
                } else {
                    this.strategyUtils.logStrategyError('Failed to sell both instruments at target/stoploss');
                }
            } catch (error) {
                this.strategyUtils.logStrategyError(`Error selling both instruments: ${error.message}`);
            }
        }
        
        if(this.entry_24){
            let first_instrument = this.who_hit_24;
            let second_instrument = this.who_hit_24 === instrument_1 ? instrument_2 : instrument_1;
            let second_instrument_change = second_instrument === instrument_1 ? instrument_1_original_change : instrument_2_original_change;
            
            if(!this.entry_24_first_stage){
                this.entry_24_first_stage = true;
                // SELL LOGIC FOR FIRST INSTRUMENT - Sell the instrument that hit +24
                try {
                    const sellResult = await this.sellInstrument(first_instrument);
                    if (sellResult && sellResult.success) {
                        this.strategyUtils.logStrategyInfo(`First instrument sold at +24 - Executed price: ${sellResult.executedPrice}`);
                        this.mtmPriceAt24Sell = sellResult.executedPrice || first_instrument.last; // Store price of remaining instrument with fallback
                    } else {
                        this.strategyUtils.logStrategyError('Failed to sell first instrument at +24');
                        this.mtmPriceAt24Sell = first_instrument.last;
                    }
                } catch (error) {
                    this.strategyUtils.logStrategyError(`Error selling first instrument at +24: ${error.message}`);
                    this.mtmPriceAt24Sell = first_instrument.last;
                }
            }
            
            if(!this.entry_24_second_stage && this.entry_24_first_stage){
                let target = this.globalDict.target - (this.mtmPriceAt24Sell - first_instrument.buyPrice);
                // this.strategyUtils.logStrategyInfo(`Target: ${target}`);
                if (second_instrument_change >= target){
                    this.boughtSold = true;
                    this.entry_24_second_stage = true;
                    // SELL LOGIC FOR SECOND INSTRUMENT - Sell remaining instrument at target
                    try {
                        const sellResult = await this.sellInstrument(second_instrument);
                        if (sellResult && sellResult.success) {
                            this.strategyUtils.logStrategyInfo(`Second instrument sold at target - Executed price: ${sellResult.executedPrice}`);
                        } else {
                            this.strategyUtils.logStrategyError('Failed to sell second instrument at target');
                        }
                    } catch (error) {
                        this.strategyUtils.logStrategyError(`Error selling second instrument at target: ${error.message}`);
                    }
                }
                else if (second_instrument_change <= this.globalDict.sellAt36Limit){
                    this.mtmBuyBackInstrument = second_instrument.symbol.includes('CE') ? this.strategyUtils.findClosestPEBelowPrice(
                        this.universalDict.instrumentMap, 
                        200, 
                        200
                    ) : this.strategyUtils.findClosestCEBelowPrice(
                        this.universalDict.instrumentMap, 
                        200, 200);
                    
                    // SELL SECOND INSTRUMENT LOGIC - Sell second instrument at -36
                    try {
                        const sellResult = await this.sellInstrument(second_instrument);
                        if (sellResult && sellResult.success) {
                            this.strategyUtils.logStrategyInfo(`Second instrument sold at -36 - Executed price: ${sellResult.executedPrice}`);
                            this.mtmPriceAt36Sell = sellResult.executedPrice || second_instrument.last; // Store price for buy back calculation with fallback
                        } else {
                            this.strategyUtils.logStrategyError('Failed to sell second instrument at -36');
                            this.mtmPriceAt36Sell = second_instrument.last;
                        }
                    } catch (error) {
                        this.strategyUtils.logStrategyError(`Error selling second instrument at -36: ${error.message}`);
                        this.mtmPriceAt36Sell = second_instrument.last;
                    }

                    //BUY BACK BUYING LOGIC - Buy back the opposite instrument
                    this.buyBackInstrument = this.mtmBuyBackInstrument;
                    if (this.buyBackInstrument) {
                        this.buyBackInstrument.buyPrice = this.buyBackInstrument.last;
                    }

                    this.buyBackTarget = this.globalDict.target - (this.mtmPriceAt24Sell - first_instrument.buyPrice) - (this.mtmPriceAt36Sell - second_instrument.buyPrice);
                    this.strategyUtils.logStrategyInfo(`Symbol: ${this.buyBackInstrument.symbol} Buy back target: ${this.buyBackTarget}`);
                    
                    // BUYING LOGIC FOR BUY BACK INSTRUMENT - Buy the opposite instrument
                    try {
                        const buyResult = await this.buyInstrument(this.buyBackInstrument);
                        if (buyResult && buyResult.success) {
                            this.strategyUtils.logStrategyInfo(`Buy back instrument bought - Executed price: ${buyResult.executedPrice}`);
                            this.buyBackInstrument.buyPrice = buyResult.executedPrice || this.buyBackInstrument.last;
                        } else {
                            this.strategyUtils.logStrategyError('Failed to buy back instrument');
                            this.buyBackInstrument.buyPrice = this.buyBackInstrument.last;
                        }
                    } catch (error) {
                        this.strategyUtils.logStrategyError(`Error buying back instrument: ${error.message}`);
                        this.buyBackInstrument.buyPrice = this.buyBackInstrument.last;
                    }

                    this.entry_24_second_stage = true;
                }
            }

            if(!this.entry_24_third_stage && this.entry_24_second_stage && !this.boughtSold){
                if (this.buyBackInstrument) {
                    let change = this.buyBackInstrument.last - this.buyBackInstrument.buyPrice;
                    if(change >= this.buyBackTarget){
                        this.boughtSold = true;
                        this.entry_24_third_stage = true;
                        // SELL LOGIC FOR BUY BACK INSTRUMENT - Sell buy back instrument at target
                        try {
                            const sellResult = await this.sellInstrument(this.buyBackInstrument);
                            if (sellResult && sellResult.success) {
                                this.strategyUtils.logStrategyInfo(`Buy back instrument sold at target - Executed price: ${sellResult.executedPrice}`);
                            } else {
                                this.strategyUtils.logStrategyError('Failed to sell buy back instrument at target');
                            }
                        } catch (error) {
                            this.strategyUtils.logStrategyError(`Error selling buy back instrument at target: ${error.message}`);
                        }
                    }
                }
                // else if(change <= this.globalDict.sellAt36Limit){
                    //     this.boughtSold = true;
                //     this.entry_24_third_stage = true;
                //     // SELL LOGIC FOR BUY BACK INSTRUMENT.
                // }
            }
        }

        if(this.entry_36){
            let first_instrument = this.who_hit_36;
            let second_instrument = this.who_hit_36 === instrument_1 ? instrument_2 : instrument_1;
            let second_instrument_change = second_instrument === instrument_1 ? instrument_1_original_change : instrument_2_original_change;
            if(!this.less_than_24){
                this.less_than_24 = checkLessThan24(second_instrument);
            }

            if(!this.entry_36_first_stage){
                this.entry_36_first_stage = true;
                // SELL LOGIC FOR FIRST INSTRUMENT - Sell the instrument that hit -36
                try {
                    const sellResult = await this.sellInstrument(first_instrument);
                    if (sellResult && sellResult.success) {
                        this.strategyUtils.logStrategyInfo(`First instrument sold at -36 - Executed price: ${sellResult.executedPrice}`);
                        this.mtmPriceAt36Sell = sellResult.executedPrice || first_instrument.last; // Store price of remaining instrument with fallback
                    } else {
                        this.strategyUtils.logStrategyError('Failed to sell first instrument at -36');
                        this.mtmPriceAt36Sell = first_instrument.last;
                    }
                } catch (error) {
                    this.strategyUtils.logStrategyError(`Error selling first instrument at -36: ${error.message}`);
                    this.mtmPriceAt36Sell = first_instrument.last;
                }
            }

            if(!this.entry_36_second_stage && this.entry_36_first_stage){
                let target = this.less_than_24 ? this.globalDict.sellAt24Limit : this.globalDict.target - (this.mtmPriceAt36Sell - first_instrument.buyPrice);
                if(second_instrument_change >= target){
                    this.entry_36_second_stage = true;
                    // SELL LOGIC FOR SECOND INSTRUMENT - Sell remaining instrument at target
                    try {
                        const sellResult = await this.sellInstrument(second_instrument);
                        if (sellResult && sellResult.success) {
                            this.strategyUtils.logStrategyInfo(`Second instrument sold at target - Executed price: ${sellResult.executedPrice}`);
                        } else {
                            this.strategyUtils.logStrategyError('Failed to sell second instrument at target');
                        }
                        this.mtmPriceAt24Sell = sellResult.executedPrice || second_instrument.last;
                    } catch (error) {
                        this.strategyUtils.logStrategyError(`Error selling second instrument at target: ${error.message}`);
                    }

                    if(!this.less_than_24){
                        this.boughtSold = true;
                    }
                }
            }

            if(!this.entry_36_third_stage && this.entry_36_second_stage && !this.boughtSold){
                this.buyBackInstrument = second_instrument.symbol.includes('CE') ? this.strategyUtils.findClosestPEBelowPrice(
                    this.universalDict.instrumentMap, 
                    200, 
                    200
                ) : this.strategyUtils.findClosestCEBelowPrice(
                    this.universalDict.instrumentMap, 
                    200, 200);

                if (this.buyBackInstrument) {
                    this.buyBackTarget = this.globalDict.target - (this.mtmPriceAt36Sell - first_instrument.buyPrice) - (this.mtmPriceAt24Sell - second_instrument.buyPrice);
                    this.entry_36_third_stage = true;
                    //BUYING LOGIC FOR NEW INSTRUMENT - Buy the opposite instrument
                    this.buyBackInstrument.buyPrice = this.buyBackInstrument.last;
                    try {
                        const buyResult = await this.buyInstrument(this.buyBackInstrument);
                        if (buyResult && buyResult.success) {
                            this.strategyUtils.logStrategyInfo(`Buy back instrument bought - Executed price: ${buyResult.executedPrice}`);
                            this.buyBackInstrument.buyPrice = buyResult.executedPrice || this.buyBackInstrument.last;
                        } else {
                            this.strategyUtils.logStrategyError('Failed to buy back instrument');
                            this.buyBackInstrument.buyPrice = this.buyBackInstrument.last;
                        }
                    } catch (error) {
                        this.strategyUtils.logStrategyError(`Error buying back instrument: ${error.message}`);
                        this.buyBackInstrument.buyPrice = this.buyBackInstrument.last;
                    }
                }
            }
            
            if(!this.entry_36_fourth_stage && this.entry_36_third_stage && !this.boughtSold){
                if (this.buyBackInstrument) {
                    let change = this.buyBackInstrument.last - this.buyBackInstrument.buyPrice;
                    if(change >= this.buyBackTarget){
                        this.boughtSold = true;
                        this.entry_36_fourth_stage = true;
                        // SELL LOGIC FOR BUY BACK INSTRUMENT - Sell buy back instrument at target
                        try {
                            const sellResult = await this.sellInstrument(this.buyBackInstrument);
                            if (sellResult && sellResult.success) {
                                this.strategyUtils.logStrategyInfo(`Buy back instrument sold at target - Executed price: ${sellResult.executedPrice}`);
                            } else {
                                this.strategyUtils.logStrategyError('Failed to sell buy back instrument at target');
                            }
                        } catch (error) {
                            this.strategyUtils.logStrategyError(`Error selling buy back instrument at target: ${error.message}`);
                        }
                    }
                }
            }
        }
        // Check if cycle is complete
        if (this.boughtSold) {
            this.blockDiff10 = false;
            this.blockNextCycle = true;
            this.strategyUtils.logStrategyInfo('Transitioning from DIFF10 to NEXT CYCLE block');
            
            // Emit real-time cycle completion notification
            this.emitBlockTransition('DIFF10', 'NEXT_CYCLE', {
                cycleCompleted: true,
                currentCycle: this.universalDict.cycles || 0
            });
        }
        
        if (instrument_1.flagCancel24 && instrument_2.flagCancel24){
            instrument_1.flagCancel24 = false;
            instrument_2.flagCancel24 = false;
            this.strategyUtils.logStrategyInfo(`24 points cancellation reset for both instruments`);
        }
    }

    processNextCycleBlock(ticks) {
        // this.strategyUtils.logStrategyInfo('Processing NEXT CYCLE block');
        
        // Reset for next cycle
        this.resetForNextCycle();
        
        this.blockNextCycle = false;
        this.blockInit = true;
        this.strategyUtils.logStrategyInfo('Transitioning from NEXT CYCLE to INIT block');
        
        // Emit cycle restart notification
        this.emitBlockTransition('NEXT_CYCLE', 'INIT', {
            cycleNumber: this.universalDict.cycles || 0,
            cycleReset: true,
            message: `Starting cycle ${this.universalDict.cycles || 0}`
        });
    }


    shouldSellAt10(){
        if (this.boughtToken && this.oppBoughtToken){
            const mainInstrument = this.universalDict.instrumentMap[this.boughtToken];
            const oppInstrument = this.universalDict.instrumentMap[this.oppBoughtToken];
            
            // Add null checks for instruments
            if (!mainInstrument || !oppInstrument) {
                this.strategyUtils.logStrategyError('Cannot check sell at 10 - instrument data not found');
                return false;
            }
            
            const sum = mainInstrument.last + oppInstrument.last;
            const buyingSum = mainInstrument.buyPrice + oppInstrument.buyPrice;
            const change = sum - buyingSum;
            const sellAt10Limit = Number(this.globalDict.sellAt10Limit || -10);
            return change <= sellAt10Limit;
        }
        return false;
    }

    sellAt10(){
        if (!this.boughtToken || !this.oppBoughtToken){
            this.strategyUtils.logStrategyError('Cannot sell at 10 - boughtToken or oppBoughtToken not set');
            return;
        }

        this.strategyUtils.logStrategyInfo('Selling at -10 points');
        this.mtmSoldAt10 = true;

        const mainInstrument = this.universalDict.instrumentMap[this.boughtToken];
        const oppInstrument = this.universalDict.instrumentMap[this.oppBoughtToken];
        
        // Add null checks for instruments
        if (!mainInstrument || !oppInstrument) {
            this.strategyUtils.logStrategyError('Cannot sell at 10 - instrument data not found');
            return;
        }
        
        const mainChange = mainInstrument.last - mainInstrument.buyPrice;
        const oppChange = oppInstrument.last - oppInstrument.buyPrice;
        let firstInstrument = null;
        let secondInstrument = null;
        if(this.globalDict.sellFirstAt10.toUpperCase() == "HIGHER"){

            firstInstrument = (mainInstrument.last - mainInstrument.buyPrice) >= (oppInstrument.last - oppInstrument.buyPrice) ? mainInstrument : oppInstrument;
            secondInstrument = firstInstrument === mainInstrument ? oppInstrument : mainInstrument;
        }
        else{
            firstInstrument = (mainInstrument.last - mainInstrument.buyPrice) <= (oppInstrument.last - oppInstrument.buyPrice) ? mainInstrument : oppInstrument;
            secondInstrument = firstInstrument === mainInstrument ? oppInstrument : mainInstrument;
        }
        this.mtmFirstToSell = firstInstrument;
        this.mtmFirstToSellPrice = firstInstrument.last;
        this.mtmNextToSell = secondInstrument;
        this.mtmAssistedTarget2 = this.globalDict.target - (mainChange + oppChange);
        this.mtmPriceAt10Sell = secondInstrument.last;
        // this.mtmFirstToSellPrice = firstInstrument.last;
        const tradingEnabled = this.globalDict.enableTrading === true;
        if (tradingEnabled && this.mtm10firstHit){
            // CRITICAL FIX: Ensure TradingUtils is available before proceeding
            if (!this.tradingUtils) {
                this.strategyUtils.logStrategyError('CRITICAL ERROR: TradingUtils not available - cannot place sell orders');
                this.strategyUtils.logStrategyError('This usually indicates a timing issue with TradingUtils injection');
                return;
            }

            // Use the injected TradingUtils instance
            const tradingUtils = this.tradingUtils;

            try {
                // Place sell order for the lesser instrument - synchronous
                const sellResult = tradingUtils.placeMarketSellOrder(
                    firstInstrument.symbol,
                    firstInstrument.last,
                    this.globalDict.quantity || 75
                );

                if (sellResult.success) {
                    this.strategyUtils.logStrategyInfo(`Sell order placed for ${firstInstrument.symbol}`);
                    this.strategyUtils.logOrderPlaced('sell', firstInstrument.symbol, firstInstrument.last, this.globalDict.quantity || 75, firstInstrument.token);
                } else {
                    this.strategyUtils.logStrategyError(`Failed to place sell order for ${firstInstrument.symbol}: ${sellResult.error}`);
                    this.strategyUtils.logOrderFailed('sell', firstInstrument.symbol, firstInstrument.last, this.globalDict.quantity || 75, firstInstrument.token, sellResult.error);
                }

                sellResult.orderId.then(orderId => {
                    this.strategyUtils.logStrategyInfo(`Order ID: ${orderId.order_id}`);
                })
                .catch(error => {
                    this.strategyUtils.logStrategyError(`Error getting order history: ${JSON.stringify(error)}`);
                });

            } catch (error) {
                this.strategyUtils.logStrategyError(`Exception while selling at 10: ${error.message}`);
            }
        } else {
            // Paper trading - log the order without placing it
            this.strategyUtils.logStrategyInfo(`PAPER TRADING: Sell order for ${firstInstrument.symbol} @ ${firstInstrument.last}`);
            this.strategyUtils.logOrderPlaced('sell', firstInstrument.symbol, firstInstrument.last, this.globalDict.quantity || 75, firstInstrument.token);
        }
    }

    shouldSellRemainingAtTargetAfter10(){
        if (this.mtmNextToSell && this.mtmSoldAt10){
            const remainingInstrument = this.universalDict.instrumentMap[this.mtmNextToSell.token];
            // const firstInstrument = this.universalDict.instrumentMap[this.mtmFirstToSell.token];

            // Add null check for remaining instrument
            if (!remainingInstrument) {
                this.strategyUtils.logStrategyError('Cannot check remaining instrument after 10 - instrument data not found');
                return false;
            }

            // const firstChangeFrom10 = firstInstrument.last - this.mtmFirstToSellPrice;
            const changeFrom10 = remainingInstrument.last - this.mtmPriceAt10Sell;

            // if(firstChangeFrom10 >= this.mtmAssistedTarget || changeFrom10 >= this.mtmAssistedTarget){
            //     if(firstChangeFrom10 >= this.mtmAssisstedTarget){
            //         let status = this.globalDict.sellFirstAt10.toUpperCase() == "HIGHER" ? "LOWER" : "HIGHER"
            //         this.strategyUtils.logStrategyInfo(`${firstInstrument.symbol} achieved target with ${status}`)
            //     }
            //     else if(changeFrom10 >= this.mtmAssistedTarget){
            //         let status = this.globalDict.sellFirstAt10.toUpperCase()
            //         this.strategyUtils.logStrategyInfo(`${remainingInstrument.symbol} achieved target with ${status}`)
            //     }
            // }
            
            return changeFrom10 >= this.mtmAssistedTarget2;
        }
        return false;
    }

    sellRemainingAtTargetAfter10(){
        this.strategyUtils.logStrategyInfo('Selling remaining instrument at target after 10 point');
        this.mtmNextSellAfter10 = true;
        if (this.mtm10firstHit){
            this.boughtSold = true;
        }
        const remainingInstrument = this.universalDict.instrumentMap[this.mtmNextToSell.token];
        
        // Add null check for remaining instrument
        if (!remainingInstrument) {
            this.strategyUtils.logStrategyError('Cannot sell remaining instrument after 10 - instrument data not found');
            return;
        }
        const tradingEnabled = this.globalDict.enableTrading === true;
        if (tradingEnabled && this.mtm10firstHit){
            // CRITICAL FIX: Ensure TradingUtils is available before proceeding
            if (!this.tradingUtils) {
                this.strategyUtils.logStrategyError('CRITICAL ERROR: TradingUtils not available - cannot place sell orders');
                this.strategyUtils.logStrategyError('This usually indicates a timing issue with TradingUtils injection');
                return;
            }

            // Use the injected TradingUtils instance
            const tradingUtils = this.tradingUtils;

            try {
                // Place sell order for the remaining instrument - synchronous
                const sellResult = tradingUtils.placeMarketSellOrder(
                    remainingInstrument.symbol,
                    remainingInstrument.last,
                    this.globalDict.quantity || 75
                );

                if (sellResult.success) {
                    this.strategyUtils.logStrategyInfo(`Sell order placed for ${remainingInstrument.symbol}`);
                    this.strategyUtils.logOrderPlaced('sell', remainingInstrument.symbol, remainingInstrument.last, this.globalDict.quantity || 75, this.mtmNextToSell.token);
                } else {
                    this.strategyUtils.logStrategyError(`Failed to place sell order for ${remainingInstrument.symbol}: ${sellResult.error}`);
                    this.strategyUtils.logOrderFailed('sell', remainingInstrument.symbol, remainingInstrument.last, this.globalDict.quantity || 75, this.mtmNextToSell.token, sellResult.error);
                }
            } catch (error) {
                this.strategyUtils.logStrategyError(`Exception while selling remaining instrument after 10: ${error.message}`);
            }
        } else {
            // Paper trading - log the order without placing it
            this.strategyUtils.logStrategyInfo(`PAPER TRADING: Sell order for ${remainingInstrument.symbol} @ ${remainingInstrument.last}`);
            this.strategyUtils.logOrderPlaced('sell', remainingInstrument.symbol, remainingInstrument.last, this.globalDict.quantity || 75, this.mtmNextToSell.token);
        }
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
        const tradingEnabled = this.globalDict.enableTrading === true;
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
                    
                    // Emit trade action for dashboard
                    this.emitTradeAction('buy', {
                        symbol: boughtInstrument.symbol,
                        price: boughtInstrument.last,
                        quantity: this.globalDict.quantity || 75
                    });
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
                    
                    // Emit trade action for dashboard
                    this.emitTradeAction('buy', {
                        symbol: oppInstrument.symbol,
                        price: oppInstrument.last,
                        quantity: this.globalDict.quantity || 75
                    });
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

    shouldSellOptions() {
        // Check if current sum is greater than or equal to target from buying sum
        if (this.boughtToken && this.oppBoughtToken) {
            const mainInstrument = this.universalDict.instrumentMap[this.boughtToken];
            const oppInstrument = this.universalDict.instrumentMap[this.oppBoughtToken];
            
            if (!mainInstrument || !oppInstrument) {
                this.strategyUtils.logStrategyError('Cannot check sell options - instrument data not found');
                return false;
            }
            
            // Ensure all values are numbers
            const mainChange = Number(mainInstrument.last || 0) - Number(mainInstrument.buyPrice || 0);
            const oppChange = Number(oppInstrument.last || 0) - Number(oppInstrument.buyPrice || 0);
            const totalChange = mainChange + oppChange;
            const target = Number(this.globalDict.target || 7);
            const stoploss = Number(this.globalDict.stoploss || -100);
            
            console.log(`Main change: ${mainChange.toFixed(2)}, Opp change: ${oppChange.toFixed(2)}, Total: ${totalChange.toFixed(2)}, Target: ${target}`);
            
            return totalChange >= target || totalChange <= stoploss;
        }
        
        return false;
    }

    shouldSellAt24() {
        // Check if either option has reached 24 points
        if (this.boughtToken && this.oppBoughtToken) {
            const mainInstrument = this.universalDict.instrumentMap[this.boughtToken];
            const oppInstrument = this.universalDict.instrumentMap[this.oppBoughtToken];
            
            if (!mainInstrument || !oppInstrument) {
                this.strategyUtils.logStrategyError('Cannot check sell at 24 - instrument data not found');
                return false;
            }
            
            // Ensure all values are numbers
            const mainChange = Number(mainInstrument.last || 0) - Number(mainInstrument.buyPrice || 0);
            const oppChange = Number(oppInstrument.last || 0) - Number(oppInstrument.buyPrice || 0);
            const total_change = mainChange + oppChange;
            const sellAt24Limit = Number(this.globalDict.sellAt24Limit || 24);
            if (total_change < Number(this.globalDict.lowerLimit || 0)){
                return mainChange >= sellAt24Limit || oppChange >= sellAt24Limit;
            }
            else{
                return false;
            }
        }
        
        return false;
    }

    shouldSellAt36() {
        // Check if remaining option has gone 12 points lower than its price at +24 sell time
        if (this.boughtToken && this.oppBoughtToken && false) {
            const mainInstrument = this.universalDict.instrumentMap[this.boughtToken];
            const oppInstrument = this.universalDict.instrumentMap[this.oppBoughtToken];
            
            if (!mainInstrument || !oppInstrument) {
                this.strategyUtils.logStrategyError('Cannot check sell at -36 points - instrument data not found');
                return false;
            }
            
            const mainChange = Number(mainInstrument.last || 0) - Number(mainInstrument.buyPrice || 0);
            const oppChange = Number(oppInstrument.last || 0) - Number(oppInstrument.buyPrice || 0);
            
            const sellAt36Limit = Number(this.globalDict.buyBackTrigger || -36);

            return mainChange <= sellAt36Limit || oppChange <= sellAt36Limit;
        }
        
        return false;
    }

    shouldSellRemainingAtTarget() {
        // Check if the remaining instrument (after sellAt24) has reached its target
        if (this.mtmNextToSell && this.mtmAssistedTarget !== undefined && this.mtmSoldAt24) {
            const remainingInstrument = this.universalDict.instrumentMap[this.mtmNextToSell.token];
            const currentPrice = Number(remainingInstrument.last || 0);
            const buyPrice = Number(remainingInstrument.buyPrice || 0);
            const changeFromBuy = currentPrice - buyPrice;
            const change_from_24_point = currentPrice - this.mtmPriceAt24Sell;
            const assistedTarget = Number(this.mtmAssistedTarget || 0);
            const stoploss = Number(this.globalDict.buyBackTrigger || -36);
            
            console.log(`Remaining instrument: ${remainingInstrument.symbol} @ ${currentPrice}, Buy price: ${buyPrice}, Change from buy: ${changeFromBuy.toFixed(2)}, Assisted Target: ${assistedTarget.toFixed(2)}`);
            
            return changeFromBuy <= stoploss || change_from_24_point >= assistedTarget; // Check if change from buy price reaches the assisted target
        }
        
        return false;
    }

    sellRemainingAtTarget() {
        this.strategyUtils.logStrategyInfo('Selling remaining instrument at target');
        this.mtmNextSellAfter24 = true;
        const remainingInstrument = this.universalDict.instrumentMap[this.mtmNextToSell.token];
        const currentPrice = Number(remainingInstrument.last || 0);
        this.changeAt36After24 = currentPrice - remainingInstrument.buyPrice;
        const buy_back_required = (this.changeAt36After24 <= Number(this.globalDict.buyBackTrigger || -36));
        
        if (!this.mtmNextToSell) {
            this.strategyUtils.logStrategyError('Cannot sell remaining instrument - mtmNextToSell not set');
            return;
        }

        if (!remainingInstrument) {
            this.strategyUtils.logStrategyError('Cannot sell remaining instrument - instrument data not found');
            return;
        }

        this.strategyUtils.logStrategyInfo(`Selling remaining instrument: ${remainingInstrument.symbol} @ ${remainingInstrument.last}`);

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
                // Place sell order for the remaining token - synchronous
                const sellResult = tradingUtils.placeMarketSellOrder(
                    remainingInstrument.symbol,
                    remainingInstrument.last,
                    this.globalDict.quantity || 75
                );

                if (sellResult.success) {
                    this.strategyUtils.logStrategyInfo(`Sell order placed for ${remainingInstrument.symbol}`);
                    this.strategyUtils.logOrderPlaced('sell', remainingInstrument.symbol, remainingInstrument.last, this.globalDict.quantity || 75, this.mtmNextToSell.token);
                } else {
                    this.strategyUtils.logStrategyError(`Failed to place sell order for ${remainingInstrument.symbol}: ${sellResult.error}`);
                    this.strategyUtils.logOrderFailed('sell', remainingInstrument.symbol, remainingInstrument.last, this.globalDict.quantity || 75, this.mtmNextToSell.token, sellResult.error);
                }

                sellResult.orderId.then(orderId => {
                    this.strategyUtils.logStrategyInfo(`Order ID: ${orderId.order_id}`);
                })
                .catch(error => {
                    this.strategyUtils.logStrategyError(`Error getting order history: ${JSON.stringify(error)}`);
                });

            } else {
                // Paper trading - log the order without placing it
                this.strategyUtils.logStrategyInfo(`PAPER TRADING: Sell order for ${remainingInstrument.symbol} @ ${remainingInstrument.last}`);
                this.strategyUtils.logOrderPlaced('sell', remainingInstrument.symbol, remainingInstrument.last, this.globalDict.quantity || 75, this.mtmNextToSell.token);
            }
            
            // Calculate and log P&L for the remaining token
            const remainingPnL = (remainingInstrument.last - remainingInstrument.buyPrice) * (this.globalDict.quantity || 75);
            this.strategyUtils.logStrategyInfo(`Remaining token P&L: ${remainingPnL.toFixed(2)}`);
            
            // Calculate total P&L from both trades
            const soldAt24PnL = this.mtmSoldAt24Gain || 0; // P&L from +24 sell
            const totalPnL = soldAt24PnL + remainingPnL;
            
            this.strategyUtils.logStrategyInfo(`Total P&L from both trades: ${totalPnL.toFixed(2)} (Sold at +24: ${soldAt24PnL.toFixed(2)}, Remaining: ${remainingPnL.toFixed(2)})`);
            
            this.strategyUtils.logTradeAction('sell_remaining_at_target', {
                remainingToken: this.mtmNextToSell.token,
                remainingPrice: remainingInstrument.last,
                remainingPnL: remainingPnL,
                totalPnL: totalPnL,
                debugMode: this.debugMode
            }, this.name);

            // Emit trade action for dashboard
            this.emitTradeAction('sell_remaining_at_target', {
                symbol: remainingInstrument.symbol,
                price: remainingInstrument.last,
                remainingPnL: remainingPnL,
                totalPnL: totalPnL
            });

        } catch (error) {
            this.strategyUtils.logStrategyError(`Exception while selling remaining instrument: ${error.message}`);
        }

        if (buy_back_required){
            this.strategyUtils.logStrategyInfo('Buy back required');
            this.buyBackAfter24 = true;
            this.mtmNextToSell = this.mtmFirstToSell;
            this.mtmAssistedTarget = this.globalDict.target - (this.changeAt24 + this.changeAt36After24);
            this.mtmBuyBackPrice = this.mtmNextToSell.last;
            this.mtmBuyBackTarget = this.mtmAssistedTarget;
            
            // CRITICAL FIX: Ensure TradingUtils is available before buy back
            if (!this.tradingUtils) {
                this.strategyUtils.logStrategyError('CRITICAL ERROR: TradingUtils not available for buy back - cannot place buy back order');
                this.strategyUtils.logStrategyError('This usually indicates a timing issue with TradingUtils injection');
                return;
            }
            
            // Buy back the instrument that was sold at +24
            try {
                if (tradingEnabled) {
                    // Place buy order for the buy back instrument
                    const buyBackResult = tradingUtils.placeBuyOrder(
                        this.mtmNextToSell.symbol,
                        this.mtmNextToSell.last,
                        this.globalDict.quantity || 75
                    );

                    if (buyBackResult.success) {
                        this.strategyUtils.logStrategyInfo(`Buy back order placed for ${this.mtmNextToSell.symbol}`);
                        this.strategyUtils.logOrderPlaced('buy', this.mtmNextToSell.symbol, this.mtmNextToSell.last, this.globalDict.quantity || 75, this.mtmNextToSell.token);
                        
                        // Emit trade action for dashboard
                        this.emitTradeAction('buy_back', {
                            symbol: this.mtmNextToSell.symbol,
                            price: this.mtmNextToSell.last,
                            quantity: this.globalDict.quantity || 75
                        });
                        
                        // Update buy price for the buy back instrument
                        this.mtmNextToSell.buyPrice = this.mtmNextToSell.last;
                        this.strategyUtils.logStrategyInfo(`Buy back completed at ${this.mtmNextToSell.last} with target: ${this.mtmAssistedTarget}`);
                    } else {
                        this.strategyUtils.logStrategyError(`Failed to place buy back order for ${this.mtmNextToSell.symbol}: ${buyBackResult.error}`);
                        this.strategyUtils.logOrderFailed('buy', this.mtmNextToSell.symbol, this.mtmNextToSell.last, this.globalDict.quantity || 75, this.mtmNextToSell.token, buyBackResult.error);
                    }

                    let buyBackPrice = this.mtmNextToSell.last;
                    buyBackResult.orderId.then(orderId => {
                        tradingUtils.getOrderHistory(orderId.order_id)
                        .then(result => {
                            this.strategyUtils.logStrategyInfo(`Order history: ${typeof result === 'object' ? JSON.stringify(result) : result}`);
                            buyBackPrice = result.at(-1).average_price;
                            this.strategyUtils.logStrategyInfo(`Executed Price: ${buyBackPrice}`);
                            this.mtmNextToSell.buyPrice = buyBackPrice != 0 ? buyBackPrice : this.mtmNextToSell.last;
                            this.strategyUtils.logStrategyInfo(`Buy Back Instrument Buy Price: ${this.mtmNextToSell.buyPrice}`);
                        })
                        .catch(error => {
                            this.strategyUtils.logStrategyError(`Error getting order history: ${JSON.stringify(error)}`);
                        });
                    }).catch(error => {
                        this.strategyUtils.logStrategyError(`Error getting order history: ${JSON.stringify(error)}`);
                    });

                } else {
                    // Paper trading - log the buy back order without placing it
                    this.strategyUtils.logStrategyInfo(`PAPER TRADING: Buy back order for ${this.mtmNextToSell.symbol} @ ${this.mtmNextToSell.last}`);
                    this.strategyUtils.logOrderPlaced('buy', this.mtmNextToSell.symbol, this.mtmNextToSell.last, this.globalDict.quantity || 75, this.mtmNextToSell.token);
                    
                    // Update buy price for the buy back instrument
                    this.mtmNextToSell.buyPrice = this.mtmNextToSell.last;
                    this.strategyUtils.logStrategyInfo(`Buy back completed at ${this.mtmNextToSell.last} with target: ${this.mtmAssistedTarget}`);
                }
                this.mtmNextToSell.buyPrice = this.mtmNextToSell.last;
            } catch (error) {
                this.strategyUtils.logStrategyError(`Exception while placing buy back order: ${error.message}`);
            }
        }
        else{
            this.boughtSold = true;
        }
    }

    shouldSellBuyBack() {
        // Check if buy-back instrument has reached its target
        if (this.mtmBuyBackPrice && this.mtmBuyBackTarget && this.buyBackAfter24) {
            const buyBackInstrument = this.mtmNextToSell;
            
            if (buyBackInstrument) {
                const currentPrice = Number(buyBackInstrument.last || 0);
                const change_from_buy = currentPrice - buyBackInstrument.buyPrice;
                const stoploss = Number(this.globalDict.stoploss || -36);
                const buyBackPrice = Number(this.mtmBuyBackPrice || 0);
                const buyBackTarget = Number(this.mtmBuyBackTarget || 0);
                const targetPrice = buyBackPrice + buyBackTarget;
                
                this.strategyUtils.logStrategyInfo(`Buy-back instrument: ${buyBackInstrument.symbol} @ ${currentPrice}, Target: ${targetPrice.toFixed(2)}`);
                
                return currentPrice >= targetPrice || change_from_buy <= stoploss;
            }
        }
        
        return false;
    }

    sellOptions() {
        this.strategyUtils.logStrategyInfo('Selling both options');
        this.boughtSold = true;
        this.mtmBothSold = true;
        
        if (!this.boughtToken || !this.oppBoughtToken) {
            this.strategyUtils.logStrategyInfo('Cannot sell options - boughtToken or oppBoughtToken not set');
            return;
        }

        const mainInstrument = this.universalDict.instrumentMap[this.boughtToken];
        const oppInstrument = this.universalDict.instrumentMap[this.oppBoughtToken];

        if (!mainInstrument || !oppInstrument) {
            this.strategyUtils.logStrategyInfo('Cannot sell options - instrument data not found');
            return;
        }

        this.strategyUtils.logStrategyInfo(`Selling ${mainInstrument.symbol} @ ${mainInstrument.last}`);
        this.strategyUtils.logStrategyInfo(`Selling ${oppInstrument.symbol} @ ${oppInstrument.last}`);

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
                // Place sell order for main token - synchronous
                const mainSellResult = tradingUtils.placeMarketSellOrder(
                    mainInstrument.symbol,
                    mainInstrument.last,
                    this.globalDict.quantity || 75
                );

                if (mainSellResult.success) {
                    this.strategyUtils.logStrategyInfo(`Sell order placed for ${mainInstrument.symbol}`);
                    this.strategyUtils.logOrderPlaced('sell', mainInstrument.symbol, mainInstrument.last, this.globalDict.quantity || 75, this.boughtToken);
                } else {
                    this.strategyUtils.logStrategyError(`Failed to place sell order for ${mainInstrument.symbol}: ${mainSellResult.error}`);
                    this.strategyUtils.logOrderFailed('sell', mainInstrument.symbol, mainInstrument.last, this.globalDict.quantity || 75, this.boughtToken, mainSellResult.error);
                }

                mainSellResult.orderId.then(orderId => {
                    this.strategyUtils.logStrategyInfo(`Order ID: ${orderId.order_id}`);
                })
                .catch(error => {
                    this.strategyUtils.logStrategyError(`Error getting order history: ${JSON.stringify(error)}`);
                });

                // Place sell order for opposite token - synchronous
                const oppSellResult = tradingUtils.placeMarketSellOrder(
                    oppInstrument.symbol,
                    oppInstrument.last,
                    this.globalDict.quantity || 75
                );

                if (oppSellResult.success) {
                    this.strategyUtils.logStrategyInfo(`Sell order placed for ${oppInstrument.symbol}`);
                    this.strategyUtils.logOrderPlaced('sell', oppInstrument.symbol, oppInstrument.last, this.globalDict.quantity || 75, this.oppBoughtToken);
                } else {
                    this.strategyUtils.logStrategyError(`Failed to place sell order for ${oppInstrument.symbol}: ${oppSellResult.error}`);
                    this.strategyUtils.logOrderFailed('sell', oppInstrument.symbol, oppInstrument.last, this.globalDict.quantity || 75, this.oppBoughtToken, oppSellResult.error);
                }

                oppSellResult.orderId.then(orderId => {
                    this.strategyUtils.logStrategyInfo(`Order ID: ${orderId.order_id}`);
                })
                .catch(error => {
                    this.strategyUtils.logStrategyError(`Error getting order history: ${JSON.stringify(error)}`);
                });

            } else {
                // Paper trading - log the orders without placing them
                this.strategyUtils.logStrategyInfo(`PAPER TRADING: Sell order for ${mainInstrument.symbol} @ ${mainInstrument.last}`);
                this.strategyUtils.logOrderPlaced('sell', mainInstrument.symbol, mainInstrument.last, this.globalDict.quantity || 75, this.boughtToken);
                
                this.strategyUtils.logStrategyInfo(`PAPER TRADING: Sell order for ${oppInstrument.symbol} @ ${oppInstrument.last}`);
                this.strategyUtils.logOrderPlaced('sell', oppInstrument.symbol, oppInstrument.last, this.globalDict.quantity || 75, this.oppBoughtToken);
            }

            // Calculate and log P&L
            const mainPnL = (mainInstrument.last - mainInstrument.buyPrice) * (this.globalDict.quantity || 75);
            const oppPnL = (oppInstrument.last - oppInstrument.buyPrice) * (this.globalDict.quantity || 75);
            const totalPnL = mainPnL + oppPnL;

            this.strategyUtils.logStrategyInfo(`Total P&L: ${totalPnL.toFixed(2)} (Main: ${mainPnL.toFixed(2)}, Opp: ${oppPnL.toFixed(2)})`);
            
            // Log the sell action
            this.strategyUtils.logTradeAction('sell_both_options', {
                mainToken: this.boughtToken,
                oppToken: this.oppBoughtToken,
                mainPrice: mainInstrument.last,
                oppPrice: oppInstrument.last,
                mainPnL: mainPnL,
                oppPnL: oppPnL,
                totalPnL: totalPnL,
                debugMode: this.debugMode
            }, this.name);

            // Emit trade action for dashboard
            this.emitTradeAction('sell_both_options', {
                symbol: `${mainInstrument.symbol}, ${oppInstrument.symbol}`,
                price: `${mainInstrument.last}, ${oppInstrument.last}`,
                totalPnL: totalPnL
            });

        } catch (error) {
            this.strategyUtils.logStrategyInfo(`Exception while selling options: ${error.message}`);
        }
    }

    sellAt24() {
        this.strategyUtils.logStrategyInfo('Selling at 24 points');
        this.mtmSoldAt24 = true;
        
        if (!this.boughtToken || !this.oppBoughtToken) {
            this.strategyUtils.logStrategyError('Cannot sell at 24 - boughtToken or oppBoughtToken not set');
            return;
        }

        const mainInstrument = this.universalDict.instrumentMap[this.boughtToken];
        const oppInstrument = this.universalDict.instrumentMap[this.oppBoughtToken];

        if (!mainInstrument || !oppInstrument) {
            this.strategyUtils.logStrategyError('Cannot sell at 24 - instrument data not found');
            return;
        }
        
        const mainChange = mainInstrument.last - mainInstrument.buyPrice;
        const oppChange = oppInstrument.last - oppInstrument.buyPrice;
        
        let tokenToSell, instrumentToSell, remainingToken, remainingInstrument;
        
        if (mainChange >= this.globalDict.sellAt24Limit) {
            // Sell main token, keep opposite
            tokenToSell = this.boughtToken;
            this.changeAt24 = mainChange;
            instrumentToSell = mainInstrument;
            this.mtmFirstToSell = mainInstrument;
            remainingToken = this.oppBoughtToken;
            remainingInstrument = oppInstrument;
            this.mtmNextToSell = oppInstrument;
            this.mtmPriceAt24Sell = oppInstrument.last; // Store price at +24 sell time
            this.mtmOriginalBuyPrice = oppInstrument.buyPrice;
            this.mtmSoldAt24Symbol = mainInstrument.symbol; // Store symbol for buy back
            
            // Calculate remaining target: target - (soldInstrumentGain + otherInstrumentLoss)
            const remainingTarget = this.globalDict.target - (mainChange + oppChange); // e.g., 7 - (24 + (-26)) = 7 + 2 = 9
            this.mtmAssistedTarget = remainingTarget;
            this.strategyUtils.logStrategyInfo(`Selling main option at +${mainChange.toFixed(2)}, opposite at ${oppChange.toFixed(2)}, remaining target: ${remainingTarget.toFixed(2)}`);
        } else {
            // Sell opposite token, keep main
            tokenToSell = this.oppBoughtToken;
            this.changeAt24 = oppChange;
            instrumentToSell = oppInstrument;
            this.mtmFirstToSell = oppInstrument;
            remainingToken = this.boughtToken;
            remainingInstrument = mainInstrument;
            this.mtmNextToSell = mainInstrument;
            this.mtmPriceAt24Sell = mainInstrument.last; // Store price at +24 sell time
            this.mtmOriginalBuyPrice = mainInstrument.buyPrice;
            this.mtmSoldAt24Symbol = oppInstrument.symbol; // Store symbol for buy back
            
            // Calculate remaining target: target - (soldInstrumentGain + otherInstrumentLoss)
            const remainingTarget = this.globalDict.target - (oppChange + mainChange); // e.g., 7 - (24 + (-20)) = 7 - 4 = 3
            this.mtmAssistedTarget = remainingTarget;
            this.strategyUtils.logStrategyInfo(`Selling opposite option at +${oppChange.toFixed(2)}, main at ${mainChange.toFixed(2)}, remaining target: ${remainingTarget.toFixed(2)}`);
        }

        this.strategyUtils.logStrategyInfo(`Selling ${instrumentToSell.symbol} @ ${instrumentToSell.last}`);
        this.strategyUtils.logStrategyInfo(`Keeping ${remainingInstrument.symbol} @ ${remainingInstrument.last} (target: ${this.mtmAssistedTarget.toFixed(2)})`);

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
                // Place sell order for the token to sell - synchronous
                const sellResult = tradingUtils.placeMarketSellOrder(
                    instrumentToSell.symbol,
                    instrumentToSell.last,
                    this.globalDict.quantity || 75
                );

                if (sellResult.success) {
                    this.strategyUtils.logStrategyInfo(`Sell order placed for ${instrumentToSell.symbol}`);
                    this.strategyUtils.logOrderPlaced('sell', instrumentToSell.symbol, instrumentToSell.last, this.globalDict.quantity || 75, tokenToSell);
                    
                    // Emit real-time trade action notification
                    this.emitTradeAction('sell_at_24', {
                        symbol: instrumentToSell.symbol,
                        price: instrumentToSell.last,
                        quantity: this.globalDict.quantity || 75,
                        change: this.changeAt24,
                        remainingSymbol: remainingInstrument.symbol,
                        remainingTarget: this.mtmAssistedTarget,
                        orderType: 'market_sell'
                    });
                } else {
                    this.strategyUtils.logStrategyError(`Failed to place sell order for ${instrumentToSell.symbol}: ${sellResult.error}`);
                    this.strategyUtils.logOrderFailed('sell', instrumentToSell.symbol, instrumentToSell.last, this.globalDict.quantity || 75, tokenToSell, sellResult.error);
                    
                    // Emit error notification
                    this.emitToUser('trade_error', {
                        action: 'sell_at_24',
                        symbol: instrumentToSell.symbol,
                        error: sellResult.error
                    });
                }

                sellResult.orderId.then(orderId => {
                    this.strategyUtils.logStrategyInfo(`Order ID: ${orderId.order_id}`);
                })
                .catch(error => {
                    this.strategyUtils.logStrategyError(`Error getting order history: ${JSON.stringify(error)}`);
                });
            } else {
                // Paper trading - log the order without placing it
                this.strategyUtils.logStrategyInfo(`PAPER TRADING: Sell order for ${instrumentToSell.symbol} @ ${instrumentToSell.last}`);
                this.strategyUtils.logOrderPlaced('sell', instrumentToSell.symbol, instrumentToSell.last, this.globalDict.quantity || 75, tokenToSell);
            }
            
            // Calculate and log P&L for sold token
            const soldPnL = (instrumentToSell.last - instrumentToSell.buyPrice) * (this.globalDict.quantity || 75);
            this.strategyUtils.logStrategyInfo(`Sold token P&L: ${soldPnL.toFixed(2)}`);
            
            // Store the P&L from +24 sell for buy-back target calculation
            this.mtmSoldAt24Gain = soldPnL;
            
            this.strategyUtils.logTradeAction('sell_at_24', {
                soldToken: tokenToSell,
                remainingToken: remainingToken,
                soldPrice: instrumentToSell.last,
                soldPnL: soldPnL,
                remainingTarget: this.mtmAssistedTarget,
                debugMode: this.debugMode
            }, this.name);

            // Emit trade action for dashboard
            this.emitTradeAction('sell_at_24', {
                symbol: instrumentToSell.symbol,
                price: instrumentToSell.last,
                soldPnL: soldPnL,
                remainingTarget: this.mtmAssistedTarget
            });

        } catch (error) {
            this.strategyUtils.logStrategyError(`Exception while selling at 24: ${error.message}`);
        }
    }

    sellAt36() {
        this.mtmSoldAt36 = true;
        
        if (!this.boughtToken || !this.oppBoughtToken) {
            this.strategyUtils.logStrategyError('Cannot sell at 36 - boughtToken or oppBoughtToken not set');
            return;
        }

        const mainInstrument = this.universalDict.instrumentMap[this.boughtToken];
        const oppInstrument = this.universalDict.instrumentMap[this.oppBoughtToken];

        if (!mainInstrument || !oppInstrument) {
            this.strategyUtils.logStrategyError('Cannot sell at 36 - instrument data not found');
            return;
        }

        const mainChange = Number(mainInstrument.last || 0) - Number(mainInstrument.buyPrice || 0);
        const oppChange = Number(oppInstrument.last || 0) - Number(oppInstrument.buyPrice || 0);

        const sellAt36Limit = Number(this.globalDict.buyBackTrigger || -36);
        let change = 0
        if (mainChange <= sellAt36Limit) {
            this.mtmNextToSell = mainInstrument;
            this.mtmFirstToSell = oppInstrument;
            change = mainChange;
        }
        else if (oppChange <= sellAt36Limit) {
            this.mtmNextToSell = oppInstrument;
            this.mtmFirstToSell = mainInstrument;
            change = oppChange;
        }
        else{
            this.strategyUtils.logStrategyError('Cannot sell at 36 - instrument data not found');
            return;
        }

        this.strategyUtils.logStrategyInfo(`Selling instrument ${this.mtmNextToSell.symbol} @ ${this.mtmNextToSell.last} for going down by 36 points`);

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
                // Place sell order for the remaining token - synchronous
                const sellResult = tradingUtils.placeMarketSellOrder(
                    this.mtmNextToSell.symbol,
                    this.mtmNextToSell.last,
                    this.globalDict.quantity || 75
                );

                if (sellResult.success) {
                    this.strategyUtils.logStrategyInfo(`Sell order placed for ${this.mtmNextToSell.symbol}`);
                    this.strategyUtils.logOrderPlaced('sell', this.mtmNextToSell.symbol, this.mtmNextToSell.last, this.globalDict.quantity || 75, this.mtmNextToSell.token);
                } else {
                    this.strategyUtils.logStrategyError(`Failed to place sell order for ${this.mtmNextToSell.symbol}: ${sellResult.error}`);
                    this.strategyUtils.logOrderFailed('sell', this.mtmNextToSell.symbol, this.mtmNextToSell.last, this.globalDict.quantity || 75, this.mtmNextToSell.token, sellResult.error);
                }

                sellResult.orderId.then(orderId => {
                    this.strategyUtils.logStrategyInfo(`Order ID: ${orderId.order_id}`);
                })
                .catch(error => {
                    this.strategyUtils.logStrategyError(`Error getting order history: ${JSON.stringify(error)}`);
                });

            } else {
                // Paper trading - log the order without placing it
                this.strategyUtils.logStrategyInfo(`PAPER TRADING: Sell order for ${this.mtmNextToSell.symbol} @ ${this.mtmNextToSell.last}`);
                this.strategyUtils.logOrderPlaced('sell', this.mtmNextToSell.symbol, this.mtmNextToSell.last, this.globalDict.quantity || 75, this.mtmNextToSell.token);
            }

            let other_price_diff = Number(this.mtmFirstToSell.last || 0) - Number(this.mtmFirstToSell.buyPrice || 0);
            this.mtmAssistedTarget = this.globalDict.target - (change + other_price_diff);
            this.mtmPriceAt36Sell = this.mtmFirstToSell.last;
           
        } catch (error) {
            this.strategyUtils.logStrategyError(`Exception while selling at 36: ${error.message}`);
        }
    }

    sellBuyBack() {
        this.strategyUtils.logStrategyInfo('Selling buy-back instrument at target');
        this.sellBuyBackAfter24 = true; // This flag is set in sellAt36, but we need to ensure it's true for this block
        this.boughtSold = true;
        if (!this.mtmBuyBackPrice || !this.mtmBuyBackTarget) {
            this.strategyUtils.logStrategyError('Cannot sell buy-back instrument - mtmBuyBackPrice or mtmBuyBackTarget not set');
            return;
        }

        const buyBackInstrument = this.universalDict.instrumentMap[this.mtmNextToSell.token]; // This token is now 'buyback'

        if (!buyBackInstrument) {
            this.strategyUtils.logStrategyError('Cannot sell buy-back instrument - instrument data not found');
            return;
        }

        this.strategyUtils.logStrategyInfo(`Selling buy-back instrument: ${buyBackInstrument.symbol} @ ${buyBackInstrument.last}`);

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
                // Place sell order for the buy-back token - synchronous
                const sellResult = tradingUtils.placeMarketSellOrder(
                    buyBackInstrument.symbol,
                    buyBackInstrument.last,
                    this.globalDict.quantity || 75
                );

                if (sellResult.success) {
                    this.strategyUtils.logStrategyInfo(`Sell order placed for ${buyBackInstrument.symbol}`);
                    this.strategyUtils.logOrderPlaced('sell', buyBackInstrument.symbol, buyBackInstrument.last, this.globalDict.quantity || 75, this.boughtToken);
                } else {
                    this.strategyUtils.logStrategyError(`Failed to place sell order for ${buyBackInstrument.symbol}: ${sellResult.error}`);
                    this.strategyUtils.logOrderFailed('sell', buyBackInstrument.symbol, buyBackInstrument.last, this.globalDict.quantity || 75, this.boughtToken, sellResult.error);
                }

                sellResult.orderId.then(orderId => {
                    this.strategyUtils.logStrategyInfo(`Order ID: ${orderId.order_id}`);
                })
                .catch(error => {
                    this.strategyUtils.logStrategyError(`Error getting order history: ${JSON.stringify(error)}`);
                });

            } else {
                // Paper trading - log the order without placing it
                this.strategyUtils.logStrategyInfo(`PAPER TRADING: Sell order for ${buyBackInstrument.symbol} @ ${buyBackInstrument.last}`);
                this.strategyUtils.logOrderPlaced('sell', buyBackInstrument.symbol, buyBackInstrument.last, this.globalDict.quantity || 75, this.boughtToken);
            }
            
            // Calculate and log P&L for the buy-back token
            const buyBackPnL = (buyBackInstrument.last - buyBackInstrument.buyPrice) * (this.globalDict.quantity || 75);
            this.strategyUtils.logStrategyInfo(`Buy-back token P&L: ${buyBackPnL.toFixed(2)}`);
            
            this.strategyUtils.logTradeAction('sell_buyback', {
                buyBackSymbol: buyBackInstrument.symbol,
                buyBackPrice: buyBackInstrument.last,
                buyBackPnL: buyBackPnL,
                newTarget: this.mtmBuyBackTarget,
                debugMode: this.debugMode
            }, this.name);

            // Emit trade action for dashboard
            this.emitTradeAction('sell_buyback', {
                symbol: buyBackInstrument.symbol,
                price: buyBackInstrument.last,
                buyBackPnL: buyBackPnL
            });

        } catch (error) {
            this.strategyUtils.logStrategyError(`Exception while selling buy-back: ${error.message}`);
        }
    }

    shouldSellRemainingAtTargetAfter36() {
        if (this.mtmFirstToSell && this.mtmAssistedTarget !== undefined && this.mtmSoldAt36) {
            const firstInstrument = this.universalDict.instrumentMap[this.mtmFirstToSell.token];
            const currentPrice = Number(firstInstrument.last || 0);
            const buyPrice = Number(firstInstrument.buyPrice || 0);
            const priceAt36Sell = Number(this.mtmPriceAt36Sell || 0);
            const changeFromBuy = currentPrice - buyPrice;
            const changeFrom36Sell = currentPrice - priceAt36Sell;
            const stoploss = Number(this.globalDict.stoploss || -100);
            return changeFromBuy <= stoploss || changeFrom36Sell >= this.mtmAssistedTarget;
        }
        return false;
    }

    sellRemainingAtTargetAfter36() {
        this.strategyUtils.logStrategyInfo('Selling remaining instrument at target after 36 point');
        this.boughtSold = true;
        const remainingInstrument = this.universalDict.instrumentMap[this.mtmFirstToSell.token];
        const currentPrice = Number(remainingInstrument.last || 0);
        
        if (!this.mtmFirstToSell) {
            this.strategyUtils.logStrategyError('Cannot sell remaining instrument - mtmFirstToSell not set');
            return;
        }

        if (!remainingInstrument) {
            this.strategyUtils.logStrategyError('Cannot sell remaining instrument - instrument data not found');
            return;
        }

        this.strategyUtils.logStrategyInfo(`Selling remaining instrument: ${remainingInstrument.symbol} @ ${remainingInstrument.last}`);

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
                // Place sell order for the remaining token
                const sellResult = tradingUtils.placeMarketSellOrder(
                    remainingInstrument.symbol,
                    remainingInstrument.last,
                    this.globalDict.quantity || 75
                );

                if (sellResult.success) {
                    this.strategyUtils.logStrategyInfo(`Sell order placed for ${remainingInstrument.symbol}`);
                    this.strategyUtils.logOrderPlaced('sell', remainingInstrument.symbol, remainingInstrument.last, this.globalDict.quantity || 75, this.mtmFirstToSell.token);
                } else {
                    this.strategyUtils.logStrategyError(`Failed to place sell order for ${remainingInstrument.symbol}: ${sellResult.error}`);
                    this.strategyUtils.logOrderFailed('sell', remainingInstrument.symbol, remainingInstrument.last, this.globalDict.quantity || 75, this.mtmFirstToSell.token, sellResult.error);
                }

                sellResult.orderId.then(orderId => {
                    this.strategyUtils.logStrategyInfo(`Order ID: ${orderId.order_id}`);
                })
                .catch(error => {
                    this.strategyUtils.logStrategyError(`Error getting order history: ${JSON.stringify(error)}`);
                });

            } else {
                // Paper trading - log the order without placing it
                this.strategyUtils.logStrategyInfo(`PAPER TRADING: Sell order for ${remainingInstrument.symbol} @ ${remainingInstrument.last}`);
                this.strategyUtils.logOrderPlaced('sell', remainingInstrument.symbol, remainingInstrument.last, this.globalDict.quantity || 75, this.mtmFirstToSell.token);
            }
            
            // Calculate and log P&L for the remaining token
            const remainingPnL = (remainingInstrument.last - remainingInstrument.buyPrice) * (this.globalDict.quantity || 75);
            this.strategyUtils.logStrategyInfo(`Remaining token P&L: ${remainingPnL.toFixed(2)}`);
            
            this.strategyUtils.logTradeAction('sell_remaining_after_36', {
                remainingToken: this.mtmFirstToSell.token,
                remainingPrice: remainingInstrument.last,
                remainingPnL: remainingPnL,
                debugMode: this.debugMode
            }, this.name);

            // Emit trade action for dashboard
            this.emitTradeAction('sell_remaining_after_36', {
                symbol: remainingInstrument.symbol,
                price: remainingInstrument.last,
                remainingPnL: remainingPnL
            });

        } catch (error) {
            this.strategyUtils.logStrategyError(`Exception while selling remaining instrument after 36: ${error.message}`);
        }
    }
    
    resetForNextCycle() {

        this.strategyUtils.logStrategyInfo('Resetting for next cycle');
        
        // Increment cycle count
        this.universalDict.cycles = (this.universalDict.cycles || 0) + 1;
        
        // Reset all flags and state
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
        // Reset tokens
        this.mainToken = null;
        this.oppToken = null;
        this.boughtToken = null;
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

    // resetCycleForNewInstrument() {
    //     this.strategyUtils.logStrategyInfo('Resetting cycle for new instrument selection...');
        
    //     // Reset position state
    //     this.hasActivePosition = false;
    //     this.buyPrice = null;
    //     this.buySymbol = null;
        
    //     // Increment cycle count
    //     this.cycleCount++;
        
    //     // Reset instrument selection for new cycle
    //     this.selectedInstrument = null;
    //     this.instrumentSelectionComplete = false;
        
    //     // Reset cycle completion flags
    //     this.buyCompleted = false;
    //     this.sellCompleted = false;
        
    //     this.strategyUtils.logStrategyInfo(`Cycle ${this.cycleCount} started`);
    //     this.strategyUtils.logStrategyInfo('Will select new instrument for this cycle');
    //     this.strategyUtils.logStrategyInfo('⏰ Ready for new buy-sell cycle');
    //     this.strategyUtils.logStrategyInfo(`🔧 Debug Mode: ${this.debugMode ? 'ENABLED' : 'DISABLED'}`);
    // }


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
            sellAt10Live: {
                type: 'boolean',
                default: false,
                description: 'Enable/disable selling at 10 points live'
            },
            sellFirstAt10: {
                type: 'string',
                default: 'HIGHER',
                description: 'Sell first instrument at 10 points higher or lower. Default is HIGHER'
            },
            peakDef: {
                type: 'number',
                default: 3,
                description: 'Peak definition in points'
            },
            upperLimit: {
                type: 'number',
                default: 2.5,
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
            sellAt10Limit: {
                type: 'number',
                default: -10,
                description: 'Limit for selling at -10 points'
            },
            buyBackTrigger: {
                type: 'number',
                default: -36,
                description: 'Trigger for buying back the first instrument'
            },
            sellAt36Limit: {
                type: 'number',
                default: -36,
                description: 'Limit for selling at -36 points'
            }
        };
    }

    getUniversalDictParameters() {
        return {
            expiry: {
                type: 'number',
                default: 3,
                description: 'Expiry day (0=Monday, 3=Thursday)'
            },
            cycles: {
                type: 'number',
                default: 0,
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
            }
        };
    }

    // Helper method to sell both instruments
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

    // Dashboard-specific emit methods for real-time updates
    emitInstrumentDataUpdate() {
        if (!this.boughtToken || !this.oppBoughtToken) {
            return; // No instruments selected yet
        }

        const boughtInstrument = this.universalDict.instrumentMap[this.boughtToken];
        const oppInstrument = this.universalDict.instrumentMap[this.oppBoughtToken];

        if (!boughtInstrument || !oppInstrument) {
            return; // Instrument data not available
        }

        // Calculate differences from buy prices
        const boughtDiff = boughtInstrument.buyPrice > 0 ? boughtInstrument.last - boughtInstrument.buyPrice : 0;
        const oppDiff = oppInstrument.buyPrice > 0 ? oppInstrument.last - oppInstrument.buyPrice : 0;
        const sumValue = boughtInstrument.last + oppInstrument.last;
        const sumDiff = boughtDiff + oppDiff;

        // Determine instrument types
        const boughtType = boughtInstrument.symbol.includes('CE') ? 'CE' : 'PE';
        const oppType = oppInstrument.symbol.includes('CE') ? 'CE' : 'PE';

        const instrumentData = {
            status: 'instrument_data_update',
            boughtInstrument: {
                symbol: boughtInstrument.symbol,
                last: boughtInstrument.last,
                buyPrice: boughtInstrument.buyPrice,
                diff: boughtDiff,
                type: boughtType,
                token: boughtInstrument.token
            },
            oppInstrument: {
                symbol: oppInstrument.symbol,
                last: oppInstrument.last,
                buyPrice: oppInstrument.buyPrice,
                diff: oppDiff,
                type: oppType,
                token: oppInstrument.token
            },
            sum: {
                value: sumValue,
                diff: sumDiff
            },
            mtm: sumDiff,
            timestamp: new Date().toISOString()
        };

        this.emitStatusUpdate('instrument_data_update', instrumentData);
    }

    emitTradeAction(action, tradeData) {
        // Enhanced trade action emission for dashboard
        const enhancedTradeData = {
            action,
            symbol: tradeData.symbol || tradeData.instrument?.symbol,
            price: tradeData.price || tradeData.instrument?.last,
            quantity: tradeData.quantity || this.globalDict.quantity || 75,
            timestamp: new Date().toISOString(),
            ...tradeData
        };

        this.emitToUser('strategy_trade_action', enhancedTradeData);
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
}

module.exports = MTMV3Strategy;
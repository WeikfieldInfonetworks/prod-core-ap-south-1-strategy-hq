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
        if (this.universalDict.cycles >= this.globalDict.skipAfterCycles) {
            // this.universalDict.skipBuy = true;
            this.globalDict.sellAt10Live = true;
            this.globalDict.enableTrading = false;
        }

        if(this.universalDict.usePrebuy){
        this.prebuyFullData['init'] = {
            "cycles": this.universalDict.cycles,
                "enableTrading": this.globalDict.enableTrading,
                "timestamp": this.formatTime24(new Date())
            };
            this.emitPrebuyDataUpdate();
        }
        else{
            this.mtmFullData['init'] = {
                "cycles": this.universalDict.cycles,
                "enableTrading": this.globalDict.enableTrading,
                "timestamp": this.formatTime24(new Date())
            };
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
            if (ce_change <= this.globalDict.prebuyStoploss || pe_change <= this.globalDict.prebuyStoploss){
                let closestPEto200 = this.universalDict.instrumentMap[this.strategyUtils.findClosestPEAbovePrice(this.universalDict.instrumentMap, 200, 200).token.toString()];
                let closestCEto200 = this.universalDict.instrumentMap[this.strategyUtils.findClosestCEAbovePrice(this.universalDict.instrumentMap, 200, 200).token.toString()];
                real_instrument = ce_change <= this.globalDict.prebuyStoploss
                ? (this.globalDict.buySame ? closestCEto200 : closestPEto200)
                : (this.globalDict.buySame ? closestPEto200 : closestCEto200);

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
                }
                catch (error) {
                    this.strategyUtils.logStrategyError(`Error buying real instrument: ${error.message}`);
                }

                // Emit instrument data update to show the real bought instrument
                this.emitInstrumentDataUpdate();

                this.prebuyFullData['realBuy'] = {
                    "stoplossHitBy": real_instrument === ce_instrument ? this.globalDict.buySame ? ce_instrument.symbol : pe_instrument.symbol : this.globalDict.buySame ? pe_instrument.symbol : ce_instrument.symbol,
                    "stoplossHitByPrice": real_instrument === ce_instrument ? this.globalDict.buySame ? ce_instrument.last : pe_instrument.last : this.globalDict.buySame ? pe_instrument.last : ce_instrument.last,
                    "firstBuyInstrument": real_instrument,
                    "firstBuyPrice": this.prebuyBuyPriceOnce,
                    "firstBuyQuantity": this.globalDict.quantity || 75,
                    "firstBuyTimestamp": this.formatTime24(new Date()),
                    "secondBuy": false,
                    "averageBuyPrice": this.prebuyBuyPriceOnce
                }
                this.emitPrebuyDataUpdate();

                this.blockFinalRef = false;
                this.blockDiff10 = true;
                this.finalRefCompleted = true;
                this.strategyUtils.logStrategyInfo('Transitioning from FINAL REF to DIFF10 block');
                
                // Emit real-time notifications
                this.emitBlockTransition('FINAL_REF', 'DIFF10', {
                    boughtSymbol: real_instrument?.symbol,
                    oppSymbol: real_instrument.symbol.includes('CE') ? "000PE" : "000CE",
                    ordersPlaced: true
                });
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
        const mtm = instrument_1_original_change + instrument_2_original_change;

        console.log(`${instrument_1.symbol} ${instrument_1_original_change} ${instrument_2.symbol} ${instrument_2_original_change} MTM:${mtm}`);

        if(this.universalDict.usePrebuy && !this.entry_7){
            if((instrument_1_original_change <= this.globalDict.realBuyStoploss) && this.prebuyBuyPriceTwice == 0){
                //BUY AGAIN - Buy the same real instrument again
                this.prebuyBuyPriceTwice = instrument_1.last;
                try {
                    const buyResult = await this.buyInstrument(instrument_1);
                    if (buyResult && buyResult.success) {
                        this.strategyUtils.logStrategyInfo(`Real instrument bought again - Executed price: ${buyResult.executedPrice}`);
                    }
                    this.prebuyBuyPriceTwice = buyResult.executedPrice == 0 ? instrument_1.last : buyResult.executedPrice;

                }
                catch (error) {
                    this.strategyUtils.logStrategyError(`Error buying instrument 1: ${error.message}`);
                }

                // Update the real instrument's buy price to average of both buys
                instrument_1.buyPrice = (this.prebuyBuyPriceOnce + this.prebuyBuyPriceTwice) / 2;
                this.globalDict.target = this.globalDict.target / 2;
                this.globalDict.stoploss = this.globalDict.stoploss / 2;
                this.globalDict.quantity = this.globalDict.quantity * 2;

                // Emit instrument data update after second buy
                this.emitInstrumentDataUpdate();

                this.prebuyFullData['realBuy'] = {
                    ...this.prebuyFullData['realBuy'],
                    "secondBuy": true,
                    "secondBuyInstrument": instrument_1,
                    "secondBuyPrice": this.prebuyBuyPriceTwice,
                    "secondBuyQuantity": this.globalDict.quantity / 2,
                    "secondBuyTimestamp": this.formatTime24(new Date()),
                    "averageBuyPrice": (this.prebuyBuyPriceOnce + this.prebuyBuyPriceTwice) / 2
                }
                this.emitPrebuyDataUpdate();

                
            }

        }

        const hit_24 = (instrument_1_original_change >= this.globalDict.sellAt24Limit || instrument_2_original_change >= this.globalDict.sellAt24Limit) && !this.universalDict.usePrebuy;
        let who_hit_24_temp = null;

        if(hit_24){
            who_hit_24_temp = instrument_1_original_change >= this.globalDict.sellAt24Limit ? instrument_1 : instrument_2;
        }

        if(who_hit_24_temp){
            // if(!who_hit_24_temp.flagCancel24){
            //     who_hit_24_temp.flagCancel24 = hit_24 && mtm >= 0.5;
            //     if (who_hit_24_temp.flagCancel24){
            //         this.strategyUtils.logStrategyInfo(`24 points cancelled for ${who_hit_24_temp.symbol} due to mtm >= 0`);
            //     }
            // }

            if(mtm >= 0.5 && !this.entry_24 && !this.entry_36 && !this.entry_7 && !this.entry_plus_24){
                this.entry_plus_24 = true;
                this.who_hit_24 = who_hit_24_temp;
            }
        }
        

        if(!this.entry_24){
            this.entry_24 = hit_24 && mtm < 0.5 && !this.entry_36 && !this.entry_7 && !this.entry_plus_24;
            this.who_hit_24 = who_hit_24_temp;
        }

        const hit_36 = (instrument_1_original_change <= this.globalDict.sellAt36Limit || instrument_2_original_change <= this.globalDict.sellAt36Limit) && !this.universalDict.usePrebuy;
        const checkLessThan24 = (instrument) => instrument.token == instrument_1.token ? instrument_1_original_change < this.globalDict.sellAt24Limit : instrument_2_original_change < this.globalDict.sellAt24Limit;

        if(!this.entry_36){
            this.entry_36 = hit_36 && !this.entry_24 && !this.entry_7 && !this.entry_plus_24;
            this.who_hit_36 = instrument_1_original_change <= this.globalDict.sellAt36Limit ? instrument_1 : instrument_2;
        }
        
        const hit_7 = mtm >= this.globalDict.target;
        const reached_stoploss = mtm <= this.globalDict.stoploss;
        if(!this.entry_7){
            this.entry_7 = (hit_7 || reached_stoploss) && !this.entry_24 && !this.entry_36 && !this.entry_plus_24;
        }
        
        if(this.entry_7){
            this.boughtSold = true;
            let sellResult = null;
            // SELL LOGIC - Sell both instruments at target or stoploss
            if(!this.universalDict.usePrebuy){
                try {
                    sellResult = await this.sellBothInstruments(instrument_1, instrument_2);
                    if (sellResult && sellResult.success) {
                        this.strategyUtils.logStrategyInfo(`Both instruments sold - Executed prices: ${JSON.stringify(sellResult.executedPrices)}`);
                        
                        // Emit specific trade actions for dashboard table
                        this.emitTradeAction('sell', {
                            symbol: instrument_1.symbol,
                            price: sellResult.executedPrices.instrument1,
                            quantity: this.globalDict.quantity || 75,
                            scenario: 'sell_both_at_7',
                            instrumentType: instrument_1.symbol.includes('CE') ? 'CE' : 'PE'
                        });
                        
                        this.emitTradeAction('sell', {
                            symbol: instrument_2.symbol,
                            price: sellResult.executedPrices.instrument2,
                            quantity: this.globalDict.quantity || 75,
                            scenario: 'sell_both_at_7',
                            instrumentType: instrument_2.symbol.includes('CE') ? 'CE' : 'PE'
                        });
                    } else {
                        this.strategyUtils.logStrategyError('Failed to sell both instruments at target/stoploss');
                    }
                } catch (error) {
                    this.strategyUtils.logStrategyError(`Error selling both instruments: ${error.message}`);
                }
                this.mtmFullData['realSell'] = {
                    "call": {
                        "sellInstrument": instrument_1.symbol.includes('CE') ? instrument_1 : instrument_2,
                        "sellPrice": instrument_1.symbol.includes('CE') ? sellResult.executedPrices.instrument1 : sellResult.executedPrices.instrument2,
                        "sellQuantity": this.globalDict.quantity || 75,
                    },
                    "put": {
                        "sellInstrument": instrument_2.symbol.includes('CE') ? instrument_2 : instrument_1,
                        "sellPrice": instrument_2.symbol.includes('CE') ? sellResult.executedPrices.instrument2 : sellResult.executedPrices.instrument1,
                        "sellQuantity": this.globalDict.quantity || 75,
                    },
                    "sellTimestamp": this.formatTime24(new Date()),
                    "sellScenario": 'sell_both_at_7'
                }
            }
            else {
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

                if(this.prebuyBuyPriceTwice > 0){
                    this.globalDict.target = this.globalDict.target * 2;
                    this.globalDict.stoploss = this.globalDict.stoploss * 2;
                    this.globalDict.quantity = this.globalDict.quantity / 2;
                    this.strategyUtils.logStrategyInfo(`Target: ${this.globalDict.target}, Stoploss: ${this.globalDict.stoploss}, Quantity: ${this.globalDict.quantity} RESET COMPLETED.`);
                }

                this.prebuyFullData['realSell'] = {
                    "sellInstrument": instrument_1,
                    "sellPrice": sellResult.executedPrice,
                    "sellQuantity": this.globalDict.quantity || 75,
                    "sellTimestamp": this.formatTime24(new Date())
                }

                this.prebuyFullData['summary'] = {
                    "pnlInPoints": this.prebuyFullData['realSell']['sellPrice'] - this.prebuyFullData['realBuy']['averageBuyPrice'],
                    "pnlActual": (this.prebuyFullData['realSell']['sellPrice'] - this.prebuyFullData['realBuy']['firstBuyPrice'])
                                *(this.prebuyFullData['realBuy']['secondBuy'] 
                                ? this.prebuyFullData['realSell']['sellQuantity'] 
                                : this.prebuyFullData['realBuy']['firstBuyQuantity']),
                    
                }
                this.emitPrebuyDataUpdate();
            }
        }

        if(this.entry_plus_24){
            let lower_instrument = this.who_hit_24 === instrument_1 ? instrument_2 : instrument_1;
            let higher_instrument = this.who_hit_24 === instrument_1 ? instrument_1 : instrument_2;
            let higher_instrument_change = higher_instrument === instrument_1 ? instrument_1_original_change : instrument_2_original_change;
            let lower_instrument_change = lower_instrument === instrument_1 ? instrument_1_original_change : instrument_2_original_change;

            if(!this.entry_plus_24_first_stage){
                this.entry_plus_24_first_stage = true;
                this.strategyUtils.logStrategyInfo(`Lower instrument: ${lower_instrument.symbol} Higher instrument: ${higher_instrument.symbol}`);
                this.strategyUtils.logStrategyInfo(`Selling LOWER ${lower_instrument.symbol} at +24 when MTM is ${mtm}`);

                try {
                    const sellResult = await this.sellInstrument(lower_instrument);
                    if (sellResult && sellResult.success) {
                        this.strategyUtils.logStrategyInfo(`Lower instrument sold at +24 - Executed price: ${sellResult.executedPrice}`);
                        this.mtmPriceAt24Sell = sellResult.executedPrice || lower_instrument.last;
                        
                        // Emit specific trade action for dashboard table
                        this.emitTradeAction('sell', {
                            symbol: lower_instrument.symbol,
                            price: sellResult.executedPrice || lower_instrument.last,
                            quantity: this.globalDict.quantity || 75,
                            scenario: 'sell_at_24_plus',
                            instrumentType: lower_instrument.symbol.includes('CE') ? 'CE' : 'PE'
                        });
                    } else {
                        this.strategyUtils.logStrategyError('Failed to sell lower instrument at +24');
                        this.mtmPriceAt24Sell = lower_instrument.last;
                    }
                } catch (error) {
                    this.strategyUtils.logStrategyError(`Error selling lower instrument at +24: ${error.message}`);
                    this.mtmPriceAt24Sell = lower_instrument.last;
                }
            }

            if(!this.entry_plus_24_second_stage && this.entry_plus_24_first_stage){
                let target = this.globalDict.target - (this.mtmPriceAt24Sell - lower_instrument.buyPrice);
                if(higher_instrument_change >= target){
                    this.entry_plus_24_second_stage = true;
                    this.boughtSold = true;
                    // SELL LOGIC FOR SECOND INSTRUMENT - Sell remaining instrument at target
                    try {
                        const sellResult = await this.sellInstrument(higher_instrument);
                        if (sellResult && sellResult.success) {
                            this.strategyUtils.logStrategyInfo(`Second instrument sold at target - Executed price: ${sellResult.executedPrice}`);
                            
                            // Emit specific trade action for dashboard table
                            this.emitTradeAction('sell', {
                                symbol: higher_instrument.symbol,
                                price: sellResult.executedPrice || higher_instrument.last,
                                quantity: this.globalDict.quantity || 75,
                                scenario: 'target_after_24_plus',
                                instrumentType: higher_instrument.symbol.includes('CE') ? 'CE' : 'PE'
                            });
                        } else {
                            this.strategyUtils.logStrategyError('Failed to sell second instrument at target');
                        }
                    } catch (error) {
                        this.strategyUtils.logStrategyError(`Error selling second instrument at target: ${error.message}`);
                    }
                }
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
                        
                        // Emit specific trade action for dashboard table
                        this.emitTradeAction('sell', {
                            symbol: first_instrument.symbol,
                            price: sellResult.executedPrice || first_instrument.last,
                            quantity: this.globalDict.quantity || 75,
                            scenario: 'sell_at_24',
                            instrumentType: first_instrument.symbol.includes('CE') ? 'CE' : 'PE'
                        });
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
                            
                            // Emit specific trade action for dashboard table
                            this.emitTradeAction('sell', {
                                symbol: second_instrument.symbol,
                                price: sellResult.executedPrice || second_instrument.last,
                                quantity: this.globalDict.quantity || 75,
                                scenario: 'target_after_24',
                                instrumentType: second_instrument.symbol.includes('CE') ? 'CE' : 'PE'
                            });
                        } else {
                            this.strategyUtils.logStrategyError('Failed to sell second instrument at target');
                        }
                    } catch (error) {
                        this.strategyUtils.logStrategyError(`Error selling second instrument at target: ${error.message}`);
                    }
                }
                else if (second_instrument_change <= this.globalDict.sellAt36Limit){
                    this.mtmBuyBackInstrument = this.universalDict.instrumentMap[second_instrument.symbol.includes('CE') ? this.strategyUtils.findClosestPEBelowPrice(
                        this.universalDict.instrumentMap, 
                        300, 300).token.toString() : this.strategyUtils.findClosestCEBelowPrice(
                        this.universalDict.instrumentMap, 
                        300, 300).token.toString()];
                    // this.mtmBuyBackInstrument = first_instrument;
                    // SELL SECOND INSTRUMENT LOGIC - Sell second instrument at -36
                    try {
                        const sellResult = await this.sellInstrument(second_instrument);
                        if (sellResult && sellResult.success) {
                            this.strategyUtils.logStrategyInfo(`Second instrument sold at -36 - Executed price: ${sellResult.executedPrice}`);
                            this.mtmPriceAt36Sell = sellResult.executedPrice || second_instrument.last; // Store price for buy back calculation with fallback
                            
                            // Emit specific trade action for dashboard table
                            this.emitTradeAction('sell', {
                                symbol: second_instrument.symbol,
                                price: sellResult.executedPrice || second_instrument.last,
                                quantity: this.globalDict.quantity || 75,
                                scenario: 'sell_at_36',
                                instrumentType: second_instrument.symbol.includes('CE') ? 'CE' : 'PE'
                            });
                        } else {
                            this.strategyUtils.logStrategyError('Failed to sell second instrument at -36');
                            this.mtmPriceAt36Sell = second_instrument.last;
                        }
                    } catch (error) {
                        this.strategyUtils.logStrategyError(`Error selling second instrument at -36: ${error.message}`);
                        this.mtmPriceAt36Sell = second_instrument.last;
                    }

                    if(!this.shouldBuyBack()){
                        this.entry_24_second_stage = true;
                        this.boughtSold = true;
                    }

                    //BUY BACK BUYING LOGIC - Buy back the opposite instrument
                    this.buyBackInstrument = this.mtmBuyBackInstrument;
                    if (this.buyBackInstrument) {
                        this.buyBackInstrument.buyPrice = this.buyBackInstrument.last;
                    }

                    this.buyBackTarget = this.globalDict.buyBackTarget - ((this.mtmPriceAt24Sell - first_instrument.buyPrice) + (this.mtmPriceAt36Sell - second_instrument.buyPrice));
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
                                
                                // Emit specific trade action for dashboard table
                                this.emitTradeAction('sell', {
                                    symbol: this.buyBackInstrument.symbol,
                                    price: sellResult.executedPrice || this.buyBackInstrument.last,
                                    quantity: this.globalDict.quantity || 75,
                                    scenario: 'sell_buyback_after_24',
                                    instrumentType: this.buyBackInstrument.symbol.includes('CE') ? 'CE' : 'PE'
                                });
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
                        
                        // Emit specific trade action for dashboard table
                        this.emitTradeAction('sell', {
                            symbol: first_instrument.symbol,
                            price: sellResult.executedPrice || first_instrument.last,
                            quantity: this.globalDict.quantity || 75,
                            scenario: 'sell_at_36_first',
                            instrumentType: first_instrument.symbol.includes('CE') ? 'CE' : 'PE'
                        });
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

                    if(!this.shouldBuyBack()){
                        this.entry_36_second_stage = true;
                        this.boughtSold = true;
                    }
                }
            }

            if(!this.entry_36_third_stage && this.entry_36_second_stage && !this.boughtSold){
                this.buyBackInstrument = this.universalDict.instrumentMap[second_instrument.symbol.includes('CE') ? this.strategyUtils.findClosestPEBelowPrice(
                    this.universalDict.instrumentMap, 
                    300, 
                    300
                ).token.toString() : this.strategyUtils.findClosestCEBelowPrice(
                    this.universalDict.instrumentMap, 
                    300, 
                    300
                ).token.toString()];

                if (this.buyBackInstrument) {
                    this.buyBackTarget = this.globalDict.buyBackTarget - ((this.mtmPriceAt36Sell - first_instrument.buyPrice) + (this.mtmPriceAt24Sell - second_instrument.buyPrice));
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
                                
                                // Emit specific trade action for dashboard table
                                this.emitTradeAction('sell', {
                                    symbol: this.buyBackInstrument.symbol,
                                    price: sellResult.executedPrice || this.buyBackInstrument.last,
                                    quantity: this.globalDict.quantity || 75,
                                    scenario: 'sell_buyback_after_36',
                                    instrumentType: this.buyBackInstrument.symbol.includes('CE') ? 'CE' : 'PE'
                                });
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
        
        // if (instrument_1.flagCancel24 && instrument_2.flagCancel24){
        //     instrument_1.flagCancel24 = false;
        //     instrument_2.flagCancel24 = false;
        //     this.strategyUtils.logStrategyInfo(`24 points cancellation reset for both instruments`);
        // }
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
        const tradingEnabled = this.globalDict.enableTrading === true && this.universalDict.usePrebuy === false;
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

        if(this.universalDict.usePrebuy){
            this.prebuyFullData["preBoughtInstruments"] = {
                    "call": {
                        "instrument": boughtInstrument.symbol.includes('CE') ? boughtInstrument : oppInstrument,
                        "price": boughtInstrument.symbol.includes('CE') ? boughtInstrument.last : oppInstrument.last,
                        "quantity": this.globalDict.quantity || 75
                    },
                    "put": {
                        "instrument": boughtInstrument.symbol.includes('CE') ? oppInstrument : boughtInstrument,
                        "price": boughtInstrument.symbol.includes('CE') ? oppInstrument.last : boughtInstrument.last,
                        "quantity": this.globalDict.quantity || 75
                    },
                    "timestamp": this.formatTime24(new Date())
            }
            this.emitPrebuyDataUpdate();
        }
        else{
            this.mtmFullData["boughtInstruments"] = {
                "call": {
                    "instrument": boughtInstrument.symbol.includes('CE') ? boughtInstrument : oppInstrument,
                    "price": boughtInstrument.symbol.includes('CE') ? boughtInstrument.buyPrice : oppInstrument.buyPrice,
                    "quantity": this.globalDict.quantity || 75
                },
                "put": {
                    "instrument": boughtInstrument.symbol.includes('CE') ? oppInstrument : boughtInstrument,
                    "price": boughtInstrument.symbol.includes('CE') ? oppInstrument.buyPrice : boughtInstrument.buyPrice,
                    "quantity": this.globalDict.quantity || 75
                },
                "timestamp": this.formatTime24(new Date())
            }
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
                default: -7,
                description: 'Stoploss for pre-buy'
            },
            realBuyStoploss: {
                type: 'number',
                default: -9,
                description: 'Stoploss for real buy'
            },
            buySame : {
                type: 'boolean',
                default: false,
                description: 'Buy the same instrument again'
            },
            skipAfterCycles: {
                type: 'number',
                default: 1,
                description: 'Skip live trading after this many cycles'
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
            },
            usePrebuy: {
                type: 'boolean',
                default: false,
                description: 'Use pre-buy technique.'
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

    emitPrebuyDataUpdate() {
        if (this.universalDict.usePrebuy && Object.keys(this.prebuyFullData).length > 0) {
            // Structure the data for frontend consumption with cycle information
            const structuredPrebuyData = {
                cycle: this.universalDict.cycles || 0,
                data: { ...this.prebuyFullData }, // Deep copy to avoid reference issues
                timestamp: new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
                completed: !!this.prebuyFullData.summary, // Mark as completed if summary exists
                // Additional metadata for frontend
                metadata: {
                    strategyName: this.name,
                    usePrebuy: this.universalDict.usePrebuy,
                    enableTrading: this.globalDict.enableTrading,
                    currentBlock: this.getCurrentBlockName(),
                    hasActivePosition: this.hasActivePosition
                }
            };
            
            this.emitToUser('strategy_prebuy_data', structuredPrebuyData);
            
            // Log the emission for debugging
            this.strategyUtils.logStrategyInfo(`Prebuy data emitted for cycle ${structuredPrebuyData.cycle}: ${Object.keys(this.prebuyFullData).join(', ')}`);
        }
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
}

module.exports = MTMV3Strategy;
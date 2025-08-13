const BaseStrategy = require('./base');
const TradingUtils = require('../utils/tradingUtils');
const StrategyUtils = require('../utils/strategyUtils');

class MTMV2Strategy extends BaseStrategy {
    constructor() {
        super();
        this.name = 'MTM V2 Strategy';
        this.description = 'Mark to Market strategy with interim low detection and dual option trading';
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
        this.mtmFirstToSell = null;
        this.mtmNextToSell = null;
        this.changeAt24 = 0;
        this.changeAt36After24 = 0;
        this.mtmAssistedTarget = 0;
        this.mtmOriginalBuyPrice = null;
        this.mtmSoldAt24Gain = 0;
        this.mtmSoldAt36Loss = 0;
        this.mtmPriceAt24Sell = null; // Store price of remaining instrument at +24 sell time
        this.mtmPriceAt36Sell = null; // Store price of remaining instrument at -36 sell time
        this.mtmSoldAt24Symbol = null; // Store symbol of instrument sold at +24 for buy back
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
    }

    setUserInfo(userName, userId) {
        this.strategyUtils.setUserInfo(userName, userId);
        this.strategyUtils.logStrategyInfo(`MTM V2 Strategy initialized for user: ${userName} (ID: ${userId})`);
    }

    initialize(globalDict, universalDict, blockDict, accessToken) {
        // Call parent initialize method
        super.initialize(globalDict, universalDict, blockDict, accessToken);
        
        console.log('=== MTM V2 Strategy Initialization ===');
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
        this.mtmNextToSell = null;
        this.mtmAssistedTarget = 0;
        this.mtmOriginalBuyPrice = null;
        this.mtmSoldAt24Gain = 0;
        this.mtmSoldAt36Loss = 0;
        this.mtmPriceAt24Sell = null; // Store price of remaining instrument at +24 sell time
        this.mtmPriceAt36Sell = null; // Store price of remaining instrument at -36 sell time
        this.mtmSoldAt24Symbol = null; // Store symbol of instrument sold at +24 for buy back
        this.mtmBuyBackPrice = null; // Store buy back price
        this.mtmBuyBackTarget = null; // Store target for buy back scenario
        this.mtmTotalPreviousPnL = 0; // Store total P&L from previous trades

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
        
        if (this.blockFinalRef) {
            this.processFinalRefBlock(ticks);
        }
        
        if (this.blockRef3) {
            this.processRef3Block(ticks);
        }
        
        if (this.blockDiff10) {
            this.processDiff10Block(ticks);
        }
        
        if (this.blockNextCycle) {
            this.processNextCycleBlock(ticks);
        }
        
        console.log(`=== Tick Batch #${this.tickCount} Complete ===`);
    }

    processInitBlock(ticks) {
        this.strategyUtils.logStrategyInfo('Processing INIT block');
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
            this.universalDict.strikeBase = 85;
            this.universalDict.strikeDiff = 50;
            this.universalDict.strikeLowest = 75;
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
        const targetPrice = today === expiryDay ? 100 : 200;
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
    }

    processUpdateBlock(ticks) {
        console.log('Processing UPDATE block');
        
        const currentTime = new Date().toISOString();
        this.globalDict.timestamp = currentTime;

        // Initialize or update instrument data for all observed tokens
        for (const tick of ticks) {
            const token = tick.instrument_token;
            
            if (!this.universalDict.observedTicks.includes(token)) {
                continue;
            }

            // Initialize instrument data if not exists
            if (!this.universalDict.instrumentMap[token]) {
                this.universalDict.instrumentMap[token] = {
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
                    peak2Time: null,
                    buyPrice: -1,
                    peak2: -1,
                    changeFromBuy: -1,
                    calcRef: -1,
                    prevCalcRef: -1,
                    flagPlus3: false,
                    flagPeakAndFall: false,
                    flagCalcRef: false,
                    flagInterim: false,
                    higherStrikeToken: null,
                    higherStrikeTokenOpen: -1,
                    refPrice: -1,
                    lowAfterSl: -1,
                    buyAtSl: -1,
                    highAfterBuy: -1,
                    lowAfterBuy: -1
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
            if (instrument.peak2 > -1 && newPrice > instrument.peak2) {
                instrument.peak2 = newPrice;
            }
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
            // this.strategyUtils.logStrategyInfo('Transitioning from UPDATE to FINAL REF block');
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
            
            // Find closest symbols below 200 for both CE and PE
            const closestCE = this.strategyUtils.findClosestCEBelowPrice(
                this.universalDict.instrumentMap, 
                200, 
                200
            );
            
            const closestPE = this.strategyUtils.findClosestPEBelowPrice(
                this.universalDict.instrumentMap, 
                200, 
                200
            );
            
            if (!closestCE || !closestPE) {
                this.strategyUtils.logStrategyError('Could not find suitable CE or PE symbols below 200');
                return;
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

    processDiff10Block(ticks) {
        console.log('Processing DIFF10 block');
        
        // Check for sell conditions
        if (this.shouldSellOptions()) {
            this.strategyUtils.logStrategyInfo('Selling options due to target/stoploss');
            this.sellOptions();
        }
        
        if (this.shouldSellAt24() && !this.mtmBothSold && !this.mtmSoldAt24) {
            this.strategyUtils.logStrategyInfo('Selling at 24 points');
            this.sellAt24();
        } 
        
        if (this.shouldSellRemainingAtTarget() && !this.mtmBothSold && this.mtmSoldAt24 && !this.mtmNextSellAfter24) {
            this.strategyUtils.logStrategyInfo('Selling remaining instrument at target after 24 point. Buying if stoploss is reached');
            this.sellRemainingAtTarget();
        } 
        
        if (this.shouldSellBuyBack() && !this.mtmBothSold && this.buyBackAfter24 && !this.sellBuyBackAfter24 && !this.boughtSold) {
            this.strategyUtils.logStrategyInfo('Selling buy-back instrument after 24 point.');
            this.sellBuyBack();
        }

        if (this.shouldSellAt36() && !this.mtmBothSold && !this.mtmSoldAt24 && !this.mtmSoldAt36) {
            this.strategyUtils.logStrategyInfo('Selling at -36 points.');
            this.sellAt36();
        } 

        if (this.shouldSellRemainingAtTargetAfter36() && !this.mtmBothSold && this.mtmSoldAt36 && !this.mtmSoldAt24 && !this.boughtSold) {
            this.strategyUtils.logStrategyInfo('Selling remaining instrument at target after 36 point. Buying if stoploss is reached');
            this.sellRemainingAtTargetAfter36();
        }
        
        
        // Check if cycle is complete
        if (this.boughtSold) {
            this.blockDiff10 = false;
            this.blockNextCycle = true;
            this.strategyUtils.logStrategyInfo('Transitioning from DIFF10 to NEXT CYCLE block');
        }
    }

    processNextCycleBlock(ticks) {
        // this.strategyUtils.logStrategyInfo('Processing NEXT CYCLE block');
        
        // Reset for next cycle
        this.resetForNextCycle();
        
        this.blockNextCycle = false;
        this.blockInit = true;
        this.strategyUtils.logStrategyInfo('Transitioning from NEXT CYCLE to INIT block');
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
            } else {
                // Paper trading - log the orders without placing them
                this.strategyUtils.logStrategyInfo(`PAPER TRADING: Buy order for ${boughtInstrument.symbol} @ ${boughtInstrument.last}`);
                this.strategyUtils.logOrderPlaced('buy', boughtInstrument.symbol, boughtInstrument.last, this.globalDict.quantity || 75, this.boughtToken);
                
                this.strategyUtils.logStrategyInfo(`PAPER TRADING: Buy order for ${oppInstrument.symbol} @ ${oppInstrument.last}`);
                this.strategyUtils.logOrderPlaced('buy', oppInstrument.symbol, oppInstrument.last, this.globalDict.quantity || 75, this.oppBoughtToken);
            }

            // Update instrument buy prices
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
            
            console.log(`Main change: ${mainChange.toFixed(2)}, Opp change: ${oppChange.toFixed(2)}, Total: ${totalChange.toFixed(2)}, Target: ${target}`);
            
            return totalChange >= target;
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
            if (total_change <= Number(this.globalDict.lowerLimit || -5)){
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
        if (this.boughtToken && this.oppBoughtToken) {
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
        if (this.mtmNextToSell && this.mtmAssistedTarget !== undefined) {
            const remainingInstrument = this.universalDict.instrumentMap[this.mtmNextToSell.token];
            const currentPrice = Number(remainingInstrument.last || 0);
            const buyPrice = Number(remainingInstrument.buyPrice || 0);
            const changeFromBuy = currentPrice - buyPrice;
            const change_from_24_point = currentPrice - this.mtmPriceAt24Sell;
            const assistedTarget = Number(this.mtmAssistedTarget || 0);
            const stoploss = Number(this.globalDict.buyBackTrigger || -36);
            
            this.strategyUtils.logStrategyInfo(`Remaining instrument: ${remainingInstrument.symbol} @ ${currentPrice}, Buy price: ${buyPrice}, Change from buy: ${changeFromBuy.toFixed(2)}, Assisted Target: ${assistedTarget.toFixed(2)}`);
            
            return changeFromBuy <= stoploss || change_from_24_point >= assistedTarget; // Check if change from buy price reaches the assisted target
        }
        
        return false;
    }

    sellRemainingAtTarget() {
        this.strategyUtils.logStrategyInfo('Selling remaining instrument at target');
        this.mtmNextSellAfter24 = true;
        const remainingInstrument = this.universalDict.instrumentMap[this.mtmNextToSell.token];
        const currentPrice = Number(remainingInstrument.last || 0);
        this.changeAt36After24 = currentPrice - this.mtmPriceAt24Sell;
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

        // Use the injected TradingUtils instance
        const tradingUtils = this.tradingUtils;

        try {
            if (tradingEnabled) {
                // Place sell order for the remaining token - synchronous
                const sellResult = tradingUtils.placeSellOrder(
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
                        
                        // Update buy price for the buy back instrument
                        this.mtmNextToSell.buyPrice = this.mtmNextToSell.last;
                        this.strategyUtils.logStrategyInfo(`Buy back completed at ${this.mtmNextToSell.last} with target: ${this.mtmAssistedTarget}`);
                    } else {
                        this.strategyUtils.logStrategyError(`Failed to place buy back order for ${this.mtmNextToSell.symbol}: ${buyBackResult.error}`);
                        this.strategyUtils.logOrderFailed('buy', this.mtmNextToSell.symbol, this.mtmNextToSell.last, this.globalDict.quantity || 75, this.mtmNextToSell.token, buyBackResult.error);
                    }
                } else {
                    // Paper trading - log the buy back order without placing it
                    this.strategyUtils.logStrategyInfo(`PAPER TRADING: Buy back order for ${this.mtmNextToSell.symbol} @ ${this.mtmNextToSell.last}`);
                    this.strategyUtils.logOrderPlaced('buy', this.mtmNextToSell.symbol, this.mtmNextToSell.last, this.globalDict.quantity || 75, this.mtmNextToSell.token);
                    
                    // Update buy price for the buy back instrument
                    this.mtmNextToSell.buyPrice = this.mtmNextToSell.last;
                    this.strategyUtils.logStrategyInfo(`Buy back completed at ${this.mtmNextToSell.last} with target: ${this.mtmAssistedTarget}`);
                }
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
        if (this.mtmBuyBackPrice && this.mtmBuyBackTarget) {
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
        
        if (!this.boughtToken || !this.oppBoughtToken) {
            this.strategyUtils.logStrategyError('Cannot sell options - boughtToken or oppBoughtToken not set');
            return;
        }

        const mainInstrument = this.universalDict.instrumentMap[this.boughtToken];
        const oppInstrument = this.universalDict.instrumentMap[this.oppBoughtToken];

        if (!mainInstrument || !oppInstrument) {
            this.strategyUtils.logStrategyError('Cannot sell options - instrument data not found');
            return;
        }

        this.strategyUtils.logStrategyInfo(`Selling ${mainInstrument.symbol} @ ${mainInstrument.last}`);
        this.strategyUtils.logStrategyInfo(`Selling ${oppInstrument.symbol} @ ${oppInstrument.last}`);

        // Check if trading is enabled
        const tradingEnabled = this.globalDict.enableTrading === true;
        this.strategyUtils.logStrategyInfo(`Trading enabled: ${tradingEnabled}`);

        // Use the injected TradingUtils instance
        const tradingUtils = this.tradingUtils;

        try {
            if (tradingEnabled) {
                // Place sell order for main token - synchronous
                const mainSellResult = tradingUtils.placeSellOrder(
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

                // Place sell order for opposite token - synchronous
                const oppSellResult = tradingUtils.placeSellOrder(
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

        } catch (error) {
            this.strategyUtils.logStrategyError(`Exception while selling options: ${error.message}`);
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

        // Use the injected TradingUtils instance
        const tradingUtils = this.tradingUtils;

        try {
            if (tradingEnabled) {
                // Place sell order for the token to sell - synchronous
                const sellResult = tradingUtils.placeSellOrder(
                    instrumentToSell.symbol,
                    instrumentToSell.last,
                    this.globalDict.quantity || 75
                );

                if (sellResult.success) {
                    this.strategyUtils.logStrategyInfo(`Sell order placed for ${instrumentToSell.symbol}`);
                    this.strategyUtils.logOrderPlaced('sell', instrumentToSell.symbol, instrumentToSell.last, this.globalDict.quantity || 75, tokenToSell);
                } else {
                    this.strategyUtils.logStrategyError(`Failed to place sell order for ${instrumentToSell.symbol}: ${sellResult.error}`);
                    this.strategyUtils.logOrderFailed('sell', instrumentToSell.symbol, instrumentToSell.last, this.globalDict.quantity || 75, tokenToSell, sellResult.error);
                }
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

        } catch (error) {
            this.strategyUtils.logStrategyError(`Exception while selling at 24: ${error.message}`);
        }
    }

    sellAt36() {
        this.strategyUtils.logStrategyInfo('Selling remaining instrument and buying back first instrument');
        this.mtmSoldAt36 = true;
        
        if (!this.boughtToken || !this.oppBoughtToken) {
            this.strategyUtils.logStrategyError('Cannot sell at 36 - boughtToken or oppBoughtToken not set');
            return;
        }

        const mainInstrument = this.universalDict.instrumentMap[this.boughtToken];
        const oppInstrument = this.universalDict.instrumentMap[this.oppBoughtToken];

        if (!mainInstrument || !oppInstrument) {
            this.strategyUtils.logStrategyError('Cannot sell at 36 - instrument data not found');
            return false;
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

        // Use the injected TradingUtils instance
        const tradingUtils = this.tradingUtils;

        try {
            if (tradingEnabled) {
                // Place sell order for the remaining token - synchronous
                const sellResult = tradingUtils.placeSellOrder(
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
            } else {
                // Paper trading - log the order without placing it
                this.strategyUtils.logStrategyInfo(`PAPER TRADING: Sell order for ${this.mtmNextToSell.symbol} @ ${this.mtmNextToSell.last}`);
                this.strategyUtils.logOrderPlaced('sell', this.mtmNextToSell.symbol, this.mtmNextToSell.last, this.globalDict.quantity || 75, this.mtmNextToSell.token);
            }

            this.mtmAssistedTarget = this.globalDict.target - change;
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

        // Use the injected TradingUtils instance
        const tradingUtils = this.tradingUtils;

        try {
            if (tradingEnabled) {
                // Place sell order for the buy-back token - synchronous
                const sellResult = tradingUtils.placeSellOrder(
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
            } else {
                // Paper trading - log the order without placing it
                this.strategyUtils.logStrategyInfo(`PAPER TRADING: Sell order for ${buyBackInstrument.symbol} @ ${buyBackInstrument.last}`);
                this.strategyUtils.logOrderPlaced('sell', buyBackInstrument.symbol, buyBackInstrument.last, this.globalDict.quantity || 75, this.boughtToken);
            }
            
            // Calculate and log P&L for the buy-back token
            const buyBackPnL = (buyBackInstrument.last - buyBackInstrument.buyPrice) * (this.globalDict.quantity || 75);
            this.strategyUtils.logStrategyInfo(`Buy-back token P&L: ${buyBackPnL.toFixed(2)}`);
            
            // Set boughtSold flag to complete the cycle
            this.boughtSold = true;
            
            this.strategyUtils.logTradeAction('sell_buyback', {
                buyBackSymbol: buyBackInstrument.symbol,
                buyBackPrice: buyBackInstrument.last,
                buyBackPnL: buyBackPnL,
                newTarget: this.mtmBuyBackTarget,
                debugMode: this.debugMode
            }, this.name);

        } catch (error) {
            this.strategyUtils.logStrategyError(`Exception while selling buy-back: ${error.message}`);
        }
    }

    shouldSellRemainingAtTargetAfter36() {
        if (this.mtmFirstToSell && this.mtmAssistedTarget !== undefined) {
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

        // Use the injected TradingUtils instance
        const tradingUtils = this.tradingUtils;

        try {
            if (tradingEnabled) {
                // Place sell order for the remaining token
                const sellResult = tradingUtils.placeSellOrder(
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
        this.mtmFirstToSell = null;
        this.mtmNextToSell = null;
        this.mtmAssistedTarget = 0;
        this.mtmOriginalBuyPrice = null;
        this.mtmSoldAt24Gain = 0;
        this.mtmSoldAt36Loss = 0;
        this.mtmPriceAt24Sell = null; // Store price of remaining instrument at +24 sell time
        this.mtmPriceAt36Sell = null; // Store price of remaining instrument at -36 sell time
        this.mtmSoldAt24Symbol = null; // Store symbol of instrument sold at +24 for buy back
        this.mtmBuyBackPrice = null; // Store buy back price
        this.mtmBuyBackTarget = null; // Store target for buy back scenario
        this.mtmTotalPreviousPnL = 0; // Store total P&L from previous trades
        this.mtmBothSold = false;
        this.mtmNextSellAfter24 = false;
        this.buyBackAfter24 = false;
        this.sellBuyBackAfter24 = false;
        this.mtmSoldFirstAt36 = false;
        this.mtmSoldAfterFirst36 = false;
        
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
        
        this.strategyUtils.logStrategyInfo(`Cycle ${this.universalDict.cycles} started`);
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
                default: 10,
                description: 'Target profit in points'
            },
            stoploss: {
                type: 'number',
                default: 10,
                description: 'Stop loss in points'
            },
            enableTrading: {
                type: 'boolean',
                default: false,
                description: 'Enable/disable actual trading'
            },
            peakDef: {
                type: 'number',
                default: 3,
                description: 'Peak definition in points'
            },
            upperLimit: {
                type: 'number',
                default: 3,
                description: 'Upper limit for interim low'
            },
            lowerLimit: {
                type: 'number',
                default: -10,
                description: 'Lower limit for MTM'
            },
            preBuyUpperLimit: {
                type: 'number',
                default: 24,
                description: 'Pre-buy upper limit'
            },
            preBuyLowerLimit: {
                type: 'number',
                default: -36,
                description: 'Pre-buy lower limit'
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
            buyBackTrigger: {
                type: 'number',
                default: -12,
                description: 'Trigger for buying back the first instrument'
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
}

module.exports = MTMV2Strategy;
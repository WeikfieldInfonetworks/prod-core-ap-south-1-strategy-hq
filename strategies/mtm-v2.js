const BaseStrategy = require('./base');
const TradingUtils = require('../utils/tradingUtils');
const StrategyUtils = require('../utils/strategyUtils');

class MTMV2Strategy extends BaseStrategy {
    constructor() {
        super();
        this.name = 'MTM V2 Strategy';
        this.description = 'Mark to Market strategy with interim low detection and dual option trading';
        this.tradingUtils = new TradingUtils();
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
        this.mtmNextToSell = null;
        this.mtmAssistedTarget = 0;
        this.mtmOriginalBuyPrice = null;
        this.mtmSoldAt24Gain = 0;
        this.mtmSoldAt36Loss = 0;
        
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
    }

    setUserInfo(userName, userId) {
        this.strategyUtils.setUserInfo(userName, userId);
        this.strategyUtils.logStrategyInfo(`MTM V2 Strategy initialized for user: ${userName} (ID: ${userId})`);
    }

    initialize(globalDict, universalDict, blockDict, accessToken) {
        super.initialize(globalDict, universalDict, blockDict, accessToken);
        
        this.strategyUtils.logStrategyInfo('=== MTM V2 Strategy Initialization ===');
        this.strategyUtils.logStrategyInfo(`Strategy Name: ${this.name}`);
        this.strategyUtils.logStrategyInfo(`Strategy Description: ${this.description}`);
        this.strategyUtils.logStrategyInfo(`Access Token Available: ${!!this.accessToken}`);
        this.strategyUtils.logStrategyInfo(`API Key Available: ${!!this.globalDict.api_key}`);
        
        // Initialize TradingUtils with credentials from session
        if (this.accessToken && this.globalDict.api_key) {
            // console.log('🔧 Initializing TradingUtils with credentials...');
            const initialized = this.tradingUtils.initializeKiteConnect(this.globalDict.api_key, this.accessToken);
            
            if (initialized) {
                this.strategyUtils.logStrategyInfo('✅ TradingUtils initialized with session credentials');
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
        this.universalDict.instrumentMap = {};
        this.universalDict.ceTokens = [];
        this.universalDict.peTokens = [];
        this.universalDict.observedTicks = [];
        this.universalDict.strikePriceMap = {};

        // Initialize dictionary parameters with default values
        const globalParams = this.getGlobalDictParameters();
        const universalParams = this.getUniversalDictParameters();

        // console.log('=== Strategy Parameters ===');
        // console.log('Global Parameters:', Object.keys(globalParams));
        // console.log('Universal Parameters:', Object.keys(universalParams));

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
        this.mtmSoldAt24 = false;
        this.mtmSoldAt36 = false;
        this.boughtSold = false;
        this.mtmNextToSell = null;
        this.mtmAssistedTarget = 0;
        this.mtmOriginalBuyPrice = null;
        this.mtmSoldAt24Gain = 0;
        this.mtmSoldAt36Loss = 0;

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
        this.strategyUtils.logStrategyDebug(`Block Init: ${this.blockInit}`);
        this.strategyUtils.logStrategyDebug(`Block Update: ${this.blockUpdate}`);
        this.strategyUtils.logStrategyDebug(`Block Final Ref: ${this.blockFinalRef}`);
        this.strategyUtils.logStrategyInfo('=== Initialization Complete ===');
    }

    async processTicks(ticks) {
        this.tickCount++;
        this.strategyUtils.logStrategyInfo(`=== Processing Tick Batch #${this.tickCount} ===`);
        this.strategyUtils.logStrategyInfo(`Number of ticks received: ${ticks.length}`);
        this.strategyUtils.logStrategyInfo(`Current Cycle: ${this.cycleCount}`);
        
        // // Check if we need to reset cycle after sell completion
        // if (this.sellCompleted && this.lastSellTime) {
        //     const timeSinceLastSell = Date.now() - this.lastSellTime;
        //     const requiredDelay = 15 * 1000; // 15 seconds in milliseconds
            
        //     if (timeSinceLastSell >= requiredDelay) {
        //         console.log('⏰ 15-second delay completed, resetting cycle for new instrument selection');
        //         this.resetCycleForNewInstrument();
        //     } else {
        //         const remainingTime = Math.ceil((requiredDelay - timeSinceLastSell) / 1000);
        //         console.log(`⏰ Waiting ${remainingTime} more seconds before next cycle (15s delay required)`);
        //         return; // Skip processing until delay is complete
        //     }
        // }

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
            await this.processDiff10Block(ticks);
        }
        
        if (this.blockNextCycle) {
            this.processNextCycleBlock(ticks);
        }
        
        this.strategyUtils.logStrategyInfo(`=== Tick Batch #${this.tickCount} Complete ===`);
    }

    processInitBlock(ticks) {
        this.strategyUtils.logStrategyInfo('🔄 Processing INIT block');
        this.strategyUtils.logStrategyInfo(`📊 Received ticks: ${ticks.length}`);
        this.strategyUtils.logStrategyDebug(`📊 Sample tick data: ${JSON.stringify(ticks.slice(0, 3).map(t => ({
            token: t.instrument_token,
            symbol: t.symbol,
            price: t.last_price
        })))}`);
        
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

        this.strategyUtils.logStrategyInfo(`📊 Range: ${this.universalDict.strikeBase} - ${this.universalDict.strikeBase + this.universalDict.strikeDiff}`);

        // Sort ticks by least deviation from target price (200 on normal days, 100 on expiry day)
        const targetPrice = today === expiryDay ? 100 : 200;
        const sortedTicks = ticks.sort((a, b) => {
            const deviationA = Math.abs(a.last_price - targetPrice);
            const deviationB = Math.abs(b.last_price - targetPrice);
            return deviationA - deviationB;
        });
        
        // Find accepted tokens within range
        const acceptedTokens = [];
        const rejectedTokens = [];
        
        for (const tick of sortedTicks) {
            const price = tick.last_price;
            const base = this.universalDict.strikeBase;
            const diff = this.universalDict.strikeDiff;
            
            if (base <= price && price <= base + diff) {
                acceptedTokens.push(tick.instrument_token);
            } else {
                rejectedTokens.push(tick.instrument_token);
            }
        }

        this.strategyUtils.logStrategyInfo(`✅ Accepted tokens: ${acceptedTokens.length}`);
        this.strategyUtils.logStrategyInfo(`❌ Rejected tokens: ${rejectedTokens.length}`);
        this.strategyUtils.logStrategyDebug(`📊 Accepted token prices: ${acceptedTokens.slice(0, 5).map(token => {
            const tick = ticks.find(t => t.instrument_token === token);
            return tick ? tick.last_price : 'unknown';
        })}`);

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

        this.strategyUtils.logStrategyInfo(`📈 CE Tokens: ${this.universalDict.ceTokens.length}`);
        this.strategyUtils.logStrategyInfo(`📉 PE Tokens: ${this.universalDict.peTokens.length}`);

        // Set observed ticks
        this.universalDict.observedTicks = acceptedTokens.sort((a, b) => {
            const aTick = ticks.find(t => t.instrument_token === a);
            const bTick = ticks.find(t => t.instrument_token === b);
            return aTick.last_price - bTick.last_price;
        });

        this.strategyUtils.logStrategyInfo(`📊 Observed ticks set: ${this.universalDict.observedTicks.length}`);

        // Transition to next block
        this.blockInit = false;
        this.blockUpdate = true;
        
        this.strategyUtils.logStrategyInfo('🔄 Transitioning from INIT to UPDATE block');
    }

    processUpdateBlock(ticks) {
        this.strategyUtils.logStrategyInfo('🔄 Processing UPDATE block');
        
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
                    this.strategyUtils.logStrategyInfo(`📈 PEAK: ${instrument.peak} SYMBOL: ${instrument.symbol}`);
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
            this.strategyUtils.logStrategyInfo('🔄 Transitioning from UPDATE to FINAL REF block');
        }
        // Note: UPDATE block continues monitoring until transition conditions are met
        // This is by design - the block monitors for interimLowReached or calcRefReached
        // If these conditions are never met, the strategy may need to be reviewed
    }

    processFinalRefBlock(ticks) {
        this.strategyUtils.logStrategyInfo('🔄 Processing FINAL REF block');
        
        if (this.interimLowReached && !this.refCapture) {
            this.refCapture = true;
            this.strategyUtils.logStrategyInfo('🎯 Interim low reached, capturing reference');
            
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
                this.strategyUtils.logStrategyError('❌ Could not find suitable CE or PE symbols below 200');
                return;
            }
            
            // Assign boughtToken and oppBoughtToken based on mtmFirstOption
            if (this.mtmFirstOption) {
                const firstOptionType = this.mtmFirstOption.symbol.includes('CE') ? 'CE' : 'PE';
                
                if (firstOptionType === 'CE') {
                    this.boughtToken = closestCE.token;
                    this.oppBoughtToken = closestPE.token;
                    this.strategyUtils.logStrategyInfo(`🎯 MTM First Option is CE - Bought Token: ${closestCE.symbol} @ ${closestCE.price}`);
                    this.strategyUtils.logStrategyInfo(`🎯 Opposite Token: ${closestPE.symbol} @ ${closestPE.price}`);
                } else {
                    this.boughtToken = closestPE.token;
                    this.oppBoughtToken = closestCE.token;
                    this.strategyUtils.logStrategyInfo(`🎯 MTM First Option is PE - Bought Token: ${closestPE.symbol} @ ${closestPE.price}`);
                    this.strategyUtils.logStrategyInfo(`🎯 Opposite Token: ${closestCE.symbol} @ ${closestCE.price}`);
                }
            } else {
                // Fallback: use CE as bought token, PE as opposite
                this.boughtToken = closestCE.token;
                this.oppBoughtToken = closestPE.token;
                this.strategyUtils.logStrategyInfo(`🎯 Fallback - Bought Token: ${closestCE.symbol} @ ${closestCE.price}`);
                this.strategyUtils.logStrategyInfo(`🎯 Opposite Token: ${closestPE.symbol} @ ${closestPE.price}`);
            }
            
            // Place orders for both tokens
            this.placeOrdersForTokens();
            
            // Transition to diff10 block
            this.blockFinalRef = false;
            this.blockDiff10 = true;
            this.strategyUtils.logStrategyInfo('🔄 Transitioning from FINAL REF to DIFF10 block');
        } else if (this.calcRefReached) {
            this.strategyUtils.logStrategyInfo('🎯 Calc ref reached');
            this.blockFinalRef = false;
            this.blockRef3 = true;
            this.strategyUtils.logStrategyInfo('🔄 Transitioning from FINAL REF to REF3 block');
        }
    }

    processRef3Block(ticks) {
        this.strategyUtils.logStrategyInfo('🔄 Processing REF3 block');
        
        // Check if either token has reached calc ref
        if (this.shouldCaptureRef()) {
            this.refCapture = true;
            this.strategyUtils.logStrategyInfo('🎯 Reference captured');
            
            // Transition to diff10 block
            this.blockRef3 = false;
            this.blockDiff10 = true;
            this.strategyUtils.logStrategyInfo('🔄 Transitioning from REF3 to DIFF10 block');
        }
    }

    async processDiff10Block(ticks) {
        this.strategyUtils.logStrategyInfo('🔄 Processing DIFF10 block');
        
        // Check for sell conditions
        if (this.shouldSellOptions()) {
            this.strategyUtils.logStrategyInfo('💰 Selling options due to target/stoploss');
            await this.sellOptions();
        } else if (this.shouldSellAt24()) {
            this.strategyUtils.logStrategyInfo('💰 Selling at 24 points');
            await this.sellAt24();
        } else if (this.shouldSellAt36()) {
            this.strategyUtils.logStrategyInfo('💰 Selling at 36 points');
            await this.sellAt36();
        }
        
        // Check if cycle is complete
        if (this.boughtSold) {
            this.blockDiff10 = false;
            this.blockNextCycle = true;
            this.strategyUtils.logStrategyInfo('🔄 Transitioning from DIFF10 to NEXT CYCLE block');
        }
    }

    processNextCycleBlock(ticks) {
        this.strategyUtils.logStrategyInfo('🔄 Processing NEXT CYCLE block');
        
        // Reset for next cycle
        this.resetForNextCycle();
        
        this.blockNextCycle = false;
        this.blockInit = true;
        this.strategyUtils.logStrategyInfo('🔄 Transitioning from NEXT CYCLE to INIT block');
    }





    shouldTransitionToFinalRef() {
        return this.interimLowReached || this.calcRefReached;
    }

    async placeOrdersForTokens() {
        if (!this.boughtToken || !this.oppBoughtToken) {
            this.strategyUtils.logStrategyError('❌ Cannot place orders - boughtToken or oppBoughtToken not set');
            return;
        }

        const boughtInstrument = this.universalDict.instrumentMap[this.boughtToken];
        const oppInstrument = this.universalDict.instrumentMap[this.oppBoughtToken];

        if (!boughtInstrument || !oppInstrument) {
            this.strategyUtils.logStrategyError('❌ Cannot place orders - instrument data not found');
            return;
        }

        this.strategyUtils.logStrategyInfo('💰 Placing orders for MTM strategy tokens');
        this.strategyUtils.logStrategyInfo(`📈 Bought Token: ${boughtInstrument.symbol} @ ${boughtInstrument.last}`);
        this.strategyUtils.logStrategyInfo(`📉 Opposite Token: ${oppInstrument.symbol} @ ${oppInstrument.last}`);

        try {
            // Place order for bought token (mtmFirstOption)
            const boughtOrderResult = await this.tradingUtils.placeBuyOrder(
                boughtInstrument.symbol,
                boughtInstrument.last,
                this.globalDict.quantity || 75
            );

            if (boughtOrderResult.success) {
                this.strategyUtils.logStrategyInfo(`✅ Buy order placed for ${boughtInstrument.symbol}`);
                this.strategyUtils.logOrderPlaced('buy', boughtInstrument.symbol, boughtInstrument.last, this.globalDict.quantity || 75, this.boughtToken);
            } else {
                this.strategyUtils.logStrategyError(`❌ Failed to place buy order for ${boughtInstrument.symbol}: ${boughtOrderResult.error}`);
                this.strategyUtils.logOrderFailed('buy', boughtInstrument.symbol, boughtInstrument.last, this.globalDict.quantity || 75, this.boughtToken, boughtOrderResult.error);
            }

            // Place order for opposite token
            const oppOrderResult = await this.tradingUtils.placeBuyOrder(
                oppInstrument.symbol,
                oppInstrument.last,
                this.globalDict.quantity || 75
            );

            if (oppOrderResult.success) {
                this.strategyUtils.logStrategyInfo(`✅ Buy order placed for ${oppInstrument.symbol}`);
                this.strategyUtils.logOrderPlaced('buy', oppInstrument.symbol, oppInstrument.last, this.globalDict.quantity || 75, this.oppBoughtToken);
            } else {
                this.strategyUtils.logStrategyError(`❌ Failed to place buy order for ${oppInstrument.symbol}: ${oppOrderResult.error}`);
                this.strategyUtils.logOrderFailed('buy', oppInstrument.symbol, oppInstrument.last, this.globalDict.quantity || 75, this.oppBoughtToken, oppOrderResult.error);
            }

            // Update instrument buy prices
            boughtInstrument.buyPrice = boughtInstrument.last;
            oppInstrument.buyPrice = oppInstrument.last;

            this.strategyUtils.logStrategyInfo('📊 Orders placed successfully for MTM strategy');
            this.strategyUtils.logStrategyInfo(`💰 Total investment: ${(boughtInstrument.last + oppInstrument.last) * (this.globalDict.quantity || 75)}`);

        } catch (error) {
            this.strategyUtils.logStrategyError(`❌ Exception while placing orders: ${error.message}`);
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
        // Check if MTM target or stoploss reached
        if (this.boughtToken && this.oppBoughtToken) {
            const mainInstrument = this.universalDict.instrumentMap[this.boughtToken];
            const oppInstrument = this.universalDict.instrumentMap[this.oppBoughtToken];
            
            const mtm = (mainInstrument.last + oppInstrument.last) - (mainInstrument.buyPrice + oppInstrument.buyPrice);
            
            return mtm >= this.globalDict.target || mtm <= -this.globalDict.stoploss;
        }
        
        return false;
    }

    shouldSellAt24() {
        // Check if either option has reached 24 points
        if (this.boughtToken && this.oppBoughtToken) {
            const mainInstrument = this.universalDict.instrumentMap[this.boughtToken];
            const oppInstrument = this.universalDict.instrumentMap[this.oppBoughtToken];
            
            const mainChange = mainInstrument.last - mainInstrument.buyPrice;
            const oppChange = oppInstrument.last - oppInstrument.buyPrice;
            
            return mainChange >= this.globalDict.preBuyUpperLimit || oppChange >= this.globalDict.preBuyUpperLimit;
        }
        
        return false;
    }

    shouldSellAt36() {
        // Check if remaining option has reached 36 points
        if (this.mtmNextToSell) {
            const change = this.mtmNextToSell.last - this.mtmNextToSell.buyPrice;
            return change <= -this.globalDict.preBuyLowerLimit;
        }
        
        return false;
    }

    async sellOptions() {
        this.strategyUtils.logStrategyInfo('💰 Selling both options');
        this.boughtSold = true;
        
        if (!this.boughtToken || !this.oppBoughtToken) {
            this.strategyUtils.logStrategyError('❌ Cannot sell options - boughtToken or oppBoughtToken not set');
            return;
        }

        const mainInstrument = this.universalDict.instrumentMap[this.boughtToken];
        const oppInstrument = this.universalDict.instrumentMap[this.oppBoughtToken];

        if (!mainInstrument || !oppInstrument) {
            this.strategyUtils.logStrategyError('❌ Cannot sell options - instrument data not found');
            return;
        }

        this.strategyUtils.logStrategyInfo(`📈 Selling ${mainInstrument.symbol} @ ${mainInstrument.last}`);
        this.strategyUtils.logStrategyInfo(`📉 Selling ${oppInstrument.symbol} @ ${oppInstrument.last}`);

        try {
            // Place sell order for main token
            const mainSellResult = await this.tradingUtils.placeSellOrder(
                mainInstrument.symbol,
                mainInstrument.last,
                this.globalDict.quantity || 75
            );

            if (mainSellResult.success) {
                this.strategyUtils.logStrategyInfo(`✅ Sell order placed for ${mainInstrument.symbol}`);
                this.strategyUtils.logOrderPlaced('sell', mainInstrument.symbol, mainInstrument.last, this.globalDict.quantity || 75, this.boughtToken);
            } else {
                this.strategyUtils.logStrategyError(`❌ Failed to place sell order for ${mainInstrument.symbol}: ${mainSellResult.error}`);
                this.strategyUtils.logOrderFailed('sell', mainInstrument.symbol, mainInstrument.last, this.globalDict.quantity || 75, this.boughtToken, mainSellResult.error);
            }

            // Place sell order for opposite token
            const oppSellResult = await this.tradingUtils.placeSellOrder(
                oppInstrument.symbol,
                oppInstrument.last,
                this.globalDict.quantity || 75
            );

            if (oppSellResult.success) {
                this.strategyUtils.logStrategyInfo(`✅ Sell order placed for ${oppInstrument.symbol}`);
                this.strategyUtils.logOrderPlaced('sell', oppInstrument.symbol, oppInstrument.last, this.globalDict.quantity || 75, this.oppBoughtToken);
            } else {
                this.strategyUtils.logStrategyError(`❌ Failed to place sell order for ${oppInstrument.symbol}: ${oppSellResult.error}`);
                this.strategyUtils.logOrderFailed('sell', oppInstrument.symbol, oppInstrument.last, this.globalDict.quantity || 75, this.oppBoughtToken, oppSellResult.error);
            }

            // Calculate and log P&L
            const mainPnL = (mainInstrument.last - mainInstrument.buyPrice) * (this.globalDict.quantity || 75);
            const oppPnL = (oppInstrument.last - oppInstrument.buyPrice) * (this.globalDict.quantity || 75);
            const totalPnL = mainPnL + oppPnL;

            this.strategyUtils.logStrategyInfo(`💰 Total P&L: ${totalPnL.toFixed(2)} (Main: ${mainPnL.toFixed(2)}, Opp: ${oppPnL.toFixed(2)})`);
            
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
            this.strategyUtils.logStrategyError(`❌ Exception while selling options: ${error.message}`);
        }
    }

    async sellAt24() {
        this.strategyUtils.logStrategyInfo('💰 Selling at 24 points');
        this.mtmSoldAt24 = true;
        
        if (!this.boughtToken || !this.oppBoughtToken) {
            this.strategyUtils.logStrategyError('❌ Cannot sell at 24 - boughtToken or oppBoughtToken not set');
            return;
        }

        const mainInstrument = this.universalDict.instrumentMap[this.boughtToken];
        const oppInstrument = this.universalDict.instrumentMap[this.oppBoughtToken];

        if (!mainInstrument || !oppInstrument) {
            this.strategyUtils.logStrategyError('❌ Cannot sell at 24 - instrument data not found');
            return;
        }
        
        const mainChange = mainInstrument.last - mainInstrument.buyPrice;
        const oppChange = oppInstrument.last - oppInstrument.buyPrice;
        
        let tokenToSell, instrumentToSell, remainingToken, remainingInstrument;
        
        if (mainChange >= this.globalDict.preBuyUpperLimit) {
            // Sell main token, keep opposite
            tokenToSell = this.boughtToken;
            instrumentToSell = mainInstrument;
            remainingToken = this.oppBoughtToken;
            remainingInstrument = oppInstrument;
            this.mtmNextToSell = oppInstrument;
            this.mtmOriginalBuyPrice = oppInstrument.buyPrice;
            this.mtmAssistedTarget = this.globalDict.target - mainChange;
            this.strategyUtils.logStrategyInfo(`💰 Selling main option, keeping opposite with target: ${this.mtmAssistedTarget}`);
        } else {
            // Sell opposite token, keep main
            tokenToSell = this.oppBoughtToken;
            instrumentToSell = oppInstrument;
            remainingToken = this.boughtToken;
            remainingInstrument = mainInstrument;
            this.mtmNextToSell = mainInstrument;
            this.mtmOriginalBuyPrice = mainInstrument.buyPrice;
            this.mtmAssistedTarget = this.globalDict.target - oppChange;
            this.strategyUtils.logStrategyInfo(`💰 Selling opposite option, keeping main with target: ${this.mtmAssistedTarget}`);
        }

        this.strategyUtils.logStrategyInfo(`📈 Selling ${instrumentToSell.symbol} @ ${instrumentToSell.last}`);
        this.strategyUtils.logStrategyInfo(`📉 Keeping ${remainingInstrument.symbol} @ ${remainingInstrument.last}`);

        try {
            // Place sell order for the token to sell
            const sellResult = await this.tradingUtils.placeSellOrder(
                instrumentToSell.symbol,
                instrumentToSell.last,
                this.globalDict.quantity || 75
            );

            if (sellResult.success) {
                this.strategyUtils.logStrategyInfo(`✅ Sell order placed for ${instrumentToSell.symbol}`);
                this.strategyUtils.logOrderPlaced('sell', instrumentToSell.symbol, instrumentToSell.last, this.globalDict.quantity || 75, tokenToSell);
                
                // Calculate and log P&L for sold token
                const soldPnL = (instrumentToSell.last - instrumentToSell.buyPrice) * (this.globalDict.quantity || 75);
                this.strategyUtils.logStrategyInfo(`💰 Sold token P&L: ${soldPnL.toFixed(2)}`);
                
                this.strategyUtils.logTradeAction('sell_at_24', {
                    soldToken: tokenToSell,
                    remainingToken: remainingToken,
                    soldPrice: instrumentToSell.last,
                    soldPnL: soldPnL,
                    target: this.mtmAssistedTarget,
                    debugMode: this.debugMode
                }, this.name);
            } else {
                this.strategyUtils.logStrategyError(`❌ Failed to place sell order for ${instrumentToSell.symbol}: ${sellResult.error}`);
                this.strategyUtils.logOrderFailed('sell', instrumentToSell.symbol, instrumentToSell.last, this.globalDict.quantity || 75, tokenToSell, sellResult.error);
            }

        } catch (error) {
            this.strategyUtils.logStrategyError(`❌ Exception while selling at 24: ${error.message}`);
        }
    }

    async sellAt36() {
        this.strategyUtils.logStrategyInfo('💰 Selling at 36 points');
        this.mtmSoldAt36 = true;
        
        if (!this.mtmNextToSell) {
            this.strategyUtils.logStrategyError('❌ Cannot sell at 36 - mtmNextToSell not set');
            return;
        }

        this.strategyUtils.logStrategyInfo(`📈 Selling remaining option: ${this.mtmNextToSell.symbol} @ ${this.mtmNextToSell.last}`);

        try {
            // Place sell order for the remaining token
            const sellResult = await this.tradingUtils.placeSellOrder(
                this.mtmNextToSell.symbol,
                this.mtmNextToSell.last,
                this.globalDict.quantity || 75
            );

            if (sellResult.success) {
                this.strategyUtils.logStrategyInfo(`✅ Sell order placed for ${this.mtmNextToSell.symbol}`);
                this.strategyUtils.logOrderPlaced('sell', this.mtmNextToSell.symbol, this.mtmNextToSell.last, this.globalDict.quantity || 75, this.mtmNextToSell.token);
                
                // Calculate and log P&L for the remaining token
                const remainingPnL = (this.mtmNextToSell.last - this.mtmNextToSell.buyPrice) * (this.globalDict.quantity || 75);
                this.strategyUtils.logStrategyInfo(`💰 Remaining token P&L: ${remainingPnL.toFixed(2)}`);
                
                // Sell the remaining option
                this.boughtSold = true;
                
                this.strategyUtils.logTradeAction('sell_at_36', {
                    soldToken: this.mtmNextToSell.token,
                    price: this.mtmNextToSell.last,
                    pnl: remainingPnL,
                    debugMode: this.debugMode
                }, this.name);
            } else {
                this.strategyUtils.logStrategyError(`❌ Failed to place sell order for ${this.mtmNextToSell.symbol}: ${sellResult.error}`);
                this.strategyUtils.logOrderFailed('sell', this.mtmNextToSell.symbol, this.mtmNextToSell.last, this.globalDict.quantity || 75, this.mtmNextToSell.token, sellResult.error);
            }

        } catch (error) {
            this.strategyUtils.logStrategyError(`❌ Exception while selling at 36: ${error.message}`);
        }
    }

    resetForNextCycle() {
        this.strategyUtils.logStrategyInfo('🔄 Resetting for next cycle');
        
        // Increment cycle count
        this.universalDict.cycles = (this.universalDict.cycles || 0) + 1;
        
        // Reset all flags and state
        this.cePlus3 = false;
        this.pePlus3 = false;
        this.interimLowReached = false;
        this.calcRefReached = false;
        this.refCapture = false;
        this.mtmSoldAt24 = false;
        this.mtmSoldAt36 = false;
        this.boughtSold = false;
        this.mtmNextToSell = null;
        this.mtmAssistedTarget = 0;
        this.mtmOriginalBuyPrice = null;
        this.mtmSoldAt24Gain = 0;
        this.mtmSoldAt36Loss = 0;
        
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
        
        this.strategyUtils.logStrategyInfo(`🔄 Cycle ${this.universalDict.cycles} started`);
    }

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
        
        this.strategyUtils.logStrategyInfo(`🔄 Cycle ${this.cycleCount} started`);
        this.strategyUtils.logStrategyInfo('🎯 Will select new instrument for this cycle');
        this.strategyUtils.logStrategyInfo('⏰ Ready for new buy-sell cycle');
        this.strategyUtils.logStrategyInfo(`🔧 Debug Mode: ${this.debugMode ? 'ENABLED' : 'DISABLED'}`);
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
            blockInit: this.blockInit,
            blockUpdate: this.blockUpdate,
            blockFinalRef: this.blockFinalRef,
            blockRef3: this.blockRef3,
            blockDiff10: this.blockDiff10,
            blockNextCycle: this.blockNextCycle,
            // Include universalDict for frontend display
            universalDict: this.universalDict
        };
        
        this.strategyUtils.logStrategyDebug('🔧 MTM V2 getConfig() called');
        this.strategyUtils.logStrategyDebug(`📊 Config data: ${JSON.stringify({
            name: config.name,
            mainToken: config.mainToken,
            oppToken: config.oppToken,
            universalDictKeys: config.universalDict ? Object.keys(config.universalDict) : 'undefined',
            instrumentMapKeys: config.universalDict?.instrumentMap ? Object.keys(config.universalDict.instrumentMap) : 'undefined'
        })}`);
        
        return config;
    }

    getGlobalDictParameters() {
        return {
            target: {
                type: 'number',
                default: 10,
                min: 1,
                max: 50,
                description: 'Target profit in points'
            },
            stoploss: {
                type: 'number',
                default: 10,
                min: 1,
                max: 50,
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
                min: 1,
                max: 10,
                description: 'Peak definition in points'
            },
            upperLimit: {
                type: 'number',
                default: 3,
                min: 1,
                max: 10,
                description: 'Upper limit for interim low'
            },
            lowerLimit: {
                type: 'number',
                default: -10,
                min: -50,
                max: -1,
                description: 'Lower limit for MTM'
            },
            preBuyUpperLimit: {
                type: 'number',
                default: 24,
                min: 10,
                max: 50,
                description: 'Pre-buy upper limit'
            },
            preBuyLowerLimit: {
                type: 'number',
                default: -36,
                min: -50,
                max: -10,
                description: 'Pre-buy lower limit'
            },
            quantity: {
                type: 'number',
                default: 75,
                min: 25,
                max: 300,
                description: 'Quantity to trade'
            }
        };
    }

    getUniversalDictParameters() {
        return {
            expiry: {
                type: 'number',
                default: 3,
                min: 0,
                max: 6,
                description: 'Expiry day (0=Monday, 3=Thursday)'
            },
            cycles: {
                type: 'number',
                default: 0,
                min: 0,
                max: 100,
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
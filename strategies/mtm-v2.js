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
    }

    initialize(globalDict, universalDict, blockDict, accessToken) {
        super.initialize(globalDict, universalDict, blockDict, accessToken);
        
        console.log('=== MTM V2 Strategy Initialization ===');
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
        this.universalDict.instrumentMap = {};
        this.universalDict.ceTokens = [];
        this.universalDict.peTokens = [];
        this.universalDict.observedTicks = [];
        this.universalDict.strikePriceMap = {};

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
        console.log('Block Init:', this.blockInit);
        console.log('Block Update:', this.blockUpdate);
        console.log('Block Final Ref:', this.blockFinalRef);
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

        // Process ticks based on current block state
        if (this.blockInit) {
            this.processInitBlock(ticks);
        } else if (this.blockUpdate) {
            this.processUpdateBlock(ticks);
        } else if (this.blockFinalRef) {
            this.processFinalRefBlock(ticks);
        } else if (this.blockRef3) {
            this.processRef3Block(ticks);
        } else if (this.blockDiff10) {
            this.processDiff10Block(ticks);
        } else if (this.blockNextCycle) {
            this.processNextCycleBlock(ticks);
        }
        
        console.log(`=== Tick Batch #${this.tickCount} Complete ===\n`);
    }

    processInitBlock(ticks) {
        console.log('🔄 Processing INIT block');
        console.log('📊 Received ticks:', ticks.length);
        console.log('📊 Sample tick data:', ticks.slice(0, 3).map(t => ({
            token: t.instrument_token,
            symbol: t.symbol,
            price: t.last_price
        })));
        
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

        console.log(`📊 Range: ${this.universalDict.strikeBase} - ${this.universalDict.strikeBase + this.universalDict.strikeDiff}`);

        // Sort ticks by price
        const sortedTicks = ticks.sort((a, b) => a.last_price - b.last_price);
        
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

        console.log(`✅ Accepted tokens: ${acceptedTokens.length}`);
        console.log(`❌ Rejected tokens: ${rejectedTokens.length}`);
        console.log('📊 Accepted token prices:', acceptedTokens.slice(0, 5).map(token => {
            const tick = ticks.find(t => t.instrument_token === token);
            return tick ? tick.last_price : 'unknown';
        }));

        // Separate CE and PE tokens
        this.universalDict.ceTokens = acceptedTokens.filter(token => 
            this.isOptionsInstrument(this.getSymbolFromToken(token)) && 
            this.getSymbolFromToken(token).includes('CE')
        );
        
        this.universalDict.peTokens = acceptedTokens.filter(token => 
            this.isOptionsInstrument(this.getSymbolFromToken(token)) && 
            this.getSymbolFromToken(token).includes('PE')
        );

        console.log(`📈 CE Tokens: ${this.universalDict.ceTokens.length}`);
        console.log(`📉 PE Tokens: ${this.universalDict.peTokens.length}`);

        // Set observed ticks
        this.universalDict.observedTicks = acceptedTokens.sort((a, b) => {
            const aTick = ticks.find(t => t.instrument_token === a);
            const bTick = ticks.find(t => t.instrument_token === b);
            return aTick.last_price - bTick.last_price;
        });

        console.log('📊 Observed ticks set:', this.universalDict.observedTicks.length);

        // Transition to next block
        this.blockInit = false;
        this.blockUpdate = true;
        
        console.log('🔄 Transitioning from INIT to UPDATE block');
    }

    processUpdateBlock(ticks) {
        console.log('🔄 Processing UPDATE block');
        
        const currentTime = new Date().toISOString();
        this.globalDict.timestamp = currentTime;

        // Process each tick
        for (const tick of ticks) {
            const token = tick.instrument_token;
            
            if (!this.universalDict.observedTicks.includes(token)) {
                continue;
            }

            // Initialize instrument data if not exists
            if (!this.universalDict.instrumentMap[token]) {
                this.universalDict.instrumentMap[token] = {
                    time: currentTime,
                    symbol: this.getSymbolFromToken(token),
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
                    console.log(`📈 PEAK: ${instrument.peak} SYMBOL: ${instrument.symbol}`);
                }
            }

            // Check for plus3 conditions
            this.checkPlus3Conditions(token, instrument);

            // Check for peak and fall conditions
            this.checkPeakAndFallConditions(token, instrument);

            // Check for calc ref conditions
            this.checkCalcRefConditions(token, instrument);

            // Check for interim low conditions
            this.checkInterimLowConditions(token, instrument);

            // Update buy-related metrics
            if (instrument.buyPrice > -1) {
                instrument.changeFromBuy = newPrice - instrument.buyPrice;
            }

            // Update peak2 if applicable
            if (instrument.peak2 > -1 && newPrice > instrument.peak2) {
                instrument.peak2 = newPrice;
            }
        }

        // Check if we should transition to final ref
        if (this.shouldTransitionToFinalRef()) {
            this.blockUpdate = false;
            this.blockFinalRef = true;
            console.log('🔄 Transitioning from UPDATE to FINAL REF block');
        }
    }

    processFinalRefBlock(ticks) {
        console.log('🔄 Processing FINAL REF block');
        
        if (this.interimLowReached && !this.refCapture) {
            this.refCapture = true;
            console.log('🎯 Interim low reached, capturing reference');
            
            // Set main and opposite tokens
            this.mainToken = this.universalDict.ceTokens[0] || this.universalDict.peTokens[0];
            this.oppToken = this.universalDict.peTokens[0] || this.universalDict.ceTokens[0];
            
            // Set MTM first option
            this.mtmFirstOption = {
                symbol: this.universalDict.instrumentMap[this.mainToken].symbol,
                token: this.mainToken
            };
            
            console.log(`🎯 Main Token: ${this.mainToken}`);
            console.log(`🎯 Opposite Token: ${this.oppToken}`);
            
            // Transition to diff10 block
            this.blockFinalRef = false;
            this.blockDiff10 = true;
            console.log('🔄 Transitioning from FINAL REF to DIFF10 block');
        } else if (this.calcRefReached) {
            console.log('🎯 Calc ref reached');
            this.blockFinalRef = false;
            this.blockRef3 = true;
            console.log('🔄 Transitioning from FINAL REF to REF3 block');
        }
    }

    processRef3Block(ticks) {
        console.log('🔄 Processing REF3 block');
        
        // Check if either token has reached calc ref
        if (this.shouldCaptureRef()) {
            this.refCapture = true;
            console.log('🎯 Reference captured');
            
            // Transition to diff10 block
            this.blockRef3 = false;
            this.blockDiff10 = true;
            console.log('🔄 Transitioning from REF3 to DIFF10 block');
        }
    }

    processDiff10Block(ticks) {
        console.log('🔄 Processing DIFF10 block');
        
        // Check for sell conditions
        if (this.shouldSellOptions()) {
            console.log('💰 Selling options due to target/stoploss');
            this.sellOptions();
        } else if (this.shouldSellAt24()) {
            console.log('💰 Selling at 24 points');
            this.sellAt24();
        } else if (this.shouldSellAt36()) {
            console.log('💰 Selling at 36 points');
            this.sellAt36();
        }
        
        // Check if cycle is complete
        if (this.boughtSold) {
            this.blockDiff10 = false;
            this.blockNextCycle = true;
            console.log('🔄 Transitioning from DIFF10 to NEXT CYCLE block');
        }
    }

    processNextCycleBlock(ticks) {
        console.log('🔄 Processing NEXT CYCLE block');
        
        // Reset for next cycle
        this.resetForNextCycle();
        
        this.blockNextCycle = false;
        this.blockInit = true;
        console.log('🔄 Transitioning from NEXT CYCLE to INIT block');
    }

    checkPlus3Conditions(token, instrument) {
        // Check CE plus3
        if (this.universalDict.ceTokens.includes(token) && !this.cePlus3 && !this.interimLowReached && !this.calcRefReached) {
            if (instrument.plus3 >= this.globalDict.peakDef) {
                console.log(`📈 PLUS ${this.globalDict.peakDef}: ${instrument.symbol} LAST: ${instrument.last}`);
                this.cePlus3 = true;
                instrument.flagPlus3 = true;
                
                if (!this.mainToken) {
                    this.mainToken = token;
                } else {
                    this.oppToken = token;
                }
            }
        }
        
        // Check PE plus3
        if (this.universalDict.peTokens.includes(token) && !this.pePlus3 && !this.interimLowReached && !this.calcRefReached) {
            if (instrument.plus3 >= this.globalDict.peakDef) {
                console.log(`📈 PLUS ${this.globalDict.peakDef}: ${instrument.symbol} LAST: ${instrument.last}`);
                this.pePlus3 = true;
                instrument.flagPlus3 = true;
                
                if (!this.mainToken) {
                    this.mainToken = token;
                } else {
                    this.oppToken = token;
                }
            }
        }
    }

    checkPeakAndFallConditions(token, instrument) {
        if (instrument.flagPlus3 && !this.calcRefReached && !this.interimLowReached) {
            if (instrument.peak - instrument.last >= 2.5 && !instrument.flagPeakAndFall) {
                console.log(`📉 PEAK AND FALL by ${instrument.symbol}. PEAK: ${instrument.peak} LAST: ${instrument.last}`);
                instrument.peakAtRef = instrument.peak;
                instrument.peakTime = instrument.time;
                instrument.flagPeakAndFall = true;
            }
        }
    }

    checkCalcRefConditions(token, instrument) {
        if (instrument.flagPeakAndFall && !instrument.flagCalcRef) {
            // Calculate reference point
            const calcRef = this.calculateRefPoint(instrument);
            if (calcRef !== instrument.prevCalcRef) {
                instrument.prevCalcRef = instrument.calcRef;
                instrument.calcRef = calcRef;
                console.log(`🎯 CALCULATED REFERENCE FOR ${instrument.symbol} IS ${instrument.calcRef}`);
            }
            
            if (instrument.last <= instrument.calcRef) {
                instrument.flagCalcRef = true;
                this.calcRefReached = true;
                console.log(`🎯 ${instrument.symbol} REACHED CALC REF PRICE ${instrument.calcRef}`);
            }
        }
    }

    checkInterimLowConditions(token, instrument) {
        if (instrument.lowAtRef > -1 && !this.interimLowReached && !this.calcRefReached) {
            if (instrument.lowAtRef > instrument.last) {
                instrument.lowAtRef = instrument.last;
                if (!this.interimLowDisabled) {
                    console.log(`📉 NEW LOW AT REF: ${instrument.lowAtRef} FOR ${instrument.symbol}`);
                }
            }
            
            if (instrument.last - instrument.lowAtRef >= this.globalDict.upperLimit && !this.interimLowDisabled) {
                instrument.flagInterim = true;
                this.interimLowReached = true;
                this.mtmFirstOption = {
                    symbol: instrument.symbol,
                    token: token
                };
                console.log(`🎯 INTERIM LOW REACHED: ${instrument.lowAtRef} FOR ${instrument.symbol}`);
            }
        }
    }

    calculateRefPoint(instrument) {
        // Simplified reference point calculation
        // In real implementation, this would be more complex
        return instrument.peak * 0.8; // Example calculation
    }

    shouldTransitionToFinalRef() {
        return this.interimLowReached || this.calcRefReached;
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

    sellOptions() {
        console.log('💰 Selling both options');
        this.boughtSold = true;
        
        // Log the sell
        this.strategyUtils.logTradeAction('sell_both_options', {
            mainToken: this.boughtToken,
            oppToken: this.oppBoughtToken,
            mainPrice: this.universalDict.instrumentMap[this.boughtToken].last,
            oppPrice: this.universalDict.instrumentMap[this.oppBoughtToken].last,
            debugMode: this.debugMode
        }, this.name);
    }

    sellAt24() {
        console.log('💰 Selling at 24 points');
        this.mtmSoldAt24 = true;
        
        // Determine which option to sell
        const mainInstrument = this.universalDict.instrumentMap[this.boughtToken];
        const oppInstrument = this.universalDict.instrumentMap[this.oppBoughtToken];
        
        const mainChange = mainInstrument.last - mainInstrument.buyPrice;
        const oppChange = oppInstrument.last - oppInstrument.buyPrice;
        
        if (mainChange >= this.globalDict.preBuyUpperLimit) {
            this.mtmNextToSell = oppInstrument;
            this.mtmOriginalBuyPrice = oppInstrument.buyPrice;
            this.mtmAssistedTarget = this.globalDict.target - mainChange;
            console.log(`💰 Selling main option, keeping opposite with target: ${this.mtmAssistedTarget}`);
        } else {
            this.mtmNextToSell = mainInstrument;
            this.mtmOriginalBuyPrice = mainInstrument.buyPrice;
            this.mtmAssistedTarget = this.globalDict.target - oppChange;
            console.log(`💰 Selling opposite option, keeping main with target: ${this.mtmAssistedTarget}`);
        }
        
        this.strategyUtils.logTradeAction('sell_at_24', {
            soldToken: mainChange >= this.globalDict.preBuyUpperLimit ? this.boughtToken : this.oppBoughtToken,
            remainingToken: this.mtmNextToSell.token,
            target: this.mtmAssistedTarget,
            debugMode: this.debugMode
        }, this.name);
    }

    sellAt36() {
        console.log('💰 Selling at 36 points');
        this.mtmSoldAt36 = true;
        
        // Sell the remaining option
        this.boughtSold = true;
        
        this.strategyUtils.logTradeAction('sell_at_36', {
            soldToken: this.mtmNextToSell.token,
            price: this.mtmNextToSell.last,
            debugMode: this.debugMode
        }, this.name);
    }

    resetForNextCycle() {
        console.log('🔄 Resetting for next cycle');
        
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
        
        console.log(`🔄 Cycle ${this.universalDict.cycles} started`);
    }

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
        
        console.log(`🔄 Cycle ${this.cycleCount} started`);
        console.log('🎯 Will select new instrument for this cycle');
        console.log('⏰ Ready for new buy-sell cycle');
        console.log('🔧 Debug Mode:', this.debugMode ? 'ENABLED' : 'DISABLED');
    }

    getSymbolFromToken(token) {
        // This would typically come from a mapping
        // For now, return a more realistic placeholder for debugging
        const tokenStr = token.toString();
        const lastDigit = parseInt(tokenStr.slice(-1));
        const isCE = lastDigit % 2 === 0;
        const strike = 100 + (lastDigit * 5);
        return `NIFTY${strike}${isCE ? 'CE' : 'PE'}`;
    }

    isOptionsInstrument(symbol) {
        return symbol && (symbol.includes('CE') || symbol.includes('PE'));
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
        
        console.log('🔧 MTM V2 getConfig() called');
        console.log('📊 Config data:', {
            name: config.name,
            mainToken: config.mainToken,
            oppToken: config.oppToken,
            universalDictKeys: config.universalDict ? Object.keys(config.universalDict) : 'undefined',
            instrumentMapKeys: config.universalDict?.instrumentMap ? Object.keys(config.universalDict.instrumentMap) : 'undefined'
        });
        
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
            enableLogging: {
                type: 'boolean',
                default: true,
                description: 'Enable/disable detailed logging'
            },
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
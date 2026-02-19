const BaseStrategy = require('./base');
const TradingUtils = require('../utils/tradingUtils');
const StrategyUtils = require('../utils/strategyUtils');

class StrategyX extends BaseStrategy {
    constructor() {
        super();
        this.name = 'Strategy X';
        this.description = 'New X strategy with interim low detection and dual option trading';
        this.strategyUtils = new StrategyUtils();
        this.tickCount = 0;
        this.cycleCount = 1;

        // State Variables
        this.acceptedTokens = [];
        this.mainToken = null;
        this.oppToken = null;
        this.mainInstrument = null;
        this.oppInstrument = null;
        this.lockedQuantity = 0;

        // Block states
        this.blockInit = true;
        this.blockUpdate = true;
        this.blockDiff10 = false;
        this.blockNextCycle = false;

        // Flags
        this.initialDIFF10entry = false;
        this.boughtSold = false;
        this.phase1BuyDone = false;
        this.phase1SellDone = false;
        this.phase2BuyDone = false;
        this.phase2SellDone = false;
        this.phase3BuyDone = false;
        this.phase3SellDone = false;
    }

    setUserInfo(userName, userId) {
        this.strategyUtils.setUserInfo(userName, userId);
        this.strategyUtils.logStrategyInfo(`20 Pair Strategy initialized for user: ${userName} (ID: ${userId})`);
    }

    initialize(globalDict, universalDict, blockDict, accessToken) {

        super.initialize(globalDict, universalDict, blockDict, accessToken);
        
        console.log('=== 20 Pair Strategy Initialization ===');
        console.log(`Strategy Name: ${this.name}`);
        console.log(`Strategy Description: ${this.description}`);
        console.log(`Access Token Available: ${!!this.accessToken}`);
        console.log(`API Key Available: ${!!this.globalDict.api_key}`);

        // Include state variables here.
        this.acceptedTokens = [];
        this.mainToken = null;
        this.oppToken = null;
        this.mainInstrument = null;
        this.oppInstrument = null;
        this.lockedQuantity = 0;

        // Initialize strategy-specific data structures
        this.universalDict.instrumentMap = {};
        this.universalDict.ceTokens = [];
        this.universalDict.peTokens = [];
        this.universalDict.strikePriceMap = {};
        this.universalDict.observedTicks = [];

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
        this.initialDIFF10entry = false;
        this.phase1BuyDone = false;
        this.phase1SellDone = false;
        this.phase2BuyDone = false;
        this.phase2SellDone = false;
        this.phase3BuyDone = false;
        this.phase3SellDone = false;
        this.boughtSold = false;
       
        console.log('=== Initialization Complete ===');
    }

    // Override parameter update methods to add debugging
    updateGlobalDictParameter(parameter, value) {
        const success = super.updateGlobalDictParameter(parameter, value);
        
        this.strategyUtils.logStrategyInfo(`🔧 Global Parameter Updated: ${parameter} = ${value}`);
        
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
            if(this.tickCount >= 10){
                if (this.blockInit) {
                    this.processInitBlock(ticks);
                }
                
                if (this.blockUpdate) {
                    this.processUpdateBlock(ticks);
                }
                
                if (this.blockDiff10) {
                    await this.processDiff10Block(ticks);
                }
                
                if (this.blockNextCycle) {
                    this.processNextCycleBlock(ticks);
                }
            }
            
            console.log(`=== Tick Batch #${this.tickCount} Complete ===`);
        } catch (error) {
            console.error('Error in processTicks:', error);
            this.strategyUtils.logStrategyError('Error in processTicks');
        }
    }

    processInitBlock(ticks) {
        if (this.universalDict.cycles >= 2) {
            this.globalDict.enableTrading = false;
        }

        // Set strike base and diff based on weekday
        const today = new Date().getDay();
        const expiryDay = parseInt(this.universalDict.expiry || 3);
        
        if (today === expiryDay) {
            this.universalDict.strikeBase = 20;
            this.universalDict.strikeDiff = 100;
            this.universalDict.strikeLowest = 20;
        } else if (today === expiryDay - 1) {
            this.universalDict.strikeBase = 20;
            this.universalDict.strikeDiff = 100;
            this.universalDict.strikeLowest = 20;
        } else {
            this.universalDict.strikeBase = 20;
            this.universalDict.strikeDiff = 100;
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
        this.universalDict.ceTokens = ceTokens.map(token => token.toString());
        this.universalDict.peTokens = peTokens.map(token => token.toString());

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
    }

    processUpdateBlock(ticks) {
        console.log('Processing UPDATE block');
        
        const currentTime = new Date().toISOString();
        this.globalDict.timestamp = currentTime;

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
                    firstPrice: Math.floor(parseFloat(tick.last_price)),
                    last: Math.floor(parseFloat(tick.last_price)),
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
            const newPrice = Math.floor(parseFloat(tick.last_price));

            // Update basic metrics
            instrument.time = currentTime;
            instrument.plus3 = newPrice - instrument.firstPrice;
            instrument.change = newPrice - oldPrice;
            instrument.last = newPrice;

            if (instrument.buyPrice > -1) {
                instrument.changeFromBuy = newPrice - instrument.buyPrice;
            }
        }

        if (!this.initialDIFF10entry) {
            this.initialDIFF10entry = true;
            this.blockDiff10 = true;
            console.log('Transitioning from UPDATE to DIFF10 block');
        }
    }

    async processDiff10Block(ticks) {
        console.log('Processing DIFF10 block');

        if(!this.mainToken) {
            this.mainToken = this.strategyUtils.findClosestCEAbovePrice(this.universalDict.instrumentMap, 20, 20).token.toString();
        }

        if(!this.oppToken) {
            this.oppToken = this.strategyUtils.findClosestPEAbovePrice(this.universalDict.instrumentMap, 20, 20).token.toString();
        }

        this.mainInstrument = this.universalDict.instrumentMap[this.mainToken];
        this.oppInstrument = this.universalDict.instrumentMap[this.oppToken];

        if(!this.mainInstrument) {
            this.mainInstrument = this.universalDict.instrumentMap[this.mainToken];
        }

        if(!this.oppInstrument) {
            this.oppInstrument = this.universalDict.instrumentMap[this.oppToken];
        }

        if(!this.mainInstrument || !this.oppInstrument) {
            return;
        }

        if(this.mainInstrument && this.oppInstrument && !this.boughtSold) {
            if(this.shouldPhase1Buy()){
                await this.phase1Buy();
            }

            if(this.shouldPhase1Sell()){
                await this.phase1Sell();
            }

            if(this.shouldPhase2Buy()){
                await this.phase2Buy();
            }

            if(this.shouldPhase2Sell()){
                await this.phase2Sell();
            }

            if(this.shouldPhase3Buy()){
                await this.phase3Buy();
            }

            if(this.shouldPhase3Sell()){
                await this.phase3Sell();
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

    resetForNextCycle() {
        this.strategyUtils.logStrategyInfo('Resetting for next cycle');
        
        // Increment cycle count
        this.universalDict.cycles = (this.universalDict.cycles || 1) + 1;
        this.cycleCount = this.universalDict.cycles;  // Keep cycleCount in sync

        // Reset all flags
        this.phase1BuyDone = false;
        this.phase1SellDone = false;
        this.phase2BuyDone = false;
        this.phase2SellDone = false;
        this.phase3BuyDone = false;
        this.phase3SellDone = false;
        this.boughtSold = false;
        this.initialDIFF10entry = false;

        // Reset instruments
        this.mainToken = null;
        this.oppToken = null;
        this.mainInstrument = null;
        this.oppInstrument = null;
        this.lockedQuantity = 0;

        // Reset block states
        this.blockInit = true;
        this.blockUpdate = false;
        this.blockDiff10 = false;
        this.blockNextCycle = false;

        // Reset data structures
        this.universalDict.instrumentMap = {};
        this.universalDict.ceTokens = [];
        this.universalDict.peTokens = [];
        this.universalDict.observedTicks = [];
        this.acceptedTokens = [];

        this.strategyUtils.logStrategyInfo(`Cycle ${this.universalDict.cycles} started`);
    }
    shouldPhase1Buy() {
        let main_filter = (((this.mainInstrument.last - this.mainInstrument.firstPrice) <= -5) && (this.oppInstrument.last < this.oppInstrument.firstPrice));
        let opp_filter = (((this.oppInstrument.last - this.oppInstrument.firstPrice) <= -5) && (this.mainInstrument.last < this.mainInstrument.firstPrice));
        let filter = main_filter || opp_filter;
        return !this.phase1BuyDone && filter;
    }

    shouldPhase1Sell() {
        let main_change = this.mainInstrument.changeFromBuy;
        let opp_change = this.oppInstrument.changeFromBuy;
        let mtm = main_change + opp_change;
        return !this.phase1SellDone && this.phase1BuyDone && mtm >= this.globalDict.target;
    }

    shouldPhase2Buy() {
        let main_change = this.mainInstrument.changeFromBuy;
        let opp_change = this.oppInstrument.changeFromBuy;
        let mtm = main_change + opp_change;
        return !this.phase2BuyDone && this.phase1SellDone && mtm >= this.globalDict.secondBuyThreshold;
        
    }

    shouldPhase2Sell() {
        let main_change = this.mainInstrument.changeFromBuy;
        let opp_change = this.oppInstrument.changeFromBuy;
        let mtm = main_change + opp_change;
        return !this.phase2SellDone && this.phase2BuyDone && mtm >= this.globalDict.secondTarget;
    }

    shouldPhase3Buy() {
        let main_change = this.mainInstrument.changeFromBuy;
        let opp_change = this.oppInstrument.changeFromBuy;
        let mtm = main_change + opp_change;
        return !this.phase3BuyDone && this.phase2SellDone && mtm >= this.globalDict.thirdBuyThreshold;
    }

    shouldPhase3Sell() {
        let main_change = this.mainInstrument.changeFromBuy;
        let opp_change = this.oppInstrument.changeFromBuy;
        let mtm = main_change + opp_change;
        return !this.phase3SellDone && this.phase3BuyDone && mtm >= this.globalDict.thirdTarget;
    }

    async phase1Buy() {
        this.phase1BuyDone = true;
        this.lockedQuantity = this.globalDict.quantity;
        try {
            const first_instrument_result = await this.buyInstrument(this.mainInstrument);
            if (first_instrument_result.success) {
                this.strategyUtils.logStrategyInfo(`First instrument bought - Executed price: ${first_instrument_result.executedPrice}`);
            }
            this.mainInstrument.buyPrice = first_instrument_result.executedPrice == 0 ? this.mainInstrument.last : first_instrument_result.executedPrice;
            this.universalDict.instrumentMap[this.mainInstrument.token].buyPrice = this.mainInstrument.buyPrice;
            this.strategyUtils.logStrategyInfo(`Main Instrument Buy Price: ${this.universalDict.instrumentMap[this.mainInstrument.token].buyPrice}`);
            // this.buyComplete = first_instrument_result.executedPrice == 0 && this.globalDict.enableTrading ? false : true;

        } catch (error) {
            this.strategyUtils.logStrategyError(`Error buying first instrument: ${error.message}`);
        }

        try {
            const second_instrument_result = await this.buyInstrument(this.oppInstrument);
            if (second_instrument_result.success) {
                this.strategyUtils.logStrategyInfo(`Second instrument bought - Executed price: ${second_instrument_result.executedPrice}`);
            }
            this.oppInstrument.buyPrice = second_instrument_result.executedPrice == 0 ? this.oppInstrument.last : second_instrument_result.executedPrice;
            this.universalDict.instrumentMap[this.oppInstrument.token].buyPrice = this.oppInstrument.buyPrice;
            this.strategyUtils.logStrategyInfo(`Other Instrument Buy Price: ${this.universalDict.instrumentMap[this.oppInstrument.token].buyPrice}`);
            // this.buyComplete = second_instrument_result.executedPrice == 0 && this.globalDict.enableTrading ? false : true;
        } catch (error) {
            this.strategyUtils.logStrategyError(`Error buying second instrument: ${error.message}`);
        }
    }

    async phase1Sell() {
        this.phase1SellDone = true;
        try {
            const first_instrument_result = await this.sellInstrument(this.mainInstrument);
            if (first_instrument_result.success) {
                this.strategyUtils.logStrategyInfo(`First instrument sold - Executed price: ${first_instrument_result.executedPrice}`);
            }
            this.mainInstrument.last = first_instrument_result.executedPrice == 0 ? this.mainInstrument.last : first_instrument_result.executedPrice;
            this.universalDict.instrumentMap[this.mainInstrument.token].last = this.mainInstrument.last;
            this.strategyUtils.logStrategyInfo(`Main Instrument Last Price: ${this.universalDict.instrumentMap[this.mainInstrument.token].last}`);
        } catch (error) {
            this.strategyUtils.logStrategyError(`Error selling first instrument: ${error.message}`);
        }
        
        try {
            const second_instrument_result = await this.sellInstrument(this.oppInstrument);
            if (second_instrument_result.success) {
                this.strategyUtils.logStrategyInfo(`Second instrument sold - Executed price: ${second_instrument_result.executedPrice}`);
            }
            this.oppInstrument.last = second_instrument_result.executedPrice == 0 ? this.oppInstrument.last : second_instrument_result.executedPrice;
            this.universalDict.instrumentMap[this.oppInstrument.token].last = this.oppInstrument.last;
            this.strategyUtils.logStrategyInfo(`Other Instrument Last Price: ${this.universalDict.instrumentMap[this.oppInstrument.token].last}`);
        } catch (error) {
            this.strategyUtils.logStrategyError(`Error selling second instrument: ${error.message}`);
        }
    }

    async phase2Buy() {
        this.phase2BuyDone = true;
        
        try {
            const first_instrument_result = await this.buyInstrument(this.mainInstrument);
            if (first_instrument_result.success) {
                this.strategyUtils.logStrategyInfo(`First instrument bought - Executed price: ${first_instrument_result.executedPrice}`);
            }
            this.mainInstrument.buyPrice = first_instrument_result.executedPrice == 0 ? this.mainInstrument.last : first_instrument_result.executedPrice;
            this.universalDict.instrumentMap[this.mainInstrument.token].buyPrice = this.mainInstrument.buyPrice;
            this.strategyUtils.logStrategyInfo(`Main Instrument Buy Price: ${this.universalDict.instrumentMap[this.mainInstrument.token].buyPrice}`);
            // this.buyComplete = first_instrument_result.executedPrice == 0 && this.globalDict.enableTrading ? false : true;

        } catch (error) {
            this.strategyUtils.logStrategyError(`Error buying first instrument: ${error.message}`);
        }

        try {
            const second_instrument_result = await this.buyInstrument(this.oppInstrument);
            if (second_instrument_result.success) {
                this.strategyUtils.logStrategyInfo(`Second instrument bought - Executed price: ${second_instrument_result.executedPrice}`);
            }
            this.oppInstrument.buyPrice = second_instrument_result.executedPrice == 0 ? this.oppInstrument.last : second_instrument_result.executedPrice;
            this.universalDict.instrumentMap[this.oppInstrument.token].buyPrice = this.oppInstrument.buyPrice;
            this.strategyUtils.logStrategyInfo(`Other Instrument Buy Price: ${this.universalDict.instrumentMap[this.oppInstrument.token].buyPrice}`);
            // this.buyComplete = second_instrument_result.executedPrice == 0 && this.globalDict.enableTrading ? false : true;
        } catch (error) {
            this.strategyUtils.logStrategyError(`Error buying second instrument: ${error.message}`);
        }    
    }

    async phase2Sell() {
        this.phase2SellDone = true;
        try {
            const first_instrument_result = await this.sellInstrument(this.mainInstrument);
            if (first_instrument_result.success) {
                this.strategyUtils.logStrategyInfo(`First instrument sold - Executed price: ${first_instrument_result.executedPrice}`);
            }
            this.mainInstrument.last = first_instrument_result.executedPrice == 0 ? this.mainInstrument.last : first_instrument_result.executedPrice;
            this.universalDict.instrumentMap[this.mainInstrument.token].last = this.mainInstrument.last;
            this.strategyUtils.logStrategyInfo(`Main Instrument Last Price: ${this.universalDict.instrumentMap[this.mainInstrument.token].last}`);
        } catch (error) {
            this.strategyUtils.logStrategyError(`Error selling first instrument: ${error.message}`);
        }
        
        try {
            const second_instrument_result = await this.sellInstrument(this.oppInstrument);
            if (second_instrument_result.success) {
                this.strategyUtils.logStrategyInfo(`Second instrument sold - Executed price: ${second_instrument_result.executedPrice}`);
            }
            this.oppInstrument.last = second_instrument_result.executedPrice == 0 ? this.oppInstrument.last : second_instrument_result.executedPrice;
            this.universalDict.instrumentMap[this.oppInstrument.token].last = this.oppInstrument.last;
            this.strategyUtils.logStrategyInfo(`Other Instrument Last Price: ${this.universalDict.instrumentMap[this.oppInstrument.token].last}`);
        } catch (error) {
            this.strategyUtils.logStrategyError(`Error selling second instrument: ${error.message}`);
        }
    }

    async phase3Buy() {
        this.phase3BuyDone = true;
        try {
            const first_instrument_result = await this.buyInstrument(this.mainInstrument);
            if (first_instrument_result.success) {
                this.strategyUtils.logStrategyInfo(`First instrument bought - Executed price: ${first_instrument_result.executedPrice}`);
            }
            this.mainInstrument.buyPrice = first_instrument_result.executedPrice == 0 ? this.mainInstrument.last : first_instrument_result.executedPrice;
            this.universalDict.instrumentMap[this.mainInstrument.token].buyPrice = this.mainInstrument.buyPrice;
            this.strategyUtils.logStrategyInfo(`Main Instrument Buy Price: ${this.universalDict.instrumentMap[this.mainInstrument.token].buyPrice}`);
            // this.buyComplete = first_instrument_result.executedPrice == 0 && this.globalDict.enableTrading ? false : true;

        } catch (error) {
            this.strategyUtils.logStrategyError(`Error buying first instrument: ${error.message}`);
        }

        try {
            const second_instrument_result = await this.buyInstrument(this.oppInstrument);
            if (second_instrument_result.success) {
                this.strategyUtils.logStrategyInfo(`Second instrument bought - Executed price: ${second_instrument_result.executedPrice}`);
            }
            this.oppInstrument.buyPrice = second_instrument_result.executedPrice == 0 ? this.oppInstrument.last : second_instrument_result.executedPrice;
            this.universalDict.instrumentMap[this.oppInstrument.token].buyPrice = this.oppInstrument.buyPrice;
            this.strategyUtils.logStrategyInfo(`Other Instrument Buy Price: ${this.universalDict.instrumentMap[this.oppInstrument.token].buyPrice}`);
            // this.buyComplete = second_instrument_result.executedPrice == 0 && this.globalDict.enableTrading ? false : true;
        } catch (error) {
            this.strategyUtils.logStrategyError(`Error buying second instrument: ${error.message}`);
        }
    }

    async phase3Sell() {
        this.phase3SellDone = true;
        this.boughtSold = true;
        try {
            const first_instrument_result = await this.sellInstrument(this.mainInstrument);
            if (first_instrument_result.success) {
                this.strategyUtils.logStrategyInfo(`First instrument sold - Executed price: ${first_instrument_result.executedPrice}`);
            }
            this.mainInstrument.last = first_instrument_result.executedPrice == 0 ? this.mainInstrument.last : first_instrument_result.executedPrice;
            this.universalDict.instrumentMap[this.mainInstrument.token].last = this.mainInstrument.last;
            this.strategyUtils.logStrategyInfo(`Main Instrument Last Price: ${this.universalDict.instrumentMap[this.mainInstrument.token].last}`);
        } catch (error) {
            this.strategyUtils.logStrategyError(`Error selling first instrument: ${error.message}`);
        }
        
        try {
            const second_instrument_result = await this.sellInstrument(this.oppInstrument);
            if (second_instrument_result.success) {
                this.strategyUtils.logStrategyInfo(`Second instrument sold - Executed price: ${second_instrument_result.executedPrice}`);
            }
            this.oppInstrument.last = second_instrument_result.executedPrice == 0 ? this.oppInstrument.last : second_instrument_result.executedPrice;
            this.universalDict.instrumentMap[this.oppInstrument.token].last = this.oppInstrument.last;
            this.strategyUtils.logStrategyInfo(`Other Instrument Last Price: ${this.universalDict.instrumentMap[this.oppInstrument.token].last}`);
        } catch (error) {
            this.strategyUtils.logStrategyError(`Error selling second instrument: ${error.message}`);
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
                    this.lockedQuantity || 65
                );

                if (sellResult.success) {
                    this.strategyUtils.logStrategyInfo(`Sell order placed for ${instrument.symbol}`);
                    this.strategyUtils.logOrderPlaced('sell', instrument.symbol, instrument.last, this.lockedQuantity || 65, instrument.token);
                    
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
                        // executedPrice = instrument.last; // Fallback to current price
                    }
                } else {
                    this.strategyUtils.logStrategyError(`Failed to place sell order for ${instrument.symbol}: ${sellResult.error}`);
                    this.strategyUtils.logOrderFailed('sell', instrument.symbol, instrument.last, this.lockedQuantity || 65, instrument.token, sellResult.error);
                }
            } else {
                // Paper trading
                this.strategyUtils.logStrategyInfo(`PAPER TRADING: Sell order for ${instrument.symbol} @ ${instrument.last}`);
                this.strategyUtils.logOrderPlaced('sell', instrument.symbol, instrument.last, this.lockedQuantity || 65, instrument.token);
                
                executedPrice = instrument.last;
            }
            
            // Emit simplified trade event after determining executed price
            this.emitSimpleTradeEvent('sell', instrument.symbol, executedPrice != 0 ? executedPrice : instrument.last, this.lockedQuantity || 65);
            
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
                    this.lockedQuantity || 65,
                    this.generateTag(this.userId, this.universalDict.cycles, instrument.symbol)
                );

                if (buyResult.success) {
                    this.strategyUtils.logStrategyInfo(`Buy order placed for ${instrument.symbol}`);
                    this.strategyUtils.logOrderPlaced('buy', instrument.symbol, instrument.last, this.lockedQuantity || 65, instrument.token);
                    
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
                        // executedPrice = instrument.last;
                        // instrument.buyPrice = instrument.last;
                    }
                } else {
                    this.strategyUtils.logStrategyError(`Failed to place buy order for ${instrument.symbol}: ${buyResult.error}`);
                    this.strategyUtils.logOrderFailed('buy', instrument.symbol, instrument.last, this.lockedQuantity || 65, instrument.token, buyResult.error);
                }
            } else {
                // Paper trading
                this.strategyUtils.logStrategyInfo(`PAPER TRADING: Buy order for ${instrument.symbol} @ ${instrument.last}`);
                this.strategyUtils.logOrderPlaced('buy', instrument.symbol, instrument.last, this.lockedQuantity || 65, instrument.token);
                
                // Update buy price for paper trading
                executedPrice = instrument.last;
                instrument.buyPrice = instrument.last;
            }
            
            // Emit simplified trade event after determining executed price
            this.emitSimpleTradeEvent('buy', instrument.symbol, executedPrice != 0 ? executedPrice : instrument.last, this.lockedQuantity || 65);
            
            return { success: true, executedPrice };
        } catch (error) {
            this.strategyUtils.logStrategyError(`Exception while buying instrument: ${error.message}`);
            return { success: false, executedPrice: null };
        }
    }

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

            // State Variables
            mainToken: this.mainToken,
            oppToken: this.oppToken,
            mainInstrument: this.mainInstrument,
            oppInstrument: this.oppInstrument,
            lockedQuantity: this.lockedQuantity,

            // Block states
            blockInit: this.blockInit,
            blockUpdate: this.blockUpdate,
            blockDiff10: this.blockDiff10,
            blockNextCycle: this.blockNextCycle,

            // Flags
            initialDIFF10entry: this.initialDIFF10entry,
            phase1BuyDone: this.phase1BuyDone,
            phase1SellDone: this.phase1SellDone,
            phase2BuyDone: this.phase2BuyDone,
            phase2SellDone: this.phase2SellDone,
            phase3BuyDone: this.phase3BuyDone,
            phase3SellDone: this.phase3SellDone,
            boughtSold: this.boughtSold,

            // Include universalDict for frontend display
            universalDict: this.universalDict
        };
        
        return config;
    }

    getGlobalDictParameters() {
        return {
            target: {
                type: 'number',
                default: 9,
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
            dropThreshold: {
                type: 'number',
                default: 0,
                description: 'Drop threshold in percentage points'
            },
            secondBuyThreshold: {
                type: 'number',
                default: 19,
                description: 'Second buy threshold in points'
            },
            secondTarget: {
                type: 'number',
                default: 16,
                description: 'Second target in points'
            },
            thirdBuyThreshold: {
                type: 'number',
                default: 31,
                description: 'Third buy threshold in points'
            },
            thirdTarget: {
                type: 'number',
                default: 50,
                description: 'Third target in points'
            },
            quantity: {
                type: 'number',
                default: 65,
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
            }
        };
    }
}

module.exports = StrategyX;
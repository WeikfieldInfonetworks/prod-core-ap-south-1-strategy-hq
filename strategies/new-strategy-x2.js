const BaseStrategy = require('./base');
const TradingUtils = require('../utils/tradingUtils');
const StrategyUtils = require('../utils/strategyUtils');
const fs = require('fs');

class NewX2Strategy extends BaseStrategy {

    constructor() {
        super();
        this.name = 'New X 2 Strategy';
        this.description = 'New X strategy with interim low detection and dual option trading';
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
        this.targetNet = false;
        this.third_bought = false;
        this.buyComplete = false;

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
        this.dropObserved = false;
        this.mtmHit = false;
        this.mtmCheck = false;

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
        this.targetNet = false;
        this.third_bought = false;
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
        this.dropObserved = false;
        this.mtmHit = false;
        this.mtmCheck = false;
        this.buyComplete = false;

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

            if (instrument.buyPrice > -1) {
                instrument.changeFromBuy = newPrice - instrument.buyPrice;
            }

            // TEMPORARY FIX: For testing
            // if (token === "18424322"){
            //     instrument.firstPrice = 120.7
            // }

            // if (token === "18425090"){
            //     instrument.firstPrice = 103.7
            // }
            
            // Other updates only for selected instruments.
            // if (this.universalDict.ceTokens.includes(token) || this.universalDict.peTokens.includes(token)) {

            //     if (newPrice > instrument.peak) {
            //         instrument.prevPeak = instrument.peak;
            //         instrument.peak = newPrice;
            //         instrument.peakTime = currentTime;
            //         this.strategyUtils.logStrategyInfo(`NEW PEAK: ${instrument.symbol}: ${instrument.peak}`);
            //     }

            //     if (newPrice < instrument.lowAtRef || instrument.lowAtRef === -1) {
            //         instrument.lowAtRef = newPrice;
            //         this.strategyUtils.logStrategyInfo(`NEW LOW AT REF: ${instrument.symbol}: ${instrument.lowAtRef}`);
            //     }

            //     if (instrument.lowAtRef <= instrument.firstPrice*0.5 && !this.halfdrop_flag) {
            //         this.halfdrop_flag = true;
            //         this.halfdrop_instrument = instrument;
            //         this.mainToken = instrument.token
            //         this.strategyUtils.logStrategyInfo(`HALF DROP FLAG: ${instrument.symbol} at ${instrument.lowAtRef}`);
            //     }

            //     if (instrument.buyPrice > -1) {
            //         instrument.changeFromBuy = newPrice - instrument.buyPrice;
            //     }
            // }
        }

        if (!this.halfdrop_flag) {
            this.blockDiff10 = true;
            console.log('Transitioning from UPDATE to DIFF10 block');
        }
    }

    async processDiff10Block(ticks) {

        this.halfdrop_flag = true;

        if(!this.mainToken) {
            this.mainToken = this.strategyUtils.findClosestCEAbovePrice(this.universalDict.instrumentMap, 20, 20).token.toString();
        }
        if(!this.oppToken) {
            this.oppToken = this.strategyUtils.findClosestPEAbovePrice(this.universalDict.instrumentMap, 20, 20).token.toString();
        }

        this.halfdrop_instrument = this.universalDict.instrumentMap[this.mainToken];
        this.other_instrument = this.universalDict.instrumentMap[this.oppToken];
        // if(!this.halfdrop_instrument) {
        //     this.halfdrop_instrument = this.universalDict.instrumentMap[this.mainToken];
        // }
        // if(!this.other_instrument) {
        //     this.other_instrument = this.universalDict.instrumentMap[this.oppToken];
        // }

        // PERCENTAGE DROP OBSERVER
        if(!this.dropObserved){
            if(this.halfdrop_instrument.last <= this.halfdrop_instrument.firstPrice * (1 - this.globalDict.dropThreshold) || this.other_instrument.last <= this.other_instrument.firstPrice * (1 - this.globalDict.dropThreshold)){
                this.dropObserved = true;
                this.strategyUtils.logStrategyInfo('Drop observed');
            }
        }
        if(!this.targetNet){
            let instrument_1_change = this.halfdrop_instrument.changeFromBuy;
            let instrument_2_change = this.other_instrument.changeFromBuy;
            let mtm = instrument_1_change + instrument_2_change;
            if(mtm > this.globalDict.target - 1){
                this.targetNet = true;
                this.strategyUtils.logStrategyInfo('Target net casted');
            }
        }

        // GLOBAL OUTPUT OBSERVER
        const globalOutput = this.readFromGlobalOutput();
        if(!this.mtmHit && this.halfdrop_bought && globalOutput.includes("HALF DROP") && !this.mtmCheck && this.halfdrop_instrument && this.other_instrument && false){
            this.mtmCheck = true;
            let instrument_1_change = this.halfdrop_instrument.changeFromBuy;
            let instrument_2_change = this.other_instrument.changeFromBuy;
            let mtm = instrument_1_change + instrument_2_change;
            this.strategyUtils.logStrategyInfo(`HALF DROP OBSERVED with MTM: ${mtm}`);
            // Reset Global Output
            this.writeToGlobalOutput("");
            
            if (mtm >= 0){
                this.mtmHit = true;
                this.strategyUtils.logStrategyInfo('HALF DROP OBSERVED with +ve MTM. Selling both.');
            }
            else if (mtm < 0){
                try {
                    const first_instrument_result = await this.buyInstrument(this.halfdrop_instrument);
                    if (first_instrument_result.success) {
                        this.strategyUtils.logStrategyInfo(`First instrument bought - Executed price: ${first_instrument_result.executedPrice}`);
                    }
                    this.halfdrop_instrument.buyPrice = first_instrument_result.executedPrice == 0 ? this.halfdrop_instrument.last : first_instrument_result.executedPrice;
                    this.universalDict.instrumentMap[this.halfdrop_instrument.token].buyPrice = this.halfdrop_instrument.buyPrice;
                    this.strategyUtils.logStrategyInfo(`Halfdrop Instrument Buy Price: ${this.universalDict.instrumentMap[this.halfdrop_instrument.token].buyPrice}`);
                } catch (error) {
                    this.strategyUtils.logStrategyError(`Error buying first instrument: ${error.message}`);
                }
                try {
                    const second_instrument_result = await this.buyInstrument(this.other_instrument);
                    if (second_instrument_result.success) {
                        this.strategyUtils.logStrategyInfo(`Second instrument bought - Executed price: ${second_instrument_result.executedPrice}`);
                    }
                    this.other_instrument.buyPrice = second_instrument_result.executedPrice == 0 ? this.other_instrument.last : second_instrument_result.executedPrice;
                    this.universalDict.instrumentMap[this.other_instrument.token].buyPrice = this.other_instrument.buyPrice;
                    this.strategyUtils.logStrategyInfo(`Other Instrument Buy Price: ${this.universalDict.instrumentMap[this.other_instrument.token].buyPrice}`);
                } catch (error) {
                    this.strategyUtils.logStrategyError(`Error buying second instrument: ${error.message}`);
                }
                this.buyComplete = true;
            }
        }

        // BUY BOTH
        if(!this.halfdrop_bought && this.dropObserved) {
            this.halfdrop_bought = true;
            try {
                const first_instrument_result = await this.buyInstrument(this.halfdrop_instrument);
                if (first_instrument_result.success) {
                    this.strategyUtils.logStrategyInfo(`First instrument bought - Executed price: ${first_instrument_result.executedPrice}`);
                }
                this.halfdrop_instrument.buyPrice = first_instrument_result.executedPrice == 0 ? this.halfdrop_instrument.last : first_instrument_result.executedPrice;
                this.universalDict.instrumentMap[this.halfdrop_instrument.token].buyPrice = this.halfdrop_instrument.buyPrice;
                this.strategyUtils.logStrategyInfo(`Halfdrop Instrument Buy Price: ${this.universalDict.instrumentMap[this.halfdrop_instrument.token].buyPrice}`);

            } catch (error) {
                this.strategyUtils.logStrategyError(`Error buying first instrument: ${error.message}`);
            }

            try {
                const second_instrument_result = await this.buyInstrument(this.other_instrument);
                if (second_instrument_result.success) {
                    this.strategyUtils.logStrategyInfo(`Second instrument bought - Executed price: ${second_instrument_result.executedPrice}`);
                }
                this.other_instrument.buyPrice = second_instrument_result.executedPrice == 0 ? this.other_instrument.last : second_instrument_result.executedPrice;
                this.universalDict.instrumentMap[this.other_instrument.token].buyPrice = this.other_instrument.buyPrice;
                this.strategyUtils.logStrategyInfo(`Other Instrument Buy Price: ${this.universalDict.instrumentMap[this.other_instrument.token].buyPrice}`);
            } catch (error) {
                this.strategyUtils.logStrategyError(`Error buying second instrument: ${error.message}`);
            }
        }

        if(this.halfdrop_bought && !this.halfdrop_sold && !this.other_bought && !this.boughtSold) {
            let instrument_1_change = this.halfdrop_instrument.changeFromBuy;
            let instrument_2_change = this.other_instrument.changeFromBuy;

            let mtm = instrument_1_change + instrument_2_change;
            console.log(`FIRST BUY PHASE MTM: ${mtm} Target: ${this.globalDict.target}`);

            if(mtm >= this.globalDict.target || (this.targetNet && mtm <= this.globalDict.target - 1)) {
                this.halfdrop_sold = true;
                // SELL BOTH
                try {
                    const first_instrument_result = await this.sellInstrument(this.halfdrop_instrument);
                    if (first_instrument_result.success) {
                        this.strategyUtils.logStrategyInfo(`First instrument sold - Executed price: ${first_instrument_result.executedPrice}`);
                    }
                    this.halfdrop_instrument.last = first_instrument_result.executedPrice == 0 ? this.halfdrop_instrument.last : first_instrument_result.executedPrice;
                    this.universalDict.instrumentMap[this.halfdrop_instrument.token].last = this.halfdrop_instrument.last;
                } catch (error) {
                    this.strategyUtils.logStrategyError(`Error selling first instrument: ${error.message}`);
                }

                try {
                    const second_instrument_result = await this.sellInstrument(this.other_instrument);
                    if (second_instrument_result.success) {
                        this.strategyUtils.logStrategyInfo(`Second instrument sold - Executed price: ${second_instrument_result.executedPrice}`);
                    }
                    this.other_instrument.last = second_instrument_result.executedPrice == 0 ? this.other_instrument.last : second_instrument_result.executedPrice;
                    this.universalDict.instrumentMap[this.other_instrument.token].last = this.other_instrument.last;
                } catch (error) {
                    this.strategyUtils.logStrategyError(`Error selling second instrument: ${error.message}`);
                }

            }
        }

        if(this.halfdrop_sold && !this.boughtSold) {

            let instrument_1_change = this.halfdrop_instrument.changeFromBuy;
            let instrument_2_change = this.other_instrument.changeFromBuy;

            let mtm = instrument_1_change + instrument_2_change;
            console.log(`SECOND BUY INITIATION MTM: ${mtm} Threshold: ${this.globalDict.secondBuyThreshold}`);
            if(mtm >= this.globalDict.secondBuyThreshold && !this.other_bought) {
                this.other_bought = true;
                // BUY BOTH
                try {
                    const first_instrument_result = await this.buyInstrument(this.halfdrop_instrument);
                    if (first_instrument_result.success) {
                        this.strategyUtils.logStrategyInfo(`First instrument bought - Executed price: ${first_instrument_result.executedPrice}`);
                    }
                    this.halfdrop_instrument.buyPrice = first_instrument_result.executedPrice == 0 ? this.halfdrop_instrument.last : first_instrument_result.executedPrice;
                    this.universalDict.instrumentMap[this.halfdrop_instrument.token].buyPrice = this.halfdrop_instrument.buyPrice;
                } catch (error) {
                    this.strategyUtils.logStrategyError(`Error buying first instrument: ${error.message}`);
                }

                try {
                    const second_instrument_result = await this.buyInstrument(this.other_instrument);
                    if (second_instrument_result.success) {
                        this.strategyUtils.logStrategyInfo(`Second instrument bought - Executed price: ${second_instrument_result.executedPrice}`);
                    }
                    this.other_instrument.buyPrice = second_instrument_result.executedPrice == 0 ? this.other_instrument.last : second_instrument_result.executedPrice;
                    this.universalDict.instrumentMap[this.other_instrument.token].buyPrice = this.other_instrument.buyPrice;
                } catch (error) {
                    this.strategyUtils.logStrategyError(`Error buying second instrument: ${error.message}`);
                }
            }

            if(this.other_bought && !this.other_sold) {
                instrument_1_change = this.halfdrop_instrument.changeFromBuy;
                instrument_2_change = this.other_instrument.changeFromBuy;

                mtm = instrument_1_change + instrument_2_change;
                console.log(`SECOND BUY PHASE MTM: ${mtm} Target: ${this.globalDict.secondTarget}`);
                
                if(mtm >= this.globalDict.secondTarget) {
                    this.other_sold = true;
                    // this.boughtSold = true;
                    // SELL BOTH
                    try {
                        const first_instrument_result = await this.sellInstrument(this.halfdrop_instrument);
                        if (first_instrument_result.success) {
                            this.strategyUtils.logStrategyInfo(`First instrument sold - Executed price: ${first_instrument_result.executedPrice}`);
                        }
                        this.halfdrop_instrument.last = first_instrument_result.executedPrice == 0 ? this.halfdrop_instrument.last : first_instrument_result.executedPrice;
                        this.universalDict.instrumentMap[this.halfdrop_instrument.token].last = this.halfdrop_instrument.last;
                    } catch (error) {
                        this.strategyUtils.logStrategyError(`Error selling first instrument: ${error.message}`);
                    }

                    try {
                        const second_instrument_result = await this.sellInstrument(this.other_instrument);
                        if (second_instrument_result.success) {
                            this.strategyUtils.logStrategyInfo(`Second instrument sold - Executed price: ${second_instrument_result.executedPrice}`);
                        }
                        this.other_instrument.last = second_instrument_result.executedPrice == 0 ? this.other_instrument.last : second_instrument_result.executedPrice;
                        this.universalDict.instrumentMap[this.other_instrument.token].last = this.other_instrument.last;
                    } catch (error) {
                        this.strategyUtils.logStrategyError(`Error selling second instrument: ${error.message}`);
                    }
                }
            }

            if(this.other_sold && !this.third_bought){
                let instrument_1_change = this.halfdrop_instrument.changeFromBuy;
                let instrument_2_change = this.other_instrument.changeFromBuy;
                let mtm = instrument_1_change + instrument_2_change;
                console.log(`THIRD BUY INITIATION MTM: ${mtm} Threshold: ${this.globalDict.thirdBuyThreshold}`);
                if(mtm >= this.globalDict.thirdBuyThreshold){
                    this.third_bought = true;
                    // BUY BOTH
                    try {
                        const first_instrument_result = await this.buyInstrument(this.halfdrop_instrument);
                        if (first_instrument_result.success) {
                            this.strategyUtils.logStrategyInfo(`First instrument bought - Executed price: ${first_instrument_result.executedPrice}`);
                            this.halfdrop_instrument.buyPrice = first_instrument_result.executedPrice == 0 ? this.halfdrop_instrument.last : first_instrument_result.executedPrice;
                            this.universalDict.instrumentMap[this.halfdrop_instrument.token].buyPrice = this.halfdrop_instrument.buyPrice;
                        }
                    } catch (error) {
                        this.strategyUtils.logStrategyError(`Error buying first instrument: ${error.message}`);
                    }
                    try {
                        const second_instrument_result = await this.buyInstrument(this.other_instrument);
                        if (second_instrument_result.success) {
                            this.strategyUtils.logStrategyInfo(`Second instrument bought - Executed price: ${second_instrument_result.executedPrice}`);
                            this.other_instrument.buyPrice = second_instrument_result.executedPrice == 0 ? this.other_instrument.last : second_instrument_result.executedPrice;
                            this.universalDict.instrumentMap[this.other_instrument.token].buyPrice = this.other_instrument.buyPrice;
                        }
                    } catch (error) {
                        this.strategyUtils.logStrategyError(`Error buying second instrument: ${error.message}`);
                    }   
                }
            }

            if(this.third_bought && !this.boughtSold){
                let instrument_1_change = this.halfdrop_instrument.changeFromBuy;
                let instrument_2_change = this.other_instrument.changeFromBuy;
                let mtm = instrument_1_change + instrument_2_change;
                console.log(`THIRD BUY PHASE MTM: ${mtm} Target: ${this.globalDict.thirdTarget}`);
                if(mtm >= this.globalDict.thirdTarget){
                    this.boughtSold = true;
                    try {
                        const first_instrument_result = await this.sellInstrument(this.halfdrop_instrument);
                        if (first_instrument_result.success) {
                            this.strategyUtils.logStrategyInfo(`First instrument sold - Executed price: ${first_instrument_result.executedPrice}`);
                            this.strategyUtils.logStrategyInfo(`SELL PRICE: ${first_instrument_result.executedPrice == 0 ? this.halfdrop_instrument.last : first_instrument_result.executedPrice}`);
                        }
                    } catch (error) {
                        this.strategyUtils.logStrategyError(`Error selling first instrument: ${error.message}`);
                    }
                    try {
                        const second_instrument_result = await this.sellInstrument(this.other_instrument);
                        if (second_instrument_result.success) {
                            this.strategyUtils.logStrategyInfo(`Second instrument sold - Executed price: ${second_instrument_result.executedPrice}`);
                            this.strategyUtils.logStrategyInfo(`SELL PRICE: ${second_instrument_result.executedPrice == 0 ? this.other_instrument.last : second_instrument_result.executedPrice}`);
                        }
                    } catch (error) {
                        this.strategyUtils.logStrategyError(`Error selling second instrument: ${error.message}`);
                    }
                }
            }
        }

        if(this.mtmHit && !this.boughtSold && false){
            
            try {
                const first_instrument_result = await this.sellInstrument(this.halfdrop_instrument);
                if (first_instrument_result.success) {
                    this.strategyUtils.logStrategyInfo(`First instrument sold - Executed price: ${first_instrument_result.executedPrice}`);
                }
            } catch (error) {
                this.strategyUtils.logStrategyError(`Error selling first instrument: ${error.message}`);
            }
            
            try {
                const second_instrument_result = await this.sellInstrument(this.other_instrument);
                if (second_instrument_result.success) {
                    this.strategyUtils.logStrategyInfo(`Second instrument sold - Executed price: ${second_instrument_result.executedPrice}`);
                }
            } catch (error) {
                this.strategyUtils.logStrategyError(`Error selling second instrument: ${error.message}`);
            }
            this.boughtSold = true;
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
                    
                    // Get executed price from order history
                    buyOrderResult.orderId.then(orderId => {
                        tradingUtils.getOrderHistory(orderId.order_id)
                        .then(result => {
                            this.strategyUtils.logStrategyInfo(`Order history: ${typeof result === 'object' ? JSON.stringify(result) : result}`);
                            const executedPrice = result.at(-1).average_price;
                            this.strategyUtils.logStrategyInfo(`Executed Price: ${executedPrice}`);
                            instrument.buyPrice = executedPrice;
                            this.strategyUtils.logStrategyInfo(`Halfdrop Instrument Buy Price: ${this.universalDict.instrumentMap[instrument.token].buyPrice}`);
                        })
                        .catch(error => {
                            this.strategyUtils.logStrategyError(`Error getting order history: ${JSON.stringify(error)}`);
                        });
                    }).catch(error => {
                        this.strategyUtils.logStrategyError(`Error getting order ID: ${JSON.stringify(error)}`);
                    });
                } else {
                    this.strategyUtils.logStrategyError(`Failed to place buy order for ${instrument.symbol}: ${buyOrderResult.error}`);
                    this.strategyUtils.logOrderFailed('buy', instrument.symbol, instrument.last, this.globalDict.quantity || 75, instrument.token, buyOrderResult.error);
                }
            } else {
                // Paper trading - log the order without placing it
                this.strategyUtils.logStrategyInfo(`PAPER TRADING: Buy order for ${instrument.symbol} @ ${instrument.last}`);
                this.strategyUtils.logOrderPlaced('buy', instrument.symbol, instrument.last, this.globalDict.quantity || 75, instrument.token);
                
                // For paper trading, use last price as buy price
                instrument.buyPrice = instrument.last;
            }

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
                // Place market sell order - synchronous
                const sellResult = tradingUtils.placeMarketSellOrder(
                    instrument.symbol,
                    instrument.last,
                    this.globalDict.quantity || 75
                );

                if (sellResult.success) {
                    this.strategyUtils.logStrategyInfo(`Market sell order placed for ${instrument.symbol}`);
                    this.strategyUtils.logOrderPlaced('sell', instrument.symbol, instrument.last, this.globalDict.quantity || 75, instrument.token);
                } else {
                    this.strategyUtils.logStrategyError(`Failed to place market sell order for ${instrument.symbol}: ${sellResult.error}`);
                    this.strategyUtils.logOrderFailed('sell', instrument.symbol, instrument.last, this.globalDict.quantity || 75, instrument.token, sellResult.error);
                }

                sellResult.orderId.then(orderId => {
                    tradingUtils.getOrderHistory(orderId.order_id)
                    .then(result => {
                        this.strategyUtils.logStrategyInfo(`Order history: ${typeof result === 'object' ? JSON.stringify(result) : result}`);
                        const executedPrice = result.at(-1).average_price;
                        this.strategyUtils.logStrategyInfo(`Executed Price: ${executedPrice}`);
                        instrument.last = executedPrice;
                    })
                    .catch(error => {
                        this.strategyUtils.logStrategyError(`Error getting order history: ${JSON.stringify(error)}`);
                    });
                })

            } else {
                // Paper trading - log the order without placing it
                this.strategyUtils.logStrategyInfo(`PAPER TRADING: Market sell order for ${instrument.symbol} @ ${instrument.last}`);
                this.strategyUtils.logOrderPlaced('sell', instrument.symbol, instrument.last, this.globalDict.quantity || 75, instrument.token);
            }

            // Calculate and log P&L
            const pnL = (instrument.last - instrument.buyPrice)
            this.strategyUtils.logStrategyInfo(`P&L: ${pnL.toFixed(2)}`);
            
            // Store loss for assisted target calculation
            if (pnL < 0) {
                this.lossAtFirst = pnL
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

        const instrument = this.universalDict.instrumentMap[this.oppToken];
        
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
                    
                    // Get executed price from order history
                    buyResult.orderId.then(orderId => {
                        tradingUtils.getOrderHistory(orderId.order_id)
                        .then(result => {
                            this.strategyUtils.logStrategyInfo(`Order history: ${typeof result === 'object' ? JSON.stringify(result) : result}`);
                            const executedPrice = result.at(-1).average_price;
                            this.strategyUtils.logStrategyInfo(`Executed Price: ${executedPrice}`);
                            instrument.buyPrice = executedPrice;
                            this.strategyUtils.logStrategyInfo(`Other Instrument Buy Price: ${this.universalDict.instrumentMap[instrument.token].buyPrice}`);
                        })
                        .catch(error => {
                            this.strategyUtils.logStrategyError(`Error getting order history: ${JSON.stringify(error)}`);
                        });
                    }).catch(error => {
                        this.strategyUtils.logStrategyError(`Error getting order ID: ${JSON.stringify(error)}`);
                    });
                } else {
                    this.strategyUtils.logStrategyError(`Failed to place buy order for ${instrument.symbol}: ${buyResult.error}`);
                    this.strategyUtils.logOrderFailed('buy', instrument.symbol, instrument.last, this.globalDict.quantity || 75, instrument.token, buyResult.error);
                }
            } else {
                // Paper trading - log the order without placing it
                this.strategyUtils.logStrategyInfo(`PAPER TRADING: Buy order for ${instrument.symbol} @ ${instrument.last}`);
                this.strategyUtils.logOrderPlaced('buy', instrument.symbol, instrument.last, this.globalDict.quantity || 75, instrument.token);
                
                // For paper trading, use last price as buy price
                instrument.buyPrice = instrument.last;
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

        const instrument = this.universalDict.instrumentMap[this.oppToken];
        
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
                // Place market sell order - synchronous
                const sellResult = tradingUtils.placeMarketSellOrder(
                    instrument.symbol,
                    instrument.last,
                    this.globalDict.quantity || 75
                );

                if (sellResult.success) {
                    this.strategyUtils.logStrategyInfo(`Market sell order placed for ${instrument.symbol}`);
                    this.strategyUtils.logOrderPlaced('sell', instrument.symbol, instrument.last, this.globalDict.quantity || 75, instrument.token);
                } else {
                    this.strategyUtils.logStrategyError(`Failed to place market sell order for ${instrument.symbol}: ${sellResult.error}`);
                    this.strategyUtils.logOrderFailed('sell', instrument.symbol, instrument.last, this.globalDict.quantity || 75, instrument.token, sellResult.error);
                }
            } else {
                // Paper trading - log the order without placing it
                this.strategyUtils.logStrategyInfo(`PAPER TRADING: Market sell order for ${instrument.symbol} @ ${instrument.last}`);
                this.strategyUtils.logOrderPlaced('sell', instrument.symbol, instrument.last, this.globalDict.quantity || 75, instrument.token);
            }

            // Calculate and log P&L
            // const pnL = instrument.last - instrument.buyPrice;

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
        this.dropObserved = false;
        this.mtmHit = false;
        // Reset instruments
        this.halfdrop_instrument = null;
        this.other_instrument = null;
        this.mainToken = null;
        this.oppToken = null;
        this.mtmAssisstedTarget = 0;
        this.lossAtFirst = 0;
        this.targetNet = false;
        this.third_bought = false;
        this.buyComplete = false;
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
            
            return { success: true, executedPrice};
        } catch (error) {
            this.strategyUtils.logStrategyError(`Exception while buying instrument: ${error.message}`);
            return { success: false, executedPrice: null };
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
            cycle: this.universalDict.cycles || 0
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
                default: 0.2,
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
            }
        };
    }

    readFromGlobalOutput() {
        const data = fs.readFileSync("output/global.txt", "utf8");
        return data;
    }

    writeToGlobalOutput(data) {
        let formatted_data = `${data}`;
        fs.writeFileSync("output/global.txt", formatted_data);
    }
}

module.exports = NewX2Strategy;

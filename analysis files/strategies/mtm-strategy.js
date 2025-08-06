const BaseStrategy = require('./base');

class MTMStrategy extends BaseStrategy {
    constructor() {
        super();
        this.name = 'MTM Strategy';
        this.description = 'Mark-to-Market strategy with peak detection and interim low tracking';
    }

    initialize(globalDict, universalDict, blockDict) {
        super.initialize(globalDict, universalDict, blockDict);
        
        // Initialize strategy-specific data structures
        this.universalDict.mtmStrategy = {
            cycles: 0,
            totalPnl: 0,
            skipBuy: false,
            interimLowReached: false,
            calcRefReached: false,
            refCapture: false,
            boughtSold: false,
            minusTen: false,
            interimLowDisabled: false,
            crefBuy: false,
            liveServer: false,
            endTime: null,
            expiry: 3, // Thursday
            strikeBase: 170,
            strikeDiff: 30,
            strikeLowest: 150
        };

        this.blockDict.mtmStrategy = {
            init: true,
            update: false,
            finalRef: false,
            ref3: false,
            diff10: false,
            nextCycle: false
        };

        this.globalDict.mtmStrategy = {
            instrumentMap: {},
            ceTokens: [],
            peTokens: [],
            observedTicks: [],
            mainToken: null,
            oppToken: null,
            boughtToken: null,
            oppBoughtToken: null,
            timestamp: null,
            cePlus3: false,
            pePlus3: false,
            finalRefFlag: false,
            mtmHigh: -Infinity,
            mtmLow: Infinity,
            bought1: { status: false, token: null },
            bought2: { status: false, token: null },
            boughtSold: false,
            boughtOppSold: false,
            realTradeCount: 0,
            currentPnl: 0,
            preBuyTime: null,
            mtmFirstOption: null
        };

        // Initialize dictionary parameters with default values
        const globalParams = this.getGlobalDictParameters();
        const universalParams = this.getUniversalDictParameters();

        // Set default values for globalDict parameters
        for (const [key, param] of Object.entries(globalParams)) {
            if (this.globalDict[key] === undefined) {
                this.globalDict[key] = param.default;
            }
        }

        // Set default values for universalDict parameters
        for (const [key, param] of Object.entries(universalParams)) {
            if (this.universalDict[key] === undefined) {
                this.universalDict[key] = param.default;
            }
        }

        this.setStrikeParameters();
    }

    setStrikeParameters() {
        const today = new Date().getDay();
        if (today === 3) { // Thursday
            this.universalDict.mtmStrategy.strikeBase = 85;
            this.universalDict.mtmStrategy.strikeDiff = 50;
            this.universalDict.mtmStrategy.strikeLowest = 75;
        } else if (today === 2) { // Wednesday
            this.universalDict.mtmStrategy.strikeBase = 165;
            this.universalDict.mtmStrategy.strikeDiff = 35;
            this.universalDict.mtmStrategy.strikeLowest = 150;
        } else {
            this.universalDict.mtmStrategy.strikeBase = 170;
            this.universalDict.mtmStrategy.strikeDiff = 30;
            this.universalDict.mtmStrategy.strikeLowest = 150;
        }
    }

    processTicks(ticks) {
        if (this.universalDict.enableLogging) {
            console.log(`RECEIVED TICKS: ${ticks.length}`);
        }

        // Check end of day
        if (this.getTimeLeftToTarget() <= 0 && this.universalDict.mtmStrategy.liveServer) {
            if (this.universalDict.enableLogging) {
                console.log('END OF DAY. EXITING.');
            }
            return;
        }

        if (this.blockDict.mtmStrategy.init) {
            this.handleInitialization(ticks);
        }

        if (this.blockDict.mtmStrategy.update) {
            this.handleUpdate(ticks);
        }

        if (this.blockDict.mtmStrategy.finalRef) {
            this.handleFinalRef(ticks);
        }

        if (this.blockDict.mtmStrategy.ref3) {
            this.handleRef3(ticks);
        }

        if (this.blockDict.mtmStrategy.diff10) {
            this.handleDiff10(ticks);
        }

        if (this.blockDict.mtmStrategy.nextCycle) {
            this.handleNextCycle();
        }
    }

    handleInitialization(ticks) {
        if (this.universalDict.enableLogging) {
            console.log("Inside INIT");
        }
        
        if (this.universalDict.mtmStrategy.cycles >= 1) {
            this.universalDict.mtmStrategy.skipBuy = true;
        }

        // Set strike parameters based on day of week
        this.setStrikeParameters();

        if (this.universalDict.enableLogging) {
            console.log(`RANGE: ${this.universalDict.mtmStrategy.strikeBase} - ${this.universalDict.mtmStrategy.strikeBase + this.universalDict.mtmStrategy.strikeDiff}`);
        }

        const acceptedTokens = [];
        const rejectedTokens = [];
        const sortedTicks = ticks.sort((a, b) => a.last_price - b.last_price);

        // Filter tokens based on strike range
        for (const tick of sortedTicks) {
            if (this.universalDict.mtmStrategy.strikeBase <= tick.last_price && 
                tick.last_price <= this.universalDict.mtmStrategy.strikeBase + this.universalDict.mtmStrategy.strikeDiff) {
                acceptedTokens.push(tick.instrument_token);
            } else {
                rejectedTokens.push(tick.instrument_token);
            }
        }

        // Separate CE and PE tokens
        this.globalDict.mtmStrategy.ceTokens = acceptedTokens.filter(token => 
            this.globalDict.strikePriceMap && this.globalDict.strikePriceMap[token] && 
            this.globalDict.strikePriceMap[token].instrument_type === 'CE'
        );
        this.globalDict.mtmStrategy.peTokens = acceptedTokens.filter(token => 
            this.globalDict.strikePriceMap && this.globalDict.strikePriceMap[token] && 
            this.globalDict.strikePriceMap[token].instrument_type === 'PE'
        );

        this.globalDict.mtmStrategy.observedTicks = acceptedTokens.sort((a, b) => {
            const aTick = ticks.find(t => t.instrument_token === a);
            const bTick = ticks.find(t => t.instrument_token === b);
            return aTick.last_price - bTick.last_price;
        });

        this.blockDict.mtmStrategy.init = false;
        this.blockDict.mtmStrategy.finalRef = true;
        this.blockDict.mtmStrategy.update = true;
    }

    handleUpdate(ticks) {
        if (this.universalDict.enableLogging) {
            console.log("Inside UPDATE");
        }

        const timestamp = this.universalDict.mtmStrategy.liveServer ? 
            new Date().toLocaleTimeString() : ticks[0]?.timeID || new Date().toLocaleTimeString();
        
        this.globalDict.mtmStrategy.timestamp = timestamp;

        for (const tick of ticks) {
            const token = tick.token.toString();
            
            if (!this.globalDict.mtmStrategy.instrumentMap[token]) {
                this.initializeInstrument(token, tick);
            } else {
                this.updateInstrument(token, tick);
            }
        }

        if (this.blockDict.mtmStrategy.finalRef && !this.globalDict.mtmStrategy.finalRefFlag) {
            if (this.universalDict.enableLogging) {
                console.log(`ENTRY TIME: ${timestamp}`);
            }
            this.globalDict.mtmStrategy.finalRefFlag = true;
            return;
        }
    }

    handleFinalRef(ticks) {
        if (this.universalDict.enableLogging) {
            console.log("Inside FINAL REF");
        }
        
        if (this.universalDict.mtmStrategy.interimLowReached && !this.universalDict.mtmStrategy.refCapture) {
            this.handleInterimLowCapture();
        } else if (this.universalDict.mtmStrategy.calcRefReached) {
            this.handleCalcRefCapture();
        }
    }

    handleRef3(ticks) {
        const mainToken = this.globalDict.mtmStrategy.mainToken;
        const oppToken = this.globalDict.mtmStrategy.oppToken;
        
        if (!mainToken || !oppToken) return;

        const mainLast = this.globalDict.mtmStrategy.instrumentMap[mainToken]?.last || 0;
        const oppLast = this.globalDict.mtmStrategy.instrumentMap[oppToken]?.last || 0;
        const mainRef = this.globalDict.mtmStrategy.instrumentMap[mainToken]?.calcRef || mainLast;
        const oppRef = this.globalDict.mtmStrategy.instrumentMap[oppToken]?.calcRef || oppLast;
        
        const mainChange = mainLast - mainRef;
        const oppChange = oppLast - oppRef;

        if ((mainChange >= 0 || oppChange >= 0) && !this.universalDict.mtmStrategy.refCapture) {
            this.handleRefCapture();
        }
    }

    handleDiff10(ticks) {
        if (this.universalDict.enableLogging) {
            console.log("Inside DIFF 10");
        }

        const mainToken = this.globalDict.mtmStrategy.boughtToken;
        const oppToken = this.globalDict.mtmStrategy.oppBoughtToken;

        if (!mainToken || !oppToken) return;

        const mainInstrument = this.globalDict.mtmStrategy.instrumentMap[mainToken];
        const oppInstrument = this.globalDict.mtmStrategy.instrumentMap[oppToken];

        if (!mainInstrument || !oppInstrument) return;

        const mtm = (mainInstrument.last + oppInstrument.last) - (mainInstrument.buy_price + oppInstrument.buy_price);
        
        this.updateMTMHighLow(mtm);

        if (mtm >= this.globalDict.target || mtm <= this.globalDict.stoploss) {
            this.handleSellSignal(mainInstrument, oppInstrument, mtm);
        }

        if (this.globalDict.mtmStrategy.boughtSold) {
            this.blockDict.mtmStrategy.diff10 = false;
            this.blockDict.mtmStrategy.nextCycle = true;
            this.universalDict.mtmStrategy.minusTen = true;
            this.universalDict.mtmStrategy.cycles++;
        }
    }

    handleNextCycle() {
        if (this.universalDict.enableLogging) {
            console.log("Inside NEXT CYCLE");
        }
        
        if (this.universalDict.mtmStrategy.minusTen) {
            this.resetForNextCycle();
        }
    }

    initializeInstrument(token, tick) {
        this.globalDict.mtmStrategy.instrumentMap[token] = {
            time: this.globalDict.mtmStrategy.timestamp,
            symbol: this.globalDict.strikePriceMap?.[token]?.tradingsymbol || `SYMBOL_${token}`,
            first_price: tick.last_price,
            last: tick.last_price,
            open: -1,
            peak: -1,
            prev_peak: -1,
            low_at_ref: -1,
            plus3: -1,
            change: -1,
            peakAtRef: -1,
            peakTime: null,
            peak2Time: null,
            buy_price: -1,
            peak_2: -1,
            change_from_buy: -1,
            calc_ref: -1,
            prev_calc_ref: -1,
            flag_plus3: false,
            flag_peakAndFall: false,
            flag_calcRef: false,
            flag_interim: false,
            higherStrikeToken: null,
            higherStrikeTokenOpen: -1,
            ref_price: -1,
            low_after_sl: -1,
            buy_at_sl: -1,
            high_after_buy: -1,
            low_after_buy: -1
        };
    }

    updateInstrument(token, tick) {
        const instrument = this.globalDict.mtmStrategy.instrumentMap[token];
        if (!instrument) return;
        
        instrument.time = this.globalDict.mtmStrategy.timestamp;
        instrument.plus3 = tick.last_price - instrument.first_price;
        instrument.change = tick.last_price - instrument.last;
        instrument.last = tick.last_price;

        // Update peak
        if (instrument.last > instrument.peak) {
            instrument.prev_peak = instrument.peak;
            instrument.peak = instrument.last;
            instrument.peakTime = this.globalDict.mtmStrategy.timestamp;
        }

        // Peak after buy
        if (instrument.peak_2 > -1) {
            if (instrument.last > instrument.peak_2) {
                instrument.peak_2 = instrument.last;
            }
        }

        // Check for plus3 signals
        this.checkPlus3Signal(token, instrument);
        
        // Check for peak and fall
        this.checkPeakAndFall(token, instrument);
        
        // Check for calc ref
        this.checkCalcRef(token, instrument);
        
        // Check for interim low
        this.checkInterimLow(token, instrument);
        
        // Update change from buy
        if (instrument.buy_price > -1) {
            instrument.change_from_buy = Math.round((instrument.last - instrument.buy_price) * 100000) / 100000;
        }

        // Update high/low after buy
        if (instrument.high_after_buy > -1) {
            if (instrument.last > instrument.high_after_buy) {
                instrument.high_after_buy = instrument.last;
            }
        }

        if (instrument.low_after_buy > -1) {
            if (instrument.last < instrument.low_after_buy) {
                instrument.low_after_buy = instrument.last;
            }
        }
    }

    checkPlus3Signal(token, instrument) {
        const isCE = this.globalDict.mtmStrategy.ceTokens.includes(parseInt(token));
        const isPE = this.globalDict.mtmStrategy.peTokens.includes(parseInt(token));
        
        if (isCE && !this.globalDict.mtmStrategy.cePlus3 && 
            !this.universalDict.mtmStrategy.interimLowReached && 
            !this.universalDict.mtmStrategy.calcRefReached) {
            
            if (instrument.plus3 >= this.globalDict.peakDef) {
                if (this.universalDict.enableLogging) {
                    console.log(`PLUS ${this.globalDict.peakDef}: ${instrument.symbol}`);
                }
                this.globalDict.mtmStrategy.cePlus3 = true;
                instrument.flag_plus3 = true;
                this.setMainOrOppToken(token);
            }
        }
        
        if (isPE && !this.globalDict.mtmStrategy.pePlus3 && 
            !this.universalDict.mtmStrategy.interimLowReached && 
            !this.universalDict.mtmStrategy.calcRefReached) {
            
            if (instrument.plus3 >= this.globalDict.peakDef) {
                if (this.universalDict.enableLogging) {
                    console.log(`PLUS ${this.globalDict.peakDef}: ${instrument.symbol}`);
                }
                this.globalDict.mtmStrategy.pePlus3 = true;
                instrument.flag_plus3 = true;
                this.setMainOrOppToken(token);
            }
        }
    }

    checkPeakAndFall(token, instrument) {
        if (instrument.flag_plus3 && 
            !this.universalDict.mtmStrategy.calcRefReached && 
            !this.universalDict.mtmStrategy.interimLowReached) {
            
            if (instrument.peak - instrument.last >= 2.5 && !instrument.flag_peakAndFall) {
                if (this.universalDict.enableLogging) {
                    console.log(`PEAK AND FALL by ${instrument.symbol}. PEAK: ${instrument.peak} LAST: ${instrument.last}`);
                }
                instrument.peakAtRef = instrument.peak;
                instrument.peakTime = this.globalDict.mtmStrategy.timestamp;
                instrument.flag_peakAndFall = true;
            }
        }
    }

    checkCalcRef(token, instrument) {
        if (instrument.flag_peakAndFall && !instrument.flag_calcRef) {
            if (instrument.calc_ref === -1) {
                instrument.low_at_ref = instrument.last;
                if (this.universalDict.enableLogging) {
                    console.log(`LOW AT REF FOR ${instrument.symbol} IS ${instrument.low_at_ref}`);
                }
            }
            
            // Calculate reference point (simplified)
            if (instrument.calc_ref === -1) {
                instrument.calc_ref = this.calculateRefPoint(instrument);
                if (this.universalDict.enableLogging) {
                    console.log(`CALCULATED REFERENCE FOR ${instrument.symbol} IS ${instrument.calc_ref}`);
                }
            }
        }
    }

    checkInterimLow(token, instrument) {
        if (instrument.low_at_ref > -1 && 
            !this.universalDict.mtmStrategy.interimLowReached && 
            !this.universalDict.mtmStrategy.calcRefReached) {
            
            if (instrument.low_at_ref > instrument.last) {
                instrument.low_at_ref = instrument.last;
                if (!this.universalDict.mtmStrategy.interimLowDisabled) {
                    if (this.universalDict.enableLogging) {
                        console.log(`NEW LOW AT REF: ${instrument.low_at_ref} FOR ${instrument.symbol}`);
                    }
                }
            }
            
            if (instrument.last - instrument.low_at_ref >= this.globalDict.upperLimit && 
                !this.universalDict.mtmStrategy.interimLowDisabled) {
                instrument.flag_interim = true;
                this.universalDict.mtmStrategy.interimLowReached = true;
                this.globalDict.mtmStrategy.mtmFirstOption = {
                    symbol: instrument.symbol,
                    token: token
                };
            }
        }
    }

    calculateRefPoint(instrument) {
        // Simplified reference point calculation
        return instrument.open > -1 ? instrument.open * 0.95 : instrument.first_price * 0.95;
    }

    setMainOrOppToken(token) {
        if (!this.globalDict.mtmStrategy.mainToken) {
            this.globalDict.mtmStrategy.mainToken = token;
        } else if (!this.globalDict.mtmStrategy.oppToken) {
            this.globalDict.mtmStrategy.oppToken = token;
        }
    }

    updateMTMHighLow(mtm) {
        if (mtm > this.globalDict.mtmStrategy.mtmHigh) {
            this.globalDict.mtmStrategy.mtmHigh = mtm;
        }
        if (mtm < this.globalDict.mtmStrategy.mtmLow) {
            this.globalDict.mtmStrategy.mtmLow = mtm;
        }
    }

    handleInterimLowCapture() {
        if (this.universalDict.enableLogging) {
            console.log("Handling interim low capture");
        }
        this.universalDict.mtmStrategy.refCapture = true;
        this.executeBuyOrders();
    }

    handleCalcRefCapture() {
        if (this.universalDict.enableLogging) {
            console.log("Handling calc ref capture");
        }
        this.universalDict.mtmStrategy.refCapture = true;
        this.executeBuyOrders();
    }

    handleRefCapture() {
        if (this.universalDict.enableLogging) {
            console.log("Handling ref capture");
        }
        this.universalDict.mtmStrategy.refCapture = true;
        this.executeBuyOrders();
    }

    executeBuyOrders() {
        const mainToken = this.globalDict.mtmStrategy.mainToken;
        const oppToken = this.globalDict.mtmStrategy.oppToken;
        
        if (!mainToken || !oppToken) return;

        // Set bought tokens
        this.globalDict.mtmStrategy.boughtToken = mainToken;
        this.globalDict.mtmStrategy.oppBoughtToken = oppToken;

        // Set buy prices
        const mainInstrument = this.globalDict.mtmStrategy.instrumentMap[mainToken];
        const oppInstrument = this.globalDict.mtmStrategy.instrumentMap[oppToken];

        if (mainInstrument && oppInstrument) {
            mainInstrument.buy_price = mainInstrument.last;
            oppInstrument.buy_price = oppInstrument.last;
            mainInstrument.peak_2 = mainInstrument.last;
            oppInstrument.peak_2 = oppInstrument.last;
            mainInstrument.high_after_buy = mainInstrument.last;
            oppInstrument.high_after_buy = oppInstrument.last;
            mainInstrument.low_after_buy = mainInstrument.last;
            oppInstrument.low_after_buy = oppInstrument.last;

            this.globalDict.mtmStrategy.preBuyTime = this.globalDict.mtmStrategy.timestamp;

            if (this.universalDict.enableLogging) {
                console.log(`BUYING ${mainInstrument.symbol} AT ${mainInstrument.last} AND ${oppInstrument.symbol} AT ${oppInstrument.last}`);
            }

            // Update PnL
            const totalCost = (mainInstrument.last + oppInstrument.last) * this.globalDict.quantity;
            this.universalDict.mtmStrategy.totalPnl -= totalCost;
            this.globalDict.mtmStrategy.currentPnl -= totalCost;
        }

        this.blockDict.mtmStrategy.finalRef = false;
        this.blockDict.mtmStrategy.ref3 = false;
        this.blockDict.mtmStrategy.diff10 = true;
    }

    handleSellSignal(mainInstrument, oppInstrument, mtm) {
        if (this.universalDict.enableLogging) {
            console.log(`SELLING ${mainInstrument.symbol} at ${mainInstrument.last} and ${oppInstrument.symbol} at ${oppInstrument.last} as MTM achieved of ${mtm}`);
        }
        
        this.globalDict.mtmStrategy.boughtSold = true;
        
        // Update PnL
        const totalRevenue = (mainInstrument.last + oppInstrument.last) * this.globalDict.quantity;
        this.universalDict.mtmStrategy.totalPnl += totalRevenue;
        this.globalDict.mtmStrategy.currentPnl += totalRevenue;

        if (this.universalDict.enableLogging) {
            console.log(`HIGH ACHIEVED BY ${mainInstrument.symbol}: ${mainInstrument.high_after_buy} and ${oppInstrument.symbol}: ${oppInstrument.high_after_buy}`);
            console.log(`LOW ACHIEVED BY ${mainInstrument.symbol}: ${mainInstrument.low_after_buy} and ${oppInstrument.symbol}: ${oppInstrument.low_after_buy}`);
            console.log(`MTM HIGH: ${this.globalDict.mtmStrategy.mtmHigh} and MTM LOW: ${this.globalDict.mtmStrategy.mtmLow}`);
        }
    }

    resetForNextCycle() {
        if (this.universalDict.enableLogging) {
            console.log("Resetting for next cycle");
        }
        
        this.universalDict.mtmStrategy.minusTen = false;
        this.universalDict.mtmStrategy.refCapture = false;
        this.universalDict.mtmStrategy.calcRefReached = false;
        this.universalDict.mtmStrategy.interimLowReached = false;
        this.universalDict.mtmStrategy.skipBuy = false;
        
        this.globalDict.mtmStrategy.finalRefFlag = false;
        this.globalDict.mtmStrategy.boughtSold = false;
        this.globalDict.mtmStrategy.cePlus3 = false;
        this.globalDict.mtmStrategy.pePlus3 = false;
        this.globalDict.mtmStrategy.mainToken = null;
        this.globalDict.mtmStrategy.oppToken = null;
        this.globalDict.mtmStrategy.boughtToken = null;
        this.globalDict.mtmStrategy.oppBoughtToken = null;
        this.globalDict.mtmStrategy.mtmHigh = -Infinity;
        this.globalDict.mtmStrategy.mtmLow = Infinity;
        this.globalDict.mtmStrategy.bought1 = { status: false, token: null };
        this.globalDict.mtmStrategy.bought2 = { status: false, token: null };
        this.globalDict.mtmStrategy.boughtSold = false;
        this.globalDict.mtmStrategy.boughtOppSold = false;
        this.globalDict.mtmStrategy.realTradeCount = 0;
        this.globalDict.mtmStrategy.currentPnl = 0;
        this.globalDict.mtmStrategy.preBuyTime = null;
        this.globalDict.mtmStrategy.mtmFirstOption = null;

        // Reset block states
        this.blockDict.mtmStrategy.init = true;
        this.blockDict.mtmStrategy.update = false;
        this.blockDict.mtmStrategy.finalRef = false;
        this.blockDict.mtmStrategy.ref3 = false;
        this.blockDict.mtmStrategy.diff10 = false;
        this.blockDict.mtmStrategy.nextCycle = false;

        // Clear instrument map
        this.globalDict.mtmStrategy.instrumentMap = {};
        this.globalDict.mtmStrategy.observedTicks = [];
        this.globalDict.mtmStrategy.ceTokens = [];
        this.globalDict.mtmStrategy.peTokens = [];
    }

    getTimeLeftToTarget() {
        if (!this.universalDict.mtmStrategy.endTime) return 0;
        const now = new Date();
        const endTime = new Date(this.universalDict.mtmStrategy.endTime);
        return Math.max(0, endTime - now);
    }

    getParameters() {
        return {};
    }

    getGlobalDictParameters() {
        return {
            maxInstruments: {
                type: 'integer',
                default: 100,
                min: 10,
                max: 500,
                description: 'Maximum number of instruments to track'
            },
            enableTracking: {
                type: 'boolean',
                default: true,
                description: 'Enable/disable instrument tracking'
            },
            strikePriceMap: {
                type: 'object',
                default: {},
                description: 'Map of strike prices and instrument details'
            },
            peakDef: {
                type: 'number',
                default: 3,
                min: 1,
                max: 10,
                description: 'Peak definition threshold'
            },
            upperLimit: {
                type: 'number',
                default: 3,
                min: 1,
                max: 10,
                description: 'Upper limit for interim low'
            },
            target: {
                type: 'number',
                default: 10,
                min: 1,
                max: 100,
                description: 'Target profit'
            },
            stoploss: {
                type: 'number',
                default: -10,
                min: -100,
                max: -1,
                description: 'Stop loss'
            },
            quantity: {
                type: 'number',
                default: 1,
                min: 1,
                max: 100,
                description: 'Trading quantity'
            }
        };
    }

    getUniversalDictParameters() {
        return {
            maxCycles: {
                type: 'integer',
                default: 50,
                min: 1,
                max: 200,
                description: 'Maximum number of trading cycles'
            },
            enableCycles: {
                type: 'boolean',
                default: true,
                description: 'Enable/disable cycle processing'
            },
            cycleTimeout: {
                type: 'integer',
                default: 300000,
                min: 60000,
                max: 1800000,
                description: 'Cycle timeout in milliseconds (5 minutes)'
            },
            enableAutoReset: {
                type: 'boolean',
                default: false,
                description: 'Enable automatic cycle reset'
            },
            enableLogging: {
                type: 'boolean',
                default: true,
                description: 'Enable console logging for strategy events'
            },
            autoReset: {
                type: 'boolean',
                default: false,
                description: 'Automatically reset strategy after each cycle'
            },
            strictMode: {
                type: 'boolean',
                default: true,
                description: 'Use strict mode for peak and fall detection'
            }
        };
    }
}

module.exports = MTMStrategy; 
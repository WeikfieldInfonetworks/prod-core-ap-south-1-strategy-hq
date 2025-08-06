const BaseStrategy = require('./base');
const TradingUtils = require('../trading-utils');

class BigWinStrategy extends BaseStrategy {
    constructor() {
        super();
        this.name = 'BigWinStrategy';
        this.description = 'BigWin strategy based on Python implementation with KiteConnect integration';
        this.tradingUtils = null;
    }

    initialize(globalDict, universalDict, blockDict, accessToken) {
        super.initialize(globalDict, universalDict, blockDict, accessToken);

        // Initialize universalDict with all required variables from Python
        this.universalDict = {
            cycles: 0,
            totalPnL: 0,
            skip_buy: 0,
            strike_price_map: {},
            strike_mode: false,
            liveServer: true,
            endTime: '15:30:00',
            expiry: 3, // Thursday = 3
            strikeBase: 90,
            strikeDiff: 35,
            have_bigwin: false,
            bigwin_tokens: [],
            bigwin_significant_peak: [],
            bigwin_ref_price_reached: false,
            bigwin_ref_sum: 0,
            bigwin_ref_sum_peak: 0,
            bigwin_buy_sum_peak: 0,
            bigwin_is_bought: false,
            interim_low_disabled: true,
            minus_ten: false
        };

        // Initialize globalDict with all required variables from Python
        this.globalDict = {
            instrumentMap: {},
            ce_tokens: [],
            pe_tokens: [],
            observedTicks: [],
            mainToken: null,
            oppToken: null,
            timestamp: '',
            quantity: 25,
            actual_target: 1000,
            Stoploss: 500,
            upper_limit: 0,
            lower_limit: 0,
            peak_def: 0,
            strike_price_map: {},
            bought_1: { status: false, token: null },
            bought_2: { status: false, token: null },
            bought_sold: false,
            current_pnl: 0,
            bigwin_ref_price_reached: false,
            bigwin_ref_sum: 0,
            bigwin_ref_sum_peak: 0,
            bigwin_buy_sum_peak: 0,
            bigwin_is_bought: false
        };

        // Initialize blockDict with state management
        this.blockDict = {
            init: true,
            update: true,
            finalRef: false,
            ref3: false,
            diff10: false,
            nextCycle: false
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

        // Initialize trading utils if API keys and access token are available
        if (process.env.API_KEY && process.env.SECRET_KEY && accessToken) {
            this.tradingUtils = new TradingUtils(process.env.API_KEY, process.env.SECRET_KEY);
            this.tradingUtils.initialize(accessToken).then(success => {
                if (success) {
                    console.log('Trading utils initialized successfully with access token');
                } else {
                    console.error('Failed to initialize trading utils with access token');
                }
            }).catch(error => {
                console.error('Error initializing trading utils:', error);
            });
        } else {
            console.warn('Trading utils not initialized: Missing API_KEY, SECRET_KEY, or ACCESS_TOKEN');
        }
    }

    processTicks(ticks) {
        console.log(`Received ${ticks.length} ticks`);

        // Check if end of day
        if (this.getTimeLeftToTarget() <= 0 && this.universalDict.liveServer) {
            console.log('END OF DAY. EXITING.');
            return;
        }

        // INIT Block Logic
        if (this.blockDict.init) {
            this.handleInitBlock(ticks);
        }

        // UPDATE Block Logic
        if (this.blockDict.update) {
            this.handleUpdateBlock(ticks);
        }

        // FINAL REF Block Logic
        if (this.blockDict.finalRef) {
            this.handleFinalRefBlock();
        }

        // DIFF 10 Block Logic
        if (this.blockDict.diff10) {
            this.handleDiff10Block();
        }
    }

    handleInitBlock(ticks) {
        console.log("Inside INIT");
        
        // Set timestamp
        const now = new Date();
        this.globalDict.timestamp = now.toTimeString().split(' ')[0];
        console.log(`ENTRY TIME: ${this.globalDict.timestamp}`);

        // Set cycle
        this.universalDict.cycles = this.universalDict.cycles || 0;
        
        // Adjust parameters based on cycle
        if (this.universalDict.cycles > 0) {
            this.universalDict.interim_low_disabled = false;
            this.globalDict.upper_limit = 3;
            this.globalDict.peak_def = 3;
        }

        // Set strike parameters based on day of week
        const dayOfWeek = now.getDay(); // 0=Sunday, 3=Wednesday
        if (dayOfWeek === parseInt(this.universalDict.expiry)) {
            this.universalDict.strikeBase = 80;
            this.universalDict.strikeDiff = 45;
        } else if (dayOfWeek === parseInt(this.universalDict.expiry) - 1) {
            this.universalDict.strikeBase = 85;
            this.universalDict.strikeDiff = 40;
        } else {
            this.universalDict.strikeBase = 90;
            this.universalDict.strikeDiff = 35;
        }

        console.log(`RANGE: ${this.universalDict.strikeBase} - ${this.universalDict.strikeBase + this.universalDict.strikeDiff}`);

        // Filter accepted tokens based on price range
        const sortedTicks = ticks.sort((a, b) => a.last_price - b.last_price);
        const acceptedTokens = [];
        const rejectedTokens = [];

        for (const tick of sortedTicks) {
            if (parseFloat(tick.last_price) >= this.universalDict.strikeBase && 
                parseFloat(tick.last_price) <= this.universalDict.strikeBase + this.universalDict.strikeDiff) {
                acceptedTokens.push(tick.instrument_token);
            } else {
                rejectedTokens.push(tick.instrument_token);
            }
        }

        // Separate CE and PE tokens
        this.globalDict.ce_tokens = acceptedTokens.filter(token => 
            this.globalDict.strike_price_map[token] && 
            this.globalDict.strike_price_map[token].instrument_type === 'CE'
        );
        this.globalDict.pe_tokens = acceptedTokens.filter(token => 
            this.globalDict.strike_price_map[token] && 
            this.globalDict.strike_price_map[token].instrument_type === 'PE'
        );

        // Set bigwin tokens if not already set
        if (!this.universalDict.have_bigwin && this.globalDict.ce_tokens.length > 0 && this.globalDict.pe_tokens.length > 0) {
            this.universalDict.bigwin_tokens = [
                this.globalDict.ce_tokens[0].toString(),
                this.globalDict.pe_tokens[0].toString()
            ];
            this.universalDict.have_bigwin = true;
        }

        if (this.universalDict.bigwin_tokens.length >= 2) {
            const ceSymbol = this.globalDict.strike_price_map[this.universalDict.bigwin_tokens[0]]?.tradingsymbol;
            const peSymbol = this.globalDict.strike_price_map[this.universalDict.bigwin_tokens[1]]?.tradingsymbol;
            console.log(`CE: ${ceSymbol} PE: ${peSymbol}`);
        }

        // Update block states
        this.blockDict.init = false;
        this.blockDict.finalRef = true;
    }

    handleUpdateBlock(ticks) {
        console.log("Inside UPDATE");
        
        // Set timestamp
        const now = new Date();
        this.globalDict.timestamp = now.toTimeString().split(' ')[0];

        for (const tick of ticks) {
            const token = tick.instrument_token.toString();
            
            // Initialize instrument map if not exists
            if (!this.globalDict.instrumentMap[token]) {
                this.globalDict.instrumentMap[token] = {
                    time: this.globalDict.timestamp,
                    symbol: this.globalDict.strike_price_map[token]?.tradingsymbol || '',
                    first_price: tick.last_price,
                    last: tick.last_price,
                    peak: -1,
                    prev_peak: -1,
                    peakTime: null,
                    buy_price: -1,
                    change_from_buy: -1,
                    ref_price: -1,
                    change_from_ref: -1,
                    first_price_flag: false
                };
                console.log(`Instrument Token: ${token} | Instrument Symbol: ${this.globalDict.instrumentMap[token].symbol} added to Instrument Data`);
            } else {
                // Update existing instrument data
                this.globalDict.instrumentMap[token].time = this.globalDict.timestamp;
                this.globalDict.instrumentMap[token].change = tick.last_price - this.globalDict.instrumentMap[token].last;
                this.globalDict.instrumentMap[token].last = tick.last_price;

                // Process bigwin tokens specifically
                if (this.universalDict.bigwin_tokens.includes(token)) {
                    if (!this.globalDict.instrumentMap[token].first_price_flag) {
                        this.globalDict.instrumentMap[token].first_price_flag = true;
                        console.log(`FIRST PRICE for ${this.globalDict.instrumentMap[token].symbol}: ${this.globalDict.instrumentMap[token].first_price} TIME: ${this.globalDict.timestamp}`);
                    }

                    // Check for new peak
                    if (this.globalDict.instrumentMap[token].last > this.globalDict.instrumentMap[token].peak) {
                        this.globalDict.instrumentMap[token].prev_peak = this.globalDict.instrumentMap[token].peak;
                        this.globalDict.instrumentMap[token].peak = this.globalDict.instrumentMap[token].last;
                        console.log(`NEW PEAK for ${this.globalDict.instrumentMap[token].symbol}: ${this.globalDict.instrumentMap[token].peak} TIME: ${this.globalDict.timestamp}`);
                        this.globalDict.instrumentMap[token].peakTime = this.globalDict.timestamp;
                    }

                    // Check for significant peak
                    if (this.globalDict.instrumentMap[token].peak - this.globalDict.instrumentMap[token].first_price >= 2.5 && 
                        !this.universalDict.bigwin_significant_peak.includes(token)) {
                        this.universalDict.bigwin_significant_peak.push(token);
                        console.log(`FIRST SIGNIFICANT PEAK for ${this.globalDict.instrumentMap[token].symbol}: ${this.globalDict.instrumentMap[token].peak} TIME: ${this.globalDict.timestamp}`);
                    }

                    // Update change from ref
                    if (this.globalDict.instrumentMap[token].ref_price !== -1) {
                        this.globalDict.instrumentMap[token].change_from_ref = this.globalDict.instrumentMap[token].last - this.globalDict.instrumentMap[token].ref_price;
                        console.log(`CHANGE FROM REF FOR ${this.globalDict.instrumentMap[token].symbol}: ${this.globalDict.instrumentMap[token].change_from_ref}`);
                    }

                    // Check for ref price reached (peak - 20)
                    if (this.globalDict.instrumentMap[token].peak - this.globalDict.instrumentMap[token].last >= 20 && 
                        !this.universalDict.bigwin_ref_price_reached && 
                        this.universalDict.bigwin_significant_peak.includes(token)) {
                        this.universalDict.bigwin_ref_price_reached = true;
                        const symbol = this.globalDict.instrumentMap[token].symbol.slice(-7);
                        
                        if (this.globalDict.instrumentMap[token].ref_price === -1) {
                            console.log(`REF POINT REACHED BY ${symbol} FROM ${this.globalDict.instrumentMap[token].peak} TO ${this.globalDict.instrumentMap[token].last} TIME: ${this.globalDict.timestamp}`);
                            this.globalDict.instrumentMap[token].ref_price = this.globalDict.instrumentMap[token].last;
                            
                            // Set ref price for other token
                            const otherToken = token === this.universalDict.bigwin_tokens[0] ? 
                                this.universalDict.bigwin_tokens[1] : this.universalDict.bigwin_tokens[0];
                            this.globalDict.instrumentMap[otherToken].ref_price = this.globalDict.instrumentMap[otherToken].last;
                            
                            const otherSymbol = this.globalDict.instrumentMap[otherToken].symbol.slice(-7);
                            console.log(`OTHER REF SYMBOL: ${otherSymbol} REF: ${this.globalDict.instrumentMap[otherToken].last} TIME: ${this.globalDict.timestamp}`);
                            
                            // Calculate ref sum
                            this.globalDict.bigwin_ref_sum = this.globalDict.instrumentMap[this.universalDict.bigwin_tokens[0]].last + 
                                                           this.globalDict.instrumentMap[this.universalDict.bigwin_tokens[1]].last;
                            console.log(`SUM OF REFS: ${this.globalDict.bigwin_ref_sum} TIME: ${this.globalDict.timestamp}`);
                            
                            if (this.globalDict.bigwin_ref_sum_peak <= 0) {
                                this.globalDict.bigwin_ref_sum_peak = this.globalDict.bigwin_ref_sum;
                            }
                        }
                    }
                }
            }
        }
    }

    handleFinalRefBlock() {
        console.log("INSIDE FINAL REF");
        
        if (this.universalDict.bigwin_ref_price_reached && this.universalDict.bigwin_tokens.length >= 2) {
            const ceToken = this.universalDict.bigwin_tokens[0];
            const peToken = this.universalDict.bigwin_tokens[1];
            const ceChange = this.globalDict.instrumentMap[ceToken].change_from_ref;
            const peChange = this.globalDict.instrumentMap[peToken].change_from_ref;
            
            const currentSum = this.globalDict.instrumentMap[ceToken].last + this.globalDict.instrumentMap[peToken].last;
            
            if (currentSum > this.globalDict.bigwin_ref_sum_peak) {
                this.globalDict.bigwin_ref_sum_peak = currentSum;
                console.log(`NEW SUM PEAK: ${this.globalDict.bigwin_ref_sum_peak} CE: ${this.globalDict.instrumentMap[ceToken].last} PE: ${this.globalDict.instrumentMap[peToken].last} TIME: ${this.globalDict.timestamp}`);
            }
            
            console.log(`CURRENT SUM: ${currentSum} CHANGE FROM BIGWIN SUM: ${currentSum - this.globalDict.bigwin_ref_sum}`);
            
            // Check if sum went up by 5 points
            if (currentSum - this.globalDict.bigwin_ref_sum >= 5) {
                this.globalDict.bigwin_is_bought = true;
                console.log(`REF SUM WENT PLUS 5. SUM VALUE: ${currentSum} TIME: ${this.globalDict.timestamp}`);
                
                if (this.globalDict.bigwin_buy_sum_peak <= 0) {
                    this.globalDict.bigwin_buy_sum_peak = currentSum;
                }
                
                const ceSymbol = this.globalDict.instrumentMap[ceToken].symbol;
                const peSymbol = this.globalDict.instrumentMap[peToken].symbol;
                
                this.globalDict.instrumentMap[ceToken].buy_price = this.globalDict.instrumentMap[ceToken].last;
                this.globalDict.instrumentMap[peToken].buy_price = this.globalDict.instrumentMap[peToken].last;
                
                // Place buy orders if trading utils available
                if (this.tradingUtils && this.tradingUtils.isAuthenticated) {
                    this.placeBuyOrders(ceSymbol, peSymbol, this.globalDict.quantity);
                }
                
                // Update tracking state
                this.globalDict.bought_1 = { status: true, token: ceToken };
                this.globalDict.bought_2 = { status: true, token: peToken };
                this.globalDict.bought_sold = false;
                
                console.log(`ACTUAL BUYING ${ceSymbol.slice(-7)}: ${this.globalDict.instrumentMap[ceToken].buy_price} and ${peSymbol.slice(-7)}: ${this.globalDict.instrumentMap[peToken].buy_price} TIME: ${this.globalDict.timestamp}`);
                
                this.blockDict.finalRef = false;
                this.blockDict.diff10 = true;
                
            } else if (ceChange <= -20 || peChange <= -20) {
                // Go to next cycle if either instrument went down 20 points
                if (ceChange <= -20) {
                    console.log(`CALL ${this.globalDict.instrumentMap[ceToken].symbol.slice(-7)} WENT DOWN 20 pts FURTHER. GOING TO NEXT CYCLE. LAST: ${this.globalDict.instrumentMap[ceToken].last} TIME: ${this.globalDict.timestamp}`);
                } else {
                    console.log(`PUT ${this.globalDict.instrumentMap[peToken].symbol.slice(-7)} WENT DOWN 20 pts FURTHER. GOING TO NEXT CYCLE. LAST: ${this.globalDict.instrumentMap[peToken].last} TIME: ${this.globalDict.timestamp}`);
                }
                
                this.blockDict.finalRef = false;
                this.blockDict.diff10 = true;
                this.globalDict.bought_sold = true;
            }
        }
    }

    handleDiff10Block() {
        console.log("Inside DIFF 10");
        
        if (this.universalDict.bigwin_tokens.length >= 2) {
            const ceToken = this.universalDict.bigwin_tokens[0];
            const peToken = this.universalDict.bigwin_tokens[1];
            
            const ceChange = this.globalDict.instrumentMap[ceToken].change_from_ref;
            const peChange = this.globalDict.instrumentMap[peToken].change_from_ref;
            
            const ceLast = this.globalDict.instrumentMap[ceToken].last;
            const peLast = this.globalDict.instrumentMap[peToken].last;
            
            const currentSum = ceLast + peLast;
            
            if (currentSum > this.globalDict.bigwin_buy_sum_peak && this.globalDict.bigwin_is_bought) {
                this.globalDict.bigwin_buy_sum_peak = currentSum;
                console.log(`PEAK MADE BY SUM AFTER BUY ${this.globalDict.bigwin_buy_sum_peak} CE: ${ceLast} PE: ${peLast} TIME: ${this.globalDict.timestamp}`);
            }
            
            // Check for -20 condition on either instrument
            if ((ceChange <= -20 || peChange <= -20) && !this.globalDict.bought_sold) {
                this.globalDict.bought_sold = true;
                
                const ceSymbol = this.globalDict.instrumentMap[ceToken].symbol;
                const peSymbol = this.globalDict.instrumentMap[peToken].symbol;
                
                const ceSellPrice = this.globalDict.instrumentMap[ceToken].last;
                const peSellPrice = this.globalDict.instrumentMap[peToken].last;
                
                console.log(`SELLING BOTH INSTRUMENTS - CE: ${ceSymbol.slice(-7)} at ${ceSellPrice} and PE: ${peSymbol.slice(-7)} at ${peSellPrice} TIME: ${this.globalDict.timestamp}`);
                
                // Place sell orders if trading utils available
                if (this.tradingUtils && this.tradingUtils.isAuthenticated) {
                    this.placeSellOrders(ceSymbol, peSymbol, this.globalDict.quantity);
                }
                
                // Log performance metrics
                const ceBuyPrice = this.globalDict.instrumentMap[ceToken].buy_price;
                const peBuyPrice = this.globalDict.instrumentMap[peToken].buy_price;
                console.log(`CE ${ceSymbol.slice(-7)} CHANGE FROM REF: ${ceChange} | PE ${peSymbol.slice(-7)} CHANGE FROM REF: ${peChange} TOTAL SUM: ${ceSellPrice + peSellPrice}`);
                console.log(`TOTAL GAIN: ${ceSellPrice + peSellPrice - (ceBuyPrice + peBuyPrice)}`);
                
                // Update PnL
                this.universalDict.totalPnL += (this.globalDict.quantity * (ceSellPrice + peSellPrice));
                this.globalDict.current_pnl += (this.globalDict.quantity * (ceSellPrice + peSellPrice));
            }
            
            if (this.globalDict.bought_sold) {
                // Move to next cycle
                this.nextCycle();
            }
        }
    }

    async placeBuyOrders(ceSymbol, peSymbol, quantity) {
        try {
            const cePrice = this.globalDict.instrumentMap[this.universalDict.bigwin_tokens[0]].last;
            const pePrice = this.globalDict.instrumentMap[this.universalDict.bigwin_tokens[1]].last;
            
            const ceOrderId = await this.tradingUtils.buyOrder(ceSymbol, quantity, cePrice);
            const peOrderId = await this.tradingUtils.buyOrder(peSymbol, quantity, pePrice);
            
            if (ceOrderId) {
                const ceHistory = await this.tradingUtils.getOrderHistory(ceOrderId);
                if (ceHistory && ceHistory.length > 0) {
                    const completedOrder = ceHistory.find(event => event.status === 'COMPLETE');
                    if (completedOrder) {
                        this.globalDict.instrumentMap[this.universalDict.bigwin_tokens[0]].buy_price = completedOrder.average_price;
                        console.log(`REAL TIME: ${this.globalDict.timestamp}, ACTUAL BUY PRICE FOR ${ceSymbol} is ${completedOrder.average_price}`);
                    }
                }
            }
            
            if (peOrderId) {
                const peHistory = await this.tradingUtils.getOrderHistory(peOrderId);
                if (peHistory && peHistory.length > 0) {
                    const completedOrder = peHistory.find(event => event.status === 'COMPLETE');
                    if (completedOrder) {
                        this.globalDict.instrumentMap[this.universalDict.bigwin_tokens[1]].buy_price = completedOrder.average_price;
                        console.log(`REAL TIME: ${this.globalDict.timestamp}, ACTUAL BUY PRICE FOR ${peSymbol} is ${completedOrder.average_price}`);
                    }
                }
            }
        } catch (error) {
            console.error('Error placing buy orders:', error);
        }
    }

    async placeSellOrders(ceSymbol, peSymbol, quantity) {
        try {
            const ceSellOrderId = await this.tradingUtils.marketSellOrder(ceSymbol, quantity);
            const peSellOrderId = await this.tradingUtils.marketSellOrder(peSymbol, quantity);
            
            if (ceSellOrderId) {
                const ceHistory = await this.tradingUtils.getOrderHistory(ceSellOrderId);
                if (ceHistory && ceHistory.length > 0) {
                    const completedOrder = ceHistory.find(event => event.status === 'COMPLETE');
                    if (completedOrder) {
                        console.log(`REAL TIME: ${this.globalDict.timestamp}, ACTUAL SELL PRICE FOR ${ceSymbol} is ${completedOrder.average_price}`);
                    }
                }
            }
            
            if (peSellOrderId) {
                const peHistory = await this.tradingUtils.getOrderHistory(peSellOrderId);
                if (peHistory && peHistory.length > 0) {
                    const completedOrder = peHistory.find(event => event.status === 'COMPLETE');
                    if (completedOrder) {
                        console.log(`REAL TIME: ${this.globalDict.timestamp}, ACTUAL SELL PRICE FOR ${peSymbol} is ${completedOrder.average_price}`);
                    }
                }
            }
        } catch (error) {
            console.error('Error placing sell orders:', error);
        }
    }

    nextCycle() {
        this.blockDict.diff10 = false;
        this.blockDict.nextCycle = true;
        this.universalDict.minus_ten = true;
        this.universalDict.cycles += 1;
        
        if (this.universalDict.bigwin_tokens.length >= 2) {
            const ceToken = this.universalDict.bigwin_tokens[0];
            const peToken = this.universalDict.bigwin_tokens[1];
            
            const ceSymbol = this.globalDict.instrumentMap[ceToken].symbol.slice(-7);
            const peSymbol = this.globalDict.instrumentMap[peToken].symbol.slice(-7);
            
            const ceLast = this.globalDict.instrumentMap[ceToken].last;
            const peLast = this.globalDict.instrumentMap[peToken].last;
            
            console.log(`PRICES BEFORE CYCLE CHANGE ${ceSymbol}: ${ceLast} | ${peSymbol}: ${peLast}`);
        }
        
        // Reset for next cycle
        this.universalDict.bigwin_tokens = [];
        this.universalDict.have_bigwin = false;
        this.universalDict.bigwin_significant_peak = [];
        this.universalDict.bigwin_ref_price_reached = false;
        this.globalDict.bigwin_ref_sum = 0;
        this.globalDict.bigwin_ref_sum_peak = 0;
        this.globalDict.bigwin_buy_sum_peak = 0;
        this.globalDict.bigwin_is_bought = false;
        this.globalDict.bought_1 = { status: false, token: null };
        this.globalDict.bought_2 = { status: false, token: null };
        this.globalDict.bought_sold = false;
        
        // Reset block states
        this.blockDict.init = true;
        this.blockDict.update = true;
        this.blockDict.finalRef = false;
        this.blockDict.diff10 = false;
        this.blockDict.nextCycle = false;
        
        console.log(`REAL TIME: ${this.globalDict.timestamp}, INITIALIZING CYCLE ${this.universalDict.cycles + 1}...`);
    }

    getTimeLeftToTarget() {
        const now = new Date();
        const targetTime = new Date();
        const [hours, minutes, seconds] = this.universalDict.endTime.split(':');
        targetTime.setHours(parseInt(hours), parseInt(minutes), parseInt(seconds), 0);
        
        if (now > targetTime) {
            targetTime.setDate(targetTime.getDate() + 1);
        }
        
        return targetTime.getTime() - now.getTime();
    }

    getParameters() {
        return {};
    }

    getGlobalDictParameters() {
        return {
            maxInstruments: {
                type: 'integer',
                default: 50,
                min: 10,
                max: 200,
                description: 'Maximum number of instruments to track'
            },
            enableTracking: {
                type: 'boolean',
                default: true,
                description: 'Enable/disable instrument tracking'
            },
            strike_mode: {
                type: 'boolean',
                default: false,
                description: 'Strike mode'
            },
            quantity: {
                type: 'integer',
                default: 25,
                min: 1,
                max: 1000,
                description: 'Trading quantity'
            }
        };
    }

    getUniversalDictParameters() {
        return {
            cycleLimit: {
                type: 'integer',
                default: 100,
                min: 1,
                max: 1000,
                description: 'Maximum number of cycles to process'
            },
            enableCycles: {
                type: 'boolean',
                default: true,
                description: 'Enable/disable cycle processing'
            },
            profitThreshold: {
                type: 'number',
                default: 1000,
                min: 0,
                max: 100000,
                description: 'Profit threshold for big win detection'
            },
            upper_limit: {
                type: 'number',
                default: 60,
                min: 0,
                max: 100,
                description: 'Upper limit for big win detection'
            },
            lower_limit: {
                type: 'number',
                default: 55,
                min: 0,
                max: 100,
                description: 'Lower limit for big win detection'
            },
            expiry: {
                type: 'integer',
                default: 3,
                min: 0,
                max: 6,
                description: 'Expiry day (0=Sunday, 3=Wednesday, etc.)'
            }
        };
    }
}

module.exports = BigWinStrategy;

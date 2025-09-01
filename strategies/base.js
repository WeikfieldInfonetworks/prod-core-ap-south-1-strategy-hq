/**
 * Abstract Base Strategy Class
 * All trading strategies must extend this class and implement required methods
 */
class BaseStrategy {
    constructor() {
        // Prevent direct instantiation of abstract class
        if (this.constructor === BaseStrategy) {
            throw new Error('BaseStrategy is an abstract class and cannot be instantiated directly');
        }
        
        // Ensure required methods are implemented
        this.validateRequiredMethods();
        
        // Common properties
        this.name = 'Base Strategy';
        this.description = 'Abstract base strategy class';
        this.globalDict = {};
        this.universalDict = {};
        this.blockDict = {};
        this.accessToken = null;
        
        // Socket.IO integration for real-time communication
        this.socketIo = null;
        this.userId = null;
        this.userName = null;
    }

    /**
     * Validate that all required methods are implemented
     * @throws {Error} If required methods are missing
     */
    validateRequiredMethods() {
        const requiredMethods = [
            'processTicks', 
            'getConfig',
            'getGlobalDictParameters',
            'getUniversalDictParameters'
        ];

        const missingMethods = requiredMethods.filter(method => 
            typeof this[method] !== 'function'
        );

        if (missingMethods.length > 0) {
            throw new Error(
                `Strategy ${this.constructor.name} must implement required methods: ${missingMethods.join(', ')}`
            );
        }
    }

    /**
     * Initialize strategy with dictionaries and access token
     * @param {Object} globalDict - Global parameters dictionary
     * @param {Object} universalDict - Universal parameters dictionary  
     * @param {Object} blockDict - Block-specific parameters dictionary
     * @param {string} accessToken - Trading API access token
     */
    initialize(globalDict, universalDict, blockDict, accessToken) {
        // Store references to dictionaries
        this.globalDict = globalDict || {};
        this.universalDict = universalDict || {};
        this.blockDict = blockDict || {};
        this.accessToken = accessToken;
        
        console.log(`✅ BaseStrategy initialized with ${Object.keys(this.globalDict).length} global, ${Object.keys(this.universalDict).length} universal, and ${Object.keys(this.blockDict).length} block parameters`);
    }

    /**
     * Set Socket.IO reference and user information for real-time communication
     * @param {Object} socketIo - Socket.IO server instance
     * @param {string} userId - User ID
     * @param {string} userName - User name
     */
    setSocketIo(socketIo, userId, userName) {
        console.log(`🔧 Setting Socket.IO for strategy ${this.name}`);
        console.log(`🔧 Socket.IO instance:`, socketIo ? 'Available' : 'Not Available');
        console.log(`🔧 User ID: ${userId}`);
        console.log(`🔧 User Name: ${userName}`);
        
        this.socketIo = socketIo;
        this.userId = userId;
        this.userName = userName;
        
        // Validate socket.io integration
        if (this.socketIo && this.userId) {
            console.log(`✅ Socket.IO integration enabled for strategy ${this.name} - User: ${userName} (${userId})`);
            
            // Test socket emission to verify it's working
            try {
                this.emitToUser('strategy_socket_test', {
                    message: 'Socket.IO integration test',
                    strategy: this.name,
                    testTimestamp: new Date().toISOString()
                });
                console.log(`✅ Socket.IO test emission successful for strategy ${this.name}`);
            } catch (error) {
                console.error(`❌ Socket.IO test emission failed for strategy ${this.name}:`, error);
            }
        } else {
            console.error(`❌ Socket.IO integration failed for strategy ${this.name}`);
            console.error(`❌ Socket.IO available: ${!!this.socketIo}`);
            console.error(`❌ User ID available: ${!!this.userId}`);
        }
    }

    /**
     * Emit real-time event to user's Socket.IO room
     * @param {string} event - Event name
     * @param {Object} data - Event data
     */
    emitToUser(event, data) {
        if (this.socketIo && this.userId) {
            try {
                const roomName = `user_${this.userId}`;
                const emitData = {
                    ...data,
                    strategy: this.name,
                    timestamp: new Date().toISOString(),
                    userId: this.userId
                };
                
                // Debug logging for socket emissions
                console.log(`📡 Emitting ${event} to room ${roomName} for user ${this.userId}`);
                console.log(`📡 Socket.IO instance: ${this.socketIo ? 'Available' : 'Not Available'}`);
                console.log(`📡 User ID: ${this.userId}`);
                console.log(`📡 Event data:`, JSON.stringify(emitData, null, 2));
                
                // Ensure we emit on the correct namespace (/live)
                const ioTarget = typeof this.socketIo.of === 'function' 
                    ? this.socketIo.of('/live') 
                    : this.socketIo;
                ioTarget.to(roomName).emit(event, emitData);
                
                // Verify emission was successful
                console.log(`✅ Successfully emitted ${event} to room ${roomName}`);
                
            } catch (error) {
                console.error(`❌ Error emitting ${event} to user ${this.userId}:`, error);
                console.error(`❌ Socket.IO instance:`, this.socketIo);
                console.error(`❌ User ID:`, this.userId);
            }
        } else {
            console.warn(`⚠️ Cannot emit ${event} - Socket.IO or user ID not set for strategy ${this.name}`);
            console.warn(`⚠️ Socket.IO available: ${!!this.socketIo}`);
            console.warn(`⚠️ User ID available: ${!!this.userId}`);
            console.warn(`⚠️ User ID value: ${this.userId}`);
        }
    }

    /**
     * Emit parameter update notification
     * @param {string} parameterType - 'global' or 'universal'
     * @param {string} parameter - Parameter name
     * @param {*} oldValue - Previous value
     * @param {*} newValue - New value
     */
    emitParameterUpdate(parameterType, parameter, oldValue, newValue) {
        this.emitToUser('strategy_parameter_updated', {
            parameterType,
            parameter,
            oldValue,
            newValue,
            success: true
        });
    }

    /**
     * Emit strategy status update
     * @param {string} status - Status message
     * @param {Object} additionalData - Additional data
     */
    emitStatusUpdate(status, additionalData = {}) {
        this.emitToUser('strategy_status_update', {
            status,
            ...additionalData
        });
    }

    /**
     * Emit trade action notification
     * @param {string} action - Trade action (buy, sell, etc.)
     * @param {Object} tradeData - Trade details
     */
    emitTradeAction(action, tradeData) {
        this.emitToUser('strategy_trade_action', {
            action,
            ...tradeData
        });
    }

    /**
     * Process incoming tick data
     * @param {Array} ticks - Array of tick objects
     * @abstract
     */
    processTicks(ticks) {
        throw new Error('processTicks() method must be implemented by subclass');
    }

    /**
     * Get strategy configuration
     * @returns {Object} Strategy configuration object
     * @abstract
     */
    getConfig() {
        throw new Error('getConfig() method must be implemented by subclass');
    }

    /**
     * Get global dictionary parameters definition
     * @returns {Object} Global parameters definition
     * @abstract
     */
    getGlobalDictParameters() {
        throw new Error('getGlobalDictParameters() method must be implemented by subclass');
    }

    /**
     * Get universal dictionary parameters definition
     * @returns {Object} Universal parameters definition
     * @abstract
     */
    getUniversalDictParameters() {
        throw new Error('getUniversalDictParameters() method must be implemented by subclass');
    }

    /**
     * Update global dictionary parameter
     * @param {string} parameter - Parameter name
     * @param {*} value - Parameter value
     * @returns {boolean} Success status
     */
    updateGlobalDictParameter(parameter, value) {
        if (this.globalDict.hasOwnProperty(parameter)) {
            const oldValue = this.globalDict[parameter];
            this.globalDict[parameter] = value;
            console.log(`✅ Updated globalDict.${parameter} = ${value}`);
            
            // Emit real-time parameter update notification
            this.emitParameterUpdate('global', parameter, oldValue, value);
            
            // Emit general status update
            this.emitStatusUpdate(`Global parameter ${parameter} updated to ${value}`, {
                parameterType: 'global',
                parameter,
                value
            });
            
            return true;
        } else {
            console.error(`❌ Parameter '${parameter}' not found in globalDict`);
            
            // Emit error notification
            this.emitToUser('strategy_parameter_error', {
                parameterType: 'global',
                parameter,
                error: `Parameter '${parameter}' not found in globalDict`,
                success: false
            });
            
            return false;
        }
    }

    /**
     * Update universal dictionary parameter
     * @param {string} parameter - Parameter name
     * @param {*} value - Parameter value
     * @returns {boolean} Success status
     */
    updateUniversalDictParameter(parameter, value) {
        if (this.universalDict.hasOwnProperty(parameter)) {
            const oldValue = this.universalDict[parameter];
            this.universalDict[parameter] = value;
            console.log(`✅ Updated universalDict.${parameter} = ${value}`);
            
            // Emit real-time parameter update notification
            this.emitParameterUpdate('universal', parameter, oldValue, value);
            
            // Emit general status update
            this.emitStatusUpdate(`Universal parameter ${parameter} updated to ${value}`, {
                parameterType: 'universal',
                parameter,
                value
            });
            
            return true;
        } else {
            console.error(`❌ Parameter '${parameter}' not found in universalDict`);
            
            // Emit error notification
            this.emitToUser('strategy_parameter_error', {
                parameterType: 'universal',
                parameter,
                error: `Parameter '${parameter}' not found in universalDict`,
                success: false
            });
            
            return false;
        }
    }

    /**
     * Get current strategy information
     * @returns {Object} Current strategy state
     */
    getCurrentStrategy() {
        return {
            name: this.name,
            description: this.description,
            hasActivePosition: this.hasActivePosition || false,
            buyPrice: this.buyPrice || null,
            buySymbol: this.buySymbol || null,
            cycleCount: this.cycleCount || 0,
            buyCompleted: this.buyCompleted || false,
            sellCompleted: this.sellCompleted || false
        };
    }

    /**
     * Get current dictionaries
     * @returns {Object} Current dictionaries state
     */
    getCurrentDictionaries() {
        return {
            globalDict: this.globalDict,
            universalDict: this.universalDict,
            blockDict: this.blockDict
        };
    }

    /**
     * Get available strategies (to be overridden by strategy manager)
     * @returns {Array} Available strategies
     */
    getAvailableStrategies() {
        return [];
    }

    /**
     * Set strategy (to be overridden by strategy manager)
     * @param {string} strategyName - Strategy name
     * @param {Object} globalDict - Global dictionary
     * @param {Object} universalDict - Universal dictionary
     * @param {Object} blockDict - Block dictionary
     * @returns {Object} Strategy configuration
     */
    setStrategy(strategyName, globalDict, universalDict, blockDict) {
        console.log(`🔧 Setting strategy: ${strategyName}`);
        return {
            name: strategyName,
            globalDict,
            universalDict,
            blockDict
        };
    }

    /**
     * Validate strategy implementation
     * @returns {boolean} Validation result
     */
    validateImplementation() {
        try {
            this.validateRequiredMethods();
            return true;
        } catch (error) {
            console.error('❌ Strategy validation failed:', error.message);
            return false;
        }
    }

    /**
     * Validate socket connectivity and emit test message
     * @returns {boolean} Whether socket is working properly
     */
    validateSocketConnectivity() {
        if (!this.socketIo || !this.userId) {
            console.warn(`⚠️ Socket validation failed - Socket.IO: ${!!this.socketIo}, User ID: ${!!this.userId}`);
            return false;
        }
        
        try {
            // Emit a test message to validate connectivity
            this.emitToUser('socket_connectivity_test', {
                message: 'Socket connectivity validation',
                timestamp: new Date().toISOString(),
                strategy: this.name
            });
            
            console.log(`✅ Socket connectivity validation successful for strategy ${this.name}`);
            return true;
        } catch (error) {
            console.error(`❌ Socket connectivity validation failed for strategy ${this.name}:`, error);
            return false;
        }
    }

    /**
     * Get socket status information
     * @returns {Object} Socket status information
     */
    getSocketStatus() {
        return {
            socketIoAvailable: !!this.socketIo,
            userId: this.userId,
            userName: this.userName,
            roomName: this.userId ? `user_${this.userId}` : null,
            strategy: this.name
        };
    }

    /**
     * Get strategy metadata
     * @returns {Object} Strategy metadata
     */
    getMetadata() {
        return {
            name: this.name,
            description: this.description,
            version: this.version || '1.0.0',
            author: this.author || 'Unknown',
            requiredMethods: [
                'initialize',
                'processTicks',
                'getConfig',
                'getGlobalDictParameters',
                'getUniversalDictParameters'
            ],
            optionalMethods: [
                'setUserInfo',
                'resetForNextCycle',
                'resetCycleForNewInstrument'
            ],
            socketStatus: this.getSocketStatus()
        };
    }
}

module.exports = BaseStrategy; 
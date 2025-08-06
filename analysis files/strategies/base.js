class BaseStrategy {
    constructor() {
        this.name = 'Base Strategy';
        this.description = 'Base strategy class that all strategies should extend';
    }

    initialize(globalDict, universalDict, blockDict, accessToken) {
        // Initialize strategy-specific variables
        this.globalDict = globalDict;
        this.universalDict = universalDict;
        this.blockDict = blockDict;
        this.accessToken = accessToken;

        // Store parameter definitions for easier access
        this.globalDictParameters = this.getGlobalDictParameters();
        this.universalDictParameters = this.getUniversalDictParameters();
    }

    processTicks(ticks) {
        // Base implementation - should be overridden by child classes
        for (const tick of ticks) {
            this.globalDict[tick.instrument_token] = tick.last_price;
        }
    }

    getConfig() {
        return {
            name: this.name,
            description: this.description,
            globalDictParameters: this.getGlobalDictParameters(),
            universalDictParameters: this.getUniversalDictParameters()
        };
    }

    getParameters() {
        // This method is deprecated - all parameters should be in dictionaries
        return {};
    }

    getGlobalDictParameters() {
        // Should be overridden by child classes to define which globalDict keys can be updated
        return {};
    }

    getUniversalDictParameters() {
        // Should be overridden by child classes to define which universalDict keys can be updated
        return {};
    }

    updateGlobalDictParameter(key, value) {
        if (this.globalDictParameters && this.globalDictParameters[key]) {
            const param = this.globalDictParameters[key];
            // Validate value based on parameter type
            if (this.validateParameterValue(value, param)) {
                this.globalDict[key] = this.convertValue(value, param.type);
                return true;
            }
        }
        return false;
    }

    updateUniversalDictParameter(key, value) {
        if (this.universalDictParameters && this.universalDictParameters[key]) {
            const param = this.universalDictParameters[key];
            // Validate value based on parameter type
            if (this.validateParameterValue(value, param)) {
                this.universalDict[key] = this.convertValue(value, param.type);
                return true;
            }
        }
        return false;
    }

    validateParameterValue(value, param) {
        if (param.type === 'number' || param.type === 'integer') {
            const numValue = parseFloat(value);
            if (isNaN(numValue)) return false;
            if (param.min !== undefined && numValue < param.min) return false;
            if (param.max !== undefined && numValue > param.max) return false;
        } else if (param.type === 'boolean') {
            if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') return false;
        }
        return true;
    }

    convertValue(value, type) {
        if (type === 'number') return parseFloat(value);
        if (type === 'integer') return Math.floor(parseFloat(value));
        if (type === 'boolean') return Boolean(value);
        return value;
    }
}

module.exports = BaseStrategy; 
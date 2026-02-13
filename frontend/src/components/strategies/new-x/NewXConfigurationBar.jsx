import React, { useState } from 'react';
import { useSocket } from '../../../contexts/SocketContext';
import { Settings, ChevronDown, ChevronUp, Save, RotateCcw } from 'lucide-react';

const NewXConfigurationBar = ({ strategy, onParameterUpdate }) => {
  const { updateGlobalParameter, updateUniversalParameter } = useSocket();
  const [isExpanded, setIsExpanded] = useState(false);
  const [pendingChanges, setPendingChanges] = useState({});
  const [localValues, setLocalValues] = useState({});

  const globalParams = strategy.globalDictParameters || {};
  const universalParams = strategy.universalDictParameters || {};

  const handleParameterChange = (type, paramName, value, paramType) => {
    // Store the raw value during editing - don't convert until update
    setLocalValues(prev => ({
      ...prev,
      [`${type}.${paramName}`]: value
    }));
  };

  const updateParameter = (type, paramName) => {
    const localValue = localValues[`${type}.${paramName}`];
    if (localValue !== undefined) {
      // Get parameter config to determine type
      const paramConfig = type === 'global' 
        ? globalParams[paramName] 
        : universalParams[paramName];
      
      // Convert value based on parameter type
      let convertedValue = localValue;
      if (paramConfig?.type === 'number') {
        convertedValue = parseFloat(localValue);
        if (isNaN(convertedValue)) {
          // If conversion fails, don't update
          return;
        }
      } else if (paramConfig?.type === 'boolean') {
        convertedValue = localValue === 'true' || localValue === true;
      }
      
      if (type === 'global') {
        updateGlobalParameter(paramName, convertedValue);
      } else {
        updateUniversalParameter(paramName, convertedValue);
      }
      
      // Notify parent component of parameter update
      if (onParameterUpdate) {
        onParameterUpdate(paramName, convertedValue);
      }
      
      // Keep the value in localValues to maintain persistence in the UI
      // The value will be updated in the strategy object via the socket update
      // and will be reflected in getCurrentValue when the strategy updates
    }
  };

  const updateParameterWithValue = (type, paramName, value) => {
    if (type === 'global') {
      updateGlobalParameter(paramName, value);
    } else {
      updateUniversalParameter(paramName, value);
    }
    if (onParameterUpdate) {
      onParameterUpdate(paramName, value);
    }
  };

  const resetParameter = (type, paramName) => {
    setLocalValues(prev => {
      const newLocalValues = { ...prev };
      delete newLocalValues[`${type}.${paramName}`];
      return newLocalValues;
    });
  };

  const applyChanges = () => {
    Object.values(pendingChanges).forEach(change => {
      if (change.type === 'global') {
        updateGlobalParameter(change.paramName, change.value);
      } else {
        updateUniversalParameter(change.paramName, change.value);
      }
    });
    setPendingChanges({});
  };

  const resetChanges = () => {
    setLocalValues({});
  };

  const getCurrentValue = (type, paramName) => {
    // Check for local changes first (during editing)
    const localKey = `${type}.${paramName}`;
    if (localValues[localKey] !== undefined) {
      return localValues[localKey];
    }
    
    // Get from strategy dictionaries (this will be updated via socket)
    const strategyValue = type === 'global' 
      ? strategy.globalDict?.[paramName] 
      : strategy.universalDict?.[paramName];
    
    if (strategyValue !== undefined) {
      return strategyValue;
    }
    
    // Fall back to default values from parameter configuration
    const paramConfig = type === 'global' 
      ? globalParams[paramName] 
      : universalParams[paramName];
    
    return paramConfig?.default !== undefined ? paramConfig.default : '';
  };

  const renderParameterInput = (type, paramName, paramConfig) => {
    const currentValue = getCurrentValue(type, paramName);
    const localKey = `${type}.${paramName}`;
    const localValue = localValues[localKey];
    const originalValue = type === 'global' 
      ? strategy.globalDict?.[paramName] 
      : strategy.universalDict?.[paramName];
    
    // Get the effective original value (strategy dict value or default)
    const effectiveOriginalValue = originalValue !== undefined 
      ? originalValue 
      : paramConfig?.default;
    
    // Check if there's a local change - any local value means user has modified it
    const hasLocalChange = localValue !== undefined;

    if (paramConfig.type === 'boolean') {
      const isOn = currentValue === true || currentValue === 'true';
      const handleToggle = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const newVal = !isOn;
        setLocalValues(prev => ({ ...prev, [localKey]: newVal }));
        updateParameterWithValue(type, paramName, newVal);
      };
      return (
        <div key={paramName} className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-medium text-gray-700 shrink-0">
              {paramName}
            </label>
            <button
              type="button"
              role="switch"
              aria-checked={isOn}
              onClick={handleToggle}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                isOn ? 'bg-green-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`pointer-events-none absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform ${
                  isOn ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          <p className="text-xs text-gray-500">{paramConfig.description}</p>
        </div>
      );
    }

    return (
      <div key={paramName} className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          <div className="flex items-center space-x-2">
            <span>{paramName}</span>
            {hasLocalChange && (
              <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 rounded-full">
                Modified
              </span>
            )}
          </div>
        </label>
        
        <div className="flex space-x-3">
          <input
            type={paramConfig.type === 'number' ? 'number' : 'text'}
            value={currentValue || ''}
            onChange={(e) => handleParameterChange(type, paramName, e.target.value, paramConfig.type)}
            className={`flex-1 px-3 py-2 text-sm border-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black transition-colors ${
              hasLocalChange 
                ? 'border-orange-400 bg-orange-50 ring-orange-200' 
                : 'border-gray-300 bg-white focus:border-blue-500'
            }`}
            step={paramConfig.type === 'number' ? 'any' : undefined}
          />
          
          {/* Update Button */}
          <button
            type="button"
            onClick={() => updateParameter(type, paramName)}
            disabled={!hasLocalChange}
            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              hasLocalChange
                ? 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Update
          </button>
          
          {/* Reset Button */}
          {hasLocalChange && (
            <button
              type="button"
              onClick={() => resetParameter(type, paramName)}
              className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Reset
            </button>
          )}
        </div>
        
        <p className="text-xs text-gray-500">{paramConfig.description}</p>
        
        {/* Show original value if modified */}
        {hasLocalChange && effectiveOriginalValue !== undefined && (
          <div className="flex items-center space-x-2 text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
            <span className="font-medium">Original:</span>
            <span className="font-mono">{String(effectiveOriginalValue)}</span>
            <span className="text-gray-400">→</span>
            <span className="font-medium">New:</span>
            <span className="font-mono text-orange-600">{String(localValue)}</span>
          </div>
        )}
      </div>
    );
  };

  const hasLocalChanges = Object.keys(localValues).length > 0;

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* Header */}
      <div 
        className="px-6 py-4 border-b bg-gray-50 cursor-pointer flex items-center justify-between"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-3">
          <Settings className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-medium text-gray-900">New X Strategy Configuration</h3>
          {hasLocalChanges && (
            <span className="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded-full">
              {Object.keys(localValues).length} local changes
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {hasLocalChanges && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                resetChanges();
              }}
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 flex items-center space-x-1"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Reset All</span>
            </button>
          )}
          
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-gray-600" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-600" />
          )}
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Global Parameters */}
            <div>
              <h4 className="text-md font-semibold text-gray-900 mb-4">Global Parameters</h4>
              <div className="space-y-4">
                {Object.entries(globalParams).map(([paramName, paramConfig]) =>
                  renderParameterInput('global', paramName, paramConfig)
                )}
              </div>
            </div>

            {/* Universal Parameters */}
            <div>
              <h4 className="text-md font-semibold text-gray-900 mb-4">Universal Parameters</h4>
              <div className="space-y-4">
                {Object.entries(universalParams).map(([paramName, paramConfig]) =>
                  renderParameterInput('universal', paramName, paramConfig)
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewXConfigurationBar;


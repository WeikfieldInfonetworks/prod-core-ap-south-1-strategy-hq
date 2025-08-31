import React, { useState } from 'react';
import { useSocket } from '../../../contexts/SocketContext';
import { Settings, ChevronDown, ChevronUp, Save, RotateCcw } from 'lucide-react';

const ConfigurationBar = ({ strategy }) => {
  const { updateGlobalParameter, updateUniversalParameter } = useSocket();
  const [isExpanded, setIsExpanded] = useState(false);
  const [pendingChanges, setPendingChanges] = useState({});

  const globalParams = strategy.globalDictParameters || {};
  const universalParams = strategy.universalDictParameters || {};

  const handleParameterChange = (type, paramName, value, paramType) => {
    // Convert value based on parameter type
    let convertedValue = value;
    if (paramType === 'number') {
      convertedValue = parseFloat(value) || 0;
    } else if (paramType === 'boolean') {
      convertedValue = value === 'true' || value === true;
    }

    // Store pending change
    setPendingChanges(prev => ({
      ...prev,
      [`${type}.${paramName}`]: {
        type,
        paramName,
        value: convertedValue,
        originalValue: type === 'global' 
          ? strategy.globalDict?.[paramName] 
          : strategy.universalDict?.[paramName]
      }
    }));
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
    setPendingChanges({});
  };

  const getCurrentValue = (type, paramName) => {
    const pendingKey = `${type}.${paramName}`;
    if (pendingChanges[pendingKey]) {
      return pendingChanges[pendingKey].value;
    }
    return type === 'global' 
      ? strategy.globalDict?.[paramName] 
      : strategy.universalDict?.[paramName];
  };

  const renderParameterInput = (type, paramName, paramConfig) => {
    const currentValue = getCurrentValue(type, paramName);
    const pendingKey = `${type}.${paramName}`;
    const hasPendingChange = pendingChanges[pendingKey];

    return (
      <div key={paramName} className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          {paramName}
          {hasPendingChange && (
            <span className="text-orange-600 text-xs ml-1">(modified)</span>
          )}
        </label>
        
        {paramConfig.type === 'boolean' ? (
          <select
            value={currentValue}
            onChange={(e) => handleParameterChange(type, paramName, e.target.value, paramConfig.type)}
            className={`block w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              hasPendingChange 
                ? 'border-orange-300 bg-orange-50' 
                : 'border-gray-300 bg-white'
            }`}
          >
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        ) : (
          <input
            type={paramConfig.type === 'number' ? 'number' : 'text'}
            value={currentValue || ''}
            onChange={(e) => handleParameterChange(type, paramName, e.target.value, paramConfig.type)}
            className={`block w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              hasPendingChange 
                ? 'border-orange-300 bg-orange-50' 
                : 'border-gray-300 bg-white'
            }`}
            step={paramConfig.type === 'number' ? 'any' : undefined}
          />
        )}
        
        <p className="text-xs text-gray-500">{paramConfig.description}</p>
      </div>
    );
  };

  const hasPendingChanges = Object.keys(pendingChanges).length > 0;

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* Header */}
      <div 
        className="px-6 py-4 border-b bg-gray-50 cursor-pointer flex items-center justify-between"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-3">
          <Settings className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-medium text-gray-900">Configuration Parameters</h3>
          {hasPendingChanges && (
            <span className="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded-full">
              {Object.keys(pendingChanges).length} pending changes
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {hasPendingChanges && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  resetChanges();
                }}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 flex items-center space-x-1"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Reset</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  applyChanges();
                }}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center space-x-1"
              >
                <Save className="h-4 w-4" />
                <span>Apply</span>
              </button>
            </>
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

export default ConfigurationBar;

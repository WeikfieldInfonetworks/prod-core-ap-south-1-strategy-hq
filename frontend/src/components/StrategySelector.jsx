import React from 'react';
import { ChevronDown, Target, TrendingUp } from 'lucide-react';

const StrategySelector = ({ strategies, currentStrategy, onStrategyChange }) => {
  // Debug logging
  console.log('StrategySelector props:', { strategies, currentStrategy });
  
  // Ensure strategies is an array and has valid data
  const validStrategies = Array.isArray(strategies) ? strategies : [];
  console.log('Valid strategies:', validStrategies);
  
  // Safety check: if no strategies, show message
  if (validStrategies.length === 0) {
    return (
      <div className="flex flex-col sm:flex-row items-start sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6">
        <div className="flex items-center space-x-3">
          <Target className="h-6 w-6 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Strategy Selection</h2>
        </div>
        
        <div className="flex-1 max-w-md">
          <div className="text-center py-8 text-gray-500">
            <p>No strategies available</p>
            <p className="text-sm">Please wait for strategy data to load...</p>
          </div>
        </div>
      </div>
    );
  }
  const getStrategyIcon = (strategyName) => {
    switch (strategyName) {
      case 'MTM V2 Strategy':
        return Target;
      default:
        return TrendingUp;
    }
  };

  const getStrategyDescription = (strategyName) => {
    switch (strategyName) {
      case 'MTM V2 Strategy':
        return 'Mark to Market strategy with interim low detection and dual option trading';
      default:
        return 'Trading strategy';
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-6">
      <div className="flex items-center space-x-3">
        <Target className="h-6 w-6 text-blue-600" />
        <h2 className="text-lg font-semibold text-gray-900">Strategy Selection</h2>
      </div>
      
      <div className="flex-1 max-w-md">
        <div className="relative">
          <select
            value={currentStrategy || ''}
            onChange={(e) => onStrategyChange(e.target.value)}
            className="block w-full pl-3 pr-10 py-3 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md appearance-none bg-white"
          >
            <option value="" disabled>
              Select a strategy...
            </option>
            {validStrategies.map((strategy, index) => {
              // Ensure strategy has a name property, fallback to index if not
              const strategyName = strategy?.name || `Strategy ${index + 1}`;
              
              // Additional safety check
              if (!strategy || typeof strategy !== 'object') {
                console.warn('Invalid strategy object at index', index, strategy);
                return null;
              }
              
              return (
                <option key={strategyName} value={strategyName}>
                  {strategyName}
                </option>
              );
            }).filter(Boolean)}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
            <ChevronDown className="h-5 w-5 text-gray-400" />
          </div>
        </div>
      </div>

      {currentStrategy && (
        <div className="flex items-center space-x-3 bg-blue-50 px-4 py-2 rounded-lg">
          {React.createElement(getStrategyIcon(currentStrategy), {
            className: "h-5 w-5 text-blue-600"
          })}
          <div className="flex flex-col">
            <span className="text-sm font-medium text-blue-900">{currentStrategy}</span>
            <span className="text-xs text-blue-600">
              {getStrategyDescription(currentStrategy)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default StrategySelector;

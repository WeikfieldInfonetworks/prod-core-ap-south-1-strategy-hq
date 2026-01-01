import React from 'react';
import { Calculator, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const SumTile = ({ instrumentData }) => {
  const formatPrice = (price) => {
    if (typeof price === 'string') return parseFloat(price).toFixed(2);
    else if (typeof price !== 'number') return '-.--';
    return parseFloat(price).toFixed(2);
  };

  const formatDiff = (diff) => {
    if (typeof diff !== 'number') return '-.--';
    const formatted = diff.toFixed(2);
    return diff > 0 ? `+${formatted}` : formatted;
  };

  const getDiffColor = (diff) => {
    if (typeof diff !== 'number' || diff === 0) return 'text-gray-600';
    return diff > 0 ? 'text-green-600' : 'text-red-600';
  };

  const getDiffIcon = (diff) => {
    if (typeof diff !== 'number' || diff === 0) return Minus;
    return diff > 0 ? TrendingUp : TrendingDown;
  };

  const getBackgroundColor = (diff) => {
    if (typeof diff !== 'number' || diff === 0) return 'bg-white';
    return diff > 0 ? 'bg-green-50' : 'bg-red-50';
  };

  const getBorderColor = (diff) => {
    if (typeof diff !== 'number' || diff === 0) return 'border-l-gray-300';
    return diff > 0 ? 'border-l-green-500' : 'border-l-red-500';
  };

  if (!instrumentData || !instrumentData.sum) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 border-2 border-dashed border-gray-200">
        <div className="text-center">
          <Calculator className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <div className="text-gray-400 mb-2">TOTAL POSITION</div>
          <div className="text-3xl text-gray-400 mb-1">-.--</div>
          <div className="text-xs text-gray-400">Waiting for instruments...</div>
        </div>
      </div>
    );
  }

  const { sum, tradingState } = instrumentData;
  const DiffIcon = getDiffIcon(sum.diff);
  const diffColor = getDiffColor(sum.diff);
  const showDiff = sum.buyPrice > 0;
  const bgColor = getBackgroundColor(sum.diff);
  const borderColor = getBorderColor(sum.diff);

  // Determine trading state for display
  const getTradingStateInfo = () => {
    if (!tradingState) return { text: 'ACTIVE', color: 'text-blue-600' };
    
    if (tradingState.bothSold) {
      return { text: 'COMPLETED', color: 'text-gray-600' };
    }
    if (tradingState.hasBuyBack) {
      return { text: 'BUY BACK ACTIVE', color: 'text-purple-600' };
    }
    if (tradingState.entry24Stage || tradingState.entry36Stage || tradingState.entryPlusStage) {
      return { text: 'PARTIAL EXIT', color: 'text-orange-600' };
    }
    return { text: 'ACTIVE', color: 'text-blue-600' };
  };

  const stateInfo = getTradingStateInfo();

  return (
    <div className={`${bgColor} rounded-lg shadow-sm hover:shadow-md transition-all duration-200 p-6 border-l-4 ${borderColor} relative`}>
      <div className="text-center">
        {/* Header */}
        <div className="flex items-center justify-center space-x-2 mb-3">
          <Calculator className="w-5 h-5 text-blue-600" />
          <span className="text-sm font-medium text-gray-700">TOTAL POSITION</span>
        </div>

        {/* Trading State Indicator */}
        <div className={`text-xs font-medium mb-2 ${stateInfo.color}`}>
          {stateInfo.text}
        </div>

        {/* Total LTP */}
        <div className="text-4xl font-bold text-gray-900 mb-2">
          ₹{formatPrice(sum.ltp)}
        </div>

        {/* Breakdown */}
        {instrumentData.boughtInstrument && instrumentData.oppInstrument && (
          <div className="text-xs text-gray-600 mb-4 font-mono">
            {formatPrice(instrumentData.boughtInstrument.ltp)} + {formatPrice(instrumentData.oppInstrument.ltp)}
          </div>
        )}

        {/* Buy Back Indicator */}
        {tradingState?.hasBuyBack && (
          <div className="text-xs text-purple-600 mb-2 font-medium">
            ↻ Includes Buy Back Position
          </div>
        )}

        {/* Buy Price & Difference */}
        {showDiff && (
          <div className="space-y-3 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Total Buy Price:</span>
              <span className="font-medium">₹{formatPrice(sum.buyPrice)}</span>
            </div>
            
            <div className={`flex items-center justify-center space-x-2 ${diffColor}`}>
              <DiffIcon className="w-5 h-5" />
              <span className="font-bold text-2xl">
                ₹{formatDiff(sum.diff)}
              </span>
            </div>

            {/* Percentage */}
            {sum.buyPrice > 0 && (
              <div className={`text-sm ${diffColor}`}>
                ({((sum.diff / sum.buyPrice) * 100).toFixed(2)}%)
              </div>
            )}

            {/* Additional Info for Complex States */}
            {(tradingState?.entry24Stage || tradingState?.entry36Stage) && (
              <div className="text-xs text-gray-500 mt-2">
                Mixed: Fixed sell prices + Live prices
              </div>
            )}
          </div>
        )}

        {/* No Position Indicator */}
        {!showDiff && (
          <div className="pt-4 border-t border-gray-200">
            <span className="text-sm text-gray-500">No positions established</span>
          </div>
        )}
      </div>

      {/* Live indicator */}
      <div className="absolute top-3 right-3">
        <div className="flex items-center space-x-1">
          <div className={`w-2 h-2 rounded-full ${
            tradingState?.bothSold ? 'bg-gray-400' : 'bg-green-500 animate-pulse'
          }`}></div>
          <span className="text-xs text-gray-500">
            {tradingState?.bothSold ? 'FINAL' : 'LIVE'}
          </span>
        </div>
      </div>

      {/* Performance Indicator */}
      {showDiff && (
        <div className="absolute bottom-3 left-3">
          <div className={`
            px-2 py-1 text-xs font-medium rounded-full
            ${sum.diff > 0 
              ? 'bg-green-100 text-green-800' 
              : sum.diff < 0 
              ? 'bg-red-100 text-red-800' 
              : 'bg-gray-100 text-gray-800'}
          `}>
            {sum.diff > 0 ? 'PROFIT' : sum.diff < 0 ? 'LOSS' : 'BREAKEVEN'}
          </div>
        </div>
      )}
    </div>
  );
};

export default SumTile;

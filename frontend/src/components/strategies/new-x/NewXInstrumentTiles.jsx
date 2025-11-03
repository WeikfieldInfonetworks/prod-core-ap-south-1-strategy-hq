import React from 'react';
import { TrendingUp, TrendingDown, Minus, Target, DollarSign } from 'lucide-react';

const NewXInstrumentTiles = ({ strategy, instrumentData, currentDropThreshold }) => {
  const formatPrice = (price) => {
    if (typeof price !== 'number') return '-.--';
    return price.toFixed(2);
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

  // Helper function to get drop threshold dynamically
  const getDropThreshold = () => {
    return currentDropThreshold || 
           strategy.globalDict?.dropThreshold || 
           strategy.globalDictParameters?.dropThreshold?.default || 
           0.5;
  };

  const renderInstrumentTile = (instrument, title, type) => {
    if (!instrument) {
      return (
        <div className="bg-white rounded-lg shadow-sm p-6 border-2 border-dashed border-gray-200">
          <div className="text-center">
            <div className="text-gray-400 mb-2">{title}</div>
            <div className="text-2xl text-gray-400 mb-1">-.--</div>
            <div className="text-xs text-gray-400">Waiting for selection...</div>
          </div>
        </div>
      );
    }

    const DiffIcon = getDiffIcon(instrument.changeFromBuy || 0);
    const diffColor = getDiffColor(instrument.changeFromBuy || 0);
    const showDiff = instrument.buyPrice > 0;
    const isSold = instrument.isSold || false;
    const isActive = instrument.isActive !== false;

    // Determine tile styling based on state
    const getTileColor = () => {
      if (isSold && !isActive) return 'border-l-gray-400 bg-gray-50';
      return type === 'CE' ? 'border-l-green-500 bg-white' : 'border-l-red-500 bg-white';
    };

    const getStatusBadge = () => {
      if (isSold && !isActive) {
        return (
          <span className="px-2 py-1 text-xs font-bold bg-gray-200 text-gray-700 rounded-full">
            SOLD
          </span>
        );
      }
      return null;
    };

    const getLiveIndicatorColor = () => {
      if (isSold && !isActive) return 'bg-gray-400';
      return type === 'CE' ? 'bg-green-500' : 'bg-red-500';
    };

    return (
      <div className={`rounded-lg shadow-sm hover:shadow-md transition-all duration-200 p-6 border-l-4 ${getTileColor()}`}>
        <div className="text-center">
          {/* Instrument Type and Status */}
          <div className="flex items-center justify-center space-x-2 mb-3">
            <span className={`
              px-3 py-1 text-sm font-medium rounded-full
              ${type === 'CE' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'}
            `}>
              {type}
            </span>
            {getStatusBadge()}
          </div>

          {/* Current Price (LTP) */}
          <div className={`text-3xl font-bold mb-2 ${isSold && !isActive ? 'text-gray-600' : 'text-gray-900'}`}>
            ₹{formatPrice(instrument.last)}
          </div>

          {/* Instrument Name */}
          <div className={`text-xs mb-3 font-mono ${isSold && !isActive ? 'text-gray-500' : 'text-gray-600'}`}>
            {instrument.symbol}
          </div>

          {/* Buy Price & Difference */}
          {showDiff && (
            <div className="space-y-2 pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Buy Price:</span>
                <span className="font-medium">₹{formatPrice(instrument.buyPrice)}</span>
              </div>
              
              <div className={`flex items-center justify-center space-x-1 ${diffColor}`}>
                <DiffIcon className="w-4 h-4" />
                <span className="font-semibold text-lg">
                  ₹{formatDiff(instrument.changeFromBuy || 0)}
                </span>
              </div>

              {/* Sold Price Indicator */}
              {isSold && !isActive && (
                <div className="text-xs text-gray-500 mt-2">
                  Sold at: ₹{formatPrice(instrument.last)}
                </div>
              )}
            </div>
          )}

          {/* No Position Indicator */}
          {!showDiff && (
            <div className="pt-3 border-t border-gray-100">
              <span className="text-xs text-gray-500">No position yet</span>
            </div>
          )}
        </div>

        {/* Live/Status indicator */}
        <div className="absolute top-2 right-2">
          <div className={`w-2 h-2 rounded-full ${
            isSold && !isActive ? '' : 'animate-pulse'
          } ${getLiveIndicatorColor()}`}></div>
        </div>
      </div>
    );
  };

  // Extract instruments from strategy data
  const halfdropInstrument = strategy.halfdrop_instrument;
  const otherInstrument = strategy.other_instrument;
  const mainToken = strategy.mainToken;
  const oppToken = strategy.oppToken;

  // Get instrument data from universalDict
  const instrumentMap = strategy.universalDict?.instrumentMap || {};
  const mainInstrument = mainToken ? instrumentMap[mainToken] : null;
  const oppInstrument = oppToken ? instrumentMap[oppToken] : null;

  // Determine which is CE and which is PE
  const ceInstrument = mainInstrument || halfdropInstrument;
  const peInstrument = oppInstrument || otherInstrument;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Dual Instrument Trading</h3>
          <div className="text-sm text-gray-500">
            Drop Threshold: {(getDropThreshold() * 100).toFixed(0)}% | 
            Target: {strategy.globalDict?.target || 9} pts
          </div>
        </div>
      </div>

      {/* Instrument Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Put Option Tile */}
        <div className="relative">
          {renderInstrumentTile(peInstrument, 'PUT (PE)', 'PE')}
        </div>

        {/* Call Option Tile */}
        <div className="relative">
          {renderInstrumentTile(ceInstrument, 'CALL (CE)', 'CE')}
        </div>
      </div>

      {/* MTM Summary */}
      {(ceInstrument?.buyPrice > 0 || peInstrument?.buyPrice > 0) && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <DollarSign className="w-5 h-5 mr-2" />
            Portfolio Summary
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-sm text-blue-600 font-medium">Current MTM</div>
              <div className="text-2xl font-bold text-blue-800">
                ₹{formatDiff((ceInstrument?.changeFromBuy || 0) + (peInstrument?.changeFromBuy || 0))}
              </div>
            </div>
            
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-sm text-green-600 font-medium">Target</div>
              <div className="text-2xl font-bold text-green-800">
                {strategy.globalDict?.target || 9} pts
              </div>
            </div>
            
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="text-sm text-orange-600 font-medium">Second Target</div>
              <div className="text-2xl font-bold text-orange-800">
                {strategy.globalDict?.secondTarget || 25} pts
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewXInstrumentTiles;


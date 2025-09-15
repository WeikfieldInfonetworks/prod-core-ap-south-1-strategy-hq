import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const InstrumentTiles = ({ instrumentData }) => {
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

  const renderInstrumentTile = (instrument, title) => {
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

    const DiffIcon = getDiffIcon(instrument.diff);
    const diffColor = getDiffColor(instrument.diff);
    const showDiff = instrument.buyPrice > 0;
    const isSold = instrument.isSold || false;
    const isBuyBack = instrument.isBuyBack || false;
    const isActive = instrument.isActive !== false; // Default to true if not specified

    // Determine tile styling based on state
    const getTileColor = () => {
      if (isSold && !isActive) return 'border-l-gray-400 bg-gray-50'; // Sold and inactive
      if (isBuyBack) return 'border-l-purple-500 bg-purple-50'; // Buy back instrument
      return 'border-l-blue-500 bg-white'; // Active original instrument
    };

    const getStatusBadge = () => {
      if (isBuyBack) {
        return (
          <span className="px-2 py-1 text-xs font-bold bg-purple-200 text-purple-800 rounded-full">
            BUY BACK
          </span>
        );
      }
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
      if (isSold && !isActive) return 'bg-gray-400'; // Gray for sold
      if (isBuyBack) return 'bg-purple-500'; // Purple for buy back
      return 'bg-green-500'; // Green for active
    };

    return (
      <div className={`rounded-lg shadow-sm hover:shadow-md transition-all duration-200 p-6 border-l-4 ${getTileColor()}`}>
        <div className="text-center">
          {/* Instrument Type and Status */}
          <div className="flex items-center justify-center space-x-2 mb-3">
            <span className={`
              px-3 py-1 text-sm font-medium rounded-full
              ${instrument.type === 'CE' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'}
            `}>
              {instrument.type}
            </span>
            {getStatusBadge()}
          </div>

          {/* Current Price (LTP) */}
          <div className={`text-3xl font-bold mb-2 ${isSold && !isActive ? 'text-gray-600' : 'text-gray-900'}`}>
            ₹{formatPrice(instrument.ltp)}
          </div>

          {/* Instrument Name */}
          <div className={`text-xs mb-3 font-mono ${isSold && !isActive ? 'text-gray-500' : 'text-gray-600'}`}>
            {instrument.displayName}
          </div>

          {/* Buy Back Indicator */}
          {isBuyBack && (
            <div className="text-xs text-purple-600 mb-2 font-medium">
              ↻ Replacement Instrument
            </div>
          )}

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
                  ₹{formatDiff(instrument.diff)}
                </span>
              </div>

              {/* Sold Price Indicator */}
              {isSold && !isActive && (
                <div className="text-xs text-gray-500 mt-2">
                  Sold at: ₹{formatPrice(instrument.ltp)}
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

  // Extract instruments from data
  const boughtInstrument = instrumentData?.boughtInstrument;
  const oppInstrument = instrumentData?.oppInstrument;

  return (
    <>
      {/* Put Option Tile */}
      <div className="relative">
        {renderInstrumentTile(
          boughtInstrument?.type === 'PE' ? boughtInstrument : 
          oppInstrument?.type === 'PE' ? oppInstrument : null,
          'PUT (PE)'
        )}
      </div>

      {/* Call Option Tile */}
      <div className="relative">
        {renderInstrumentTile(
          boughtInstrument?.type === 'CE' ? boughtInstrument : 
          oppInstrument?.type === 'CE' ? oppInstrument : null,
          'CALL (CE)'
        )}
      </div>
    </>
  );
};

export default InstrumentTiles;

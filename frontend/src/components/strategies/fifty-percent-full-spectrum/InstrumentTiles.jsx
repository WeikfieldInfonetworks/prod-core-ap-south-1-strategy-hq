import React from 'react';
import { TrendingUp, TrendingDown, Target, AlertTriangle, Clock, DollarSign } from 'lucide-react';

const InstrumentTiles = ({ strategy, instrumentData, currentDropThreshold }) => {
  if (!strategy) return null;

  // Helper function to get drop threshold with multiple fallbacks
  const getDropThreshold = () => {
    const threshold = currentDropThreshold || 
                     strategy?.globalDict?.dropThreshold || 
                     strategy?.globalDictParameters?.dropThreshold?.default ||
                     0.5; // Default fallback
    
    return (threshold * 100).toFixed(0);
  };

  // Use instrumentData if available, otherwise fall back to strategy
  const instrumentMap = instrumentData?.instrumentMap || strategy.universalDict?.instrumentMap || {};
  
  // Get Full Spectrum specific data
  const halfdropFlag = instrumentData?.halfdrop_flag !== undefined ? instrumentData.halfdrop_flag : strategy.halfdrop_flag;
  const halfdropInstrument = instrumentData?.halfdrop_instrument || strategy.halfdrop_instrument;
  const mainToken = instrumentData?.mainToken || strategy.mainToken;
  const oppToken = instrumentData?.oppToken || strategy.oppToken;
  const stoplossHit = instrumentData?.stoplossHit !== undefined ? instrumentData.stoplossHit : strategy.stoplossHit;
  const instrumentBought = instrumentData?.instrument_bought || strategy.instrument_bought;
  const boughtSold = instrumentData?.boughtSold !== undefined ? instrumentData.boughtSold : strategy.boughtSold;
  const rebuyDone = instrumentData?.rebuyDone !== undefined ? instrumentData.rebuyDone : strategy.rebuyDone;
  const buyPriceOnce = instrumentData?.buyPriceOnce || strategy.buyPriceOnce;
  const buyPriceTwice = instrumentData?.buyPriceTwice || strategy.buyPriceTwice;
  
  // Get instrument data for display
  const getInstrumentData = (token) => {
    if (!token || !instrumentMap[token]) return null;
    return instrumentMap[token];
  };

  const formatPrice = (price) => {
    if (typeof price === 'string') return parseFloat(price).toFixed(2);
    else if (typeof price !== 'number') return '-.--';
    return parseFloat(price).toFixed(2);
  };

  const formatChange = (change) => {
    if (change === undefined || change === null || change === -1) return 'N/A';
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}`;
  };

  const getChangeColor = (change) => {
    if (change === undefined || change === null || change === -1) return 'text-gray-500';
    return change >= 0 ? 'text-green-600' : 'text-red-600';
  };

  const getChangeIcon = (change) => {
    if (change === undefined || change === null || change === -1) return null;
    return change >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />;
  };

  // Calculate P&L for an instrument
  const calculatePnL = (instrument) => {
    if (!instrument || instrument.buyPrice === -1 || instrument.last === -1) return 0;
    return (instrument.last - instrument.buyPrice) * (strategy.globalDict?.quantity || 75);
  };

  const getPnLColor = (pnl) => {
    if (pnl === 0) return 'text-gray-500';
    return pnl >= 0 ? 'text-green-600' : 'text-red-600';
  };

  return (
    <div className="space-y-4">
      {/* Half Drop Detection Status */}
      {halfdropInstrument && (
        <div className={`bg-white rounded-lg shadow-sm p-4 border-l-4 ${
          halfdropFlag ? 'border-red-500 bg-red-50' : 'border-orange-400'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <h4 className={`text-sm font-medium ${
              halfdropFlag ? 'text-red-900' : 'text-gray-900'
            }`}>
              {getDropThreshold()}% Drop Detection
              {halfdropFlag && (
                <span className="ml-2 px-2 py-1 text-xs font-bold bg-red-200 text-red-800 rounded-full animate-pulse">
                  TRIGGERED!
                </span>
              )}
            </h4>
            <AlertTriangle className={`h-4 w-4 ${
              halfdropFlag ? 'text-red-600 animate-pulse' : 'text-orange-500'
            }`} />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Instrument:</span>
              <span className="text-sm font-mono">{halfdropInstrument.symbol || 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Current Price:</span>
              <span className="text-sm font-mono">{formatPrice(halfdropInstrument.last)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">First Price:</span>
              <span className="text-sm font-mono">{formatPrice(halfdropInstrument.firstPrice)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Low at Ref:</span>
              <span className="text-sm font-mono">{formatPrice(halfdropInstrument.lowAtRef)}</span>
            </div>
            {halfdropFlag && halfdropInstrument.firstPrice && halfdropInstrument.lowAtRef && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Drop %:</span>
                <span className="text-sm font-mono font-bold text-red-600">
                  {((halfdropInstrument.lowAtRef / halfdropInstrument.firstPrice) * 100).toFixed(2)}%
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CE Token Tracking (mainToken) */}
      {mainToken && (
        <div className={`bg-white rounded-lg shadow-sm p-4 border-l-4 ${
          instrumentBought && instrumentBought.token === mainToken ? 'border-blue-600' : 
          stoplossHit ? 'border-yellow-400' : 'border-blue-200'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <h4 className={`text-sm font-medium ${
              instrumentBought && instrumentBought.token === mainToken ? 'text-blue-900' : 'text-gray-700'
            }`}>
              CE Token (Under 200)
              {instrumentBought && instrumentBought.token === mainToken && (
                <span className="ml-2 px-2 py-1 text-xs bg-blue-200 text-blue-800 rounded-full font-bold">
                  BOUGHT
                </span>
              )}
              {stoplossHit && !instrumentBought && (
                <span className="ml-2 px-2 py-1 text-xs bg-yellow-200 text-yellow-800 rounded-full">
                  MONITORING
                </span>
              )}
            </h4>
            <Target className={`h-4 w-4 ${
              instrumentBought && instrumentBought.token === mainToken ? 'text-blue-600' : 'text-blue-300'
            }`} />
          </div>
          {(() => {
            const instrument = getInstrumentData(mainToken);
            if (!instrument) return <div className="text-sm text-gray-500">Loading...</div>;
            
            const pnl = calculatePnL(instrument);
            const changeFromTracking = instrument.buyPrice !== -1 ? instrument.last - instrument.buyPrice : 0;
            
            return (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Symbol:</span>
                  <span className="text-sm font-mono">{instrument.symbol || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Current Price:</span>
                  <span className="text-sm font-mono">{formatPrice(instrument.last)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Tracking Price:</span>
                  <span className="text-sm font-mono">{formatPrice(instrument.buyPrice)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Change from Tracking:</span>
                  <div className={`flex items-center space-x-1 ${getChangeColor(changeFromTracking)}`}>
                    {getChangeIcon(changeFromTracking)}
                    <span className="text-sm font-mono">{formatChange(changeFromTracking)}</span>
                  </div>
                </div>
                {instrumentBought && instrumentBought.token === mainToken && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">P&L:</span>
                    <span className={`text-sm font-mono font-semibold ${getPnLColor(pnl)}`}>
                      {pnl.toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Peak:</span>
                  <span className="text-sm font-mono">{formatPrice(instrument.peak)}</span>
                </div>
                {/* Stoploss indicator */}
                {stoplossHit && changeFromTracking <= (strategy.globalDict?.prebuyStoploss || -15) && (
                  <div className="mt-2 p-2 bg-red-50 rounded border-l-2 border-red-400">
                    <div className="text-xs text-red-600 font-medium">
                      ⚠️ Stoploss Hit: {strategy.globalDict?.prebuyStoploss || -15} points
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* PE Token Tracking (oppToken) */}
      {oppToken && (
        <div className={`bg-white rounded-lg shadow-sm p-4 border-l-4 ${
          instrumentBought && instrumentBought.token === oppToken ? 'border-purple-600' : 
          stoplossHit ? 'border-yellow-400' : 'border-purple-200'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <h4 className={`text-sm font-medium ${
              instrumentBought && instrumentBought.token === oppToken ? 'text-purple-900' : 'text-gray-700'
            }`}>
              PE Token (Under 200)
              {instrumentBought && instrumentBought.token === oppToken && (
                <span className="ml-2 px-2 py-1 text-xs bg-purple-200 text-purple-800 rounded-full font-bold">
                  BOUGHT
                </span>
              )}
              {stoplossHit && !instrumentBought && (
                <span className="ml-2 px-2 py-1 text-xs bg-yellow-200 text-yellow-800 rounded-full">
                  MONITORING
                </span>
              )}
            </h4>
            <Target className={`h-4 w-4 ${
              instrumentBought && instrumentBought.token === oppToken ? 'text-purple-600' : 'text-purple-300'
            }`} />
          </div>
          {(() => {
            const instrument = getInstrumentData(oppToken);
            if (!instrument) return <div className="text-sm text-gray-500">Loading...</div>;
            
            const pnl = calculatePnL(instrument);
            const changeFromTracking = instrument.buyPrice !== -1 ? instrument.last - instrument.buyPrice : 0;
            
            return (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Symbol:</span>
                  <span className="text-sm font-mono">{instrument.symbol || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Current Price:</span>
                  <span className="text-sm font-mono">{formatPrice(instrument.last)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Tracking Price:</span>
                  <span className="text-sm font-mono">{formatPrice(instrument.buyPrice)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Change from Tracking:</span>
                  <div className={`flex items-center space-x-1 ${getChangeColor(changeFromTracking)}`}>
                    {getChangeIcon(changeFromTracking)}
                    <span className="text-sm font-mono">{formatChange(changeFromTracking)}</span>
                  </div>
                </div>
                {instrumentBought && instrumentBought.token === oppToken && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">P&L:</span>
                    <span className={`text-sm font-mono font-semibold ${getPnLColor(pnl)}`}>
                      {pnl.toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Peak:</span>
                  <span className="text-sm font-mono">{formatPrice(instrument.peak)}</span>
                </div>
                {/* Stoploss indicator */}
                {stoplossHit && changeFromTracking <= (strategy.globalDict?.prebuyStoploss || -15) && (
                  <div className="mt-2 p-2 bg-red-50 rounded border-l-2 border-red-400">
                    <div className="text-xs text-red-600 font-medium">
                      ⚠️ Stoploss Hit: {strategy.globalDict?.prebuyStoploss || -15} points
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Rebuy Information */}
      {rebuyDone && instrumentBought && (
        <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-orange-500 bg-orange-50">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-orange-900">
              Rebuy Information
              <span className="ml-2 px-2 py-1 text-xs font-bold bg-orange-200 text-orange-800 rounded-full">
                REBUY EXECUTED
              </span>
            </h4>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">First Buy Price:</span>
              <span className="text-sm font-mono">{formatPrice(buyPriceOnce)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Second Buy Price:</span>
              <span className="text-sm font-mono">{formatPrice(buyPriceTwice)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Average Buy Price:</span>
              <span className="text-sm font-mono font-semibold">
                {formatPrice((buyPriceOnce + buyPriceTwice) / 2)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Target Adjusted:</span>
              <span className="text-sm font-mono text-orange-600 font-bold">
                {(strategy.globalDict?.target || 12) / 2} points
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Quantity Doubled:</span>
              <span className="text-sm font-mono text-orange-600 font-bold">
                {(strategy.globalDict?.quantity || 75) * 2}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Target Achievement Status */}
      {instrumentBought && (
        <div className={`bg-white rounded-lg shadow-sm p-4 border-l-4 ${
          boughtSold ? 'border-green-500 bg-green-50' : 'border-blue-400'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <h4 className={`text-sm font-medium ${
              boughtSold ? 'text-green-900' : 'text-gray-900'
            }`}>
              Target Status
              {boughtSold && (
                <span className="ml-2 px-2 py-1 text-xs font-bold bg-green-200 text-green-800 rounded-full">
                  TARGET ACHIEVED!
                </span>
              )}
            </h4>
            <DollarSign className={`h-4 w-4 ${
              boughtSold ? 'text-green-600' : 'text-blue-500'
            }`} />
          </div>
          {(() => {
            const instrument = getInstrumentData(instrumentBought.token);
            if (!instrument) return <div className="text-sm text-gray-500">Loading...</div>;
            
            const changeFromBuy = instrument.last - instrument.buyPrice;
            const targetPoints = rebuyDone ? (strategy.globalDict?.target || 12) / 2 : (strategy.globalDict?.target || 12);
            const progress = (changeFromBuy / targetPoints * 100).toFixed(1);
            
            return (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Bought Instrument:</span>
                  <span className="text-sm font-mono">{instrument.symbol}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Target Points:</span>
                  <span className="text-sm font-mono">
                    {targetPoints}
                    {rebuyDone && (
                      <span className="ml-1 text-xs text-orange-600 font-bold">
                        (Adjusted)
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Current Progress:</span>
                  <div className={`flex items-center space-x-1 ${getChangeColor(changeFromBuy)}`}>
                    {getChangeIcon(changeFromBuy)}
                    <span className="text-sm font-mono">{formatChange(changeFromBuy)}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Progress %:</span>
                  <span className={`text-sm font-mono ${progress >= 100 ? 'text-green-600 font-bold' : rebuyDone ? 'text-orange-600' : 'text-gray-600'}`}>
                    {progress}%
                    {rebuyDone && progress < 100 && (
                      <span className="ml-1 text-xs text-orange-500">
                        (vs adjusted target)
                      </span>
                    )}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="mt-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        progress >= 100 ? 'bg-green-500' : 
                        rebuyDone ? 'bg-orange-500' : 
                        progress >= 50 ? 'bg-blue-500' : 'bg-yellow-500'
                      }`}
                      style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* No tracking active */}
      {!halfdropFlag && !mainToken && !oppToken && (
        <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-gray-300">
          <div className="text-center text-gray-500">
            <Clock className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm">Waiting for {getDropThreshold()}% drop detection...</p>
            <p className="text-xs mt-1">Monitoring instruments in 20-100 range</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default InstrumentTiles;

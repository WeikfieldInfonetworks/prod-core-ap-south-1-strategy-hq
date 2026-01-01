import React from 'react';
import { TrendingUp, TrendingDown, Target, AlertTriangle, Clock } from 'lucide-react';

const InstrumentTiles = ({ strategy, instrumentData }) => {
  if (!strategy) return null;

  // Use instrumentData if available, otherwise fall back to strategy
  const instrumentMap = instrumentData?.instrumentMap || strategy.universalDict?.instrumentMap || {};
  const ceTokens = instrumentData?.ceTokens || strategy.universalDict?.ceTokens || [];
  const peTokens = instrumentData?.peTokens || strategy.universalDict?.peTokens || [];
  
  // Get the main instruments being traded from instrumentData (real-time updates)
  const buyToken = instrumentData?.buyToken || strategy.buyToken;
  const oppBuyToken = instrumentData?.oppBuyToken || strategy.oppBuyToken;
  const halfdropInstrument = instrumentData?.halfdrop_instrument || strategy.halfdrop_instrument;
  const halfdropFlag = instrumentData?.halfdrop_flag !== undefined ? instrumentData.halfdrop_flag : strategy.halfdrop_flag;
  const halfdropBought = instrumentData?.halfdrop_bought !== undefined ? instrumentData.halfdrop_bought : strategy.halfdrop_bought;
  
  // Get chosen tokens for pre-purchase tracking
  const chosenCEToken = instrumentData?.chosenCEToken || (ceTokens.length > 0 ? ceTokens[0] : null);
  const chosenPEToken = instrumentData?.chosenPEToken || (peTokens.length > 0 ? peTokens[0] : null);
  
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
      {/* Half Drop Instrument */}
      {halfdropInstrument && (
        <div className={`bg-white rounded-lg shadow-sm p-4 border-l-4 ${
          halfdropFlag ? 'border-red-500 bg-red-50' : 'border-orange-400'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <h4 className={`text-sm font-medium ${
              halfdropFlag ? 'text-red-900' : 'text-gray-900'
            }`}>
              Half Drop Instrument
              {halfdropFlag && (
                <span className="ml-2 px-2 py-1 text-xs font-bold bg-red-200 text-red-800 rounded-full animate-pulse">
                  DETECTED!
                </span>
              )}
            </h4>
            <AlertTriangle className={`h-4 w-4 ${
              halfdropFlag ? 'text-red-600 animate-pulse' : 'text-orange-500'
            }`} />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Symbol:</span>
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
              <span className="text-xs text-gray-500">Change from First:</span>
              <div className={`flex items-center space-x-1 ${getChangeColor(halfdropInstrument.plus3)}`}>
                {getChangeIcon(halfdropInstrument.plus3)}
                <span className="text-sm font-mono">{formatChange(halfdropInstrument.plus3)}</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Low at Ref:</span>
              <span className="text-sm font-mono">{formatPrice(halfdropInstrument.lowAtRef)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Peak:</span>
              <span className="text-sm font-mono">{formatPrice(halfdropInstrument.peak)}</span>
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

      {/* CE Token - Show chosen token before purchase, bought token after purchase */}
      {(buyToken || chosenCEToken) && (
        <div className={`bg-white rounded-lg shadow-sm p-4 border-l-4 ${
          halfdropBought ? 'border-blue-400' : 'border-blue-200'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <h4 className={`text-sm font-medium ${
              halfdropBought ? 'text-gray-900' : 'text-gray-700'
            }`}>
              CE Token {halfdropBought ? '(Bought)' : '(Selected)'}
              {!halfdropBought && (
                <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
                  Monitoring
                </span>
              )}
            </h4>
            <Target className={`h-4 w-4 ${
              halfdropBought ? 'text-blue-500' : 'text-blue-300'
            }`} />
          </div>
          {(() => {
            const tokenToShow = buyToken || chosenCEToken;
            const instrument = getInstrumentData(tokenToShow);
            if (!instrument) return <div className="text-sm text-gray-500">Loading...</div>;
            
            const pnl = calculatePnL(instrument);
            
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
                {halfdropBought && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Buy Price:</span>
                      <span className="text-sm font-mono">{formatPrice(instrument.buyPrice)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Change from Buy:</span>
                      <div className={`flex items-center space-x-1 ${getChangeColor(instrument.changeFromBuy)}`}>
                        {getChangeIcon(instrument.changeFromBuy)}
                        <span className="text-sm font-mono">{formatChange(instrument.changeFromBuy)}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">P&L:</span>
                      <span className={`text-sm font-mono font-semibold ${getPnLColor(pnl)}`}>
                        {pnl.toFixed(2)}
                      </span>
                    </div>
                  </>
                )}
                {!halfdropBought && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">First Price:</span>
                      <span className="text-sm font-mono">{formatPrice(instrument.firstPrice)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Change from First:</span>
                      <div className={`flex items-center space-x-1 ${getChangeColor(instrument.plus3)}`}>
                        {getChangeIcon(instrument.plus3)}
                        <span className="text-sm font-mono">{formatChange(instrument.plus3)}</span>
                      </div>
                    </div>
                  </>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Peak:</span>
                  <span className="text-sm font-mono">{formatPrice(instrument.peak)}</span>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* PE Token - Show chosen token before purchase, bought token after purchase */}
      {(oppBuyToken || chosenPEToken) && (
        <div className={`bg-white rounded-lg shadow-sm p-4 border-l-4 ${
          halfdropBought ? 'border-purple-400' : 'border-purple-200'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <h4 className={`text-sm font-medium ${
              halfdropBought ? 'text-gray-900' : 'text-gray-700'
            }`}>
              PE Token {halfdropBought ? '(Bought)' : '(Selected)'}
              {!halfdropBought && (
                <span className="ml-2 px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-full">
                  Monitoring
                </span>
              )}
            </h4>
            <Target className={`h-4 w-4 ${
              halfdropBought ? 'text-purple-500' : 'text-purple-300'
            }`} />
          </div>
          {(() => {
            const tokenToShow = oppBuyToken || chosenPEToken;
            const instrument = getInstrumentData(tokenToShow);
            if (!instrument) return <div className="text-sm text-gray-500">Loading...</div>;
            
            const pnl = calculatePnL(instrument);
            
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
                {halfdropBought && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Buy Price:</span>
                      <span className="text-sm font-mono">{formatPrice(instrument.buyPrice)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Change from Buy:</span>
                      <div className={`flex items-center space-x-1 ${getChangeColor(instrument.changeFromBuy)}`}>
                        {getChangeIcon(instrument.changeFromBuy)}
                        <span className="text-sm font-mono">{formatChange(instrument.changeFromBuy)}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">P&L:</span>
                      <span className={`text-sm font-mono font-semibold ${getPnLColor(pnl)}`}>
                        {pnl.toFixed(2)}
                      </span>
                    </div>
                  </>
                )}
                {!halfdropBought && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">First Price:</span>
                      <span className="text-sm font-mono">{formatPrice(instrument.firstPrice)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Change from First:</span>
                      <div className={`flex items-center space-x-1 ${getChangeColor(instrument.plus3)}`}>
                        {getChangeIcon(instrument.plus3)}
                        <span className="text-sm font-mono">{formatChange(instrument.plus3)}</span>
                      </div>
                    </div>
                  </>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Peak:</span>
                  <span className="text-sm font-mono">{formatPrice(instrument.peak)}</span>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Buy Back Token (if applicable) */}
      {strategy.buyBackToken && (
        <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-green-400">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-900">Buy Back Token</h4>
            <Clock className="h-4 w-4 text-green-500" />
          </div>
          {(() => {
            const buyBackToken = instrumentData?.buyBackToken || strategy.buyBackToken;
            const instrument = getInstrumentData(buyBackToken);
            if (!instrument) return <div className="text-sm text-gray-500">Loading...</div>;
            
            const pnl = calculatePnL(instrument);
            const buyBackPrice = instrumentData?.buyBackPrice || strategy.buyBackPrice;
            const buyBackTarget = instrumentData?.buyBackTarget || strategy.buyBackTarget;
            
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
                  <span className="text-xs text-gray-500">Buy Price:</span>
                  <span className="text-sm font-mono">{formatPrice(buyBackPrice)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Target:</span>
                  <span className="text-sm font-mono">{formatPrice(buyBackTarget)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">P&L:</span>
                  <span className={`text-sm font-mono font-semibold ${getPnLColor(pnl)}`}>
                    {pnl.toFixed(2)}
                  </span>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* No instruments selected */}
      {!halfdropInstrument && !buyToken && !oppBuyToken && !chosenCEToken && !chosenPEToken && (
        <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-gray-300">
          <div className="text-center text-gray-500">
            <Clock className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm">Waiting for instrument selection...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default InstrumentTiles;

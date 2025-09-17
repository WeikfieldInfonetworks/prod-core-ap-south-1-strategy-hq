import React from 'react';
import { Activity, Clock, CheckCircle, XCircle, AlertTriangle, Target } from 'lucide-react';

const TradingTable = ({ strategy, instrumentData, tradingActions }) => {
  if (!strategy) return null;

  // Get Full Spectrum specific data
  const instrumentMap = instrumentData?.instrumentMap || strategy.universalDict?.instrumentMap || {};
  const halfdropFlag = instrumentData?.halfdrop_flag !== undefined ? instrumentData.halfdrop_flag : strategy.halfdrop_flag;
  const halfdropInstrument = instrumentData?.halfdrop_instrument || strategy.halfdrop_instrument;
  const stoplossHit = instrumentData?.stoplossHit !== undefined ? instrumentData.stoplossHit : strategy.stoplossHit;
  const instrumentBought = instrumentData?.instrument_bought || strategy.instrument_bought;
  const boughtSold = instrumentData?.boughtSold !== undefined ? instrumentData.boughtSold : strategy.boughtSold;
  const mainToken = instrumentData?.mainToken || strategy.mainToken;
  const oppToken = instrumentData?.oppToken || strategy.oppToken;

  const formatTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      return new Date(timestamp).toLocaleTimeString();
    } catch {
      return 'Invalid Time';
    }
  };

  const formatPrice = (price) => {
    if (price === undefined || price === null || price === -1) return 'N/A';
    return price.toFixed(2);
  };

  const getActionIcon = (action) => {
    switch (action?.toUpperCase()) {
      case 'BUY':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'SELL':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'HALF DROP':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'STOPLOSS':
        return <Target className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getActionColor = (action) => {
    switch (action?.toUpperCase()) {
      case 'BUY':
        return 'text-green-600 bg-green-50';
      case 'SELL':
        return 'text-red-600 bg-red-50';
      case 'HALF DROP':
        return 'text-orange-600 bg-orange-50';
      case 'STOPLOSS':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  // Create trading history from Full Spectrum strategy state
  const createTradingHistory = () => {
    const history = [];
    const quantity = strategy.globalDict?.quantity || 75;

    // Add half drop detection event
    if (halfdropFlag && halfdropInstrument) {
      const dropPercentage = halfdropInstrument.firstPrice && halfdropInstrument.lowAtRef 
        ? ((halfdropInstrument.lowAtRef / halfdropInstrument.firstPrice) * 100).toFixed(2)
        : 'N/A';
      
      history.push({
        id: `half-drop-${halfdropInstrument.symbol}`,
        action: 'HALF DROP',
        symbol: halfdropInstrument.symbol,
        price: halfdropInstrument.lowAtRef,
        quantity: 'N/A',
        timestamp: new Date().toISOString(),
        status: 'detected',
        type: `50% Drop (${dropPercentage}%)`
      });
    }

    // Add CE/PE tracking start
    if (stoplossHit && mainToken && oppToken) {
      const ceInstrument = instrumentMap[mainToken];
      const peInstrument = instrumentMap[oppToken];
      
      if (ceInstrument) {
        history.push({
          id: `tracking-ce-${mainToken}`,
          action: 'TRACKING',
          symbol: ceInstrument.symbol,
          price: ceInstrument.buyPrice,
          quantity: 'N/A',
          timestamp: new Date().toISOString(),
          status: 'active',
          type: 'CE Tracking Started'
        });
      }
      
      if (peInstrument) {
        history.push({
          id: `tracking-pe-${oppToken}`,
          action: 'TRACKING',
          symbol: peInstrument.symbol,
          price: peInstrument.buyPrice,
          quantity: 'N/A',
          timestamp: new Date().toISOString(),
          status: 'active',
          type: 'PE Tracking Started'
        });
      }
    }

    // Add stoploss hit event
    if (stoplossHit && instrumentBought) {
      const instrument = instrumentMap[instrumentBought.token];
      if (instrument) {
        const otherToken = instrumentBought.token === mainToken ? oppToken : mainToken;
        const otherInstrument = instrumentMap[otherToken];
        
        history.push({
          id: `stoploss-${otherInstrument?.symbol || 'unknown'}`,
          action: 'STOPLOSS',
          symbol: otherInstrument?.symbol || 'Unknown',
          price: otherInstrument?.last || 0,
          quantity: 'N/A',
          timestamp: new Date().toISOString(),
          status: 'detected',
          type: `Stoploss Hit (${strategy.globalDict?.prebuyStoploss || -15} points)`
        });
      }
    }

    // Add buy order
    if (instrumentBought) {
      const instrument = instrumentMap[instrumentBought.token];
      if (instrument) {
        history.push({
          id: `buy-${instrumentBought.token}`,
          action: 'BUY',
          symbol: instrument.symbol,
          price: instrument.buyPrice,
          quantity: quantity,
          timestamp: new Date().toISOString(),
          status: 'executed',
          type: `Opposite Token Buy (Target: ${strategy.globalDict?.target || 12})`
        });
      }
    }

    // Add sell order
    if (boughtSold && instrumentBought) {
      const instrument = instrumentMap[instrumentBought.token];
      if (instrument) {
        history.push({
          id: `sell-${instrumentBought.token}`,
          action: 'SELL',
          symbol: instrument.symbol,
          price: instrument.last,
          quantity: quantity,
          timestamp: new Date().toISOString(),
          status: 'executed',
          type: `Target Achieved (${strategy.globalDict?.target || 12} points)`
        });
      }
    }

    return history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  };

  const tradingHistory = createTradingHistory();
  const allActions = [...tradingHistory, ...(tradingActions || [])].sort((a, b) => 
    new Date(b.timestamp || b.time || 0) - new Date(a.timestamp || a.time || 0)
  );

  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Full Spectrum Trading History</h3>
        <p className="text-sm text-gray-600 mt-1">50% drop detection → CE/PE tracking → Opposite token purchase</p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Action
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Symbol
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Price
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Quantity
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {allActions.length > 0 ? (
              allActions.slice(0, 15).map((action, index) => (
                <tr key={action.id || index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getActionIcon(action.action)}
                      <span className={`ml-2 text-sm font-medium ${getActionColor(action.action)} px-2 py-1 rounded-full`}>
                        {action.action}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                    {action.symbol || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {action.type || 'Trade'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                    {formatPrice(action.price)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {action.quantity || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatTime(action.timestamp || action.time)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      action.status === 'executed' 
                        ? 'bg-green-100 text-green-800' 
                        : action.status === 'failed'
                        ? 'bg-red-100 text-red-800'
                        : action.status === 'detected'
                        ? 'bg-orange-100 text-orange-800'
                        : action.status === 'active'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {action.status === 'executed' ? (
                        <>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Executed
                        </>
                      ) : action.status === 'failed' ? (
                        <>
                          <XCircle className="h-3 w-3 mr-1" />
                          Failed
                        </>
                      ) : action.status === 'detected' ? (
                        <>
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Detected
                        </>
                      ) : action.status === 'active' ? (
                        <>
                          <Activity className="h-3 w-3 mr-1" />
                          Active
                        </>
                      ) : (
                        <>
                          <Clock className="h-3 w-3 mr-1" />
                          Pending
                        </>
                      )}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                  <Clock className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">No trading actions yet</p>
                  <p className="text-xs mt-1">Full Spectrum strategy execution will appear here</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Strategy Status Summary */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <div className="text-sm text-gray-600">50% Drop</div>
            <div className={`text-lg font-semibold ${halfdropFlag ? 'text-orange-600' : 'text-gray-400'}`}>
              {halfdropFlag ? 'Detected' : 'Monitoring'}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-600">CE/PE Tracking</div>
            <div className={`text-lg font-semibold ${stoplossHit ? 'text-blue-600' : 'text-gray-400'}`}>
              {stoplossHit ? 'Active' : 'Inactive'}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-600">Stoploss Hit</div>
            <div className={`text-lg font-semibold ${stoplossHit ? 'text-red-600' : 'text-gray-400'}`}>
              {stoplossHit ? 'Yes' : 'No'}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-600">Instrument Bought</div>
            <div className={`text-lg font-semibold ${instrumentBought ? 'text-green-600' : 'text-gray-400'}`}>
              {instrumentBought ? 'Yes' : 'No'}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-600">Target Achieved</div>
            <div className={`text-lg font-semibold ${boughtSold ? 'text-green-600' : 'text-gray-400'}`}>
              {boughtSold ? 'Yes' : 'No'}
            </div>
          </div>
        </div>

        {/* Current P&L Summary */}
        {instrumentBought && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="text-center">
              <div className="text-sm text-gray-600 mb-2">Current Position P&L</div>
              {(() => {
                const instrument = instrumentMap[instrumentBought.token];
                if (!instrument || instrument.buyPrice === -1) return null;
                
                const pnl = (instrument.last - instrument.buyPrice) * (strategy.globalDict?.quantity || 75);
                const pnlColor = pnl >= 0 ? 'text-green-600' : 'text-red-600';
                
                return (
                  <div className="flex items-center justify-center space-x-4">
                    <div>
                      <span className="text-xs text-gray-500">Symbol: </span>
                      <span className="text-sm font-mono">{instrument.symbol}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">P&L: </span>
                      <span className={`text-lg font-bold ${pnlColor}`}>
                        {pnl.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Points: </span>
                      <span className={`text-sm font-mono ${pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {(instrument.last - instrument.buyPrice).toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TradingTable;

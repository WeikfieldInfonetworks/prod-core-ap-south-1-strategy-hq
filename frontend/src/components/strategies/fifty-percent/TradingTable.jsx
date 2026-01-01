import React from 'react';
import { Activity, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

const TradingTable = ({ strategy, instrumentData, tradingActions }) => {
  if (!strategy) return null;

  // Get chosen instruments and status from instrumentData (real-time updates) or fall back to strategy
  const buyToken = instrumentData?.buyToken || strategy.buyToken;
  const oppBuyToken = instrumentData?.oppBuyToken || strategy.oppBuyToken;
  const halfdropInstrument = instrumentData?.halfdrop_instrument || strategy.halfdrop_instrument;
  const halfdropBought = instrumentData?.halfdrop_bought !== undefined ? instrumentData.halfdrop_bought : strategy.halfdrop_bought;
  const halfdropFlag = instrumentData?.halfdrop_flag !== undefined ? instrumentData.halfdrop_flag : strategy.halfdrop_flag;
  const soldAt10 = instrumentData?.soldAt10 !== undefined ? instrumentData.soldAt10 : strategy.soldAt10;
  const instrumentAt10Sell = instrumentData?.instrumentAt10Sell || strategy.instrumentAt10Sell;
  const instrumentAt10 = instrumentData?.instrumentAt10 || strategy.instrumentAt10;
  const remainingSellAtTarget = instrumentData?.remainingSellAtTarget || strategy.remainingSellAtTarget;
  const instrumentAtStoploss = instrumentData?.instrumentAtStoploss || strategy.instrumentAtStoploss;
  const instrumentAtStoplossSell = instrumentData?.instrumentAtStoplossSell || strategy.instrumentAtStoplossSell;
  const buyBackToken = instrumentData?.buyBackToken || strategy.buyBackToken;
  const buyBackPrice = instrumentData?.buyBackPrice || strategy.buyBackPrice;
  const soldBuyBackAfterStoploss = instrumentData?.soldBuyBackAfterStoploss !== undefined ? instrumentData.soldBuyBackAfterStoploss : strategy.soldBuyBackAfterStoploss;
  const buyBackAfterStoploss = instrumentData?.buyBackAfterStoploss !== undefined ? instrumentData.buyBackAfterStoploss : strategy.buyBackAfterStoploss;

  const formatTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      return new Date(timestamp).toLocaleTimeString();
    } catch {
      return 'Invalid Time';
    }
  };

  const formatPrice = (price) => {
    if (typeof price === 'string') return parseFloat(price).toFixed(2);
    else if (typeof price !== 'number') return '-.--';
    return parseFloat(price).toFixed(2);
  };

  const getActionIcon = (action) => {
    switch (action?.toUpperCase()) {
      case 'BUY':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'SELL':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'HALF DROP':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
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
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  // Create trading history from strategy state
  const createTradingHistory = () => {
    const history = [];
    // Use instrumentData if available, otherwise fall back to strategy
    const instrumentMap = instrumentData?.instrumentMap || strategy.universalDict?.instrumentMap || {};
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
        type: `Drop: ${dropPercentage}%`
      });
    }

    // Add buy orders
    if (buyToken && halfdropBought) {
      const instrument = instrumentMap[buyToken];
      if (instrument && instrument.buyPrice !== -1) {
        history.push({
          id: `buy-${buyToken}`,
          action: 'BUY',
          symbol: instrument.symbol,
          price: instrument.buyPrice,
          quantity: quantity,
          timestamp: new Date().toISOString(),
          status: 'executed',
          type: 'CE Token'
        });
      }
    }

    if (oppBuyToken && halfdropBought) {
      const instrument = instrumentMap[oppBuyToken];
      if (instrument && instrument.buyPrice !== -1) {
        history.push({
          id: `buy-${oppBuyToken}`,
          action: 'BUY',
          symbol: instrument.symbol,
          price: instrument.buyPrice,
          quantity: quantity,
          timestamp: new Date().toISOString(),
          status: 'executed',
          type: 'PE Token'
        });
      }
    }


    // Add sell at -10
    if (soldAt10 && instrumentAt10Sell) {
      const instrument = instrumentAt10;
      if (instrument) {
        history.push({
          id: `sell-at-10-${instrument.token}`,
          action: 'SELL',
          symbol: instrument.symbol,
          price: instrumentAt10Sell,
          quantity: quantity,
          timestamp: new Date().toISOString(),
          status: 'executed',
          type: 'Sold at -10'
        });
      }
    }

    // Add remaining sell
    if (remainingSellAtTarget && instrumentAtStoploss) {
      const instrument = instrumentAtStoploss;
      if (instrument) {
        history.push({
          id: `sell-remaining-${instrument.token}`,
          action: 'SELL',
          symbol: instrument.symbol,
          price: instrumentAtStoplossSell,
          quantity: quantity,
          timestamp: new Date().toISOString(),
          status: 'executed',
          type: 'Remaining Sell'
        });
      }
    }


    // Add buy back buy
    if (buyBackToken && buyBackPrice) {
      const instrument = instrumentMap[buyBackToken];
      if (instrument) {
        history.push({
          id: `buy-back-${buyBackToken}`,
          action: 'BUY',
          symbol: instrument.symbol,
          price: buyBackPrice,
          quantity: quantity,
          timestamp: new Date().toISOString(),
          status: 'executed',
          type: 'Buy Back'
        });
      }
    }

    // Add buy back sell
    if (soldBuyBackAfterStoploss && buyBackToken) {
      const instrument = instrumentMap[buyBackToken];
      if (instrument) {
        history.push({
          id: `sell-buy-back-${buyBackToken}`,
          action: 'SELL',
          symbol: instrument.symbol,
          price: instrument.last,
          quantity: quantity,
          timestamp: new Date().toISOString(),
          status: 'executed',
          type: 'Buy Back Sell'
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
        <h3 className="text-lg font-semibold text-gray-900">Trading History</h3>
        <p className="text-sm text-gray-600 mt-1">Recent trading actions and strategy execution</p>
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
              allActions.slice(0, 10).map((action, index) => (
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
                  <p className="text-xs mt-1">Trading history will appear here once the strategy begins executing</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Strategy Status Summary */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-sm text-gray-600">Half Drop</div>
            <div className={`text-lg font-semibold ${halfdropFlag ? 'text-orange-600' : 'text-gray-400'}`}>
              {halfdropFlag ? 'Active' : 'Inactive'}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-600">Bought</div>
            <div className={`text-lg font-semibold ${halfdropBought ? 'text-green-600' : 'text-gray-400'}`}>
              {halfdropBought ? 'Yes' : 'No'}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-600">Sold at -10</div>
            <div className={`text-lg font-semibold ${soldAt10 ? 'text-red-600' : 'text-gray-400'}`}>
              {soldAt10 ? 'Yes' : 'No'}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-600">Buy Back</div>
            <div className={`text-lg font-semibold ${buyBackAfterStoploss ? 'text-blue-600' : 'text-gray-400'}`}>
              {buyBackAfterStoploss ? 'Active' : 'Inactive'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TradingTable;

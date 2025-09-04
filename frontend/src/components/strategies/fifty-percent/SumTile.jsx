import React from 'react';
import { DollarSign, TrendingUp, TrendingDown, Target, AlertTriangle, Clock } from 'lucide-react';

const SumTile = ({ strategy, instrumentData }) => {
  if (!strategy) return null;

  const instrumentMap = strategy.universalDict?.instrumentMap || {};
  const quantity = strategy.globalDict?.quantity || 75;
  const target = strategy.globalDict?.target || 7;
  const stoploss = strategy.globalDict?.stoploss || -100;

  // Calculate P&L for an instrument
  const calculatePnL = (instrument) => {
    if (!instrument || instrument.buyPrice === -1 || instrument.last === -1) return 0;
    return (instrument.last - instrument.buyPrice) * quantity;
  };

  // Get instrument data
  const getInstrumentData = (token) => {
    if (!token || !instrumentMap[token]) return null;
    return instrumentMap[token];
  };

  const buyTokenInstrument = getInstrumentData(strategy.buyToken);
  const oppBuyTokenInstrument = getInstrumentData(strategy.oppBuyToken);
  const buyBackInstrument = getInstrumentData(strategy.buyBackToken);

  // Calculate individual P&Ls
  const buyTokenPnL = calculatePnL(buyTokenInstrument);
  const oppBuyTokenPnL = calculatePnL(oppBuyTokenInstrument);
  const buyBackPnL = calculatePnL(buyBackInstrument);

  // Calculate total P&L
  let totalPnL = 0;
  if (buyTokenInstrument) totalPnL += buyTokenPnL;
  if (oppBuyTokenInstrument) totalPnL += oppBuyTokenPnL;
  if (buyBackInstrument) totalPnL += buyBackPnL;

  // Calculate total investment
  let totalInvestment = 0;
  if (buyTokenInstrument && buyTokenInstrument.buyPrice !== -1) {
    totalInvestment += buyTokenInstrument.buyPrice * quantity;
  }
  if (oppBuyTokenInstrument && oppBuyTokenInstrument.buyPrice !== -1) {
    totalInvestment += oppBuyTokenInstrument.buyPrice * quantity;
  }
  if (buyBackInstrument && strategy.buyBackPrice) {
    totalInvestment += strategy.buyBackPrice * quantity;
  }

  // Calculate current value
  let currentValue = 0;
  if (buyTokenInstrument && buyTokenInstrument.last !== -1) {
    currentValue += buyTokenInstrument.last * quantity;
  }
  if (oppBuyTokenInstrument && oppBuyTokenInstrument.last !== -1) {
    currentValue += oppBuyTokenInstrument.last * quantity;
  }
  if (buyBackInstrument && buyBackInstrument.last !== -1) {
    currentValue += buyBackInstrument.last * quantity;
  }

  const getPnLColor = (pnl) => {
    if (pnl === 0) return 'text-gray-500';
    return pnl >= 0 ? 'text-green-600' : 'text-red-600';
  };

  const getPnLIcon = (pnl) => {
    if (pnl === 0) return null;
    return pnl >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />;
  };

  const formatCurrency = (value) => {
    return value.toFixed(2);
  };

  // Check if we're at target or stoploss
  const isAtTarget = totalPnL >= target;
  const isAtStoploss = totalPnL <= stoploss;

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Portfolio Summary</h3>
        <DollarSign className="h-5 w-5 text-gray-400" />
      </div>

      {/* Total P&L */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-600">Total P&L</span>
          <div className={`flex items-center space-x-1 ${getPnLColor(totalPnL)}`}>
            {getPnLIcon(totalPnL)}
            <span className="text-2xl font-bold">{formatCurrency(totalPnL)}</span>
          </div>
        </div>
        
        {/* Target/Stoploss indicators */}
        <div className="flex items-center justify-between text-xs">
          <div className={`flex items-center space-x-1 ${isAtTarget ? 'text-green-600' : 'text-gray-500'}`}>
            <Target className="h-3 w-3" />
            <span>Target: {target}</span>
          </div>
          <div className={`flex items-center space-x-1 ${isAtStoploss ? 'text-red-600' : 'text-gray-500'}`}>
            <AlertTriangle className="h-3 w-3" />
            <span>Stoploss: {stoploss}</span>
          </div>
        </div>
      </div>

      {/* Individual P&Ls */}
      <div className="space-y-3">
        {buyTokenInstrument && (
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">CE Token</span>
            <div className={`flex items-center space-x-1 ${getPnLColor(buyTokenPnL)}`}>
              {getPnLIcon(buyTokenPnL)}
              <span className="text-sm font-mono">{formatCurrency(buyTokenPnL)}</span>
            </div>
          </div>
        )}

        {oppBuyTokenInstrument && (
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">PE Token</span>
            <div className={`flex items-center space-x-1 ${getPnLColor(oppBuyTokenPnL)}`}>
              {getPnLIcon(oppBuyTokenPnL)}
              <span className="text-sm font-mono">{formatCurrency(oppBuyTokenPnL)}</span>
            </div>
          </div>
        )}

        {buyBackInstrument && (
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Buy Back</span>
            <div className={`flex items-center space-x-1 ${getPnLColor(buyBackPnL)}`}>
              {getPnLIcon(buyBackPnL)}
              <span className="text-sm font-mono">{formatCurrency(buyBackPnL)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Investment Summary */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Total Investment</span>
            <span className="text-sm font-mono">{formatCurrency(totalInvestment)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Current Value</span>
            <span className="text-sm font-mono">{formatCurrency(currentValue)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Quantity</span>
            <span className="text-sm font-mono">{quantity}</span>
          </div>
        </div>
      </div>

      {/* Strategy Status */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Half Drop Flag</span>
            <span className={`text-sm font-medium ${strategy.halfdrop_flag ? 'text-orange-600' : 'text-gray-500'}`}>
              {strategy.halfdrop_flag ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Sold at -10</span>
            <span className={`text-sm font-medium ${strategy.soldAt10 ? 'text-green-600' : 'text-gray-500'}`}>
              {strategy.soldAt10 ? 'Yes' : 'No'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Buy Back Active</span>
            <span className={`text-sm font-medium ${strategy.buyBackAfterStoploss ? 'text-blue-600' : 'text-gray-500'}`}>
              {strategy.buyBackAfterStoploss ? 'Yes' : 'No'}
            </span>
          </div>
        </div>
      </div>

      {/* No data state */}
      {!buyTokenInstrument && !oppBuyTokenInstrument && (
        <div className="text-center text-gray-500 mt-6">
          <Clock className="h-8 w-8 mx-auto mb-2" />
          <p className="text-sm">Waiting for trading to begin...</p>
        </div>
      )}
    </div>
  );
};

export default SumTile;

import React from 'react';
import { Table, TrendingUp, TrendingDown, Target, DollarSign } from 'lucide-react';

const TradingTable = ({ strategy, instrumentData, tradingActions }) => {
  const formatPrice = (price) => {
    if (typeof price !== 'number' || price === 0) return '-';
    return `₹${price.toFixed(2)}`;
  };

  const getCellColor = (value, isProfit = null) => {
    if (value === '-' || !value) return 'text-gray-400';
    if (isProfit === null) return 'text-gray-900';
    return isProfit ? 'text-green-600' : 'text-red-600';
  };

  // Extract instrument data
  const boughtInstrument = instrumentData?.boughtInstrument;
  const oppInstrument = instrumentData?.oppInstrument;
  const ceInstrument = boughtInstrument?.type === 'CE' ? boughtInstrument : oppInstrument;
  const peInstrument = boughtInstrument?.type === 'PE' ? boughtInstrument : oppInstrument;

  // Get trading action data for specific scenarios
  const getActionPrice = (actionType, instrumentType) => {
    const action = tradingActions.find(a => 
      a.action === actionType && 
      (a.symbol?.includes('CE') === (instrumentType === 'CE'))
    );
    return action?.price || '-';
  };

  const columns = [
    { key: 'buyPrice', label: 'Buying Price', icon: DollarSign },
    { key: 'sellAt10', label: '-10', icon: TrendingDown },
    { key: 'targetOf10', label: 'TARGET OF -10', icon: Target },
    { key: 'sellAt24', label: '+24', icon: TrendingUp },
    { key: 'targetOf24', label: 'TARGET OF 24', icon: Target },
    { key: 'sellAt36', label: '-36', icon: TrendingDown },
    { key: 'targetOf36', label: 'TARGET OF -36', icon: Target },
    { key: 'sellBoth', label: '+7', icon: TrendingUp }
  ];

  const getRowData = (instrumentType, instrument) => {
    if (!instrument) return columns.map(() => '-');

    return [
      // Buying Price
      formatPrice(instrument.buyPrice),
      
      // -10 scenario
      getActionPrice('sell_at_10', instrumentType),
      
      // Target of -10
      getActionPrice('sell_remaining_after_10', instrumentType),
      
      // +24 scenario  
      getActionPrice('sell_at_24', instrumentType),
      
      // Target of 24
      getActionPrice('sell_remaining_at_target', instrumentType),
      
      // -36 scenario
      getActionPrice('sell_at_36', instrumentType),
      
      // Target of -36
      getActionPrice('sell_remaining_after_36', instrumentType),
      
      // Both options sold at +7
      getActionPrice('sell_both_options', instrumentType)
    ];
  };

  const getSumRowData = () => {
    if (!instrumentData?.sum) return columns.map(() => '-');
    
    const sum = instrumentData.sum;
    
    return [
      // Total buying price
      formatPrice(sum.buyPrice),
      
      // Sum at -10 (both instruments price at -10 scenario)
      '-', // Will be calculated when -10 scenario occurs
      
      // Target of -10
      '-',
      
      // Sum at +24 (both instruments price at +24 scenario)
      '-', // Will be calculated when +24 scenario occurs
      
      // Target of 24
      '-',
      
      // Sum at -36
      '-',
      
      // Target of -36
      '-',
      
      // Sum when both sold at +7
      formatPrice(sum.ltp) // Current total value
    ];
  };

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 px-6 py-4 border-b">
        <div className="flex items-center space-x-3">
          <Table className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Trading Scenarios Matrix</h3>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Track prices across different trading scenarios and exit conditions
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Instrument
              </th>
              {columns.map((column) => (
                <th key={column.key} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex flex-col items-center space-y-1">
                    <column.icon className="w-4 h-4" />
                    <span>{column.label}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {/* PE Row */}
            <tr className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-sm font-medium text-gray-900">PE</span>
                  {peInstrument && (
                    <span className="text-xs text-gray-500 font-mono">
                      {peInstrument.displayName}
                    </span>
                  )}
                </div>
              </td>
              {getRowData('PE', peInstrument).map((value, index) => (
                <td key={index} className="px-4 py-4 whitespace-nowrap text-center">
                  <span className={`text-sm font-medium ${getCellColor(value)}`}>
                    {value}
                  </span>
                </td>
              ))}
            </tr>

            {/* CE Row */}
            <tr className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium text-gray-900">CE</span>
                  {ceInstrument && (
                    <span className="text-xs text-gray-500 font-mono">
                      {ceInstrument.displayName}
                    </span>
                  )}
                </div>
              </td>
              {getRowData('CE', ceInstrument).map((value, index) => (
                <td key={index} className="px-4 py-4 whitespace-nowrap text-center">
                  <span className={`text-sm font-medium ${getCellColor(value)}`}>
                    {value}
                  </span>
                </td>
              ))}
            </tr>

            {/* SUM Row */}
            <tr className="bg-blue-50 hover:bg-blue-100 border-t-2 border-blue-200">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-sm font-bold text-blue-900">SUM</span>
                </div>
              </td>
              {getSumRowData().map((value, index) => (
                <td key={index} className="px-4 py-4 whitespace-nowrap text-center">
                  <span className="text-sm font-bold text-blue-900">
                    {value}
                  </span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="bg-gray-50 px-6 py-3 border-t text-xs text-gray-600">
        <div className="flex flex-wrap items-center space-x-6">
          <div className="flex items-center space-x-2">
            <TrendingDown className="w-3 h-3 text-red-500" />
            <span>Loss scenarios</span>
          </div>
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-3 h-3 text-green-500" />
            <span>Profit scenarios</span>
          </div>
          <div className="flex items-center space-x-2">
            <Target className="w-3 h-3 text-blue-500" />
            <span>Target achievements</span>
          </div>
        </div>
      </div>

      {/* Recent Trading Actions */}
      {tradingActions.length > 0 && (
        <div className="border-t">
          <div className="bg-gray-50 px-6 py-3">
            <h4 className="text-sm font-medium text-gray-900">Recent Trading Actions</h4>
          </div>
          <div className="px-6 py-4">
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {tradingActions.slice(0, 5).map((action, index) => (
                <div key={index} className="text-xs text-gray-600 flex items-center justify-between">
                  <span>
                    {action.action}: {action.symbol} @ {formatPrice(action.price)}
                  </span>
                  <span className="text-gray-400">
                    {new Date(action.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradingTable;

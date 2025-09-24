import React, { useState, useEffect, useCallback } from 'react';
import { History, TrendingUp, TrendingDown, DollarSign, Target, Clock, ChevronDown, ChevronUp } from 'lucide-react';

const PrebuyHistoryTable = ({ strategy, currentPrebuyData }) => {
  const [historyData, setHistoryData] = useState([]);
  const [expandedCycles, setExpandedCycles] = useState(new Set());

  // Session storage key for this strategy
  const getStorageKey = useCallback(() => `prebuy_history_${strategy.name || 'mtm_v2'}`, [strategy.name]);

  // Load history from session storage on mount
  useEffect(() => {
    const savedHistory = sessionStorage.getItem(getStorageKey());
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        setHistoryData(parsed);
      } catch (error) {
        console.error('Error loading prebuy history from session storage:', error);
      }
    }
  }, []);

  // Function to update prebuy history data
  const updatePrebuyHistory = useCallback((prebuyData, cycleNumber) => {
    if (!prebuyData || Object.keys(prebuyData).length === 0) return;
    
    setHistoryData(prevHistoryData => {
      // Check if this cycle data already exists
      const existingIndex = prevHistoryData.findIndex(item => item.cycle === cycleNumber);
      
      let newHistoryData;
      if (existingIndex >= 0) {
        // Update existing cycle data (same cycle, update same row)
        newHistoryData = [...prevHistoryData];
        newHistoryData[existingIndex] = {
          ...newHistoryData[existingIndex], // Preserve original timestamp
          cycle: cycleNumber,
          data: { ...prebuyData }, // Deep copy to avoid reference issues
          lastUpdated: new Date().toISOString(),
          completed: !!prebuyData.summary
        };
        
        console.log(`✏️  Updated existing cycle ${cycleNumber} data in prebuy history (same row)`, Object.keys(prebuyData));
      } else {
        // Add new cycle data (different cycle, create new row)
        const newCycleData = {
          cycle: cycleNumber,
          data: { ...prebuyData }, // Deep copy to avoid reference issues
          timestamp: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          completed: !!prebuyData.summary
        };
        
        // Insert at the beginning (most recent first) and limit to 20 cycles
        newHistoryData = [newCycleData, ...prevHistoryData].slice(0, 20);
        
        console.log(`➕ Added new cycle ${cycleNumber} data to prebuy history (new row)`, Object.keys(prebuyData));
      }
      
      // Save to session storage
      try {
        sessionStorage.setItem(getStorageKey(), JSON.stringify(newHistoryData));
      } catch (error) {
        console.error('Error saving prebuy history to session storage:', error);
      }
      
      return newHistoryData;
    });
  }, [getStorageKey]);

  // Save current prebuy data when cycle completes or updates
  useEffect(() => {
    if (currentPrebuyData && Object.keys(currentPrebuyData).length > 0) {
      const currentCycle = strategy.universalDict?.cycles || 0;
      updatePrebuyHistory(currentPrebuyData, currentCycle);
    }
  }, [currentPrebuyData, strategy.universalDict?.cycles, updatePrebuyHistory]);

  const formatPrice = (price) => {
    if (typeof price !== 'number' || price === 0) return '-';
    return `₹${price.toFixed(2)}`;
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '-';
    try {
      return new Date(timestamp).toLocaleTimeString();
    } catch {
      return timestamp; // If already formatted
    }
  };

  const getPnLColor = (pnl) => {
    if (typeof pnl !== 'number') return 'text-gray-600';
    return pnl >= 0 ? 'text-green-600' : 'text-red-600';
  };

  const getPnLIcon = (pnl) => {
    if (typeof pnl !== 'number') return null;
    return pnl >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />;
  };

  const toggleCycleExpansion = (cycle) => {
    const newExpanded = new Set(expandedCycles);
    if (newExpanded.has(cycle)) {
      newExpanded.delete(cycle);
    } else {
      newExpanded.add(cycle);
    }
    setExpandedCycles(newExpanded);
  };

  const clearHistory = () => {
    setHistoryData([]);
    sessionStorage.removeItem(getStorageKey());
  };

  if (!strategy.universalDict?.usePrebuy) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 px-6 py-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <History className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">Prebuy Trading History</h3>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">
              {historyData.length} cycle{historyData.length !== 1 ? 's' : ''} recorded
            </span>
            {historyData.length > 0 && (
              <button
                onClick={clearHistory}
                className="text-sm text-red-600 hover:text-red-800 px-2 py-1 rounded border border-red-200 hover:bg-red-50"
              >
                Clear History
              </button>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Complete trading history for prebuy mode cycles with detailed P&L breakdown
        </p>
      </div>

      {/* History Table */}
      <div className="overflow-x-auto">
        {historyData.length === 0 ? (
          <div className="text-center py-12">
            <History className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No prebuy trading history available</p>
            <p className="text-sm text-gray-500 mt-1">Complete a cycle to see history data</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {historyData.map((cycleData) => (
              <div key={cycleData.cycle} className="bg-white">
                {/* Cycle Summary Row */}
                <div 
                  className="px-6 py-4 hover:bg-gray-50 cursor-pointer"
                  onClick={() => toggleCycleExpansion(cycleData.cycle)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        {expandedCycles.has(cycleData.cycle) ? (
                          <ChevronUp className="w-4 h-4 text-gray-500" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        )}
                        <span className="font-semibold text-gray-900">
                          Cycle {cycleData.cycle}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span>Started: {formatTime(cycleData.timestamp)}</span>
                        {cycleData.lastUpdated && cycleData.lastUpdated !== cycleData.timestamp && (
                          <span className="ml-2 text-blue-600">
                            • Updated: {formatTime(cycleData.lastUpdated)}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                          cycleData.completed 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {cycleData.completed ? 'Completed' : 'In Progress'}
                        </div>
                        
                        {/* Show update indicator if data was updated */}
                        {cycleData.lastUpdated && cycleData.lastUpdated !== cycleData.timestamp && (
                          <div className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Updated
                          </div>
                        )}
                      </div>
                    </div>

                    {/* P&L Summary */}
                    {cycleData.data.summary && (
                      <div className="flex items-center space-x-6">
                        <div className="text-right">
                          <div className="text-xs text-gray-500">P&L (Points)</div>
                          <div className={`text-sm font-semibold ${getPnLColor(cycleData.data.summary.pnlInPoints)}`}>
                            {typeof cycleData.data.summary.pnlInPoints === 'number' 
                              ? cycleData.data.summary.pnlInPoints.toFixed(2) 
                              : '-'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-500">P&L (₹)</div>
                          <div className={`text-sm font-semibold flex items-center space-x-1 ${getPnLColor(cycleData.data.summary.pnlActual)}`}>
                            {getPnLIcon(cycleData.data.summary.pnlActual)}
                            <span>{formatPrice(cycleData.data.summary.pnlActual)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedCycles.has(cycleData.cycle) && (
                  <div className="px-6 pb-4 bg-gray-50">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      
                      {/* Pre-bought Instruments */}
                      {cycleData.data.preBoughtInstruments && (
                        <div className="bg-white rounded-lg p-4">
                          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                            <Target className="w-4 h-4 mr-2 text-blue-600" />
                            Pre-bought Instruments
                          </h4>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center py-2 border-b border-gray-100">
                              <div className="flex items-center space-x-2">
                                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                <span className="text-sm font-medium">CE</span>
                                <span className="text-xs text-gray-500 font-mono">
                                  {cycleData.data.preBoughtInstruments.call?.instrument?.symbol || 'N/A'}
                                </span>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-semibold">
                                  {formatPrice(cycleData.data.preBoughtInstruments.call?.price)}
                                </div>
                                <div className="text-xs text-gray-500">
                                  Qty: {cycleData.data.preBoughtInstruments.call?.quantity || 0}
                                </div>
                              </div>
                            </div>
                            <div className="flex justify-between items-center py-2">
                              <div className="flex items-center space-x-2">
                                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                                <span className="text-sm font-medium">PE</span>
                                <span className="text-xs text-gray-500 font-mono">
                                  {cycleData.data.preBoughtInstruments.put?.instrument?.symbol || 'N/A'}
                                </span>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-semibold">
                                  {formatPrice(cycleData.data.preBoughtInstruments.put?.price)}
                                </div>
                                <div className="text-xs text-gray-500">
                                  Qty: {cycleData.data.preBoughtInstruments.put?.quantity || 0}
                                </div>
                              </div>
                            </div>
                          </div>
                          {cycleData.data.preBoughtInstruments.timestamp && (
                            <div className="text-xs text-gray-500 mt-2 flex items-center">
                              <Clock className="w-3 h-3 mr-1" />
                              {formatTime(cycleData.data.preBoughtInstruments.timestamp)}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Real Trading Actions */}
                      <div className="bg-white rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                          <DollarSign className="w-4 h-4 mr-2 text-green-600" />
                          Trading Actions
                        </h4>
                        <div className="space-y-3">
                          
                          {/* Real Buy */}
                          {cycleData.data.realBuy && (
                            <div className="border border-blue-200 rounded-lg p-3 bg-blue-50">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-blue-800">Buy Action</span>
                                <span className="text-xs text-blue-600">
                                  {formatTime(cycleData.data.realBuy.firstBuyTimestamp)}
                                </span>
                              </div>
                              <div className="text-xs text-gray-700 space-y-1">
                                <div>Stoploss Hit By: <span className="font-medium">{cycleData.data.realBuy.stoplossHitBy}</span></div>
                                <div>Buy Instrument: <span className="font-medium">{cycleData.data.realBuy.firstBuyInstrument?.symbol}</span></div>
                                <div>Buy Price: <span className="font-medium">{formatPrice(cycleData.data.realBuy.firstBuyPrice)}</span></div>
                                {cycleData.data.realBuy.secondBuy && (
                                  <>
                                    <div className="border-t border-blue-300 pt-1 mt-2">
                                      <div>Second Buy: <span className="font-medium">{formatPrice(cycleData.data.realBuy.secondBuyPrice)}</span></div>
                                      <div>Average Price: <span className="font-medium">{formatPrice(cycleData.data.realBuy.averageBuyPrice)}</span></div>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Real Sell */}
                          {cycleData.data.realSell && (
                            <div className="border border-red-200 rounded-lg p-3 bg-red-50">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-red-800">Sell Action</span>
                                <span className="text-xs text-red-600">
                                  {formatTime(cycleData.data.realSell.sellTimestamp)}
                                </span>
                              </div>
                              <div className="text-xs text-gray-700 space-y-1">
                                <div>Sell Instrument: <span className="font-medium">{cycleData.data.realSell.sellInstrument?.symbol}</span></div>
                                <div>Sell Price: <span className="font-medium">{formatPrice(cycleData.data.realSell.sellPrice)}</span></div>
                                <div>Quantity: <span className="font-medium">{cycleData.data.realSell.sellQuantity}</span></div>
                              </div>
                            </div>
                          )}

                          {/* Summary */}
                          {cycleData.data.summary && (
                            <div className="border border-gray-300 rounded-lg p-3 bg-gray-50">
                              <div className="text-sm font-medium text-gray-800 mb-2">Cycle Summary</div>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <span className="text-gray-600">P&L Points:</span>
                                  <div className={`font-semibold ${getPnLColor(cycleData.data.summary.pnlInPoints)}`}>
                                    {typeof cycleData.data.summary.pnlInPoints === 'number' 
                                      ? cycleData.data.summary.pnlInPoints.toFixed(2) 
                                      : '-'}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-gray-600">P&L Amount:</span>
                                  <div className={`font-semibold ${getPnLColor(cycleData.data.summary.pnlActual)}`}>
                                    {formatPrice(cycleData.data.summary.pnlActual)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer with totals */}
      {historyData.length > 0 && (
        <div className="bg-blue-50 px-6 py-4 border-t">
          <div className="flex items-center justify-between">
            <div className="text-sm text-blue-800">
              Total Cycles: {historyData.filter(c => c.completed).length} completed, {historyData.filter(c => !c.completed).length} in progress
            </div>
            <div className="flex items-center space-x-6">
              {(() => {
                const completedCycles = historyData.filter(c => c.completed && c.data.summary);
                const totalPnLPoints = completedCycles.reduce((sum, c) => sum + (c.data.summary.pnlInPoints || 0), 0);
                const totalPnLAmount = completedCycles.reduce((sum, c) => sum + (c.data.summary.pnlActual || 0), 0);
                
                return (
                  <>
                    <div className="text-right">
                      <div className="text-xs text-blue-600">Total P&L (Points)</div>
                      <div className={`text-sm font-bold ${getPnLColor(totalPnLPoints)}`}>
                        {totalPnLPoints.toFixed(2)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-blue-600">Total P&L (₹)</div>
                      <div className={`text-sm font-bold flex items-center space-x-1 ${getPnLColor(totalPnLAmount)}`}>
                        {getPnLIcon(totalPnLAmount)}
                        <span>{formatPrice(totalPnLAmount)}</span>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrebuyHistoryTable;

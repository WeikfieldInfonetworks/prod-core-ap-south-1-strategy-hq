import React, { useState, useEffect, useCallback } from 'react';
import { Activity, Clock, CheckCircle, XCircle, AlertTriangle, Target, RotateCcw, TrendingDown, TrendingUp, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';

const TradingTable = ({ strategy, instrumentData, tradingActions, currentDropThreshold }) => {
  const [historyData, setHistoryData] = useState([]);
  const [expandedCycles, setExpandedCycles] = useState(new Set());

  if (!strategy) return null;

  // Session storage key for this strategy
  const getStorageKey = useCallback(() => `fifty-percent-full-spectrum-cycles`, []);

  // Load history from session storage on mount
  useEffect(() => {
    const savedHistory = sessionStorage.getItem(getStorageKey());
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        
        // Ensure parsed data is an array
        if (Array.isArray(parsed)) {
          setHistoryData(parsed);
          console.log('📂 TradingTable: Loaded cycle history', { cycles: parsed.length });
        } else {
          console.warn('📂 TradingTable: Invalid data format in session storage, initializing empty array');
          setHistoryData([]);
        }
      } catch (error) {
        console.error('Error loading cycle history from session storage:', error);
        setHistoryData([]);
      }
    } else {
      console.log('📂 TradingTable: No saved history found, initializing empty array');
      setHistoryData([]);
    }
  }, [getStorageKey]);

  // Function to update cycle history data (similar to PrebuyHistoryTable)
  const updateCycleHistory = useCallback((cycleData, cycleNumber, structuredData = null) => {
    if (!cycleData || Object.keys(cycleData).length === 0) return;
    
    setHistoryData(prevHistoryData => {
      // Ensure prevHistoryData is always an array
      const safePrevHistoryData = Array.isArray(prevHistoryData) ? prevHistoryData : [];
      
      // Check if this cycle data already exists
      const existingIndex = safePrevHistoryData.findIndex(item => item.cycle === cycleNumber);
      
      let newHistoryData;
      if (existingIndex >= 0) {
        // Update existing cycle data (same cycle, update same row)
        newHistoryData = [...safePrevHistoryData];
        newHistoryData[existingIndex] = {
          ...newHistoryData[existingIndex], // Preserve original timestamp
          cycle: cycleNumber,
          data: { ...cycleData }, // Deep copy to avoid reference issues
          lastUpdated: new Date().toISOString(),
          completed: structuredData?.completed !== undefined ? structuredData.completed : !!cycleData.sellData
        };
        
        console.log(`✏️ TradingTable: Updated existing cycle ${cycleNumber} data`, Object.keys(cycleData));
      } else {
        // Add new cycle data (different cycle, create new row)
        const newCycleData = {
          cycle: cycleNumber,
          data: { ...cycleData }, // Deep copy to avoid reference issues
          timestamp: structuredData?.timestamp || new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          completed: structuredData?.completed !== undefined ? structuredData.completed : !!cycleData.sellData
        };
        
        // Insert at the beginning (most recent first) and limit to 20 cycles
        newHistoryData = [newCycleData, ...safePrevHistoryData].slice(0, 20);
        
        console.log(`➕ TradingTable: Added new cycle ${cycleNumber} data`, Object.keys(cycleData));
      }
      
      // Save to session storage
      try {
        sessionStorage.setItem(getStorageKey(), JSON.stringify(newHistoryData));
      } catch (error) {
        console.error('Error saving cycle history to session storage:', error);
      }
      
      return newHistoryData;
    });
  }, [getStorageKey]);

  // Listen for cycle data updates from strategy
  useEffect(() => {
    console.log('🔍 TradingTable Debug:', {
      instrumentData: instrumentData,
      strategyName: strategy.name,
      cycles: strategy.universalDict?.cycles,
      hasData: instrumentData && Object.keys(instrumentData).length > 0,
      hasStructuredFormat: instrumentData?.cycle !== undefined && instrumentData?.data !== undefined,
      timestamp: instrumentData?.timestamp,
      instrumentDataKeys: instrumentData ? Object.keys(instrumentData) : 'no data',
      instrumentDataStatus: instrumentData?.status
    });
    
    const currentCycle = (strategy.universalDict?.cycles || 0) + 1; // Display cycles starting from 1
    
    // Check if we need to create a new cycle row (when cycle number increases)
    if (currentCycle > 1) {
      const hasCurrentCycle = historyData.some(item => item.cycle === currentCycle);
      if (!hasCurrentCycle) {
        console.log('🆕 Creating new cycle row for cycle', currentCycle);
        // Create empty cycle data for the new cycle
        const emptyCycleData = {
          halfDropInstrument: null,
          instrumentBought: null,
          rebuyData: null,
          sellData: null,
          summary: null
        };
        updateCycleHistory(emptyCycleData, currentCycle, {
          completed: false,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    if (instrumentData && Object.keys(instrumentData).length > 0) {
      // Check if this is the new structured format from strategy
      if (instrumentData.cycle !== undefined && instrumentData.data !== undefined) {
        console.log('📊 Using new structured format from strategy', {
          cycle: instrumentData.cycle,
          timestamp: instrumentData.timestamp,
          dataKeys: Object.keys(instrumentData.data)
        });
        // New structured format - use the cycle and data directly
        // The timestamps are already properly set in the data from strategy
        // Add 1 to cycle number for display (backend cycles start at 0, frontend displays from 1)
        updateCycleHistory(instrumentData.data, instrumentData.cycle + 1, instrumentData);
      } else {
        console.log('📊 Using old format - converting to structured');
        // Old format - convert to structured format
        // For old format, we don't have specific timestamps, so we'll use a generic timestamp
        // The new structured format from strategy already includes proper timestamps
        const genericTimestamp = new Date().toISOString();
        
        const structuredData = {
          halfDropInstrument: instrumentData.halfdrop_instrument ? {
            symbol: instrumentData.halfdrop_instrument.symbol,
            price: instrumentData.halfdrop_instrument.lowAtRef,
            timestamp: instrumentData.halfdrop_instrument.peakTime || genericTimestamp,
            firstPrice: instrumentData.halfdrop_instrument.firstPrice,
            dropPercentage: instrumentData.halfdrop_instrument.firstPrice ? 
              ((instrumentData.halfdrop_instrument.lowAtRef / instrumentData.halfdrop_instrument.firstPrice) * 100).toFixed(2) : 'N/A'
          } : null,
          instrumentBought: instrumentData.instrument_bought ? {
            symbol: instrumentData.instrument_bought.symbol,
            price: instrumentData.buyPriceOnce || instrumentData.instrument_bought.buyPrice,
            timestamp: instrumentData.buyTime || genericTimestamp,
            quantity: 75 // Always show original quantity
          } : null,
          rebuyData: instrumentData.rebuyDone && instrumentData.buyPriceOnce && instrumentData.buyPriceTwice ? {
            firstBuyPrice: instrumentData.buyPriceOnce,
            secondBuyPrice: instrumentData.buyPriceTwice,
            averagePrice: (instrumentData.buyPriceOnce + instrumentData.buyPriceTwice) / 2,
            timestamp: instrumentData.rebuyTime || genericTimestamp,
            quantity: 75 // Show original quantity for rebuy
          } : null,
          sellData: instrumentData.boughtSold ? {
            symbol: instrumentData.instrument_bought?.symbol,
            price: instrumentData.instrument_bought?.last,
            timestamp: instrumentData.sellTime || genericTimestamp,
            quantity: instrumentData.rebuyDone ? 150 : 75, // Double quantity if rebuy occurred, otherwise original
            pnl: instrumentData.instrument_bought?.buyPrice !== -1 ? 
              (instrumentData.instrument_bought.last - instrumentData.instrument_bought.buyPrice) * (instrumentData.rebuyDone ? 150 : 75) : 0
          } : null,
          summary: instrumentData.boughtSold ? {
            pnlInPoints: instrumentData.instrument_bought?.buyPrice !== -1 ? 
              (instrumentData.instrument_bought.last - instrumentData.instrument_bought.buyPrice) : 0,
            pnlActual: instrumentData.instrument_bought?.buyPrice !== -1 ? 
              (instrumentData.instrument_bought.last - instrumentData.instrument_bought.buyPrice) * (instrumentData.rebuyDone ? 150 : 75) : 0
          } : null
        };
        updateCycleHistory(structuredData, currentCycle);
      }
    }
  }, [instrumentData, strategy.universalDict?.cycles, updateCycleHistory, historyData]);

  const formatTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    
    // Check if it's already in HH:MM:SS format (from strategy)
    if (typeof timestamp === 'string' && /^\d{2}:\d{2}:\d{2}$/.test(timestamp)) {
      return timestamp; // Already formatted as HH:MM:SS
    }
    
    // Check if it's an ISO timestamp
    try {
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
        return date.toLocaleTimeString();
      }
    } catch {
      // Fall through to return as-is
    }
    
    // Return as-is if we can't parse it
    return timestamp;
  };

  const formatPrice = (price) => {
    if (price === undefined || price === null || price === -1) return 'N/A';
    return price.toFixed(2);
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
    if (window.confirm('Are you sure you want to clear all cycle history? This action cannot be undone.')) {
      setHistoryData([]);
      sessionStorage.removeItem(getStorageKey());
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 px-6 py-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Activity className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">Full Spectrum Cycle History</h3>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">
              {Array.isArray(historyData) ? historyData.length : 0} cycle{(Array.isArray(historyData) ? historyData.length : 0) !== 1 ? 's' : ''} recorded
            </span>
            {Array.isArray(historyData) && historyData.length > 0 && (
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
          Complete trading history for Full Spectrum cycles with detailed P&L breakdown
        </p>
      </div>

      {/* History Table */}
      <div className="overflow-x-auto">
        {!Array.isArray(historyData) || historyData.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No cycle trading history available</p>
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
                      
                      <div className="flex items-center space-x-1 text-sm text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span className="font-semibold">Started: {formatTime(cycleData.timestamp)}</span>
                        {cycleData.lastUpdated && cycleData.lastUpdated !== cycleData.timestamp && (
                          <span className="ml-2 text-blue-600 font-semibold">
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
                    {/* Check if cycle has any data */}
                    {(!cycleData.data.halfDropInstrument && !cycleData.data.instrumentBought && !cycleData.data.rebuyData && !cycleData.data.sellData) ? (
                      <div className="bg-white rounded-lg p-6 text-center">
                        <Activity className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                        <h4 className="text-sm font-semibold text-gray-600 mb-2">Waiting for Cycle Data</h4>
                        <p className="text-xs text-gray-500">This cycle is ready and waiting for trading events to occur</p>
                        <div className="mt-3 text-xs text-gray-400">
                          Started: {formatTime(cycleData.timestamp)}
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        
                        {/* Half Drop Instrument */}
                        {cycleData.data.halfDropInstrument && (
                          <div className="bg-white rounded-lg p-4">
                            <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                              <TrendingDown className="w-4 h-4 mr-2 text-orange-600" />
                              Half Drop Instrument
                            </h4>
                            <div className="space-y-2">
                              <div className="text-sm font-mono text-gray-900">{cycleData.data.halfDropInstrument.symbol}</div>
                              <div className="text-xs text-gray-600">Price: {formatPrice(cycleData.data.halfDropInstrument.price)}</div>
                              <div className="text-xs text-gray-600">Drop: {cycleData.data.halfDropInstrument.dropPercentage}%</div>
                              <div className="text-xs text-gray-500 flex items-center">
                                <Clock className="w-3 h-3 mr-1" />
                                {formatTime(cycleData.data.halfDropInstrument.timestamp)}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Trading Actions */}
                        <div className="bg-white rounded-lg p-4">
                          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                            <Target className="w-4 h-4 mr-2 text-green-600" />
                            Trading Actions
                          </h4>
                          <div className="space-y-3">
                            
                            {/* 1. Instrument Bought */}
                            {cycleData.data.instrumentBought && (
                              <div className="border border-green-200 rounded-lg p-3 bg-green-50">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium text-green-800">1. Instrument Bought</span>
                                  <span className="text-sm font-bold text-green-600">
                                    {formatTime(cycleData.data.instrumentBought.timestamp)}
                    </span>
                                </div>
                                <div className="text-xs text-gray-700 space-y-1">
                                  <div>Instrument: <span className="font-medium">{cycleData.data.instrumentBought.symbol}</span></div>
                                  <div>Buy Price: <span className="font-medium">{formatPrice(cycleData.data.instrumentBought.price)}</span></div>
                                  <div>Quantity: <span className="font-medium">{cycleData.data.instrumentBought.quantity}</span></div>
                                </div>
                              </div>
                            )}

                            {/* 2. Rebuy Data */}
                            {cycleData.data.rebuyData && (
                              <div className="border border-purple-200 rounded-lg p-3 bg-purple-50">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium text-purple-800">2. Rebuy Action</span>
                                  <span className="text-sm font-bold text-purple-600">
                                    {formatTime(cycleData.data.rebuyData.timestamp)}
                                  </span>
                                </div>
                                <div className="text-xs text-gray-700 space-y-1">
                                  <div>Instrument: <span className="font-medium">{cycleData.data.instrumentBought?.symbol || 'Same Instrument'}</span></div>
                                  <div>1st Buy Price: <span className="font-medium">{formatPrice(cycleData.data.rebuyData.firstBuyPrice)}</span></div>
                                  <div>2nd Buy Price: <span className="font-medium">{formatPrice(cycleData.data.rebuyData.secondBuyPrice)}</span></div>
                                  <div>Average Price: <span className="font-medium">{formatPrice(cycleData.data.rebuyData.averagePrice)}</span></div>
                                  <div>Total Quantity: <span className="font-medium">{cycleData.data.rebuyData.quantity}</span></div>
                                </div>
      </div>
                            )}

                            {/* 3. Sell Data */}
                            {cycleData.data.sellData && (
                              <div className="border border-red-200 rounded-lg p-3 bg-red-50">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium text-red-800">3. Sell Action</span>
                                  <span className="text-sm font-bold text-red-600">
                                    {formatTime(cycleData.data.sellData.timestamp)}
                                  </span>
                                </div>
                                <div className="text-xs text-gray-700 space-y-1">
                                  <div>Instrument: <span className="font-medium">{cycleData.data.sellData.symbol}</span></div>
                                  <div className="flex items-center space-x-2">
                                    <span>Sell Price: <span className="font-medium">{formatPrice(cycleData.data.sellData.price)}</span></span>
                                    {cycleData.data.sellData.sellReason && (
                                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                        cycleData.data.sellData.sellReason === 'REBUY_PRICE' 
                                          ? 'bg-orange-100 text-orange-800' 
                                          : cycleData.data.sellData.sellReason === 'AVG_PRICE'
                                          ? 'bg-blue-100 text-blue-800'
                                          : 'bg-gray-100 text-gray-800'
                                      }`}>
                                        {cycleData.data.sellData.sellReason === 'REBUY_PRICE' ? 'SOLD AT REBUY' : 
                                         cycleData.data.sellData.sellReason === 'AVG_PRICE' ? 'SOLD AT AVG PRICE' : 
                                         cycleData.data.sellData.sellReason}
                                      </span>
                                    )}
                                  </div>
                                  <div>Quantity: <span className="font-medium">{cycleData.data.sellData.quantity}</span></div>
                                  <div className={`font-semibold ${getPnLColor(cycleData.data.sellData.pnl)}`}>
                                    P&L: {formatPrice(cycleData.data.sellData.pnl)}
                                  </div>
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
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        </div>

      {/* Footer with totals */}
      {Array.isArray(historyData) && historyData.length > 0 && (
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

export default TradingTable;
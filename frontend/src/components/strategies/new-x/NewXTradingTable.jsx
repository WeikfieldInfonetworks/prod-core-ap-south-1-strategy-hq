import React, { useState, useEffect, useCallback } from 'react';
import { Activity, Clock, CheckCircle, XCircle, AlertTriangle, Target, RotateCcw, TrendingDown, TrendingUp, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';

const NewXTradingTable = ({ strategy, instrumentData, tradingActions, currentDropThreshold }) => {
  const [historyData, setHistoryData] = useState([]);
  const [expandedCycles, setExpandedCycles] = useState(new Set());

  if (!strategy) return null;

  // Session storage key for this strategy
  const getStorageKey = useCallback(() => `new-x-strategy-cycles`, []);

  // Load history from session storage on mount
  useEffect(() => {
    const savedHistory = sessionStorage.getItem(getStorageKey());
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        
        // Ensure parsed data is an array
        if (Array.isArray(parsed)) {
          setHistoryData(parsed);
          console.log('📂 NewXTradingTable: Loaded cycle history', { cycles: parsed.length });
        } else {
          console.warn('📂 NewXTradingTable: Invalid data format in session storage, initializing empty array');
          setHistoryData([]);
        }
      } catch (error) {
        console.error('Error loading cycle history from session storage:', error);
        setHistoryData([]);
      }
    } else {
      console.log('📂 NewXTradingTable: No saved history found, initializing empty array');
      setHistoryData([]);
    }
  }, [getStorageKey]);

  // Cleanup session storage on tab close and component unmount
  useEffect(() => {
    const cleanupStorage = () => {
      try {
        sessionStorage.removeItem(getStorageKey());
        console.log('🧹 NewXTradingTable: Session storage cleared on tab close');
      } catch (error) {
        console.error('Error clearing session storage:', error);
      }
    };

    // Cleanup on tab close
    const handleBeforeUnload = () => {
      cleanupStorage();
    };

    // Cleanup on component unmount
    const handleUnload = () => {
      cleanupStorage();
    };

    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('unload', handleUnload);

    // Cleanup function for component unmount
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleUnload);
      cleanupStorage(); // Also cleanup on component unmount
    };
  }, [getStorageKey]);

  // Update cycle history when strategy data changes
  const updateCycleHistory = useCallback((newCycleData) => {
    setHistoryData(prevHistoryData => {
      const historyArray = Array.isArray(prevHistoryData) ? prevHistoryData : [];
      const updatedHistory = [...historyArray, newCycleData];
      
      // Save to session storage
      try {
        sessionStorage.setItem(getStorageKey(), JSON.stringify(updatedHistory));
        console.log('💾 NewXTradingTable: Cycle history saved to session storage');
      } catch (error) {
        console.error('Error saving cycle history to session storage:', error);
      }
      
      return updatedHistory;
    });
  }, [getStorageKey]);

  // Monitor strategy state changes to create cycle data
  useEffect(() => {
    const currentCycle = strategy.universalDict?.cycles || 0;
    
    // Check if we have trading data to create a cycle
    if (strategy.halfdrop_instrument || strategy.other_instrument) {
      const cycleData = {
        cycle: currentCycle + 1, // Display cycle starts at 1
        timestamp: new Date().toISOString(),
        data: {
          firstBuy: {
            ceInstrument: strategy.halfdrop_instrument,
            peInstrument: strategy.other_instrument,
            timestamp: new Date().toISOString(),
            target: strategy.globalDict?.target || 9
          },
          firstSell: strategy.halfdrop_sold ? {
            ceInstrument: strategy.halfdrop_instrument,
            peInstrument: strategy.other_instrument,
            timestamp: new Date().toISOString(),
            mtm: (strategy.halfdrop_instrument?.changeFromBuy || 0) + (strategy.other_instrument?.changeFromBuy || 0)
          } : null,
          secondBuy: strategy.other_bought ? {
            ceInstrument: strategy.halfdrop_instrument,
            peInstrument: strategy.other_instrument,
            timestamp: new Date().toISOString(),
            threshold: strategy.globalDict?.secondBuyThreshold || 19
          } : null,
          secondSell: strategy.other_sold ? {
            ceInstrument: strategy.halfdrop_instrument,
            peInstrument: strategy.other_instrument,
            timestamp: new Date().toISOString(),
            target: strategy.globalDict?.secondTarget || 25,
            mtm: (strategy.halfdrop_instrument?.changeFromBuy || 0) + (strategy.other_instrument?.changeFromBuy || 0)
          } : null
        },
        completed: strategy.boughtSold || false
      };

      // Check if this cycle already exists in history
      const existingCycleIndex = historyData.findIndex(cycle => cycle.cycle === cycleData.cycle);
      
      if (existingCycleIndex >= 0) {
        // Update existing cycle
        setHistoryData(prev => {
          const updated = [...prev];
          updated[existingCycleIndex] = cycleData;
          
          // Save to session storage
          try {
            sessionStorage.setItem(getStorageKey(), JSON.stringify(updated));
          } catch (error) {
            console.error('Error updating cycle history:', error);
          }
          
          return updated;
        });
      } else {
        // Add new cycle
        updateCycleHistory(cycleData);
      }
    }
  }, [
    strategy.halfdrop_instrument, 
    strategy.other_instrument, 
    strategy.halfdrop_sold, 
    strategy.other_bought, 
    strategy.other_sold, 
    strategy.boughtSold,
    strategy.universalDict?.cycles,
    updateCycleHistory,
    getStorageKey,
    historyData
  ]);

  const toggleCycleExpansion = (cycleNumber) => {
    setExpandedCycles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cycleNumber)) {
        newSet.delete(cycleNumber);
      } else {
        newSet.add(cycleNumber);
      }
      return newSet;
    });
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '--:--:--';
    try {
      return new Date(timestamp).toLocaleTimeString('en-GB', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (error) {
      return '--:--:--';
    }
  };

  const formatPrice = (price) => {
    if (typeof price !== 'number') return '-.--';
    return price.toFixed(2);
  };

  const clearHistory = () => {
    if (window.confirm('Are you sure you want to clear all cycle history? This action cannot be undone.')) {
      setHistoryData([]);
      sessionStorage.removeItem(getStorageKey());
    }
  };

  // Ensure historyData is always an array
  const safeHistoryData = Array.isArray(historyData) ? historyData : [];

  return (
    <div className="bg-white rounded-lg shadow-sm">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Activity className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-medium text-gray-900">Trading History</h3>
          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
            {safeHistoryData.length} cycles
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={clearHistory}
            className="px-3 py-1 text-sm text-red-600 hover:text-red-800 flex items-center space-x-1"
          >
            <Trash2 className="h-4 w-4" />
            <span>Clear History</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {!Array.isArray(safeHistoryData) || safeHistoryData.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-2">No trading cycles yet</div>
            <div className="text-sm text-gray-500">Trading history will appear here as cycles complete</div>
          </div>
        ) : (
          <div className="space-y-4">
            {safeHistoryData.map((cycleData, index) => {
              const isExpanded = expandedCycles.has(cycleData.cycle);
              const hasActions = cycleData.data.firstBuy || cycleData.data.firstSell || cycleData.data.secondBuy || cycleData.data.secondSell;
              
              return (
                <div key={cycleData.cycle} className="border border-gray-200 rounded-lg">
                  {/* Cycle Header */}
                  <div 
                    className="px-4 py-3 bg-gray-50 cursor-pointer flex items-center justify-between hover:bg-gray-100"
                    onClick={() => toggleCycleExpansion(cycleData.cycle)}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-700">
                          Cycle {cycleData.cycle}
                        </span>
                        {cycleData.completed && (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        )}
                      </div>
                      
                      <div className="text-xs text-gray-500">
                        {formatTime(cycleData.timestamp)}
                      </div>
                      
                      {!hasActions && (
                        <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                          Waiting for Cycle Data
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-gray-600" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-600" />
                      )}
                    </div>
                  </div>

                  {/* Cycle Details */}
                  {isExpanded && (
                    <div className="p-4 border-t border-gray-200">
                      {!hasActions ? (
                        <div className="text-center py-4 text-gray-500">
                          <div className="text-sm">Waiting for trading data...</div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* First Buy */}
                          {cycleData.data.firstBuy && (
                            <div className="bg-blue-50 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-blue-800">First Buy (Both Instruments)</span>
                                <span className="text-sm font-semibold text-blue-600">
                                  {formatTime(cycleData.data.firstBuy.timestamp)}
                                </span>
                              </div>
                              <div className="text-xs text-gray-700 space-y-1">
                                <div>CE: <span className="font-medium">{cycleData.data.firstBuy.ceInstrument?.symbol}</span> @ ₹{formatPrice(cycleData.data.firstBuy.ceInstrument?.buyPrice)}</div>
                                <div>PE: <span className="font-medium">{cycleData.data.firstBuy.peInstrument?.symbol}</span> @ ₹{formatPrice(cycleData.data.firstBuy.peInstrument?.buyPrice)}</div>
                                <div>Target: <span className="font-medium">{cycleData.data.firstBuy.target} pts</span></div>
                              </div>
                            </div>
                          )}

                          {/* First Sell */}
                          {cycleData.data.firstSell && (
                            <div className="bg-green-50 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-green-800">First Sell (Target Hit)</span>
                                <span className="text-sm font-semibold text-green-600">
                                  {formatTime(cycleData.data.firstSell.timestamp)}
                                </span>
                              </div>
                              <div className="text-xs text-gray-700 space-y-1">
                                <div>CE: <span className="font-medium">{cycleData.data.firstSell.ceInstrument?.symbol}</span> @ ₹{formatPrice(cycleData.data.firstSell.ceInstrument?.last)}</div>
                                <div>PE: <span className="font-medium">{cycleData.data.firstSell.peInstrument?.symbol}</span> @ ₹{formatPrice(cycleData.data.firstSell.peInstrument?.last)}</div>
                                <div>MTM: <span className="font-medium text-green-600">₹{formatPrice(cycleData.data.firstSell.mtm)}</span></div>
                              </div>
                            </div>
                          )}

                          {/* Second Buy */}
                          {cycleData.data.secondBuy && (
                            <div className="bg-purple-50 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-purple-800">Second Buy (Threshold Hit)</span>
                                <span className="text-sm font-semibold text-purple-600">
                                  {formatTime(cycleData.data.secondBuy.timestamp)}
                                </span>
                              </div>
                              <div className="text-xs text-gray-700 space-y-1">
                                <div>CE: <span className="font-medium">{cycleData.data.secondBuy.ceInstrument?.symbol}</span> @ ₹{formatPrice(cycleData.data.secondBuy.ceInstrument?.buyPrice)}</div>
                                <div>PE: <span className="font-medium">{cycleData.data.secondBuy.peInstrument?.symbol}</span> @ ₹{formatPrice(cycleData.data.secondBuy.peInstrument?.buyPrice)}</div>
                                <div>Threshold: <span className="font-medium">{cycleData.data.secondBuy.threshold} pts</span></div>
                              </div>
                            </div>
                          )}

                          {/* Second Sell */}
                          {cycleData.data.secondSell && (
                            <div className="bg-orange-50 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-orange-800">Second Sell (Final Target)</span>
                                <span className="text-sm font-semibold text-orange-600">
                                  {formatTime(cycleData.data.secondSell.timestamp)}
                                </span>
                              </div>
                              <div className="text-xs text-gray-700 space-y-1">
                                <div>CE: <span className="font-medium">{cycleData.data.secondSell.ceInstrument?.symbol}</span> @ ₹{formatPrice(cycleData.data.secondSell.ceInstrument?.last)}</div>
                                <div>PE: <span className="font-medium">{cycleData.data.secondSell.peInstrument?.symbol}</span> @ ₹{formatPrice(cycleData.data.secondSell.peInstrument?.last)}</div>
                                <div>Target: <span className="font-medium">{cycleData.data.secondSell.target} pts</span></div>
                                <div>Final MTM: <span className="font-medium text-orange-600">₹{formatPrice(cycleData.data.secondSell.mtm)}</span></div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default NewXTradingTable;


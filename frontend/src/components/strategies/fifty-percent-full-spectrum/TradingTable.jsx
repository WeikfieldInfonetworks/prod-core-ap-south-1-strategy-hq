import React, { useState, useEffect, useCallback } from 'react';
import { Activity, Clock, CheckCircle, XCircle, AlertTriangle, Target, RotateCcw, TrendingDown, TrendingUp, ChevronDown, ChevronUp, Trash2, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';

const TradingTable = ({ strategy, instrumentData, tradingActions, tradeEvents = [], socketEvents = [], currentDropThreshold }) => {
  const [historyData, setHistoryData] = useState([]);
  const [expandedCycles, setExpandedCycles] = useState(new Set());

  if (!strategy) return null;

  // Session storage key for this strategy
  const getStorageKey = useCallback(() => `fifty_percent_full_spectrum_trading_history_${strategy.name || 'fpfs'}`, [strategy.name]);

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

  // Cleanup session storage on tab close and component unmount
  useEffect(() => {
    const cleanupStorage = () => {
      try {
        sessionStorage.removeItem(getStorageKey());
        console.log('🧹 TradingTable: Session storage cleared on tab close');
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

  // Auto-expand current cycle when it gets updated
  useEffect(() => {
    if (historyData.length > 0) {
      const currentCycle = historyData[0].cycle;
      setExpandedCycles(prev => {
        const newExpanded = new Set(prev);
        newExpanded.add(currentCycle);
        return newExpanded;
      });
    }
  }, [historyData]);

  // Process incoming socket events for real-time updates
  useEffect(() => {
    if (!socketEvents || socketEvents.length === 0) return;

    setHistoryData(prevHistoryData => {
      let newHistoryData = [...prevHistoryData];
      
      // Process each event in the queue
      socketEvents.forEach(eventData => {
        const cycleNumber = eventData.cycle || 1;
        const existingIndex = newHistoryData.findIndex(item => item.cycle === cycleNumber);

        if (existingIndex >= 0) {
          // Update existing cycle
          const existingCycle = newHistoryData[existingIndex];
          
          if (eventData.type === 'trade_event' && eventData.tradeEvent) {
            // Add trade event to the cycle's tradeEvents array
            const currentTradeEvents = existingCycle.tradeEvents || [];
            const newTradeEvent = eventData.tradeEvent;
            
            // Check if this trade event already exists (avoid duplicates)
            const eventExists = currentTradeEvents.some(evt => 
              evt.symbol === newTradeEvent.symbol &&
              evt.action === newTradeEvent.action &&
              evt.timestamp === newTradeEvent.timestamp
            );
            
            if (!eventExists) {
              newHistoryData[existingIndex] = {
                ...existingCycle,
                tradeEvents: [newTradeEvent, ...currentTradeEvents],
                lastUpdated: new Date().toISOString()
              };
            }
          }
        } else {
          // Add new cycle
          const newCycleData = {
            cycle: cycleNumber,
            tradeEvents: eventData.type === 'trade_event' && eventData.tradeEvent ? [eventData.tradeEvent] : [],
            timestamp: eventData.timestamp || new Date().toISOString(),
            lastUpdated: new Date().toISOString()
          };
          newHistoryData = [newCycleData, ...newHistoryData].slice(0, 20);
        }
      });

      // Save to session storage
      try {
        sessionStorage.setItem(getStorageKey(), JSON.stringify(newHistoryData));
      } catch (error) {
        console.error('Error saving trading history to session storage:', error);
      }

      return newHistoryData;
    });
  }, [socketEvents, getStorageKey]);

  // Process trade events and update history
  useEffect(() => {
    if (!tradeEvents || tradeEvents.length === 0) return;

    setHistoryData(prevHistoryData => {
      // Group trade events by cycle
      const eventsByCycle = {};
      tradeEvents.forEach(event => {
        if (!eventsByCycle[event.cycle]) {
          eventsByCycle[event.cycle] = [];
        }
        eventsByCycle[event.cycle].push(event);
      });

      let newHistoryData = [...prevHistoryData];

      // Process each cycle's events
      Object.entries(eventsByCycle).forEach(([cycleNum, events]) => {
        const cycleNumber = parseInt(cycleNum);
        const existingIndex = newHistoryData.findIndex(item => item.cycle === cycleNumber);

        if (existingIndex >= 0) {
          // Update existing cycle - merge events and avoid duplicates
          const existingEvents = newHistoryData[existingIndex].tradeEvents || [];
          const mergedEvents = [...events];
          
          // Add existing events that aren't duplicates
          existingEvents.forEach(existingEvent => {
            const isDuplicate = events.some(newEvent => 
              newEvent.symbol === existingEvent.symbol &&
              newEvent.action === existingEvent.action &&
              newEvent.timestamp === existingEvent.timestamp
            );
            if (!isDuplicate) {
              mergedEvents.push(existingEvent);
            }
          });

          newHistoryData[existingIndex] = {
            ...newHistoryData[existingIndex],
            lastUpdated: new Date().toISOString(),
            tradeEvents: mergedEvents.sort((a, b) => {
              // Sort by timestamp descending (newest first)
              const timeA = new Date(a.timestamp || 0).getTime();
              const timeB = new Date(b.timestamp || 0).getTime();
              return timeB - timeA;
            })
          };
        } else {
          // Add new cycle
          const newCycleData = {
            cycle: cycleNumber,
            tradeEvents: events,
            timestamp: events[0].timestamp || new Date().toISOString(),
            lastUpdated: new Date().toISOString()
          };
          newHistoryData = [newCycleData, ...newHistoryData].slice(0, 20);
        }
      });

      // Save to session storage
      try {
        sessionStorage.setItem(getStorageKey(), JSON.stringify(newHistoryData));
      } catch (error) {
        console.error('Error saving trading history to session storage:', error);
      }

      return newHistoryData;
    });
  }, [tradeEvents, getStorageKey]);

  // Removed updateCycleHistory - no longer needed since we only use simple trade events

  // Removed structured cycle data processing - only using simple buy/sell trade events now

  const formatTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    
    // Check if it's already in HH:MM:SS format (from backend)
    if (typeof timestamp === 'string' && /^\d{2}:\d{2}:\d{2}$/.test(timestamp)) {
      return timestamp; // Already formatted as HH:MM:SS
    }
    
    // Check if it's an ISO timestamp
    try {
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
        return date.toLocaleTimeString('en-GB', { 
          hour12: false, 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit' 
        });
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
            {historyData.map((cycleData, index) => {
              const isCurrentCycle = index === 0; // First item is most recent (current cycle)
              return (
              <div key={cycleData.cycle} className={`bg-white ${isCurrentCycle ? 'border-l-4 border-blue-600' : ''}`}>
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
                        <span className={`font-semibold ${isCurrentCycle ? 'text-blue-600' : 'text-gray-900'}`}>
                          Cycle {cycleData.cycle}
                        </span>
                        {isCurrentCycle && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 animate-pulse">
                            LIVE
                          </span>
                        )}
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
                        {/* Show update indicator if data was updated */}
                        {cycleData.lastUpdated && cycleData.lastUpdated !== cycleData.timestamp && (
                          <div className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Updated
                          </div>
                        )}
                        
                        {/* Trade Events Count */}
                        {cycleData.tradeEvents && cycleData.tradeEvents.length > 0 && (
                          <div className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {cycleData.tradeEvents.length} trade{cycleData.tradeEvents.length !== 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                </div>

                {/* Expanded Details - Only Trade Events */}
                {expandedCycles.has(cycleData.cycle) && (
                  <div className="px-6 pb-4 bg-gray-50">
                    {cycleData.tradeEvents && cycleData.tradeEvents.length > 0 ? (
                      <div className="bg-white rounded-lg p-4 border border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                          <span className="text-green-600 mr-2">📊</span>
                          Trading Events
                        </h4>
                        <div className={`space-y-3 ${cycleData.tradeEvents.length > 5 ? 'max-h-96 overflow-y-auto' : ''}`}>
                          {cycleData.tradeEvents.map((event, index) => (
                            <div 
                              key={index}
                              className={`p-3 rounded-lg border transition-all duration-300 ${
                                event.action === 'buy' 
                                  ? 'bg-green-50 border-green-200' 
                                  : 'bg-red-50 border-red-200'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  {event.action === 'buy' ? (
                                    <ArrowUpCircle className="w-5 h-5 text-green-600" />
                                  ) : (
                                    <ArrowDownCircle className="w-5 h-5 text-red-600" />
                                  )}
                                  <div>
                                    <div className={`text-sm font-semibold ${
                                      event.action === 'buy' ? 'text-green-800' : 'text-red-800'
                                    }`}>
                                      {event.action === 'buy' ? 'BUY' : 'SELL'}
                                    </div>
                                    <div className="text-xs text-gray-600 font-mono">{event.symbol}</div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className={`text-sm font-semibold ${
                                    event.action === 'buy' ? 'text-green-800' : 'text-red-800'
                                  }`}>
                                    ₹{formatPrice(event.price)}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    Qty: {event.quantity || 0}
                                  </div>
                                </div>
                                <div className="flex items-center space-x-1 text-sm text-gray-500">
                                  <Clock className="w-3 h-3" />
                                  <span>{formatTime(event.timestamp)}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-500">
                        <p className="text-sm">No trading events for this cycle yet</p>
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

      {/* Footer with cycle count */}
      {Array.isArray(historyData) && historyData.length > 0 && (
        <div className="bg-blue-50 px-6 py-4 border-t">
          <div className="flex items-center justify-between">
            <div className="text-sm text-blue-800">
              Total Cycles: {historyData.length} cycle{historyData.length !== 1 ? 's' : ''} recorded
            </div>
            <div className="text-sm text-blue-600">
              Total Trade Events: {historyData.reduce((sum, c) => sum + (c.tradeEvents?.length || 0), 0)} events
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradingTable;
import React, { useState, useEffect, useCallback } from 'react';
import { History, Clock, ChevronDown, ChevronUp, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';

const PrebuyHistoryTable = ({ strategy, tradeEvents = [], preboughtInstruments = null, currentPrebuyData = null, socketEvents = [] }) => {
  const [historyData, setHistoryData] = useState([]);
  const [expandedCycles, setExpandedCycles] = useState(new Set());
  const [socketEventQueue, setSocketEventQueue] = useState([]);

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
          
          if (eventData.type === 'prebought_instruments') {
            // Update prebought instruments
            newHistoryData[existingIndex] = {
              ...existingCycle,
              preboughtInstruments: eventData.preboughtInstruments,
              lastUpdated: new Date().toISOString(),
              timestamp: existingCycle.timestamp || eventData.timestamp || new Date().toISOString()
            };
          } else if (eventData.type === 'trade_event' && eventData.tradeEvent) {
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
            preboughtInstruments: eventData.type === 'prebought_instruments' ? eventData.preboughtInstruments : null,
            tradeEvents: eventData.type === 'trade_event' && eventData.tradeEvent ? [eventData.tradeEvent] : [],
            timestamp: eventData.timestamp || new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            completed: false
          };
          newHistoryData = [newCycleData, ...newHistoryData].slice(0, 20);
        }
      });

      // Save to session storage
      try {
        sessionStorage.setItem(getStorageKey(), JSON.stringify(newHistoryData));
      } catch (error) {
        console.error('Error saving prebuy history to session storage:', error);
      }

      return newHistoryData;
    });
  }, [socketEvents, getStorageKey]);

  // Cleanup session storage on tab close and component unmount
  useEffect(() => {
    const cleanupStorage = () => {
      try {
        sessionStorage.removeItem(getStorageKey());
        console.log('🧹 PrebuyHistoryTable: Session storage cleared on tab close');
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
          // Update existing cycle
          newHistoryData[existingIndex] = {
            ...newHistoryData[existingIndex],
            lastUpdated: new Date().toISOString(),
            tradeEvents: events
          };
        } else {
          // Add new cycle
          const newCycleData = {
            cycle: cycleNumber,
            tradeEvents: events,
            timestamp: events[0].timestamp || new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            completed: false
          };
          newHistoryData = [newCycleData, ...newHistoryData].slice(0, 20);
        }
      });

      // Save to session storage
      try {
        sessionStorage.setItem(getStorageKey(), JSON.stringify(newHistoryData));
      } catch (error) {
        console.error('Error saving prebuy history to session storage:', error);
      }

      return newHistoryData;
    });
  }, [tradeEvents, getStorageKey]);

  // Process prebought instruments data
  useEffect(() => {
    if (!preboughtInstruments || !preboughtInstruments.cycle) return;

    setHistoryData(prevHistoryData => {
      const cycleNumber = preboughtInstruments.cycle;
      const existingIndex = prevHistoryData.findIndex(item => item.cycle === cycleNumber);

      let newHistoryData = [...prevHistoryData];

      if (existingIndex >= 0) {
        // Update existing cycle with prebought data
        newHistoryData[existingIndex] = {
          ...newHistoryData[existingIndex],
          preboughtInstruments: preboughtInstruments,
          lastUpdated: new Date().toISOString()
        };
      } else {
        // Add new cycle with prebought data
        const newCycleData = {
          cycle: cycleNumber,
          preboughtInstruments: preboughtInstruments,
          tradeEvents: [],
          timestamp: preboughtInstruments.timestamp || new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          completed: false
        };
        newHistoryData = [newCycleData, ...newHistoryData].slice(0, 20);
      }

      // Save to session storage
      try {
        sessionStorage.setItem(getStorageKey(), JSON.stringify(newHistoryData));
      } catch (error) {
        console.error('Error saving prebuy history to session storage:', error);
      }

      return newHistoryData;
    });
  }, [preboughtInstruments, getStorageKey]);

  const formatPrice = (price) => {
    if (typeof price !== 'number' || price === 0) return '-';
    return `₹${price.toFixed(2)}`;
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '-';
    
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
          Trading history for prebuy mode cycles
        </p>
      </div>

      {/* History Table */}
      <div className="overflow-x-auto">
        {historyData.length === 0 ? (
          <div className="text-center py-12">
            <History className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No trading history available</p>
            <p className="text-sm text-gray-500 mt-1">Trades will appear here as they occur</p>
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
                      
                      <div className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {cycleData.tradeEvents?.length || 0} trade{cycleData.tradeEvents?.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Details - Two Column Layout */}
                {expandedCycles.has(cycleData.cycle) && (
                  <div className="px-6 pb-4 bg-gray-50">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      
                      {/* Left Side - Prebought Instruments */}
                      {cycleData.preboughtInstruments && (
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                            <span className="text-blue-600 mr-2">📋</span>
                            Pre-bought Instruments
                          </h4>
                          <div className="space-y-3">
                            {/* PE Instrument */}
                            <div className="flex items-center justify-between p-2 border rounded">
                              <div className="flex items-center space-x-2">
                                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                                <span className="text-sm font-medium">PE</span>
                                <span className="text-xs text-gray-500 font-mono">
                                  {cycleData.preboughtInstruments.peInstrument?.symbol || 'N/A'}
                                </span>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-semibold">
                                  {formatPrice(cycleData.preboughtInstruments.peInstrument?.price)}
                                </div>
                                <div className="text-xs text-gray-500">
                                  Qty: {cycleData.preboughtInstruments.peInstrument?.quantity || 0}
                                </div>
                              </div>
                            </div>
                            {/* CE Instrument */}
                            <div className="flex items-center justify-between p-2 border rounded">
                              <div className="flex items-center space-x-2">
                                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                <span className="text-sm font-medium">CE</span>
                                <span className="text-xs text-gray-500 font-mono">
                                  {cycleData.preboughtInstruments.ceInstrument?.symbol || 'N/A'}
                                </span>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-semibold">
                                  {formatPrice(cycleData.preboughtInstruments.ceInstrument?.price)}
                                </div>
                                <div className="text-xs text-gray-500">
                                  Qty: {cycleData.preboughtInstruments.ceInstrument?.quantity || 0}
                                </div>
                              </div>
                            </div>
                          </div>
                          {cycleData.preboughtInstruments.timestamp && (
                            <div className="text-xs text-gray-500 mt-2 flex items-center">
                              <Clock className="w-3 h-3 mr-1" />
                              {formatTime(cycleData.preboughtInstruments.timestamp)}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Right Side - Event Blocks */}
                      {cycleData.tradeEvents && cycleData.tradeEvents.length > 0 && (
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
                                      {formatPrice(event.price)}
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
                      )}
                    </div>
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

export default PrebuyHistoryTable;

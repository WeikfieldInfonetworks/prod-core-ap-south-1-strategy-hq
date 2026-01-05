import React, { useState, useEffect, useCallback } from 'react';
import { History, Clock, ChevronDown, ChevronUp, ArrowUpCircle, ArrowDownCircle, Download } from 'lucide-react';

const NewXTradingTable = ({ strategy, tradeEvents = [], socketEvents = [] }) => {
  const [historyData, setHistoryData] = useState([]);
  const [expandedCycles, setExpandedCycles] = useState(new Set());
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Session storage key for this strategy
  const getStorageKey = useCallback(() => `new_x_trading_history_${strategy.name || 'new_x'}`, [strategy.name]);

  // Load history from session storage on mount
  useEffect(() => {
    const savedHistory = sessionStorage.getItem(getStorageKey());
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        setHistoryData(parsed);
      } catch (error) {
        console.error('Error loading trading history from session storage:', error);
      }
    }
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
      let processedCount = 0;
      
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
              processedCount++;
            }
          }
        } else {
          // Add new cycle
          const newCycleData = {
            cycle: cycleNumber,
            tradeEvents: eventData.type === 'trade_event' && eventData.tradeEvent ? [eventData.tradeEvent] : [],
            timestamp: eventData.timestamp || new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            completed: false
          };
          newHistoryData = [newCycleData, ...newHistoryData];
          processedCount++;
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
            lastUpdated: new Date().toISOString(),
            completed: false
          };
          newHistoryData = [newCycleData, ...newHistoryData];
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

  const formatPrice = (price) => {
    if (typeof price === 'string') return parseFloat(price).toFixed(2);
    else if (typeof price !== 'number') return '-.--';
    return parseFloat(price).toFixed(2);
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
    if (window.confirm('Are you sure you want to clear all trading history? This action cannot be undone.')) {
      setHistoryData([]);
      sessionStorage.removeItem(getStorageKey());
    }
  };

  // Download PDF function using jsPDF
  const downloadPDF = async () => {
    if (!historyData.length) {
      alert("No history to export");
      return;
    }
  
    // Prompt user for filename
    const defaultFilename = `TradingHistory_${strategy.name}_${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}`;
    
    const userFilename = window.prompt(
      "Enter filename for PDF (without .pdf extension):",
      defaultFilename
    );
    
    if (!userFilename) {
      // User cancelled
      return;
    }
    
    // Sanitize filename (remove invalid characters)
    let sanitizedFilename = userFilename
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') // Remove invalid chars and control characters
      .replace(/^\.+|\.+$/g, '') // Remove leading/trailing dots
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .trim();
    
    // Limit filename length (255 chars is common OS limit, but we'll use 200 for safety)
    if (sanitizedFilename.length > 200) {
      sanitizedFilename = sanitizedFilename.substring(0, 200);
    }
    
    if (!sanitizedFilename) {
      alert("Invalid filename. Please enter a valid name.");
      return;
    }
  
    setIsGeneratingPDF(true);
  
    try {
      const { default: jsPDF } = await import("jspdf");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
  
      const PAGE = {
        width: 210,
        height: 297,
        margin: 12,
        lineHeight: 5,
        sectionSpacing: 6,
      };
  
      let y = PAGE.margin;
  
      // ---- THEME ----
      const COLORS = {
        text: [30, 30, 30],
        faint: [120, 120, 120],
        line: [180, 180, 180],
        box: [240, 240, 240],
        green: [20, 120, 60],
        red: [180, 50, 50],
        yellow: [190, 140, 20],
      };
  
      // ---- HELPERS ----
      const ensureSpace = (needed = 15) => {
        if (y + needed >= PAGE.height - PAGE.margin) {
          pdf.addPage();
          y = PAGE.margin;
        }
      };
  
      const line = () => {
        pdf.setDrawColor(...COLORS.line);
        pdf.line(PAGE.margin, y, PAGE.width - PAGE.margin, y);
        y += PAGE.sectionSpacing;
      };
  
      const text = (t, size = 11, bold = false, color = COLORS.text) => {
        ensureSpace(size * 0.45);
        pdf.setFont("helvetica", bold ? "bold" : "normal");
        pdf.setFontSize(size);
        pdf.setTextColor(...color);
        pdf.text(t, PAGE.margin, y);
        y += PAGE.lineHeight;
      };
  
      const chip = (label, bg = COLORS.box, color = COLORS.text) => {
        const w = pdf.getTextWidth(label) + 6;
        pdf.setFillColor(...bg);
        pdf.setTextColor(...color);
        pdf.roundedRect(PAGE.margin, y - 4, w, 6, 1, 1, "F");
        pdf.text(label, PAGE.margin + 3, y);
        y += PAGE.sectionSpacing;
      };
  
      const box = (title, contentCallback) => {
        ensureSpace(20);
        const boxStartY = y;
        const boxWidth = PAGE.width - PAGE.margin * 2;
  
        pdf.setDrawColor(...COLORS.line);
        pdf.setFillColor(...COLORS.box);
  
        pdf.roundedRect(PAGE.margin, y, boxWidth, 6, 2, 2, "FD");
        pdf.setFontSize(10);
        pdf.text(title, PAGE.margin + 2, y + 4);
  
        y += 10;
        contentCallback();
        const boxEndY = y + 2;
  
        pdf.roundedRect(PAGE.margin, boxStartY, boxWidth, boxEndY - boxStartY, 2, 2);
        y = boxEndY + PAGE.sectionSpacing;
      };
  
      const format = {
        time: (t) =>
          typeof t === "string" && /^\d\d:\d\d:\d\d$/.test(t)
            ? t
            : new Date(t).toLocaleTimeString("en-GB"),
        price: (p) => {
          if (p === null || p === undefined) return "-";
          // Convert to number if it's a string
          const numPrice = typeof p === 'string' ? parseFloat(p) : Number(p);
          if (isNaN(numPrice)) return "-";
          return numPrice.toFixed(2);
        },
      };
  
      // ---- HEADER ----
      text("Trading History", 18, true);
      text(
        `Strategy: ${strategy.name}    |    Generated: ${new Date().toLocaleString()}`,
        9,
        false,
        COLORS.faint
      );
      line();
  
      // ---- BODY: LOOP CYCLES ----
      historyData.forEach((cycle, idx) => {
        ensureSpace(20);
  
        text(`Cycle ${cycle.cycle}`, 14, true);
  
        if (idx === 0)
          chip("LIVE", [220, 240, 255], [20, 80, 160]);
  
        text(
          `Started: ${format.time(cycle.timestamp)}  | Updated: ${format.time(
            cycle.lastUpdated
          )}`,
          9,
          false,
          COLORS.faint
        );
  
        text(`${cycle.tradeEvents?.length || 0} trade(s)`);
  
        box("Trade Events", () => {
          if (!cycle.tradeEvents || !cycle.tradeEvents.length)
            return text("No trades recorded", 10, false, COLORS.faint);
  
          cycle.tradeEvents
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
            .forEach((t) => {
              const color = t.action === "buy" ? COLORS.green : COLORS.red;
              text(
                `${t.action.toUpperCase()} ${t.symbol} — ${format.price(
                  t.price
                )} | Qty: ${t.quantity || 0} @ ${format.time(t.timestamp)}`,
                10,
                true,
                color
              );
            });
        });
  
        line();
      });
  
      pdf.save(`${sanitizedFilename}.pdf`);
  
      setIsGeneratingPDF(false);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate PDF. Please try again.");
      setIsGeneratingPDF(false);
    }
  };

  if (!strategy) return null;

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 px-6 py-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <History className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">Trading History</h3>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">
              {historyData.length} cycle{historyData.length !== 1 ? 's' : ''} recorded
            </span>
            {historyData.length > 0 && (
              <>
                <button
                  onClick={downloadPDF}
                  disabled={isGeneratingPDF}
                  className="flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded border border-blue-200 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Download PDF"
                >
                  <Download className="w-4 h-4" />
                  <span>{isGeneratingPDF ? 'Generating...' : 'Download PDF'}</span>
                </button>
                <button
                  onClick={clearHistory}
                  className="text-sm text-red-600 hover:text-red-800 px-2 py-1 rounded border border-red-200 hover:bg-red-50"
                >
                  Clear History
                </button>
              </>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Live trading history for all cycles
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

                {/* Expanded Details - Trading Events */}
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
    </div>
  );
};

export default NewXTradingTable;

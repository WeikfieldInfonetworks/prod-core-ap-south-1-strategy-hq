import React, { useState, useEffect, useCallback, useRef } from 'react';
import { History, Clock, ChevronDown, ChevronUp, ArrowUpCircle, ArrowDownCircle, Download } from 'lucide-react';
import jsPDF from 'jspdf';

const PrebuyHistoryTable = ({ strategy, tradeEvents = [], preboughtInstruments = null, currentPrebuyData = null, socketEvents = [] }) => {
  const [historyData, setHistoryData] = useState([]);
  const [expandedCycles, setExpandedCycles] = useState(new Set());
  const [socketEventQueue, setSocketEventQueue] = useState([]);
  const [niftyPrices, setNiftyPrices] = useState({}); // Track NIFTY prices per cycle
  const fetchingNiftyRef = useRef(new Set()); // Track cycles we're currently fetching NIFTY for
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Session storage key for this strategy
  const getStorageKey = useCallback(() => `prebuy_history_${strategy.name || 'mtm_v2'}`, [strategy.name]);

  // Function to fetch NIFTY price from backend API
  const fetchNiftyPrice = useCallback(async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const endpoint = `${apiUrl}/api/nifty-price`;
      
      console.log('🌐 PrebuyHistoryTable: Fetching NIFTY price from backend API...');
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success && data.price && typeof data.price === 'number') {
        console.log('✅ PrebuyHistoryTable: Successfully fetched NIFTY price:', data.price);
        return data.price;
      } else {
        throw new Error(data.error || 'Invalid NIFTY price data received');
      }
    } catch (error) {
      console.error('❌ PrebuyHistoryTable: Error fetching NIFTY price:', error);
      console.error('Error details:', error.message, error.stack);
      return null;
    }
  }, []);

  // Load history from session storage on mount
  useEffect(() => {
    const savedHistory = sessionStorage.getItem(getStorageKey());
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        setHistoryData(parsed);
        
        // Restore NIFTY prices from saved history
        const prices = {};
        parsed.forEach(cycleData => {
          if (cycleData.niftyPrice) {
            prices[cycleData.cycle] = cycleData.niftyPrice;
          }
        });
        setNiftyPrices(prices);
      } catch (error) {
        console.error('Error loading prebuy history from session storage:', error);
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

      // Check for buy events and fetch NIFTY price AFTER updating historyData
      newHistoryData.forEach(cycleData => {
        const cycleNum = cycleData.cycle;
        
        // Skip if we already have NIFTY price for this cycle OR if we're already fetching
        if (cycleData.niftyPrice || fetchingNiftyRef.current.has(cycleNum)) {
          return;
        }
        
        // Check if there's a buy event in this cycle
        const hasBuyEvent = cycleData.tradeEvents?.some(event => event.action === 'buy');
        
        if (hasBuyEvent) {
          console.log('🔍 PrebuyHistoryTable: Buy event found in cycle', cycleNum, '- fetching NIFTY price');
          fetchingNiftyRef.current.add(cycleNum); // Mark as fetching
          
          fetchNiftyPrice().then(price => {
            console.log('📊 PrebuyHistoryTable: NIFTY price fetched for cycle', cycleNum, ':', price);
            fetchingNiftyRef.current.delete(cycleNum); // Remove from fetching set
            
            if (price !== null) {
              setNiftyPrices(prev => {
                if (prev[cycleNum]) {
                  console.log('⚠️ PrebuyHistoryTable: NIFTY price already exists for cycle', cycleNum);
                  return prev;
                }
                return { ...prev, [cycleNum]: price };
              });
              
              // Update the cycle data with NIFTY price
              setHistoryData(prevHistoryData => {
                const updated = prevHistoryData.map(item => {
                  if (item.cycle === cycleNum && !item.niftyPrice) {
                    console.log('✅ PrebuyHistoryTable: Adding NIFTY price to cycle', cycleNum);
                    return { ...item, niftyPrice: price };
                  }
                  return item;
                });
                
                // Save to session storage
                try {
                  sessionStorage.setItem(getStorageKey(), JSON.stringify(updated));
                  console.log('💾 PrebuyHistoryTable: NIFTY price saved to session storage for cycle', cycleNum);
                } catch (error) {
                  console.error('Error saving NIFTY price to session storage:', error);
                }
                
                return updated;
              });
            } else {
              console.warn('⚠️ PrebuyHistoryTable: NIFTY price fetch returned null for cycle', cycleNum);
            }
          }).catch(error => {
            console.error('❌ PrebuyHistoryTable: Error fetching NIFTY price for cycle', cycleNum, ':', error);
            fetchingNiftyRef.current.delete(cycleNum); // Remove from fetching set on error
          });
        }
      });

      // Check for buy events and fetch NIFTY price AFTER updating historyData
      newHistoryData.forEach(cycleData => {
        const cycleNum = cycleData.cycle;
        
        // Skip if we already have NIFTY price for this cycle OR if we're already fetching
        if (cycleData.niftyPrice || fetchingNiftyRef.current.has(cycleNum)) {
          return;
        }
        
        // Check if there's a buy event in this cycle
        const hasBuyEvent = cycleData.tradeEvents?.some(event => event.action === 'buy');
        
        if (hasBuyEvent) {
          console.log('🔍 PrebuyHistoryTable: Buy event found in cycle', cycleNum, '- fetching NIFTY price');
          fetchingNiftyRef.current.add(cycleNum); // Mark as fetching
          
          fetchNiftyPrice().then(price => {
            console.log('📊 PrebuyHistoryTable: NIFTY price fetched for cycle', cycleNum, ':', price);
            fetchingNiftyRef.current.delete(cycleNum); // Remove from fetching set
            
            if (price !== null) {
              setNiftyPrices(prev => {
                if (prev[cycleNum]) {
                  console.log('⚠️ PrebuyHistoryTable: NIFTY price already exists for cycle', cycleNum);
                  return prev;
                }
                return { ...prev, [cycleNum]: price };
              });
              
              // Update the cycle data with NIFTY price
              setHistoryData(prevHistoryData => {
                const updated = prevHistoryData.map(item => {
                  if (item.cycle === cycleNum && !item.niftyPrice) {
                    console.log('✅ PrebuyHistoryTable: Adding NIFTY price to cycle', cycleNum);
                    return { ...item, niftyPrice: price };
                  }
                  return item;
                });
                
                // Save to session storage
                try {
                  sessionStorage.setItem(getStorageKey(), JSON.stringify(updated));
                  console.log('💾 PrebuyHistoryTable: NIFTY price saved to session storage for cycle', cycleNum);
                } catch (error) {
                  console.error('Error saving NIFTY price to session storage:', error);
                }
                
                return updated;
              });
            } else {
              console.warn('⚠️ PrebuyHistoryTable: NIFTY price fetch returned null for cycle', cycleNum);
            }
          }).catch(error => {
            console.error('❌ PrebuyHistoryTable: Error fetching NIFTY price for cycle', cycleNum, ':', error);
            fetchingNiftyRef.current.delete(cycleNum); // Remove from fetching set on error
          });
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
  }, [socketEvents, getStorageKey, fetchNiftyPrice]);

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
      // IMPORTANT: Each cycle gets its own NIFTY price (fetched at first buy of that cycle)
      // The price persists for that cycle and does NOT update after being set
      // For each new cycle, a fresh NIFTY price is fetched at the first buy event
      Object.entries(eventsByCycle).forEach(([cycleNum, events]) => {
        const cycleNumber = parseInt(cycleNum);
        const existingIndex = newHistoryData.findIndex(item => item.cycle === cycleNumber);

        if (existingIndex >= 0) {
          // Update existing cycle
          const existingCycle = newHistoryData[existingIndex];
          newHistoryData[existingIndex] = {
            ...existingCycle,
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

      // Check for buy events and fetch NIFTY price AFTER updating historyData
      // IMPORTANT: Each cycle gets its own NIFTY price (fetched at first buy of that cycle)
      // The price is persisted for that cycle and does NOT update after being set
      // For each new cycle, a fresh NIFTY price is fetched at the first buy event
      newHistoryData.forEach(cycleData => {
        const cycleNum = cycleData.cycle;
        
        // Skip if we already have NIFTY price for this cycle OR if we're already fetching
        // This ensures each cycle's NIFTY price is set once and persists
        if (cycleData.niftyPrice || fetchingNiftyRef.current.has(cycleNum)) {
          return;
        }
        
        // Check if there's a buy event in this cycle
        const hasBuyEvent = cycleData.tradeEvents?.some(event => event.action === 'buy');
        
        if (hasBuyEvent) {
          console.log('🔍 PrebuyHistoryTable: First buy event found in tradeEvents for cycle', cycleNum, '- fetching fresh NIFTY price for this cycle');
          fetchingNiftyRef.current.add(cycleNum); // Mark as fetching
          
          fetchNiftyPrice().then(price => {
            console.log('📊 PrebuyHistoryTable: NIFTY price fetched from tradeEvents for cycle', cycleNum, ':', price);
            fetchingNiftyRef.current.delete(cycleNum); // Remove from fetching set
            
            if (price !== null) {
              setNiftyPrices(prev => {
                if (prev[cycleNum]) {
                  console.log('⚠️ PrebuyHistoryTable: NIFTY price already exists for cycle', cycleNum);
                  return prev;
                }
                return { ...prev, [cycleNum]: price };
              });
              
              // Update the cycle data with NIFTY price
              setHistoryData(prevHistoryData => {
                const updated = prevHistoryData.map(item => {
                  if (item.cycle === cycleNum && !item.niftyPrice) {
                    console.log('✅ PrebuyHistoryTable: Adding NIFTY price to cycle', cycleNum, 'from tradeEvents');
                    return { ...item, niftyPrice: price };
                  }
                  return item;
                });
                
                // Save to session storage
                try {
                  sessionStorage.setItem(getStorageKey(), JSON.stringify(updated));
                  console.log('💾 PrebuyHistoryTable: NIFTY price saved from tradeEvents for cycle', cycleNum);
                } catch (error) {
                  console.error('Error saving NIFTY price to session storage:', error);
                }
                
                return updated;
              });
            } else {
              console.warn('⚠️ PrebuyHistoryTable: NIFTY price fetch returned null for cycle', cycleNum);
            }
          }).catch(error => {
            console.error('❌ PrebuyHistoryTable: Error fetching NIFTY price from tradeEvents for cycle', cycleNum, ':', error);
            fetchingNiftyRef.current.delete(cycleNum); // Remove from fetching set on error
          });
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

  // Detect first buy event and fetch NIFTY price (fallback check)
  // This ensures we catch any cycles that might have been missed in socketEvents/tradeEvents processing
  useEffect(() => {
    if (!historyData || historyData.length === 0) return;

    historyData.forEach(cycleData => {
      const cycleNumber = cycleData.cycle;
      
      // Skip if we already have NIFTY price for this cycle OR if we're already fetching
      if (cycleData.niftyPrice || fetchingNiftyRef.current.has(cycleNumber)) {
        return;
      }
      
      // Check if there's a buy event in this cycle
      const hasBuyEvent = cycleData.tradeEvents?.some(event => event.action === 'buy');
      
      if (hasBuyEvent) {
        // Fetch NIFTY price for this cycle (only once per cycle)
        // Each cycle gets its own NIFTY price (the price at the time of first buy)
        console.log('🔍 PrebuyHistoryTable: First buy event detected in historyData check, fetching NIFTY price for cycle', cycleNumber);
        fetchingNiftyRef.current.add(cycleNumber); // Mark as fetching
        
        fetchNiftyPrice().then(price => {
          console.log('📊 PrebuyHistoryTable: NIFTY price fetched from historyData check for cycle', cycleNumber, ':', price);
          fetchingNiftyRef.current.delete(cycleNumber); // Remove from fetching set
          
          if (price !== null) {
            setNiftyPrices(prev => {
              // Double-check we don't already have it (race condition protection)
              if (prev[cycleNumber]) {
                console.log('⚠️ PrebuyHistoryTable: NIFTY price already exists for cycle', cycleNumber);
                return prev;
              }
              
              const updated = { ...prev, [cycleNumber]: price };
              
              // Also update historyData to include NIFTY price
              setHistoryData(prevHistoryData => {
                const updatedHistory = prevHistoryData.map(item => {
                  if (item.cycle === cycleNumber && !item.niftyPrice) {
                    console.log('✅ PrebuyHistoryTable: Adding NIFTY price to cycle', cycleNumber, 'from historyData check');
                    return { ...item, niftyPrice: price };
                  }
                  return item;
                });
                
                // Save to session storage
                try {
                  sessionStorage.setItem(getStorageKey(), JSON.stringify(updatedHistory));
                  console.log('💾 PrebuyHistoryTable: NIFTY price saved from historyData check for cycle', cycleNumber);
                } catch (error) {
                  console.error('Error saving NIFTY price to session storage:', error);
                }
                
                return updatedHistory;
              });
              
              return updated;
            });
          } else {
            console.warn('⚠️ PrebuyHistoryTable: NIFTY price fetch returned null for cycle', cycleNumber);
          }
        }).catch(error => {
          console.error('❌ PrebuyHistoryTable: Error fetching NIFTY price from historyData check for cycle', cycleNumber, ':', error);
          fetchingNiftyRef.current.delete(cycleNumber); // Remove from fetching set on error
        });
      }
    });
  }, [historyData, fetchNiftyPrice, getStorageKey]);

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

  // Generate PDF content HTML
  const generatePDFContent = () => {
    const timestamp = new Date().toLocaleString('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    let html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            * { 
              margin: 0; 
              padding: 0; 
              box-sizing: border-box; 
            }
            body { 
              font-family: Arial, sans-serif;
              padding: 15px;
              background: #ffffff;
              color: #000000;
              font-size: 12px;
            }
            .pdf-header {
              margin-bottom: 25px;
              padding-bottom: 10px;
              border-bottom: 2px solid #000000;
            }
            .pdf-title {
              font-size: 20px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .pdf-meta {
              font-size: 10px;
              color: #666666;
            }
            .cycle-section {
              margin-bottom: 30px;
              page-break-inside: avoid;
              border: 2px solid #000000;
              padding: 15px;
              background: #f9f9f9;
            }
            .cycle-header {
              margin-bottom: 15px;
              padding-bottom: 10px;
              border-bottom: 1px solid #cccccc;
            }
            .cycle-title {
              font-size: 16px;
              font-weight: bold;
              margin-bottom: 5px;
              color: #0000ff;
            }
            .cycle-meta {
              font-size: 10px;
              color: #666666;
            }
            .cycle-badge {
              display: inline-block;
              padding: 2px 6px;
              background: #0000ff;
              color: #ffffff;
              font-size: 9px;
              font-weight: bold;
              margin-left: 8px;
            }
            .containers-wrapper {
              display: table;
              width: 100%;
              border-collapse: separate;
              border-spacing: 15px;
            }
            .container-box {
              display: table-cell;
              width: 50%;
              vertical-align: top;
              border: 2px solid #000000;
              padding: 12px;
              background: #ffffff;
            }
            .container-title {
              font-size: 13px;
              font-weight: bold;
              margin-bottom: 10px;
              padding-bottom: 5px;
              border-bottom: 1px solid #cccccc;
            }
            .item-row {
              margin-bottom: 8px;
              padding: 8px;
              border: 1px solid #cccccc;
              background: #ffffff;
            }
            .item-row.pe {
              border-left: 4px solid #ff0000;
            }
            .item-row.ce {
              border-left: 4px solid #00ff00;
            }
            .item-row.nifty {
              border-left: 4px solid #ffaa00;
              background: #fffacd;
            }
            .item-row.buy {
              border-left: 4px solid #00ff00;
              background: #f0fff0;
            }
            .item-row.sell {
              border-left: 4px solid #ff0000;
              background: #fff0f0;
            }
            .item-header {
              font-weight: bold;
              font-size: 11px;
              margin-bottom: 4px;
            }
            .item-details {
              font-size: 10px;
              color: #333333;
              margin-top: 4px;
            }
            .item-symbol {
              font-family: monospace;
              font-size: 10px;
              color: #666666;
            }
            .item-price {
              font-weight: bold;
              font-size: 11px;
            }
            .item-time {
              font-size: 9px;
              color: #666666;
              margin-top: 3px;
            }
            .no-data {
              text-align: center;
              padding: 20px;
              color: #999999;
              font-size: 11px;
            }
          </style>
        </head>
        <body>
          <div class="pdf-header">
            <div class="pdf-title">Prebuy Trading History</div>
            <div class="pdf-meta">
              Strategy: ${strategy.name || 'MTM V2'} | Generated: ${timestamp} | Total Cycles: ${historyData.length}
            </div>
          </div>
    `;

    if (historyData.length === 0) {
      html += `<div class="no-data">No trading history available</div>`;
    } else {
      historyData.forEach((cycleData, index) => {
        const isCurrentCycle = index === 0;
        
        html += `
          <div class="cycle-section">
            <div class="cycle-header">
              <div class="cycle-title">
                Cycle ${cycleData.cycle}${isCurrentCycle ? '<span class="cycle-badge">LIVE</span>' : ''}
              </div>
              <div class="cycle-meta">
                Started: ${formatTime(cycleData.timestamp)}
                ${cycleData.lastUpdated && cycleData.lastUpdated !== cycleData.timestamp 
                  ? ` | Updated: ${formatTime(cycleData.lastUpdated)}` 
                  : ''}
                | ${cycleData.tradeEvents?.length || 0} trade${(cycleData.tradeEvents?.length || 0) !== 1 ? 's' : ''}
              </div>
            </div>
            
            <div class="containers-wrapper">
              <!-- Container 1: Prebought Instruments + NIFTY -->
              <div class="container-box">
                <div class="container-title">Prebought Instruments & NIFTY</div>
        `;

        // PE Instrument
        if (cycleData.preboughtInstruments?.peInstrument) {
          const pe = cycleData.preboughtInstruments.peInstrument;
          html += `
            <div class="item-row pe">
              <div class="item-header">PE - ${pe.symbol || 'N/A'}</div>
              <div class="item-details">
                <span class="item-price">${formatPrice(pe.price)}</span> | Qty: ${pe.quantity || 0}
              </div>
              ${cycleData.preboughtInstruments.timestamp ? `
                <div class="item-time">Time: ${formatTime(cycleData.preboughtInstruments.timestamp)}</div>
              ` : ''}
            </div>
          `;
        }

        // CE Instrument
        if (cycleData.preboughtInstruments?.ceInstrument) {
          const ce = cycleData.preboughtInstruments.ceInstrument;
          html += `
            <div class="item-row ce">
              <div class="item-header">CE - ${ce.symbol || 'N/A'}</div>
              <div class="item-details">
                <span class="item-price">${formatPrice(ce.price)}</span> | Qty: ${ce.quantity || 0}
              </div>
              ${cycleData.preboughtInstruments.timestamp ? `
                <div class="item-time">Time: ${formatTime(cycleData.preboughtInstruments.timestamp)}</div>
              ` : ''}
            </div>
          `;
        }

        // NIFTY Price
        if (cycleData.niftyPrice) {
          html += `
            <div class="item-row nifty">
              <div class="item-header">NIFTY (NSEI)</div>
              <div class="item-details">
                <span class="item-price">${formatPrice(cycleData.niftyPrice)}</span>
              </div>
              <div class="item-time">At first buy</div>
            </div>
          `;
        }

        if (!cycleData.preboughtInstruments && !cycleData.niftyPrice) {
          html += `<div class="no-data">No prebought instruments</div>`;
        }

        html += `
              </div>
              
              <!-- Container 2: Trading Events (Buy/Sell in order) -->
              <div class="container-box">
                <div class="container-title">Trading Events (Chronological Order)</div>
        `;

        if (cycleData.tradeEvents && cycleData.tradeEvents.length > 0) {
          // Sort events by timestamp to show in chronological order
          const sortedEvents = [...cycleData.tradeEvents].sort((a, b) => {
            const timeA = new Date(a.timestamp || 0).getTime();
            const timeB = new Date(b.timestamp || 0).getTime();
            return timeA - timeB;
          });
          
          sortedEvents.forEach((event) => {
            const isBuy = event.action === 'buy';
            html += `
              <div class="item-row ${isBuy ? 'buy' : 'sell'}">
                <div class="item-header">
                  ${isBuy ? 'BUY' : 'SELL'} - <span class="item-symbol">${event.symbol || 'N/A'}</span>
                </div>
                <div class="item-details">
                  <span class="item-price">${formatPrice(event.price)}</span> | Qty: ${event.quantity || 0}
                </div>
                <div class="item-time">Time: ${formatTime(event.timestamp)}</div>
              </div>
            `;
          });
        } else {
          html += `<div class="no-data">No trading events</div>`;
        }

        html += `
              </div>
            </div>
          </div>
        `;
      });
    }

    html += `
        </body>
      </html>
    `;

    return html;
  };

  // Download PDF function using jsPDF
  const downloadPDF = async () => {
    if (!historyData.length) {
      alert("No history to export");
      return;
    }
  
    setIsGeneratingPDF(true);
  
    import("jspdf").then(({ default: jsPDF }) => {
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
        price: (p) => (p ? `${p.toFixed(2)}` : "-"),
      };
  
      // ---- HEADER ----
      text("Prebuy Trading History", 18, true);
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
  
        text(`${cycle.tradeEvents.length} trade(s)`);
  
        box("Prebought & NIFTY", () => {
          const { peInstrument, ceInstrument } = cycle.preboughtInstruments || {};
  
          if (peInstrument) {
            text(
              `PE ${peInstrument.symbol} | ${format.price(
                peInstrument.price
              )} | Qty: ${peInstrument.quantity}`,
              10,
              false,
              COLORS.red
            );
          }
  
          if (ceInstrument) {
            text(
              `CE ${ceInstrument.symbol} | ${format.price(
                ceInstrument.price
              )} | Qty: ${ceInstrument.quantity}`,
              10,
              false,
              COLORS.green
            );
          }
  
          if (cycle.niftyPrice)
            text(
              `NIFTY: ${format.price(cycle.niftyPrice)} (first buy)`,
              10,
              true,
              COLORS.yellow
            );
  
          if (!peInstrument && !ceInstrument)
            text("No prebought instruments", 10, false, COLORS.faint);
        });
  
        box("Trade Events", () => {
          if (!cycle.tradeEvents.length)
            return text("No trades recorded", 10, false, COLORS.faint);
  
          cycle.tradeEvents
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
            .forEach((t) => {
              const color = t.action === "buy" ? COLORS.green : COLORS.red;
              text(
                `${t.action.toUpperCase()} ${t.symbol} — ${format.price(
                  t.price
                )} | Qty: ${t.quantity} @ ${format.time(t.timestamp)}`,
                10,
                true,
                color
              );
            });
        });
  
        line();
      });
  
      pdf.save(
        `PrebuyHistory_${strategy.name}_${new Date()
          .toISOString()
          .replace(/[:.]/g, "-")}.pdf`
      );
  
      setIsGeneratingPDF(false);
    });
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
                      
                      {/* Left Side - Prebought Instruments and NIFTY */}
                      <div className="bg-white rounded-lg p-4 border border-gray-200">
                        {cycleData.preboughtInstruments ? (
                          <>
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
                              {cycleData.preboughtInstruments.timestamp && (
                                <div className="text-xs text-gray-500 mt-2 flex items-center">
                                  <Clock className="w-3 h-3 mr-1" />
                                  {formatTime(cycleData.preboughtInstruments.timestamp)}
                                </div>
                              )}
                            </div>
                          </>
                        ) : (
                          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                            <span className="text-blue-600 mr-2">📋</span>
                            Cycle Information
                          </h4>
                        )}
                        {/* NIFTY Price - Always show if available */}
                        {cycleData.niftyPrice && (
                          <div className={`mt-3 ${cycleData.preboughtInstruments ? 'border-t pt-3' : ''}`}>
                            <div className="flex items-center justify-between p-2 border rounded bg-yellow-50 border-yellow-200">
                              <div className="flex items-center space-x-2">
                                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                                <span className="text-sm font-medium">NIFTY</span>
                                <span className="text-xs text-gray-500 font-mono">
                                  NSEI
                                </span>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-semibold text-yellow-800">
                                  {formatPrice(cycleData.niftyPrice)}
                                </div>
                                <div className="text-xs text-gray-500">
                                  At first buy
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

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

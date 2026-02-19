import React, { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../../contexts/SocketContext';
import NewXConfigurationBar from './new-x/NewXConfigurationBar';
import NewXBlockProgress from './new-x/NewXBlockProgress';
import NewXInstrumentTiles from './new-x/NewXInstrumentTiles';
import NewXTradingTable from './new-x/NewXTradingTable';

const NewXDashboard = ({ strategy }) => {
  const { socket } = useSocket();
  const [instrumentData, setInstrumentData] = useState({});
  const [tradingActions, setTradingActions] = useState([]);
  const [tradeEvents, setTradeEvents] = useState([]);
  const [socketEventQueue, setSocketEventQueue] = useState([]);
  const [currentDropThreshold, setCurrentDropThreshold] = useState(0.5);
  /** Live block state from strategy_update (Strategy X); overrides strategy snapshot for block progress */
  const [blockState, setBlockState] = useState(null);
  /** Live cycles from strategy_update (Strategy X); overrides for header when present */
  const [liveCycles, setLiveCycles] = useState(null);

  // Helper function to get drop threshold dynamically
  const getDropThreshold = useCallback(() => {
    return currentDropThreshold || 
           strategy.globalDict?.dropThreshold || 
           strategy.globalDictParameters?.dropThreshold?.default || 
           0.5;
  }, [currentDropThreshold, strategy.globalDict?.dropThreshold, strategy.globalDictParameters?.dropThreshold?.default]);

  // Update currentDropThreshold when strategy.globalDict.dropThreshold changes
  useEffect(() => {
    if (strategy.globalDict?.dropThreshold !== undefined) {
      setCurrentDropThreshold(strategy.globalDict.dropThreshold);
    }
  }, [strategy.globalDict?.dropThreshold]);

  // Reset live state when strategy (selection) changes
  useEffect(() => {
    setBlockState(null);
    setLiveCycles(null);
    setInstrumentData({});
  }, [strategy?.name]);

  // Handle strategy status updates (Strategy X emitStrategyUpdate + others)
  const handleStrategyStatusUpdate = useCallback((data) => {
    console.log('NewXDashboard: Strategy status update received', data);

    // Live block state from Strategy X (INIT → UPDATE → TRADE → NEXT CYCLE)
    if (data.block_state) {
      setBlockState(data.block_state);
    }
    if (data.cycles !== undefined && data.cycles !== null) {
      setLiveCycles(data.cycles);
    }
    
    // Handle structured cycle data (prioritize this over instrument_data_update)
    if (data.current_cycle_data) {
      setInstrumentData(prev => ({
        ...prev,
        ...data.current_cycle_data
      }));
    }
    
    if (data.cycle_completion_data) {
      setInstrumentData(prev => ({
        ...prev,
        ...data.cycle_completion_data
      }));
    }

    // Handle instrument data updates (only if no structured data)
    if (data.instrument_data_update && !data.current_cycle_data && !data.cycle_completion_data) {
      setInstrumentData(prev => ({
        ...prev,
        ...data.instrument_data_update
      }));
    }

    // Handle trading actions
    if (data.trade_action) {
      setTradingActions(prev => [...prev, {
        ...data.trade_action,
        timestamp: new Date().toISOString()
      }]);
    }
  }, []);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    const handleStrategyUpdate = (data) => {
      console.log('NewXDashboard: Socket strategy update received', data);
      handleStrategyStatusUpdate(data);
    };

    const handleTradeEvent = (data) => {
      console.log('NewXDashboard: Trade event received', data);
      
      // Extract trade event data
      if (data.action && data.symbol && data.price) {
        const tradeEvent = {
          action: data.action, // 'buy' or 'sell'
          symbol: data.symbol,
          price: data.price,
          quantity: data.quantity || 0,
          timestamp: data.timestamp || new Date().toISOString(),
          cycle: data.cycle || (strategy.universalDict?.cycles || 1)
        };

        // Add to trade events
        setTradeEvents(prev => [...prev, tradeEvent]);

        // Add to socket event queue for trading table
        setSocketEventQueue(prev => [...prev, {
          type: 'trade_event',
          tradeEvent: tradeEvent,
          cycle: tradeEvent.cycle,
          timestamp: tradeEvent.timestamp
        }]);
      }
    };

    socket.on('strategy_update', handleStrategyUpdate);
    socket.on('strategy_trade_event', handleTradeEvent);

    return () => {
      socket.off('strategy_update', handleStrategyUpdate);
      socket.off('strategy_trade_event', handleTradeEvent);
    };
  }, [socket, handleStrategyStatusUpdate, strategy.universalDict?.cycles]);

  // Clear socket event queue periodically to prevent memory buildup
  useEffect(() => {
    const interval = setInterval(() => {
      setSocketEventQueue(prev => {
        // Keep only the last 50 events
        if (prev.length > 50) {
          return prev.slice(-50);
        }
        return prev;
      });
    }, 10000); // Clear every 10 seconds

    return () => clearInterval(interval);
  }, []);

  // Handle parameter updates from ConfigurationBar
  const handleParameterUpdate = useCallback((parameter, value) => {
    console.log('NewXDashboard: Parameter update', { parameter, value });
    
    // Update local state for dropThreshold
    if (parameter === 'dropThreshold') {
      setCurrentDropThreshold(value);
    }
  }, []);

  if (!strategy) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading strategy...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{strategy.name}</h1>
            <p className="text-gray-600 mt-1">{strategy.description}</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Current Cycle</div>
            <div className="text-2xl font-bold text-blue-600">
              {(liveCycles != null ? liveCycles : strategy.universalDict?.cycles ?? 0) + 1}
            </div>
          </div>
        </div>
        
        {/* Strategy Status */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="text-sm text-blue-600 font-medium">Target</div>
            <div className="text-lg font-bold text-blue-800">
              {strategy.globalDict?.target || 9} pts
            </div>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <div className="text-sm text-green-600 font-medium">Second Target</div>
            <div className="text-lg font-bold text-green-800">
              {strategy.globalDict?.secondTarget || 25} pts
            </div>
          </div>
          <div className="bg-orange-50 rounded-lg p-3">
            <div className="text-sm text-orange-600 font-medium">Second Buy Threshold</div>
            <div className="text-lg font-bold text-orange-800">
              {strategy.globalDict?.secondBuyThreshold || 19} pts
            </div>
          </div>
          <div className="bg-purple-50 rounded-lg p-3">
            <div className="text-sm text-purple-600 font-medium">Trading Status</div>
            <div className="text-lg font-bold text-purple-800">
              {strategy.globalDict?.enableTrading ? 'LIVE' : 'PAPER'}
            </div>
          </div>
        </div>
      </div>

      {/* Configuration Bar */}
      <NewXConfigurationBar 
        strategy={strategy} 
        onParameterUpdate={handleParameterUpdate}
      />

      {/* Block Progress: merge live block_state from Strategy X when present */}
      <NewXBlockProgress 
        strategy={{ ...strategy, ...blockState }}
        currentDropThreshold={currentDropThreshold}
      />

      {/* Instrument Tiles: instrumentData from strategy_update overrides config snapshot */}
      <NewXInstrumentTiles 
        strategy={strategy}
        instrumentData={instrumentData}
        currentDropThreshold={currentDropThreshold}
      />

      {/* Trading Table */}
      <NewXTradingTable 
        strategy={strategy}
        tradeEvents={tradeEvents}
        socketEvents={socketEventQueue}
      />
    </div>
  );
};

export default NewXDashboard;


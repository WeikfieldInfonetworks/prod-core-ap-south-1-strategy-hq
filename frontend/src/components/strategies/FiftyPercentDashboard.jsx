import React, { useState, useEffect } from 'react';
import { useSocket } from '../../contexts/SocketContext';
import ConfigurationBar from './mtm-v2/ConfigurationBar';
import BlockProgress from './fifty-percent/BlockProgress';
import InstrumentTiles from './fifty-percent/InstrumentTiles';
import SumTile from './fifty-percent/SumTile';
import TradingTable from './fifty-percent/TradingTable';
import { Activity, AlertCircle } from 'lucide-react';

const FiftyPercentDashboard = ({ strategy }) => {
  const { socket } = useSocket();
  const [instrumentData, setInstrumentData] = useState(null);
  const [blockState, setBlockState] = useState({
    blockInit: true,
    blockUpdate: false,
    blockDiff10: false,
    blockNextCycle: false
  });
  const [tradingActions, setTradingActions] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [fadingNotifications, setFadingNotifications] = useState(new Set());

  useEffect(() => {
    if (!socket) return;

    // Listen for strategy status updates
    socket.on('strategy_status_update', (data) => {
      if (data.blockTransition) {
        // Update block states based on transitions
        const newBlockState = { ...blockState };
        
        // Reset all blocks first
        Object.keys(newBlockState).forEach(key => {
          newBlockState[key] = false;
        });
        
        // Set current block based on the transition
        switch (data.toBlock) {
          case 'INIT':
            newBlockState.blockInit = true;
            break;
          case 'UPDATE':
            newBlockState.blockUpdate = true;
            break;
          case 'DIFF10':
            newBlockState.blockDiff10 = true;
            break;
          case 'NEXT_CYCLE':
            newBlockState.blockNextCycle = true;
            break;
        }
        
        setBlockState(newBlockState);
      }

      // Handle instrument data updates
      if (data.status === 'instrument_data_update') {
        setInstrumentData(data);
      }

      // Add to notifications
      if (data.status != 'instrument_data_update') {
        addNotification({
          type: 'info',
          title: 'Strategy Update',
          message: data.status,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Listen for trade actions
    socket.on('strategy_trade_action', (data) => {
      setTradingActions(prev => [data, ...prev.slice(0, 9)]); // Keep last 10 actions
      
      addNotification({
        type: 'success',
        title: 'Trade Action',
        message: `${data.action}: ${data.symbol} @ ${data.price}`,
        timestamp: new Date().toISOString()
      });
    });

    // Listen for parameter updates
    socket.on('strategy_parameter_updated', (data) => {
      addNotification({
        type: 'info',
        title: 'Parameter Updated',
        message: `${data.parameter}: ${data.oldValue} → ${data.newValue}`,
        timestamp: new Date().toISOString()
      });
    });

    // Listen for errors
    socket.on('strategy_parameter_error', (data) => {
      addNotification({
        type: 'error',
        title: 'Parameter Error',
        message: data.error,
        timestamp: new Date().toISOString()
      });
    });

    return () => {
      socket.off('strategy_status_update');
      socket.off('strategy_trade_action');
      socket.off('strategy_parameter_updated');
      socket.off('strategy_parameter_error');
    };
  }, [socket]);

  const addNotification = (notification) => {
    const notificationWithId = { ...notification, id: Date.now() };
    setNotifications(prev => [
      notificationWithId,
      ...prev.slice(0, 4) // Keep last 5 notifications
    ]);
    
    // Auto-dismiss notification after 2 seconds
    setTimeout(() => {
      removeNotification(notificationWithId.id);
    }, 2000);
  };

  const removeNotification = (id) => {
    // Add to fading set to trigger fade-out animation
    setFadingNotifications(prev => new Set(prev).add(id));
    
    // Remove from notifications after animation completes
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
      setFadingNotifications(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }, 300); // Match animation duration
  };

  if (!strategy) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Loading Fifty Percent Strategy Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`p-4 rounded-lg shadow-lg border-l-4 cursor-pointer transition-all duration-300 hover:opacity-80 ${
                notification.type === 'error' 
                  ? 'bg-red-50 border-red-400 text-red-800'
                  : notification.type === 'success'
                  ? 'bg-green-50 border-green-400 text-green-800'
                  : 'bg-blue-50 border-blue-400 text-blue-800'
              } ${fadingNotifications.has(notification.id) ? 'animate-slide-out' : 'animate-slide-in'}`}
              onClick={() => removeNotification(notification.id)}
            >
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 mt-0.5 mr-2" />
                <div className="flex-1">
                  <h4 className="text-sm font-medium">{notification.title}</h4>
                  <p className="text-xs mt-1">{notification.message}</p>
                  {/* Auto-dismiss progress bar */}
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-1 overflow-hidden">
                    <div 
                      className={`h-1 rounded-full ${
                        notification.type === 'error' 
                          ? 'bg-red-400' 
                          : notification.type === 'success'
                          ? 'bg-green-400'
                          : 'bg-blue-400'
                      }`}
                      style={{
                        width: '100%',
                        animation: 'shrink 2s linear forwards'
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Fifty Percent Strategy Dashboard</h2>
            <p className="text-gray-600 mt-1">{strategy.description}</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Current Cycle</div>
            <div className="text-2xl font-bold text-blue-600">
              {strategy.universalDict?.cycles || 0}
            </div>
          </div>
        </div>
      </div>

      {/* Configuration Bar */}
      <ConfigurationBar strategy={strategy} />

      {/* Block Progress */}
      <BlockProgress blockState={blockState} />

      {/* Instrument Tiles Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <InstrumentTiles 
          strategy={strategy}
          instrumentData={instrumentData} 
        />
        <SumTile 
          strategy={strategy}
          instrumentData={instrumentData} 
        />
      </div>

      {/* Trading Table */}
      <TradingTable 
        strategy={strategy} 
        instrumentData={instrumentData}
        tradingActions={tradingActions}
      />
    </div>
  );
};

export default FiftyPercentDashboard;

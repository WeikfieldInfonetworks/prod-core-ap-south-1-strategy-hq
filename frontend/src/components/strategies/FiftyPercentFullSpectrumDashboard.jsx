import React, { useState, useEffect } from 'react';
import { useSocket } from '../../contexts/SocketContext';
import BlockProgress from './fifty-percent-full-spectrum/BlockProgress';
import ConfigurationBar from './fifty-percent-full-spectrum/ConfigurationBar';
import InstrumentTiles from './fifty-percent-full-spectrum/InstrumentTiles';
import TradingTable from './fifty-percent-full-spectrum/TradingTable';
import { Activity, TrendingUp, Target, AlertTriangle, Clock, CheckCircle, XCircle, Info } from 'lucide-react';

const FiftyPercentFullSpectrumDashboard = ({ strategy }) => {
  const { socket } = useSocket();
  const [instrumentData, setInstrumentData] = useState(null);
  const [tradingActions, setTradingActions] = useState([]);
  const [allInstrumentsData, setAllInstrumentsData] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [fadingNotifications, setFadingNotifications] = useState(new Set());

  const addNotification = (notification) => {
    const notificationWithId = { ...notification, id: Date.now() };
    setNotifications(prev => [
      notificationWithId,
      ...prev.slice(0, 4) // Keep last 5 notifications
    ]);
    
    // Auto-dismiss notification after 3 seconds
    setTimeout(() => {
      removeNotification(notificationWithId.id);
    }, 3000);
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

  useEffect(() => {
    if (!socket || !strategy) return;

    // Listen for strategy status updates
    const handleStrategyStatusUpdate = (data) => {
      if (data.blockTransition) {
        // Handle block transitions if needed
        // The block state is already managed by the strategy object
      }

      // Handle instrument data updates
      if (data.status === 'instrument_data_update') {
        setInstrumentData(data);
        
        // Update all instruments data for the table
        if (data.instrumentMap) {
          setAllInstrumentsData(data.instrumentMap);
        }
      }

      // Handle half drop detection specifically
      if (data.halfDropDetected) {
        addNotification({
          type: 'warning',
          title: 'Half Drop Detected!',
          message: data.message || `50% drop detected in ${data.instrument}`,
          timestamp: new Date().toISOString(),
          data: {
            instrument: data.instrument,
            lowAtRef: data.lowAtRef,
            firstPrice: data.firstPrice,
            dropPercentage: data.dropPercentage
          }
        });
      }

      // Add to notifications for other status updates
      if (data.status !== 'instrument_data_update' && !data.halfDropDetected) {
        addNotification({
          type: 'info',
          title: 'Strategy Update',
          message: data.status,
          timestamp: new Date().toISOString()
        });
      }
    };

    // Listen for parameter updates
    const handleParameterUpdated = (data) => {
      addNotification({
        type: 'success',
        title: 'Parameter Updated',
        message: `${data.parameter}: ${data.oldValue} → ${data.newValue}`,
        timestamp: new Date().toISOString()
      });
    };

    // Listen for parameter errors
    const handleParameterError = (data) => {
      addNotification({
        type: 'error',
        title: 'Parameter Error',
        message: data.error,
        timestamp: new Date().toISOString()
      });
    };

    // Listen for trading actions
    const handleTradingAction = (data) => {
      setTradingActions(prev => [data, ...prev].slice(0, 50)); // Keep last 50 actions
      
      addNotification({
        type: 'success',
        title: 'Trade Action',
        message: `${data.action}: ${data.symbol} @ ${data.price}`,
        timestamp: new Date().toISOString()
      });
    };

    // Listen for instrument data updates (legacy)
    const handleInstrumentUpdate = (data) => {
      if (data.strategyName === strategy.name) {
        setInstrumentData(data);
        
        // Update all instruments data for the table
        if (data.instrumentMap) {
          setAllInstrumentsData(data.instrumentMap);
        }
      }
    };

    // Register all socket listeners
    socket.on('strategy_status_update', handleStrategyStatusUpdate);
    socket.on('strategy_parameter_updated', handleParameterUpdated);
    socket.on('strategy_parameter_error', handleParameterError);
    socket.on('strategy_trade_action', handleTradingAction);
    socket.on('instrument_data_update', handleInstrumentUpdate);
    socket.on('trading_action', handleTradingAction);

    return () => {
      socket.off('strategy_status_update', handleStrategyStatusUpdate);
      socket.off('strategy_parameter_updated', handleParameterUpdated);
      socket.off('strategy_parameter_error', handleParameterError);
      socket.off('strategy_trade_action', handleTradingAction);
      socket.off('instrument_data_update', handleInstrumentUpdate);
      socket.off('trading_action', handleTradingAction);
    };
  }, [socket, strategy]);

  if (!strategy) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Loading strategy data...</p>
        </div>
      </div>
    );
  }

  const blockState = {
    blockInit: strategy.blockInit,
    blockUpdate: strategy.blockUpdate,
    blockDiff10: strategy.blockDiff10,
    blockNextCycle: strategy.blockNextCycle
  };

  const formatPrice = (price) => {
    if (price === undefined || price === null || price === -1) return 'N/A';
    return price.toFixed(2);
  };

  const formatChange = (change) => {
    if (change === undefined || change === null || change === -1) return 'N/A';
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}`;
  };

  const getChangeColor = (change) => {
    if (change === undefined || change === null || change === -1) return 'text-gray-500';
    return change >= 0 ? 'text-green-600' : 'text-red-600';
  };

  // Filter instruments in the 20-100 price range
  const getInstrumentsInRange = () => {
    const instrumentMap = allInstrumentsData || strategy.universalDict?.instrumentMap || {};
    const instruments = Object.values(instrumentMap).filter(instrument => {
      return instrument.last >= 20 && instrument.last <= 100;
    });
    
    // Sort by current price
    return instruments.sort((a, b) => a.last - b.last);
  };

  const instrumentsInRange = getInstrumentsInRange();

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-orange-50 border-orange-200 text-orange-800';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`max-w-sm p-4 rounded-lg border shadow-lg transition-all duration-300 ${
                fadingNotifications.has(notification.id)
                  ? 'opacity-0 transform translate-x-full'
                  : 'opacity-100 transform translate-x-0'
              } ${getNotificationColor(notification.type)}`}
            >
              <div className="flex items-start space-x-3">
                {getNotificationIcon(notification.type)}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium">{notification.title}</h4>
                  <p className="text-sm mt-1">{notification.message}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(notification.timestamp).toLocaleTimeString()}
                  </p>
                </div>
                <button
                  onClick={() => removeNotification(notification.id)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Strategy Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{strategy.name}</h2>
            <p className="text-gray-600 mt-1">{strategy.description}</p>
          </div>
          <div className="flex items-center space-x-4 text-sm text-gray-600">
            <div className="text-center">
              <div className="font-semibold text-gray-900">{strategy.universalDict?.cycles || 0}</div>
              <div>Cycles</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-gray-900">{instrumentsInRange.length}</div>
              <div>Instruments (20-100)</div>
            </div>
            <div className="text-center">
              <div className={`font-semibold ${
                instrumentData?.halfdrop_flag ? 'text-orange-600' : 'text-gray-900'
              }`}>
                {instrumentData?.halfdrop_flag ? 'DETECTED' : 'MONITORING'}
              </div>
              <div>Half Drop</div>
            </div>
          </div>
        </div>
      </div>

      {/* Block Progress */}
      <BlockProgress blockState={blockState} />

      {/* Configuration */}
      <ConfigurationBar strategy={strategy} />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Instruments Tracking Table */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Price Range Monitoring (20-100)</h3>
                  <p className="text-sm text-gray-600 mt-1">Tracking instruments for 50% drop detection</p>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="text-sm text-gray-600">
                    Target Range: 20-100 | Drop Threshold: 50%
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto max-h-96">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Symbol
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Current
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      First Price
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Change
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Change %
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Low at Ref
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Peak
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {instrumentsInRange.length > 0 ? (
                    instrumentsInRange.map((instrument) => {
                      const changePercent = instrument.firstPrice ? 
                        ((instrument.last - instrument.firstPrice) / instrument.firstPrice * 100) : 0;
                      const dropPercent = instrument.firstPrice && instrument.lowAtRef !== -1 ? 
                        ((instrument.lowAtRef / instrument.firstPrice) * 100) : 100;
                      const hasHalfDrop = dropPercent <= 50;
                      
                      return (
                        <tr key={instrument.token} className={`hover:bg-gray-50 ${
                          hasHalfDrop ? 'bg-red-50 border-l-4 border-red-400' : ''
                        }`}>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-900">
                            {instrument.symbol}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-900">
                            {formatPrice(instrument.last)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-600">
                            {formatPrice(instrument.firstPrice)}
                          </td>
                          <td className={`px-4 py-3 whitespace-nowrap text-sm font-mono ${getChangeColor(instrument.plus3)}`}>
                            {formatChange(instrument.plus3)}
                          </td>
                          <td className={`px-4 py-3 whitespace-nowrap text-sm font-mono ${getChangeColor(changePercent)}`}>
                            {changePercent.toFixed(2)}%
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-600">
                            {formatPrice(instrument.lowAtRef)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-600">
                            {formatPrice(instrument.peak)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {hasHalfDrop ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                50% Drop ({dropPercent.toFixed(1)}%)
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <TrendingUp className="h-3 w-3 mr-1" />
                                Monitoring
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="8" className="px-4 py-12 text-center text-gray-500">
                        <Clock className="h-8 w-8 mx-auto mb-2" />
                        <p className="text-sm">No instruments in range (20-100)</p>
                        <p className="text-xs mt-1">Waiting for market data...</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Instrument Tiles */}
        <div className="space-y-4">
          <InstrumentTiles 
            strategy={strategy} 
            instrumentData={instrumentData}
          />
        </div>
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

export default FiftyPercentFullSpectrumDashboard;

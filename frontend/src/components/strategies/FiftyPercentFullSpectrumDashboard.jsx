import React, { useState, useEffect } from 'react';
import { useSocket } from '../../contexts/SocketContext';
import BlockProgress from './fifty-percent-full-spectrum/BlockProgress';
import ConfigurationBar from './mtm-v2/ConfigurationBar';
import InstrumentTiles from './fifty-percent-full-spectrum/InstrumentTiles';
import TradingTable from './fifty-percent-full-spectrum/TradingTable';
import { Activity, TrendingUp, Target, AlertTriangle, Clock } from 'lucide-react';

const FiftyPercentFullSpectrumDashboard = ({ strategy }) => {
  const { socket } = useSocket();
  const [instrumentData, setInstrumentData] = useState(null);
  const [tradingActions, setTradingActions] = useState([]);
  const [allInstrumentsData, setAllInstrumentsData] = useState({});

  useEffect(() => {
    if (!socket || !strategy) return;

    // Listen for instrument data updates
    const handleInstrumentUpdate = (data) => {
      if (data.strategyName === strategy.name) {
        setInstrumentData(data);
        
        // Update all instruments data for the table
        if (data.instrumentMap) {
          setAllInstrumentsData(data.instrumentMap);
        }
      }
    };

    // Listen for trading actions
    const handleTradingAction = (data) => {
      if (data.strategyName === strategy.name) {
        setTradingActions(prev => [data, ...prev].slice(0, 50)); // Keep last 50 actions
      }
    };

    socket.on('instrument_data_update', handleInstrumentUpdate);
    socket.on('trading_action', handleTradingAction);

    return () => {
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

  return (
    <div className="space-y-6">
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

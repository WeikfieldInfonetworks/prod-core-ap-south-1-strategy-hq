import React, { useState, useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';
import AuthenticationForm from './AuthenticationForm';
import StrategySelector from './StrategySelector';
import ConnectionStatus from './ConnectionStatus';
import MTMv2Dashboard from './strategies/MTMv2Dashboard';
import FiftyPercentDashboard from './strategies/FiftyPercentDashboard';
import { Settings, Activity, TrendingUp } from 'lucide-react';

const SuperDashboard = ({ connectionStatus }) => {
  const { 
    user, 
    strategies, 
    currentStrategy, 
    isAuthenticated,
    selectStrategy 
  } = useSocket();

  const [selectedStrategyName, setSelectedStrategyName] = useState('');

  useEffect(() => {
    if (currentStrategy) {
      setSelectedStrategyName(currentStrategy.name);
    }
  }, [currentStrategy]);

  const handleStrategyChange = (strategyName) => {
    setSelectedStrategyName(strategyName);
    selectStrategy(strategyName);
  };

  const renderStrategyDashboard = () => {
    if (!currentStrategy) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <TrendingUp className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Strategy Selected</h3>
            <p className="text-gray-600">Please select a strategy from the dropdown above to view its dashboard.</p>
          </div>
        </div>
      );
    }

    // Route to specific strategy dashboards
    switch (currentStrategy.name) {
      case 'MTM V2 Strategy':
        return <MTMv2Dashboard strategy={currentStrategy} />;
      case 'Fifty Percent Strategy New':
        return <FiftyPercentDashboard strategy={currentStrategy} />;
      default:
        return (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Settings className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Strategy Dashboard Not Available</h3>
              <p className="text-gray-600">
                Dashboard for "{currentStrategy.name}" is not yet implemented.
              </p>
            </div>
          </div>
        );
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-lg shadow-md p-8">
              <div className="text-center mb-8">
                <Activity className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                <h1 className="text-2xl font-bold text-gray-900">Strategy HQ</h1>
                <p className="text-gray-600 mt-2">Connect to your trading strategies</p>
              </div>
              <ConnectionStatus status={connectionStatus} />
              <AuthenticationForm />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Activity className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Strategy HQ</h1>
              <ConnectionStatus status={connectionStatus} size="small" />
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Welcome, {user?.userName}
              </span>
              <div className="h-8 w-8 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {user?.userName?.charAt(0)?.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Strategy Selection Bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-6 py-4">
          <StrategySelector
            strategies={strategies}
            currentStrategy={selectedStrategyName}
            onStrategyChange={handleStrategyChange}
          />
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1">
        <div className="container mx-auto px-6 py-6">
          {renderStrategyDashboard()}
        </div>
      </main>
    </div>
  );
};

export default SuperDashboard;

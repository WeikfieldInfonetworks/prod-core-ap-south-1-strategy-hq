import React from 'react';
import { Wifi, WifiOff, Loader } from 'lucide-react';

const ConnectionStatus = ({ status, size = 'normal' }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          icon: Wifi,
          text: 'Connected',
          className: 'text-green-600 bg-green-50',
          dotClassName: 'bg-green-500'
        };
      case 'disconnected':
        return {
          icon: WifiOff,
          text: 'Disconnected',
          className: 'text-red-600 bg-red-50',
          dotClassName: 'bg-red-500'
        };
      case 'connecting':
        return {
          icon: Loader,
          text: 'Connecting',
          className: 'text-yellow-600 bg-yellow-50',
          dotClassName: 'bg-yellow-500 animate-pulse'
        };
      case 'error':
        return {
          icon: WifiOff,
          text: 'Connection Error',
          className: 'text-red-600 bg-red-50',
          dotClassName: 'bg-red-500'
        };
      default:
        return {
          icon: Loader,
          text: 'Unknown',
          className: 'text-gray-600 bg-gray-50',
          dotClassName: 'bg-gray-500'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  if (size === 'small') {
    return (
      <div className="flex items-center space-x-2">
        <div className={`w-2 h-2 rounded-full ${config.dotClassName}`}></div>
        <span className="text-sm text-gray-600">{config.text}</span>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${config.className}`}>
      <Icon 
        className={`w-4 h-4 mr-2 ${status === 'connecting' ? 'animate-spin' : ''}`} 
      />
      {config.text}
    </div>
  );
};

export default ConnectionStatus;

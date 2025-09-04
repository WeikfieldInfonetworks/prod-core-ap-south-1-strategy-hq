import React from 'react';
import { CheckCircle, Circle, Clock, AlertTriangle } from 'lucide-react';

const BlockProgress = ({ blockState }) => {
  const blocks = [
    {
      id: 'blockInit',
      name: 'INIT',
      description: 'Token Selection',
      icon: Circle,
      status: blockState.blockInit ? 'active' : blockState.blockUpdate || blockState.blockDiff10 || blockState.blockNextCycle ? 'completed' : 'pending'
    },
    {
      id: 'blockUpdate',
      name: 'UPDATE',
      description: 'Price Monitoring',
      icon: Clock,
      status: blockState.blockUpdate ? 'active' : blockState.blockDiff10 || blockState.blockNextCycle ? 'completed' : 'pending'
    },
    {
      id: 'blockDiff10',
      name: 'DIFF10',
      description: 'Trading Execution',
      icon: AlertTriangle,
      status: blockState.blockDiff10 ? 'active' : blockState.blockNextCycle ? 'completed' : 'pending'
    },
    {
      id: 'blockNextCycle',
      name: 'NEXT CYCLE',
      description: 'Cycle Reset',
      icon: CheckCircle,
      status: blockState.blockNextCycle ? 'active' : 'pending'
    }
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-blue-500 text-white';
      case 'completed':
        return 'bg-green-500 text-white';
      case 'pending':
        return 'bg-gray-300 text-gray-600';
      default:
        return 'bg-gray-300 text-gray-600';
    }
  };

  const getStatusIcon = (block) => {
    const IconComponent = block.icon;
    const isActive = block.status === 'active';
    const isCompleted = block.status === 'completed';
    
    if (isCompleted) {
      return <CheckCircle className="h-5 w-5" />;
    }
    
    return <IconComponent className={`h-5 w-5 ${isActive ? 'animate-pulse' : ''}`} />;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Strategy Progress</h3>
      
      <div className="flex items-center justify-between">
        {blocks.map((block, index) => (
          <div key={block.id} className="flex flex-col items-center space-y-2 flex-1">
            {/* Block Circle */}
            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${getStatusColor(block.status)}`}>
              {getStatusIcon(block)}
            </div>
            
            {/* Block Name */}
            <div className="text-center">
              <div className={`text-sm font-medium ${block.status === 'active' ? 'text-blue-600' : block.status === 'completed' ? 'text-green-600' : 'text-gray-500'}`}>
                {block.name}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {block.description}
              </div>
            </div>
            
            {/* Connector Line */}
            {index < blocks.length - 1 && (
              <div className={`absolute top-6 left-1/2 w-full h-0.5 -z-10 ${
                block.status === 'completed' ? 'bg-green-500' : 'bg-gray-300'
              }`} 
              style={{ 
                left: `${(index + 1) * (100 / blocks.length) - (100 / blocks.length / 2)}%`,
                width: `${100 / blocks.length}%`
              }} />
            )}
          </div>
        ))}
      </div>
      
      {/* Current Status Text */}
      <div className="mt-6 text-center">
        <div className="text-sm text-gray-600">
          Current Status: 
          <span className="ml-2 font-medium text-gray-900">
            {blocks.find(block => block.status === 'active')?.name || 'INIT'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default BlockProgress;

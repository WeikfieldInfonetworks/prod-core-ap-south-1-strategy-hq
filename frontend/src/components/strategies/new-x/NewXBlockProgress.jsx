import React from 'react';
import { Play, Target, TrendingUp, RotateCcw, CheckCircle } from 'lucide-react';

const NewXBlockProgress = ({ strategy, currentDropThreshold }) => {
  const blocks = [
    {
      key: 'blockInit',
      name: 'INIT',
      description: 'Initialize & Select Tokens',
      icon: Play,
      color: 'blue'
    },
    {
      key: 'blockUpdate',
      name: 'UPDATE',
      description: 'Monitor Price Updates',
      icon: Target,
      color: 'purple'
    },
    {
      key: 'blockDiff10',
      name: 'TRADE',
      description: 'Execute Trading Logic',
      icon: TrendingUp,
      color: 'green'
    },
    {
      key: 'blockNextCycle',
      name: 'NEXT CYCLE',
      description: 'Reset for Next Cycle',
      icon: RotateCcw,
      color: 'orange'
    }
  ];

  // Helper function to get drop threshold dynamically
  const getDropThreshold = () => {
    return currentDropThreshold || 
           strategy.globalDict?.dropThreshold || 
           strategy.globalDictParameters?.dropThreshold?.default || 
           0.5;
  };

  const getBlockStatus = (blockKey) => {
    if (strategy[blockKey]) {
      return 'active';
    }
    
    // Determine if block is completed based on progression
    const blockOrder = ['blockInit', 'blockUpdate', 'blockDiff10', 'blockNextCycle'];
    const currentIndex = blockOrder.findIndex(key => strategy[key]);
    const blockIndex = blockOrder.findIndex(key => key === blockKey);
    
    if (currentIndex > blockIndex) {
      return 'completed';
    }
    
    return 'pending';
  };

  const getStatusStyles = (status, color) => {
    const baseStyles = "transition-all duration-300 transform";
    
    switch (status) {
      case 'active':
        return `${baseStyles} bg-${color}-600 text-white shadow-lg scale-110 animate-pulse`;
      case 'completed':
        return `${baseStyles} bg-green-600 text-white shadow-md`;
      case 'pending':
        return `${baseStyles} bg-gray-200 text-gray-600`;
      default:
        return `${baseStyles} bg-gray-200 text-gray-600`;
    }
  };

  const getConnectorStyles = (index) => {
    const currentBlock = blocks[index];
    const nextBlock = blocks[index + 1];
    
    if (!nextBlock) return '';
    
    const currentStatus = getBlockStatus(currentBlock.key);
    const nextStatus = getBlockStatus(nextBlock.key);
    
    if (currentStatus === 'completed') {
      return 'bg-green-400';
    } else if (currentStatus === 'active' && nextStatus !== 'pending') {
      return 'bg-blue-400';
    } else {
      return 'bg-gray-300';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">New X Strategy Progress</h3>
        <div className="text-sm text-gray-500">
          Current Phase: {blocks.find(block => strategy[block.key])?.name || 'Initializing'}
        </div>
      </div>

      <div className="flex items-center justify-between">
        {blocks.map((block, index) => {
          const status = getBlockStatus(block.key);
          const Icon = block.icon;
          
          return (
            <React.Fragment key={block.key}>
              {/* Block Circle */}
              <div className="flex flex-col items-center space-y-3 flex-1">
                <div
                  className={`
                    w-16 h-16 rounded-full flex items-center justify-center
                    ${getStatusStyles(status, block.color)}
                  `}
                >
                  {status === 'completed' ? (
                    <CheckCircle className="w-8 h-8" />
                  ) : (
                    <Icon className="w-8 h-8" />
                  )}
                </div>
                
                <div className="text-center">
                  <div className={`
                    text-sm font-semibold
                    ${status === 'active' ? `text-${block.color}-600` : 
                      status === 'completed' ? 'text-green-600' : 'text-gray-600'}
                  `}>
                    {block.name}
                  </div>
                  <div className="text-xs text-gray-500 mt-1 max-w-20">
                    {block.description}
                  </div>
                </div>
              </div>

              {/* Connector Line */}
              {index < blocks.length - 1 && (
                <div className="flex-1 flex items-center justify-center px-4">
                  <div 
                    className={`
                      h-2 w-full rounded-full transition-all duration-500
                      ${getConnectorStyles(index)}
                    `}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Status Messages */}
      <div className="mt-6 text-center">
        {strategy.blockInit && (
          <p className="text-sm text-blue-600">
            🔍 Analyzing market data and selecting optimal instruments...
          </p>
        )}
        {strategy.blockUpdate && (
          <p className="text-sm text-purple-600">
            📊 Monitoring price updates and tracking instrument performance...
          </p>
        )}
        {strategy.blockDiff10 && (
          <p className="text-sm text-green-600">
            💹 Executing dual instrument trading strategy...
          </p>
        )}
        {strategy.blockNextCycle && (
          <p className="text-sm text-orange-600">
            🔄 Preparing for next trading cycle...
          </p>
        )}
      </div>

      {/* Trading Status Indicators */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className={`p-3 rounded-lg ${strategy.halfdrop_bought ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
          <div className="text-xs font-medium">First Buy</div>
          <div className="text-sm font-bold">{strategy.halfdrop_bought ? 'COMPLETED' : 'PENDING'}</div>
        </div>
        <div className={`p-3 rounded-lg ${strategy.halfdrop_sold ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
          <div className="text-xs font-medium">First Sell</div>
          <div className="text-sm font-bold">{strategy.halfdrop_sold ? 'COMPLETED' : 'PENDING'}</div>
        </div>
        <div className={`p-3 rounded-lg ${strategy.other_bought ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
          <div className="text-xs font-medium">Second Buy</div>
          <div className="text-sm font-bold">{strategy.other_bought ? 'COMPLETED' : 'PENDING'}</div>
        </div>
        <div className={`p-3 rounded-lg ${strategy.other_sold ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
          <div className="text-xs font-medium">Second Sell</div>
          <div className="text-sm font-bold">{strategy.other_sold ? 'COMPLETED' : 'PENDING'}</div>
        </div>
      </div>
    </div>
  );
};

export default NewXBlockProgress;


import React from 'react';
import { Play, Activity, TrendingUp, RotateCcw, CheckCircle } from 'lucide-react';

const BlockProgress = ({ blockState, strategy, currentDropThreshold }) => {
  // Helper function to get drop threshold with multiple fallbacks
  const getDropThreshold = () => {
    const threshold = currentDropThreshold || 
                     strategy?.globalDict?.dropThreshold || 
                     strategy?.globalDictParameters?.dropThreshold?.default ||
                     0.5; // Default fallback
    
    return (threshold * 100).toFixed(0);
  };

  const blocks = [
    {
      key: 'blockInit',
      name: 'INIT',
      description: 'Initialize & Select Tokens (20-100)',
      icon: Play,
      color: 'blue'
    },
    {
      key: 'blockUpdate',
      name: 'UPDATE',
      description: `Monitor ${getDropThreshold()}% Drop Detection`,
      icon: Activity,
      color: 'purple'
    },
    {
      key: 'blockDiff10',
      name: 'DIFF10',
      description: 'Track CE/PE & Execute Trades',
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

  const getBlockStatus = (blockKey) => {
    if (blockState[blockKey]) {
      return 'active';
    }
    
    // Determine if block is completed based on progression
    const blockOrder = ['blockInit', 'blockUpdate', 'blockDiff10', 'blockNextCycle'];
    const currentIndex = blockOrder.findIndex(key => blockState[key]);
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
        <h3 className="text-lg font-semibold text-gray-900">Strategy Block Progress</h3>
        <div className="text-sm text-gray-500">
          Current Phase: {blocks.find(block => blockState[block.key])?.name || 'Initializing'}
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
                  <div className="text-xs text-gray-500 mt-1 max-w-24">
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
        {blockState.blockInit && (
          <p className="text-sm text-blue-600">
            🔍 Analyzing instruments in 20-100 range for optimal selection...
          </p>
        )}
        {blockState.blockUpdate && (
          <p className="text-sm text-purple-600">
            📊 Monitoring for {getDropThreshold()}% price drops and selecting CE/PE under 200...
          </p>
        )}
        {blockState.blockDiff10 && (
          <p className="text-sm text-green-600">
            💹 Tracking CE/PE instruments and executing trades on -15 stoploss...
          </p>
        )}
        {blockState.blockNextCycle && (
          <p className="text-sm text-orange-600">
            🔄 Preparing for next trading cycle...
          </p>
        )}
      </div>
    </div>
  );
};

export default BlockProgress;

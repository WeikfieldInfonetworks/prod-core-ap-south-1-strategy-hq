import React from 'react';
import { GitBranch } from 'lucide-react';

/**
 * Live default strategy mode from strategy.defaultStrategy (REGULAR vs ANTI), emitted on each instrument_data_update.
 * Always visible; shows NA until the first socket payload arrives.
 */
const DefaultStrategyTracking = ({ instrumentData }) => {
  const raw = instrumentData?.defaultStrategy;
  const label =
    raw != null && String(raw).trim() !== '' ? String(raw).trim().toUpperCase() : 'NA';

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-lg shadow-sm p-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span className="font-semibold text-indigo-900 flex items-center">
          <GitBranch className="w-4 h-4 mr-1.5 text-indigo-600" />
          DEFAULT STRATEGY:{' '}
          <span className="font-mono text-indigo-800 ml-1 tracking-wide">{label}</span>
        </span>
      </div>
    </div>
  );
};

export default DefaultStrategyTracking;

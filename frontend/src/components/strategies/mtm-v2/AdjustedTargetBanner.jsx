import React from 'react';
import { Target } from 'lucide-react';

/**
 * Displays the adjusted target after Scenario 1C or SL4 has fired.
 * Formula: (universalDict.target + universalDict.residual) / 2
 * Hidden when adjustedTarget is null (i.e. neither scenario has occurred yet).
 */
const AdjustedTargetBanner = ({ instrumentData }) => {
  const adjustedTarget = instrumentData?.adjustedTarget;

  if (adjustedTarget == null) return null;

  const formatted =
    typeof adjustedTarget === 'number'
      ? adjustedTarget.toFixed(2)
      : parseFloat(adjustedTarget).toFixed(2);

  return (
    <div className="bg-indigo-50 border border-indigo-300 rounded-lg shadow-sm p-4">
      <div className="flex items-center gap-x-3 text-sm">
        <Target className="w-4 h-4 text-indigo-600 shrink-0" />
        <span className="font-semibold text-indigo-900">
          Adjusted Target{' '}
          <span className="text-xs font-normal text-indigo-600">
            (after Scenario 1C / SL4)
          </span>
          :
        </span>
        <span className="font-mono font-bold text-indigo-800 text-base">
          ₹{formatted}
        </span>
      </div>
    </div>
  );
};

export default AdjustedTargetBanner;

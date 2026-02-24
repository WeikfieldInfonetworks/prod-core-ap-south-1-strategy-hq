import React from 'react';
import { TrendingDown, Clock } from 'lucide-react';

/**
 * Displays prebuy low tracking: SYMBOL, LOW (price), TIME (when low was recorded).
 * Shown only when instrumentData contains prebuyLowTracking (after real buy in prebuy mode).
 */
const PrebuyLowTracking = ({ instrumentData }) => {
  const tracking = instrumentData?.prebuyLowTracking;
  if (!tracking) return null;

  const formatPrice = (price) => {
    if (price == null || price === '') return '—';
    if (typeof price === 'string') return parseFloat(price).toFixed(2);
    if (typeof price !== 'number') return '—';
    return parseFloat(price).toFixed(2);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '—';
    if (typeof timestamp === 'string' && /^\d{2}:\d{2}:\d{2}$/.test(timestamp)) {
      return timestamp;
    }
    try {
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
        return date.toLocaleTimeString('en-GB', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
      }
    } catch {
      // fall through
    }
    return String(timestamp);
  };

  const symbol = tracking.symbol ?? '—';
  const low = formatPrice(tracking.low);
  const time = formatTime(tracking.time);

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg shadow-sm p-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span className="font-semibold text-amber-900 flex items-center">
          <TrendingDown className="w-4 h-4 mr-1.5 text-amber-600" />
          SYMBOL: <span className="font-mono text-amber-800 ml-1">{symbol}</span>
        </span>
        <span className="font-semibold text-amber-900">
          LOW: <span className="font-mono text-amber-800">₹{low}</span>
        </span>
        <span className="font-semibold text-amber-900 flex items-center">
          <Clock className="w-4 h-4 mr-1.5 text-amber-600" />
          TIME: <span className="font-mono text-amber-800 ml-1">{time}</span>
        </span>
      </div>
    </div>
  );
};

export default PrebuyLowTracking;

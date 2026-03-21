import React from 'react';
import { TrendingDown, Clock } from 'lucide-react';

/**
 * Displays prebuy low tracking: SYMBOL, LOW (price), TIME (when low was recorded).
 * Always visible in prebuy dashboard; uses NA / 0 / NA when payload not yet present.
 */
const PrebuyLowTracking = ({ instrumentData }) => {
  const tracking = instrumentData?.prebuyLowTracking;

  const formatPrice = (price) => {
    if (price == null || price === '') return '0.00';
    if (typeof price === 'string') {
      const n = parseFloat(price);
      return Number.isFinite(n) ? n.toFixed(2) : '0.00';
    }
    if (typeof price !== 'number') return '0.00';
    return parseFloat(price).toFixed(2);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'NA';
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
    return 'NA';
  };

  const sym = tracking?.symbol;
  const symbol =
    sym != null && String(sym).trim() !== '' ? String(sym).trim() : 'NA';
  const low = formatPrice(tracking?.low);
  const time = formatTime(tracking?.time);

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

import React from 'react';
import { TrendingUp, Clock } from 'lucide-react';

/**
 * Displays session peak for the prebuy-bought instrument: SYMBOL, peakPrice, peakPriceTime.
 * Shown when instrumentData contains prebuyPeakTracking (after real buy in prebuy mode).
 */
const PrebuyPeakTracking = ({ instrumentData }) => {
  const tracking = instrumentData?.prebuyPeakTracking;
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
  const high = formatPrice(tracking.peakPrice);
  const time = formatTime(tracking.peakPriceTime);

  return (
    <div className="bg-rose-50 border border-rose-200 rounded-lg shadow-sm p-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span className="font-semibold text-rose-900 flex items-center">
          <TrendingUp className="w-4 h-4 mr-1.5 text-rose-600" />
          SYMBOL: <span className="font-mono text-rose-800 ml-1">{symbol}</span>
        </span>
        <span className="font-semibold text-rose-900">
          HIGH: <span className="font-mono text-rose-800">₹{high}</span>
        </span>
        <span className="font-semibold text-rose-900 flex items-center">
          <Clock className="w-4 h-4 mr-1.5 text-rose-600" />
          TIME: <span className="font-mono text-rose-800 ml-1">{time}</span>
        </span>
      </div>
    </div>
  );
};

export default PrebuyPeakTracking;

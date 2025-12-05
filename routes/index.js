const express = require('express');
const router = express.Router();
const userRoutes = require('./userRoutes');

// Mount user routes
router.use('/users', userRoutes);

// NIFTY price endpoint
router.get('/nifty-price', async (req, res) => {
  try {
    const https = require('https');
    const url = "https://query1.finance.yahoo.com/v8/finance/chart/%5ENSEI";
    
    const options = {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US, en;q=0.9",
        "Referer": "https://finance.yahoo.com/",
        "Connection": "keep-alive"
      }
    };

    https.get(url, options, (httpsRes) => {
      let data = '';

      httpsRes.on('data', (chunk) => {
        data += chunk;
      });

      httpsRes.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          const niftyPrice = jsonData?.chart?.result?.[0]?.meta?.regularMarketPrice;
          
          if (niftyPrice && typeof niftyPrice === 'number') {
            res.json({ success: true, price: niftyPrice });
          } else {
            res.status(500).json({ success: false, error: 'Invalid NIFTY price data received' });
          }
        } catch (parseError) {
          console.error('Error parsing NIFTY price response:', parseError);
          res.status(500).json({ success: false, error: 'Failed to parse response' });
        }
      });
    }).on('error', (error) => {
      console.error('Error fetching NIFTY price:', error);
      res.status(500).json({ success: false, error: error.message });
    });
  } catch (error) {
    console.error('Error in NIFTY price endpoint:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router; 
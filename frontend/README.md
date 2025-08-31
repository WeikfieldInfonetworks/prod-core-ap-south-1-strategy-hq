# Strategy HQ Dashboard Frontend

A React-based dashboard for monitoring and controlling trading strategies with real-time updates via Socket.IO.

## Features

### Super Dashboard
- **Strategy Selection**: Dropdown to select from available trading strategies
- **Real-time Connection Status**: Live connection monitoring with the backend
- **User Authentication**: Secure login with API credentials
- **Multi-strategy Support**: Extensible architecture for different strategy dashboards

### MTM V2 Strategy Dashboard
- **Configuration Bar**: Interactive parameter controls for global and universal settings
- **Block Progress**: Visual representation of strategy execution phases (INIT → FINAL_REF → DIFF10 → NEXT_CYCLE)
- **Instrument Tiles**: Real-time display of Call and Put option prices with P&L
- **Position Summary**: Combined view of total position value and performance
- **Trading Matrix**: Comprehensive table showing all trading scenarios and outcomes
- **Real-time Notifications**: Live updates for parameter changes, trades, and status

## Technology Stack

- **React 18**: Modern UI library with hooks
- **Vite**: Fast build tool and development server
- **Tailwind CSS**: Utility-first CSS framework
- **Socket.IO Client**: Real-time bidirectional communication
- **Lucide React**: Beautiful icon set

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Running backend server at `http://localhost:3000`
- MongoDB database with user profiles

### Installation

1. **Install dependencies**:
   ```bash
   cd frontend
   npm install
   ```

2. **Set up sample users** (if needed):
   ```bash
   # Make sure your backend is running first
   node create-sample-users.js
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```

4. **Access the dashboard**:
   Open http://localhost:5173 in your browser

### Building for Production

```bash
npm run build
npm run preview
```

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── AuthenticationForm.jsx      # User login form
│   │   ├── ConnectionStatus.jsx        # Connection indicator
│   │   ├── StrategySelector.jsx        # Strategy dropdown
│   │   ├── SuperDashboard.jsx          # Main dashboard container
│   │   └── strategies/
│   │       ├── MTMv2Dashboard.jsx      # MTM V2 main dashboard
│   │       └── mtm-v2/
│   │           ├── ConfigurationBar.jsx # Parameter controls
│   │           ├── BlockProgress.jsx    # Strategy phase indicator
│   │           ├── InstrumentTiles.jsx  # CE/PE option displays
│   │           ├── SumTile.jsx         # Total position display
│   │           └── TradingTable.jsx    # Trading scenarios matrix
│   ├── contexts/
│   │   └── SocketContext.jsx           # Socket.IO context provider
│   ├── App.jsx                         # Main app component
│   ├── main.jsx                        # Entry point
│   └── index.css                       # Global styles
├── index.html
├── package.json
├── tailwind.config.js
├── vite.config.js
└── README.md
```

## Dashboard Components

### Authentication System
- **User Selection**: Dropdown populated from backend user database
- **Automatic Credential Loading**: API keys and tokens loaded automatically when user is selected
- **Real-time Validation**: Connection status and error handling
- **Persistent Session Management**: Selected user preferences maintained

#### User Management
The authentication system now fetches user profiles from the backend:
- Users are loaded from `/api/users` endpoint on form load
- When a user is selected, complete credentials are fetched from `/api/users/:userId`
- All API keys, secret keys, and access tokens are handled automatically
- No manual entry of credentials required

### Configuration Bar
- Collapsible panel with all strategy parameters
- Real-time parameter updates with instant feedback
- Pending changes indicator with batch apply/reset
- Separate sections for global and universal parameters

### Block Progress
- Visual timeline of strategy execution phases
- Real-time status updates with animations
- Phase-specific status messages and descriptions
- Progress indicators and completion tracking

### Instrument Monitoring
- **Individual Tiles**: Separate displays for CE and PE options
  - Current LTP (Last Traded Price)
  - Buy price and P&L difference
  - Visual profit/loss indicators
  - Live data animations
  
- **Sum Tile**: Combined position overview
  - Total portfolio value
  - Overall P&L with percentage
  - Performance indicators
  - Breakdown calculations

### Trading Matrix
- Comprehensive table with all trading scenarios:
  - **Columns**: Buying Price, -10, Target of -10, +24, Target of 24, -36, Target of -36, +7
  - **Rows**: PE, CE, SUM
  - Real-time price updates for each scenario
  - Recent trading actions log
  - Color-coded profit/loss indicators

## Real-time Features

The dashboard listens for these Socket.IO events:

- `strategy_status_update`: Block transitions and general status
- `strategy_parameter_updated`: Parameter changes confirmation
- `strategy_parameter_error`: Parameter update errors
- `strategy_trade_action`: Trading order executions
- `user_authenticated`: Login confirmation
- `node_identity`: Available strategies and current selection

## Configuration

### Backend Connection
Update the Socket.IO connection URL in `src/App.jsx`:
```javascript
const socketInstance = io('http://localhost:3000/live', {
  transports: ['websocket']
});
```

### Styling Customization
Modify `tailwind.config.js` for custom colors and themes.

## Adding New Strategies

To add support for a new trading strategy:

1. **Create strategy dashboard component**:
   ```javascript
   // src/components/strategies/NewStrategyDashboard.jsx
   const NewStrategyDashboard = ({ strategy }) => {
     // Your custom dashboard implementation
   };
   ```

2. **Register in SuperDashboard**:
   ```javascript
   // In src/components/SuperDashboard.jsx
   case 'New Strategy Name':
     return <NewStrategyDashboard strategy={currentStrategy} />;
   ```

3. **Add strategy-specific Socket.IO listeners** in your dashboard component

## Troubleshooting

### Common Issues

1. **Connection Failed**:
   - Verify backend server is running on port 3000
   - Check firewall settings
   - Ensure WebSocket support is enabled

2. **Authentication Errors**:
   - Check if backend database contains user profiles
   - Verify `/api/users` endpoint is accessible
   - Use browser DevTools Network tab to check API responses
   - Ensure selected user has valid API credentials in database
   - Review browser console for detailed errors

3. **Real-time Updates Not Working**:
   - Check Socket.IO connection status
   - Verify event listeners are properly registered
   - Check browser console for Socket.IO errors

4. **Socket.IO Connection Issues**:
   **Symptoms**: WebSocket connection failures, "WebSocket is closed before connection is established"
   
   **Solutions**:
   - **Restart backend server** - Socket.IO config changes require restart
   - **Check transport fallback** - The client now uses both WebSocket and polling fallback
   - **Verify server logs** - Backend shows detailed connection information
   - **Test connection manually**:
     ```bash
     # From project root
     node test-socketio.js
     ```
   
   **Expected Browser Console Logs**:
   ```
   ✅ Connected to server successfully
   Transport: websocket (or polling)
   ⬆️ Upgraded transport to: websocket
   ```
   
   **Server Console Logs**:
   ```
   ✅ New client connected: [socket-id]
   Connection transport: polling (initial)
   ⬆️ Client upgraded to: websocket
   ```

### Development Tips

- Use browser DevTools Network tab to monitor Socket.IO connections
- Enable verbose Socket.IO logging for debugging:
  ```javascript
  localStorage.debug = 'socket.io-client:socket';
  ```
- Check React DevTools for component state and context values

## User Management

### Creating Users

You can create users in several ways:

1. **Using the sample script** (for testing):
   ```bash
   node create-sample-users.js
   ```

2. **Manual API calls**:
   ```bash
   curl -X POST http://localhost:3000/api/users \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Your Name",
       "api_key": "your_api_key",
       "secret_key": "your_secret_key", 
       "access_token": "your_access_token"
     }'
   ```

3. **Database direct insertion** (MongoDB):
   ```javascript
   db.users.insertOne({
     name: "Your Name",
     api_key: "your_api_key",
     secret_key: "your_secret_key",
     access_token: "your_access_token",
     user_id: "unique_user_id", // Auto-generated if not provided
     createdAt: new Date(),
     updatedAt: new Date()
   });
   ```

### User Security

- Secret keys are excluded from general API responses for security
- Complete credentials are only fetched when a specific user is selected
- All credentials are transmitted securely and stored encrypted
- Frontend masks sensitive information with dots (••••••••)

## License

This project is part of the Strategy HQ trading system.

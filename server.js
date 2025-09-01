const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { io } = require('socket.io-client');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

// Import database connection
const connectDB = require('./config/database');

// Import routes
const apiRoutes = require('./routes');

// Import middleware
const errorHandler = require('./middleware/errorHandler');

// Import strategy manager
const UserStrategyManager = require('./controllers/userStrategyManager');

// Import tick processor
const TickProcessor = require('./utils/tickProcessor');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Define CORS origins for both Express and Socket.IO
const corsOrigins = process.env.CORS_ORIGINS 
    ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
    : [
        'http://localhost:5173', // Vite dev server
        'http://localhost:3000', // Frontend production (if served from same port)
        'http://127.0.0.1:5173', // Alternative localhost
        'http://127.0.0.1:3000'  // Alternative localhost
    ];

// Socket.IO server for frontend connections
const ioServer = new Server(server, {
    cors: {
        origin: process.env.NODE_ENV === 'production' ? corsOrigins : true,
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling'], // Allow both WebSocket and polling fallback
    allowEIO3: true, // Allow Engine.IO v3 clients
    pingTimeout: 60000, // How many ms without a pong packet to consider the connection closed
    pingInterval: 25000, // How many ms before sending a new ping packet
    upgradeTimeout: 10000, // How many ms before an uncompleted transport upgrade is cancelled
    maxHttpBufferSize: 1e6 // Maximum size of HTTP buffer in bytes
});

// Connect to MongoDB
connectDB();

// Global error handlers for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Promise Rejection at:', promise, 'reason:', reason);
    // Log the error but don't crash the application
    console.error('Stack trace:', reason?.stack || 'No stack trace available');
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    console.error('Stack trace:', error.stack);
    // In production, you might want to gracefully shut down here
    // process.exit(1);
});

// CORS configuration for frontend access
const corsConfig = {
    origin: process.env.NODE_ENV === 'production' ? corsOrigins : true, // Allow all origins in development
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with']
};

console.log('🔧 CORS Configuration:', {
    environment: process.env.NODE_ENV || 'development',
    allowedOrigins: process.env.NODE_ENV === 'production' ? corsOrigins : 'All origins (development mode)'
});

app.use(cors(corsConfig));

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Initialize user strategy manager
const userStrategyManager = new UserStrategyManager();

// Pass Socket.IO reference to UserStrategyManager for real-time communication
userStrategyManager.setSocketIo(ioServer);

// Initialize tick processor with controlled concurrency
const tickProcessor = new TickProcessor(10); // Max 10 concurrent processors

// Connect to central server (ticks.wmi.co.in)
const centralSocket = io('https://ticks.wmi.co.in', {
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
});

// Handle central server connection
centralSocket.on("connect", () => {
    console.log('Connected to central server at ticks.wmi.co.in');
});

centralSocket.on("disconnect", () => {
    console.log("Disconnected from central server");
});

centralSocket.on("connect_error", (error) => {
    console.error("Connection error:", error);
});

// Handle incoming ticks from central server
centralSocket.on("ticks", (tickData) => { // User manually changed from "tick" to "ticks"
    try {
        // Process ticks for all active users using the tick processor
        const activeUsers = userStrategyManager.getActiveUsers();
        
        if (activeUsers.length === 0) {
            console.log('No active users to process ticks for');
            return;
        }
        
        // Use the tick processor for controlled asynchronous processing
        tickProcessor.processMultipleUsers(
            activeUsers,
            tickData,
            userStrategyManager.processTicksForUser.bind(userStrategyManager),
            (room, event, data) => {
                try {
                    // Emit on the /live namespace to match frontend connection
                    const ioTarget = ioServer.of('/live');
                    ioTarget.to(room).emit(event, data);
                } catch (emitError) {
                    console.error(`Error emitting to room ${room}:`, emitError);
                    throw emitError; // Re-throw to be caught by tick processor
                }
            }
        ).catch(error => {
            console.error('Error in batch tick processing:', error);
        });
        
    } catch (error) {
        console.error("Error in tick processing loop:", error);
    }
});

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Test route for debugging
app.get('/test', (req, res) => {
    res.json({
        message: 'Server is running',
        port: PORT,
        activeUsers: userStrategyManager.getActiveUsers(),
        userCount: userStrategyManager.getUserCount(),
        tickProcessorStats: tickProcessor.getStats(),
        timestamp: new Date().toISOString()
    });
});

// Monitoring endpoint for tick processing performance
app.get('/api/monitoring/tick-stats', (req, res) => {
    res.json({
        tickProcessor: tickProcessor.getStats(),
        activeUsers: userStrategyManager.getActiveUsers().length,
        serverInfo: {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            timestamp: new Date().toISOString()
        }
    });
});

// API routes
app.use('/api', apiRoutes);

// Handle frontend connections
ioServer.of("/live").on("connection", socket => {
    console.log(`✅ New client connected: ${socket.id}`);
    console.log(`Connection transport: ${socket.conn.transport.name}`);
    console.log(`Client IP: ${socket.handshake.address}`);
    console.log(`User Agent: ${socket.handshake.headers['user-agent']}`);
    
    // Log transport upgrades
    socket.conn.on('upgrade', () => {
        console.log(`⬆️ Client ${socket.id} upgraded to: ${socket.conn.transport.name}`);
    });
    
    let currentUserId = null;
    let currentUserName = null;

    // Handle user authentication
    socket.on("authenticate_user", (userData) => {
        try {
            const { userId, userName, api_key, secret_key, access_token } = userData;
            
            currentUserId = userId;
            currentUserName = userName;
            
            // Join user-specific room
            socket.join(`user_${userId}`);
            
            // Set user credentials
            userStrategyManager.setUserCredentials(userId, userName, api_key, secret_key, access_token);
            
            // Send initial data to user
            const availableStrategies = userStrategyManager.getAvailableStrategiesForUser(userId);
            const currentStrategy = userStrategyManager.getCurrentStrategyForUser(userId);
            
            console.log(`User authenticated: ${userName} (${userId})`);
            console.log(`Available strategies: ${availableStrategies.length}`);
            
            socket.emit("node_identity", { 
                name: "Strategy HQ Node",
                userId: userId,
                userName: userName,
                currentStrategy: currentStrategy,
                availableStrategies: availableStrategies
            });
            
            socket.emit("user_authenticated", { 
                success: true, 
                userId: userId,
                userName: userName
            });
            
        } catch (error) {
            console.error("Error authenticating user:", error);
            socket.emit("authentication_error", error.message);
        }
    });

    // Handle strategy selection
    socket.on("select_strategy", (strategyName) => {
        try {
            console.log('select_strategy event received:', strategyName);
            console.log('Current user:', { userId: currentUserId, userName: currentUserName });
            
            if (!currentUserId) {
                socket.emit("strategy_error", "User not authenticated");
                return;
            }
            
            const strategyConfig = userStrategyManager.setStrategyForUser(currentUserId, strategyName);
            console.log('Strategy set successfully:', strategyConfig.name);
            socket.emit("strategy_updated", strategyConfig);
        } catch (error) {
            console.error('Error setting strategy:', error);
            socket.emit("strategy_error", error.message);
        }
    });

    // Handle globalDict parameter updates
    socket.on("update_global_dict_parameter", (data) => {
        try {
            if (!currentUserId) {
                socket.emit("parameter_error", "User not authenticated");
                return;
            }
            
            const { parameter, value } = data;
            
            // Validate that a strategy is currently active
            const currentStrategy = userStrategyManager.getCurrentStrategyForUser(currentUserId);
            if (!currentStrategy) {
                socket.emit("parameter_error", "No strategy currently active");
                return;
            }

            // Update the parameter in globalDict
            const success = userStrategyManager.updateGlobalParameterForUser(currentUserId, parameter, value);
            
            if (success) {
                console.log(`GlobalDict parameter ${parameter} updated to ${value} for user ${currentUserId}`);
                socket.emit("global_dict_parameter_updated", { parameter, value });
                
                // Get updated strategy data without processing ticks
                const userData = userStrategyManager.getStrategyDataForUser(currentUserId);
                if (userData) {
                    ioServer.to(`user_${currentUserId}`).emit("node_update", userData);
                }
            } else {
                socket.emit("parameter_error", `Failed to update globalDict parameter ${parameter}`);
            }
        } catch (error) {
            console.error("Error updating globalDict parameter:", error);
            socket.emit("parameter_error", error.message);
        }
    });

    // Handle universalDict parameter updates
    socket.on("update_universal_dict_parameter", (data) => {
        try {
            if (!currentUserId) {
                socket.emit("parameter_error", "User not authenticated");
                return;
            }
            
            const { parameter, value } = data;
            
            // Validate that a strategy is currently active
            const currentStrategy = userStrategyManager.getCurrentStrategyForUser(currentUserId);
            if (!currentStrategy) {
                socket.emit("parameter_error", "No strategy currently active");
                return;
            }

            // Update the parameter in universalDict
            const success = userStrategyManager.updateUniversalParameterForUser(currentUserId, parameter, value);
            
            if (success) {
                console.log(`UniversalDict parameter ${parameter} updated to ${value} for user ${currentUserId}`);
                socket.emit("universal_dict_parameter_updated", { parameter, value });
                
                // Get updated strategy data without processing ticks
                const userData = userStrategyManager.getStrategyDataForUser(currentUserId);
                if (userData) {
                    ioServer.to(`user_${currentUserId}`).emit("node_update", userData);
                }
            } else {
                socket.emit("parameter_error", `Failed to update universalDict parameter ${parameter}`);
            }
        } catch (error) {
            console.error("Error updating universalDict parameter:", error);
            socket.emit("parameter_error", error.message);
        }
    });

    // Handle socket debugging requests
    socket.on("debug_socket_connectivity", () => {
        try {
            if (!currentUserId) {
                socket.emit("debug_error", "User not authenticated");
                return;
            }
            
            console.log(`🔧 Socket debugging requested by user: ${currentUserId}`);
            
            // Debug socket connectivity for the current user
            const isValid = userStrategyManager.debugSocketConnectivity(currentUserId);
            
            // Get comprehensive socket status
            const socketStatus = userStrategyManager.getAllUsersSocketStatus();
            
            socket.emit("socket_debug_result", {
                userId: currentUserId,
                connectivityValid: isValid,
                socketStatus: socketStatus,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('Error in socket debugging:', error);
            socket.emit("debug_error", error.message);
        }
    });

    socket.on("ping_node", () => {
        if (!currentUserId) {
            socket.emit("node_identity", { 
                name: "Strategy HQ Node",
                error: "User not authenticated"
            });
            return;
        }
        
        const currentStrategy = userStrategyManager.getCurrentStrategyForUser(currentUserId);
        socket.emit("node_identity", { 
            name: "Strategy HQ Node",
            userId: currentUserId,
            userName: currentUserName,
            currentStrategy: currentStrategy
        });
    });

    socket.on("disconnect", (reason) => {
        console.log(`❌ Client disconnected: ${socket.id}`);
        console.log(`Disconnect reason: ${reason}`);
        console.log(`User: ${currentUserName || 'Not authenticated'} (${currentUserId || 'N/A'})`);
        
        // Log connection duration
        const connectionTime = Date.now() - socket.handshake.time;
        console.log(`Connection duration: ${Math.round(connectionTime / 1000)}s`);
        
        // Optionally cleanup user instance after some time
        // userStrategyManager.removeUserInstance(currentUserId);
    });
});

// Error handling middleware (should be last)
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log('\n🚀 Strategy HQ Server Started Successfully!');
    console.log('='.repeat(50));
    console.log(`📍 Server URL: http://localhost:${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard.html`);
    console.log(`🔌 Socket.IO: ws://localhost:${PORT}/live`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    
    console.log('\n🔧 Socket.IO Configuration:');
    console.log(`   Transports: websocket, polling`);
    console.log(`   Ping Timeout: 60s`);
    console.log(`   Ping Interval: 25s`);
    console.log(`   CORS Origins: ${process.env.NODE_ENV === 'production' ? corsOrigins.join(', ') : 'All (development mode)'}`);
    
    console.log('\n💡 Next Steps:');
    console.log('   1. Open your frontend at http://localhost:5173');
    console.log('   2. Check Socket.IO connection in browser console');
    console.log('   3. Authenticate with a user to start trading');
    console.log('='.repeat(50));
});
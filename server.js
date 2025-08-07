const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { io } = require('socket.io-client');
const path = require('path');
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

// Socket.IO server for frontend connections
const ioServer = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Connect to MongoDB
connectDB();

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Initialize user strategy manager
const userStrategyManager = new UserStrategyManager();

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
            (room, event, data) => ioServer.to(room).emit(event, data)
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
    console.log("New client connected");
    
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
                
                // Broadcast the updated dictionaries to user's room
                const userData = userStrategyManager.processTicksForUser(currentUserId, []);
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
                
                // Broadcast the updated dictionaries to user's room
                const userData = userStrategyManager.processTicksForUser(currentUserId, []);
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

    socket.on("disconnect", () => {
        console.log(`Client disconnected - User: ${currentUserName} (${currentUserId})`);
        
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
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} to access the application`);
    console.log(`Dashboard available at: http://localhost:${PORT}/dashboard.html`);
});
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const { io } = require("socket.io-client");
const path = require('path');

const config = require('./config');
const StrategyManager = require('./strategy-manager');

// Get port and node name from command line arguments, environment variables, or config defaults
const PORT = process.argv[2] || process.env.PORT || config.frontendPort;
const NODE_NAME = process.argv[3] || process.env.NODE_NAME || config.name;
const API_KEY = process.argv[4] || process.env.API_KEY || '';
const SECRET_KEY = process.argv[5] || process.env.SECRET_KEY || '';
const ACCESS_TOKEN = process.argv[6] || process.env.ACCESS_TOKEN || '';

// Validate port number
const portNumber = parseInt(PORT);
if (isNaN(portNumber) || portNumber < 1 || portNumber > 65535) {
    console.error(`Invalid port number: ${PORT}. Using default port ${config.frontendPort}`);
    PORT = config.frontendPort;
}

// Validate API credentials
if (API_KEY === '' || SECRET_KEY === '') {
    console.warn('Warning: API_KEY and SECRET_KEY are required for trading functionality');
    console.warn('Usage: npm start <port> <node_name> <api_key> <secret_key> <access_token>');
    console.warn('Or set environment variables: API_KEY, SECRET_KEY, and ACCESS_TOKEN');
}

// Validate access token
if (ACCESS_TOKEN === '') {
    console.warn('Warning: ACCESS_TOKEN is required for KiteConnect authentication');
    console.warn('You can get the access token by logging in to KiteConnect');
}

// Initialize Express app
const app = express();
const server = http.createServer(app);
const ioServer = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Add a test route to verify server is working
app.get('/test', (req, res) => {
    res.json({
        message: 'Server is running',
        port: PORT,
        nodeName: NODE_NAME,
        timestamp: new Date().toISOString()
    });
});

// Add a test route to check dictionary state
app.get('/debug-dict', (req, res) => {
    strategyManager.debugDictionaryState();
    res.json({
        globalDict: globalDict,
        universalDict: universalDict,
        blockDict: blockDict,
        currentStrategy: strategyManager.getCurrentStrategy()
    });
});

// Initialize dictionaries
const globalDict = {};
const universalDict = {};
const blockDict = {};

// Initialize strategy manager
const strategyManager = new StrategyManager();

// Set access token for trading authentication
if (ACCESS_TOKEN !== '') {
    strategyManager.setAccessToken(ACCESS_TOKEN);
    console.log('Access token set for trading authentication');
}

// Connect to central server
const xSocket = io(config.centralServerUrl, {
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
});

// Handle central server connection
xSocket.on("connect", () => {
    console.log(`Connected to central server at ${config.centralServerUrl}`);
    xSocket.emit("register_node", { 
        name: NODE_NAME
    });
});

xSocket.on("disconnect", () => {
    console.log("Disconnected from central server");
});

xSocket.on("connect_error", (error) => {
    console.error("Connection error:", error);
});

// Handle incoming ticks
xSocket.on("tick", (tickData) => {
    try {
        strategyManager.processTicks(tickData);
        
        ioServer.to("clients").emit("node_update", {
            tickData,
            globalDict,
            universalDict,
            blockDict,
            currentStrategy: strategyManager.getCurrentStrategy()
        });
    } catch (error) {
        console.error("Error processing ticks:", error);
    }
});

// Handle frontend connections
ioServer.of("/live").on("connection", socket => {
    console.log("New client connected");
    socket.join("clients");

    // Send initial data to new client
    socket.emit("node_identity", { 
        name: NODE_NAME,
        globalDict,
        universalDict,
        blockDict,
        currentStrategy: strategyManager.getCurrentStrategy(),
        availableStrategies: strategyManager.getAvailableStrategies()
    });

    // Handle strategy selection
    socket.on("select_strategy", (strategyName) => {
        try {
            const strategyConfig = strategyManager.setStrategy(
                strategyName,
                globalDict,
                universalDict,
                blockDict
            );
            socket.emit("strategy_updated", strategyConfig);
        } catch (error) {
            socket.emit("strategy_error", error.message);
        }
    });

    // Handle globalDict parameter updates
    socket.on("update_global_dict_parameter", (data) => {
        try {
            const { parameter, value } = data;
            
            // Validate that a strategy is currently active
            const currentStrategy = strategyManager.getCurrentStrategy();
            if (!currentStrategy) {
                socket.emit("parameter_error", "No strategy currently active");
                return;
            }

            // Update the parameter in globalDict
            const success = strategyManager.updateGlobalDictParameter(parameter, value);
            
            if (success) {
                console.log(`GlobalDict parameter ${parameter} updated to ${value}`);
                socket.emit("global_dict_parameter_updated", { parameter, value });
                
                // Broadcast the updated dictionaries to all clients
                ioServer.to("clients").emit("node_update", {
                    globalDict,
                    universalDict,
                    blockDict,
                    currentStrategy: strategyManager.getCurrentStrategy()
                });
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
            const { parameter, value } = data;
            
            // Validate that a strategy is currently active
            const currentStrategy = strategyManager.getCurrentStrategy();
            if (!currentStrategy) {
                socket.emit("parameter_error", "No strategy currently active");
                return;
            }

            // Update the parameter in universalDict
            const success = strategyManager.updateUniversalDictParameter(parameter, value);
            
            if (success) {
                console.log(`UniversalDict parameter ${parameter} updated to ${value}`);
                socket.emit("universal_dict_parameter_updated", { parameter, value });
                
                // Broadcast the updated dictionaries to all clients
                ioServer.to("clients").emit("node_update", {
                    globalDict,
                    universalDict,
                    blockDict,
                    currentStrategy: strategyManager.getCurrentStrategy()
                });
            } else {
                socket.emit("parameter_error", `Failed to update universalDict parameter ${parameter}`);
            }
        } catch (error) {
            console.error("Error updating universalDict parameter:", error);
            socket.emit("parameter_error", error.message);
        }
    });

    socket.on("ping_node", () => {
        socket.emit("node_identity", { 
            name: NODE_NAME,
            currentStrategy: strategyManager.getCurrentStrategy()
        });
    });

    socket.on("disconnect", () => {
        console.log("Client disconnected");
    });
});

// Start server
server.listen(PORT, () => {
    console.log(`Node server running on port ${PORT}`);
    console.log(`Node name: ${NODE_NAME}`);
    console.log(`Frontend available at: http://localhost:${PORT}`);
    console.log(`Test endpoint available at: http://localhost:${PORT}/test`);
});
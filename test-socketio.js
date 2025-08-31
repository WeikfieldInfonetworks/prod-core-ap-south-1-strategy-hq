#!/usr/bin/env node

/**
 * Socket.IO connection test script
 * Tests the WebSocket and polling transport connections
 * 
 * Usage: node test-socketio.js
 */

const { io } = require('socket.io-client');

const SOCKET_URL = 'http://localhost:3000/live';

async function testSocketConnection() {
    console.log('🧪 Testing Socket.IO Connection...\n');
    
    return new Promise((resolve, reject) => {
        let connectionResolved = false;
        
        console.log(`Connecting to: ${SOCKET_URL}`);
        
        const socket = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
            upgrade: true,
            timeout: 10000,
            reconnection: false, // Don't reconnect for this test
            autoConnect: true
        });

        // Connection success
        socket.on('connect', () => {
            console.log('✅ Socket.IO connection successful!');
            console.log(`Socket ID: ${socket.id}`);
            console.log(`Transport: ${socket.io.engine.transport.name}`);
            console.log(`Connected: ${socket.connected}`);
            
            if (!connectionResolved) {
                connectionResolved = true;
                setTimeout(() => {
                    socket.disconnect();
                    resolve({ success: true, transport: socket.io.engine.transport.name });
                }, 1000);
            }
        });

        // Connection error
        socket.on('connect_error', (error) => {
            console.error('❌ Socket.IO connection failed!');
            console.error(`Error: ${error.message}`);
            console.error(`Error type: ${error.type}`);
            console.error(`Error description: ${error.description}`);
            
            if (!connectionResolved) {
                connectionResolved = true;
                socket.disconnect();
                reject(error);
            }
        });

        // Disconnect
        socket.on('disconnect', (reason) => {
            console.log(`🔌 Disconnected: ${reason}`);
        });

        // Transport events
        socket.io.engine.on('upgrade', () => {
            console.log(`⬆️ Transport upgraded to: ${socket.io.engine.transport.name}`);
        });

        socket.io.engine.on('upgradeError', (error) => {
            console.error('🔴 Transport upgrade error:', error.message);
        });

        // Timeout fallback
        setTimeout(() => {
            if (!connectionResolved) {
                console.error('❌ Connection test timed out');
                socket.disconnect();
                reject(new Error('Connection timeout'));
            }
        }, 15000);
    });
}

async function testSpecificTransport(transport) {
    console.log(`\n🧪 Testing ${transport.toUpperCase()} transport specifically...\n`);
    
    return new Promise((resolve, reject) => {
        let connectionResolved = false;
        
        const socket = io(SOCKET_URL, {
            transports: [transport],
            upgrade: false, // Don't upgrade
            timeout: 10000,
            reconnection: false
        });

        socket.on('connect', () => {
            console.log(`✅ ${transport.toUpperCase()} transport connection successful!`);
            console.log(`Socket ID: ${socket.id}`);
            
            if (!connectionResolved) {
                connectionResolved = true;
                setTimeout(() => {
                    socket.disconnect();
                    resolve({ success: true, transport });
                }, 1000);
            }
        });

        socket.on('connect_error', (error) => {
            console.error(`❌ ${transport.toUpperCase()} transport connection failed!`);
            console.error(`Error: ${error.message}`);
            
            if (!connectionResolved) {
                connectionResolved = true;
                socket.disconnect();
                reject(error);
            }
        });

        socket.on('disconnect', (reason) => {
            console.log(`🔌 ${transport.toUpperCase()} disconnected: ${reason}`);
        });

        setTimeout(() => {
            if (!connectionResolved) {
                console.error(`❌ ${transport.toUpperCase()} transport test timed out`);
                socket.disconnect();
                reject(new Error(`${transport} timeout`));
            }
        }, 15000);
    });
}

async function runTests() {
    console.log('🚀 Socket.IO Connection Tests\n');
    
    try {
        // Test general connection (with fallback)
        await testSocketConnection();
        
        // Test specific transports
        try {
            await testSpecificTransport('websocket');
        } catch (error) {
            console.error(`WebSocket transport failed: ${error.message}`);
        }
        
        try {
            await testSpecificTransport('polling');
        } catch (error) {
            console.error(`Polling transport failed: ${error.message}`);
        }
        
        console.log('\n📋 Test Results Summary:');
        console.log('✅ Socket.IO connection tests completed');
        console.log('\n💡 Next Steps:');
        console.log('1. Start your frontend: cd frontend && npm run dev');
        console.log('2. Check browser console for Socket.IO logs');
        console.log('3. Look for transport type and connection status');
        
    } catch (error) {
        console.error('\n❌ Socket.IO connection tests failed');
        console.error('Error:', error.message);
        
        console.log('\n🔧 Troubleshooting:');
        console.log('1. Ensure backend server is running: npm start');
        console.log('2. Check if port 3000 is available');
        console.log('3. Verify CORS configuration in server.js');
        console.log('4. Check firewall settings');
        
        process.exit(1);
    }
}

if (require.main === module) {
    runTests().catch(console.error);
}

module.exports = { testSocketConnection, testSpecificTransport };

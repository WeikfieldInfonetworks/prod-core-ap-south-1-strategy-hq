#!/usr/bin/env node

/**
 * Socket Debug Test Script
 * 
 * This script helps test socket connectivity and emissions
 * Run this after starting your server to test socket functionality
 */

const { io } = require('socket.io-client');

// Configuration
const SERVER_URL = 'http://localhost:3000';
const NAMESPACE = '/live';

// Test user data
const testUser = {
    userId: 'test-user-123',
    userName: 'Test User',
    api_key: 'test-api-key',
    secret_key: 'test-secret-key',
    access_token: 'test-access-token'
};

console.log('🔧 Starting Socket Debug Test...');
console.log(`🔧 Connecting to: ${SERVER_URL}${NAMESPACE}`);

// Create socket connection
const socket = io(`${SERVER_URL}${NAMESPACE}`, {
    transports: ['websocket', 'polling'],
    timeout: 5000,
    forceNew: true
});

// Connection event handlers
socket.on('connect', () => {
    console.log('✅ Connected to server');
    console.log(`🔧 Socket ID: ${socket.id}`);
    console.log(`🔧 Transport: ${socket.io.engine.transport.name}`);
    
    // Authenticate user
    console.log('🔧 Authenticating user...');
    socket.emit('authenticate_user', testUser);
});

socket.on('disconnect', (reason) => {
    console.log(`❌ Disconnected from server: ${reason}`);
});

socket.on('connect_error', (error) => {
    console.error('❌ Connection error:', error.message);
});

// Authentication response
socket.on('user_authenticated', (data) => {
    console.log('✅ User authenticated:', data);
    
    // Select MTM V2 strategy
    console.log('🔧 Selecting MTM V2 strategy...');
    socket.emit('select_strategy', 'MTM V2 Strategy');
});

socket.on('node_identity', (data) => {
    console.log('✅ Node identity received:', data);
});

socket.on('strategy_updated', (data) => {
    console.log('✅ Strategy updated:', data.name);
    
    // Test socket debugging
    console.log('🔧 Testing socket debugging...');
    socket.emit('debug_socket_connectivity');
});

// Socket debugging results
socket.on('socket_debug_result', (data) => {
    console.log('✅ Socket debug result:');
    console.log(JSON.stringify(data, null, 2));
    
    // Test parameter update to trigger socket emission
    console.log('🔧 Testing parameter update...');
    socket.emit('update_global_dict_parameter', {
        parameter: 'enableTrading',
        value: false
    });
});

// Listen for strategy events
socket.on('strategy_status_update', (data) => {
    console.log('📡 Strategy status update received:', data);
});

socket.on('strategy_parameter_updated', (data) => {
    console.log('📡 Strategy parameter update received:', data);
});

socket.on('strategy_trade_action', (data) => {
    console.log('📡 Strategy trade action received:', data);
});

socket.on('instrument_data_update', (data) => {
    console.log('📡 Instrument data update received:', data);
});

socket.on('strategy_socket_test', (data) => {
    console.log('📡 Socket test message received:', data);
});

socket.on('socket_connectivity_test', (data) => {
    console.log('📡 Socket connectivity test received:', data);
});

// Error handlers
socket.on('authentication_error', (error) => {
    console.error('❌ Authentication error:', error);
});

socket.on('strategy_error', (error) => {
    console.error('❌ Strategy error:', error);
});

socket.on('parameter_error', (error) => {
    console.error('❌ Parameter error:', error);
});

socket.on('debug_error', (error) => {
    console.error('❌ Debug error:', error);
});

// Global error handler
socket.on('error', (error) => {
    console.error('❌ Socket error:', error);
});

// Keep the script running
console.log('🔧 Socket test script running...');
console.log('🔧 Press Ctrl+C to exit');

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🔧 Shutting down socket test...');
    socket.disconnect();
    process.exit(0);
});

// Timeout after 30 seconds
setTimeout(() => {
    console.log('⏰ Test timeout reached');
    socket.disconnect();
    process.exit(0);
}, 30000);

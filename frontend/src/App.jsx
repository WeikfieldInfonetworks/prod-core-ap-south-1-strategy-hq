import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import SuperDashboard from './components/SuperDashboard';
import { SocketProvider } from './contexts/SocketContext';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  const [socket, setSocket] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');

  useEffect(() => {
    // Connect to Socket.IO server
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000/live';
    const socketInstance = io(socketUrl, {
      transports: ['websocket', 'polling'], // Allow fallback to polling
      upgrade: true, // Allow transport upgrades
      rememberUpgrade: true, // Remember the upgrade for future connections
      timeout: 20000, // Connection timeout
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
      autoConnect: true,
      forceNew: false
    });

    socketInstance.on('connect', () => {
      console.log('✅ Connected to server successfully');
      console.log('Transport:', socketInstance.io.engine.transport.name);
      setConnectionStatus('connected');
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('❌ Disconnected from server:', reason);
      setConnectionStatus('disconnected');
    });

    socketInstance.on('connect_error', (error) => {
      console.error('🔴 Connection error:', error);
      console.error('Error type:', error.type);
      console.error('Error description:', error.description);
      setConnectionStatus('error');
    });

    // Additional Socket.IO event listeners for debugging
    socketInstance.on('reconnect', (attemptNumber) => {
      console.log('🔄 Reconnected after', attemptNumber, 'attempts');
      setConnectionStatus('connected');
    });

    socketInstance.on('reconnecting', (attemptNumber) => {
      console.log('🔄 Attempting to reconnect... (attempt', attemptNumber + ')');
      setConnectionStatus('connecting');
    });

    socketInstance.on('reconnect_error', (error) => {
      console.error('🔴 Reconnection failed:', error);
    });

    socketInstance.on('reconnect_failed', () => {
      console.error('🔴 Reconnection failed after maximum attempts');
      setConnectionStatus('error');
    });

    // Transport upgrade events
    socketInstance.io.engine.on('upgrade', () => {
      console.log('⬆️ Upgraded transport to:', socketInstance.io.engine.transport.name);
    });

    socketInstance.io.engine.on('upgradeError', (error) => {
      console.error('🔴 Transport upgrade error:', error);
    });

    setSocket(socketInstance);

    return () => {
      if (socketInstance) {
        console.log('🧹 Cleaning up Socket.IO connection...');
        
        // Remove all event listeners
        socketInstance.off('connect');
        socketInstance.off('disconnect');
        socketInstance.off('connect_error');
        socketInstance.off('reconnect');
        socketInstance.off('reconnecting');
        socketInstance.off('reconnect_error');
        socketInstance.off('reconnect_failed');
        
        // Remove engine event listeners
        if (socketInstance.io && socketInstance.io.engine) {
          socketInstance.io.engine.off('upgrade');
          socketInstance.io.engine.off('upgradeError');
        }
        
        // Disconnect the socket
        socketInstance.disconnect();
      }
    };
  }, []);

  if (!socket) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Initializing Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <SocketProvider socket={socket}>
      <div className="min-h-screen bg-gray-50">
        <ErrorBoundary>
          <SuperDashboard connectionStatus={connectionStatus} />
        </ErrorBoundary>
      </div>
    </SocketProvider>
  );
}

export default App;

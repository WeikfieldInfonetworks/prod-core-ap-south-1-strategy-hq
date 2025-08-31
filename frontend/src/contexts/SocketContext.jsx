import React, { createContext, useContext, useEffect, useState } from 'react';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children, socket }) => {
  const [user, setUser] = useState(null);
  const [strategies, setStrategies] = useState([]);
  const [currentStrategy, setCurrentStrategy] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    if (!socket) return;

    // Listen for authentication response
    socket.on('user_authenticated', (data) => {
      if (data.success) {
        setIsAuthenticated(true);
        setUser({
          userId: data.userId,
          userName: data.userName
        });
      }
    });

    // Listen for node identity (includes available strategies)
    socket.on('node_identity', (data) => {
      setStrategies(data.availableStrategies || []);
      setCurrentStrategy(data.currentStrategy);
    });

    // Listen for strategy updates
    socket.on('strategy_updated', (strategyConfig) => {
      setCurrentStrategy(strategyConfig);
    });

    return () => {
      socket.off('user_authenticated');
      socket.off('node_identity');
      socket.off('strategy_updated');
    };
  }, [socket]);

  const authenticateUser = (userData) => {
    if (socket) {
      socket.emit('authenticate_user', userData);
    }
  };

  const selectStrategy = (strategyName) => {
    if (socket && isAuthenticated) {
      socket.emit('select_strategy', strategyName);
    }
  };

  const updateGlobalParameter = (parameter, value) => {
    if (socket && isAuthenticated) {
      socket.emit('update_global_dict_parameter', { parameter, value });
    }
  };

  const updateUniversalParameter = (parameter, value) => {
    if (socket && isAuthenticated) {
      socket.emit('update_universal_dict_parameter', { parameter, value });
    }
  };

  const value = {
    socket,
    user,
    strategies,
    currentStrategy,
    isAuthenticated,
    authenticateUser,
    selectStrategy,
    updateGlobalParameter,
    updateUniversalParameter
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

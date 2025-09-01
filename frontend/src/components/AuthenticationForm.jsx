import React, { useState, useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { User, Shield, ChevronDown, RefreshCw } from 'lucide-react';

const AuthenticationForm = () => {
  const { authenticateUser } = useSocket();
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedUserData, setSelectedUserData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [error, setError] = useState('');

  // Fetch all users on component mount
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setIsLoadingUsers(true);
      setError('');
      
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/users`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const userData = await response.json();
      setUsers(userData);
    } catch (error) {
      console.error('Error fetching users:', error);
      setError(`Failed to fetch users: ${error.message}`);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Fetch complete user data when a user is selected
  const handleUserSelection = async (userId) => {
    if (!userId) {
      setSelectedUserId('');
      setSelectedUserData(null);
      return;
    }

    try {
      setSelectedUserId(userId);
      setError('');
      
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/users/${userId}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const userData = await response.json();
      setSelectedUserData(userData);
    } catch (error) {
      console.error('Error fetching user details:', error);
      setError(`Failed to fetch user details: ${error.message}`);
      setSelectedUserData(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedUserData) {
      setError('Please select a user first');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Prepare authentication data
      const authData = {
        userId: selectedUserData.user_id,
        userName: selectedUserData.name,
        api_key: selectedUserData.api_key,
        secret_key: selectedUserData.secret_key,
        access_token: selectedUserData.access_token
      };

      await authenticateUser(authData);
    } catch (error) {
      console.error('Authentication error:', error);
      setError(`Authentication failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = selectedUserData && 
                     selectedUserData.api_key && 
                     selectedUserData.secret_key && 
                     selectedUserData.access_token;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        </div>
      )}

      {/* User Selection */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <User className="h-5 w-5 mr-2 text-blue-600" />
            Select User Profile
          </h3>
          <button
            type="button"
            onClick={fetchUsers}
            disabled={isLoadingUsers}
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center space-x-1"
          >
            <RefreshCw className={`h-4 w-4 ${isLoadingUsers ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
        
        <div>
          <label htmlFor="userSelect" className="block text-sm font-medium text-gray-700">
            Choose User
          </label>
          <div className="mt-1 relative">
            <select
              id="userSelect"
              value={selectedUserId}
              onChange={(e) => handleUserSelection(e.target.value)}
              disabled={isLoadingUsers || users.length === 0}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white text-gray-900"
            >
              <option value="" className="text-gray-900">
                {isLoadingUsers 
                  ? 'Loading users...' 
                  : users.length === 0 
                  ? 'No users found' 
                  : 'Select a user profile...'}
              </option>
              {users.map((user) => (
                <option key={user.user_id} value={user.user_id} className="text-gray-900">
                  {user.name} ({user.user_id})
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
              <ChevronDown className="h-5 w-5 text-gray-400" />
            </div>
          </div>
        </div>

        {/* Selected User Preview */}
        {selectedUserData && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="text-sm font-medium text-blue-900 mb-2">Selected User Details</h4>
            <div className="space-y-1 text-sm text-blue-800">
              <div><span className="font-medium">Name:</span> {selectedUserData.name}</div>
              <div><span className="font-medium">User ID:</span> {selectedUserData.user_id}</div>
              <div><span className="font-medium">API Key:</span> {selectedUserData.api_key ? '••••••••' : 'Not configured'}</div>
              <div><span className="font-medium">Secret Key:</span> {selectedUserData.secret_key ? '••••••••' : 'Not configured'}</div>
              <div><span className="font-medium">Access Token:</span> {selectedUserData.access_token ? '••••••••' : 'Not configured'}</div>
            </div>
          </div>
        )}

        {/* Users Count */}
        <div className="text-xs text-gray-500 text-center">
          {isLoadingUsers 
            ? 'Loading available users...' 
            : `${users.length} user profile${users.length !== 1 ? 's' : ''} available`}
        </div>
      </div>

      <button
        type="submit"
        disabled={!isFormValid || isLoading}
        className="w-full flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            Connecting...
          </>
        ) : (
          <>
            <Shield className="h-4 w-4 mr-2" />
            Connect to Strategy HQ
          </>
        )}
      </button>

      <div className="text-xs text-gray-500 text-center">
        {selectedUserData 
          ? 'User profile selected. Click connect to authenticate with Strategy HQ.'
          : 'Select a user profile to connect to Strategy HQ.'
        }
      </div>
    </form>
  );
};

export default AuthenticationForm;

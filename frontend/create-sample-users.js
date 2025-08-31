#!/usr/bin/env node

/**
 * Sample script to create test users for the Strategy HQ Dashboard
 * Run this script to populate your database with sample users
 * 
 * Usage: node create-sample-users.js
 * Make sure your backend server is running on http://localhost:3000
 */

const API_URL = 'http://localhost:3000/api/users';

const sampleUsers = [
  {
    name: 'John Trader',
    api_key: 'your_api_key_1',
    secret_key: 'your_secret_key_1',
    access_token: 'your_access_token_1'
  },
  {
    name: 'Sarah Wilson',
    api_key: 'your_api_key_2', 
    secret_key: 'your_secret_key_2',
    access_token: 'your_access_token_2'
  },
  {
    name: 'Mike Johnson',
    api_key: 'your_api_key_3',
    secret_key: 'your_secret_key_3', 
    access_token: 'your_access_token_3'
  }
];

async function createUser(userData) {
  try {
    console.log(`Creating user: ${userData.name}...`);
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log(`✅ User created successfully: ${result.name} (ID: ${result.user_id})`);
    return result;
    
  } catch (error) {
    console.error(`❌ Failed to create user ${userData.name}:`, error.message);
    return null;
  }
}

async function createSampleUsers() {
  console.log('🚀 Creating sample users for Strategy HQ Dashboard...\n');
  
  // Check if backend is running
  try {
    const healthCheck = await fetch('http://localhost:3000/api/users');
    console.log('✅ Backend server is running\n');
  } catch (error) {
    console.error('❌ Backend server is not running on http://localhost:3000');
    console.error('Please start your backend server first and try again.');
    process.exit(1);
  }

  const results = [];
  
  for (const userData of sampleUsers) {
    const result = await createUser(userData);
    results.push(result);
    
    // Add small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n📊 Summary:');
  console.log(`Total users attempted: ${sampleUsers.length}`);
  console.log(`Successfully created: ${results.filter(r => r !== null).length}`);
  console.log(`Failed: ${results.filter(r => r === null).length}`);
  
  if (results.some(r => r !== null)) {
    console.log('\n🎉 Sample users created! You can now:');
    console.log('1. Start the frontend dashboard: npm run dev');
    console.log('2. Open http://localhost:5173');
    console.log('3. Select a user from the dropdown');
    console.log('4. Click "Connect to Strategy HQ"');
    console.log('\n⚠️  Note: Update the API keys, secret keys, and access tokens with real values for actual trading.');
  }
}

// Run the script
if (require.main === module) {
  createSampleUsers().catch(console.error);
}

module.exports = { createSampleUsers, createUser };

#!/usr/bin/env node

/**
 * Simple script to test CORS configuration
 * Run this to verify that CORS is working properly
 */

const API_URL = 'http://localhost:3000/api/users';

async function testCORS() {
    console.log('🧪 Testing CORS configuration...\n');
    
    try {
        console.log(`Testing API endpoint: ${API_URL}`);
        
        const response = await fetch(API_URL, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Origin': 'http://localhost:5173' // Simulate frontend request
            }
        });
        
        console.log(`Response Status: ${response.status} ${response.statusText}`);
        console.log('Response Headers:');
        
        // Check important CORS headers
        const corsHeaders = [
            'access-control-allow-origin',
            'access-control-allow-credentials',
            'access-control-allow-methods',
            'access-control-allow-headers'
        ];
        
        corsHeaders.forEach(header => {
            const value = response.headers.get(header);
            console.log(`  ${header}: ${value || 'Not set'}`);
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log(`\n✅ CORS test successful!`);
            console.log(`Found ${Array.isArray(data) ? data.length : 0} users in response`);
        } else {
            console.log(`\n❌ API request failed: ${response.status} ${response.statusText}`);
        }
        
    } catch (error) {
        console.error('❌ CORS test failed:', error.message);
        
        if (error.message.includes('fetch is not defined')) {
            console.log('\n💡 Note: This Node.js version doesn\'t have fetch. The test simulates what would happen in a browser.');
            console.log('Try testing directly in your browser console or with the frontend app.');
        } else if (error.message.includes('ECONNREFUSED')) {
            console.log('\n💡 Backend server is not running. Please start it first:');
            console.log('   npm start (or) npm run dev');
        }
    }
}

// Add a preflight OPTIONS test
async function testPreflightRequest() {
    console.log('\n🔄 Testing preflight request...');
    
    try {
        const response = await fetch(API_URL, {
            method: 'OPTIONS',
            headers: {
                'Origin': 'http://localhost:5173',
                'Access-Control-Request-Method': 'GET',
                'Access-Control-Request-Headers': 'Content-Type'
            }
        });
        
        console.log(`Preflight Status: ${response.status} ${response.statusText}`);
        
        if (response.status === 204 || response.status === 200) {
            console.log('✅ Preflight request successful');
        } else {
            console.log('❌ Preflight request failed');
        }
        
    } catch (error) {
        console.log('❌ Preflight test failed:', error.message);
    }
}

async function runTests() {
    await testCORS();
    await testPreflightRequest();
    
    console.log('\n📋 Next steps:');
    console.log('1. Ensure your backend server is running: npm start');
    console.log('2. Start the frontend: cd frontend && npm run dev');
    console.log('3. Open http://localhost:5173 and test the authentication form');
}

if (require.main === module) {
    runTests().catch(console.error);
}

module.exports = { testCORS };

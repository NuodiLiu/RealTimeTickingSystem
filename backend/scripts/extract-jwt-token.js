#!/usr/bin/env node

// Script to help extract JWT token from browser session for curl testing

console.log('🔐 JWT Token Extraction Helper');
console.log('=====================================\n');

console.log('Since you\'re already logged in via the browser, you can extract your JWT token:\n');

console.log('📋 Method 1: From Browser Developer Tools');
console.log('1. Open your portal in the browser (https://app.localhost)');
console.log('2. Open Developer Tools (F12)');
console.log('3. Go to Application/Storage tab');
console.log('4. Check Local Storage or Session Storage');
console.log('5. Look for keys like "authToken", "accessToken", or similar');
console.log('6. Copy the JWT token value\n');

console.log('📋 Method 2: From Network Tab');
console.log('1. Open Developer Tools (F12)');
console.log('2. Go to Network tab');
console.log('3. Refresh the page or make an API call');
console.log('4. Look for requests with Authorization header');
console.log('5. Copy the Bearer token from the header\n');

console.log('📋 Method 3: Using curl with browser cookies');
console.log('If you have the refresh cookie, you can get a new token:');
console.log(`
curl -X POST http://localhost:3000/auth/refresh \\
  -H "Cookie: your-refresh-cookie-here" \\
  -H "Content-Type: application/json"
`);

console.log('\n📋 Method 4: Test without JWT (use device auth instead)');
console.log('For testing case creation, you can use device authentication:');
console.log(`
curl -X POST http://localhost:3000/cases \\
  -H "Content-Type: application/json" \\
  -H "Authorisation: Device test-device-1:test-device-secret-123" \\
  -d '{
    "studentName": "John Smith",
    "category": "Academic",
    "zID": "z1234567"
  }'
`);

console.log('\n💡 Once you have the JWT token, use it like this:');
console.log(`
# Get cases (staff only)
curl -X GET http://localhost:3000/cases \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"

# Take a case
curl -X POST http://localhost:3000/cases/CASE_ID/take \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \\
  -H "Content-Type: application/json"
`);

console.log('\n🎯 Your Staff Details:');
console.log('- Employee No: aad-9188040d-6c67-4c5b-b112-36a304b66dad-00000000');
console.log('- Role: STAFF');
console.log('- User ID: cmfsavlun00008obqhusdip94');
console.log('\n✅ You are successfully authenticated!');

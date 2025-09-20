#!/usr/bin/env node

// Script to login as staff and get JWT token for testing
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🔐 Staff Login Helper');
console.log('This script helps you get a JWT token for staff authentication\n');

rl.question('Enter your employee number: ', (employeeNo) => {
  console.log('\n📝 Run this curl command to login:');
  console.log(`
curl -X POST http://localhost:3000/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"employeeNo": "${employeeNo}"}'
  `);
  
  console.log('🔗 Or visit this URL in your browser:');
  console.log(`http://localhost:3000/auth/login?employeeNo=${employeeNo}`);
  
  console.log('\n💡 After login, you can use the JWT token like this:');
  console.log(`
curl -X GET http://localhost:3000/cases \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
  `);
  
  console.log('\n📌 Note: For creating cases, device authentication is recommended:');
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
  
  rl.close();
});

#!/usr/bin/env node

// Updated curl commands for Azure Functions mode

console.log('🔄 Azure Functions Mode - Updated Curl Commands');
console.log('===============================================\n');

console.log('🚀 When using: nvm exec 22 npm run start:functions');
console.log('📍 Server runs on: http://localhost:7071');
console.log('🛣️  Route prefix: /api/app\n');

console.log('📋 Device Authentication (Creating Cases):');
console.log('```bash');
console.log('# Academic case');
console.log('curl -X POST http://localhost:7071/api/app/cases \\');
console.log('  -H "Content-Type: application/json" \\');
console.log('  -H "Authorisation: Device test-device-1:test-device-secret-123" \\');
console.log('  -d \'{"studentName":"Alice Johnson","category":"Academic","zID":"z1234567"}\'');
console.log('');
console.log('# IT Help case');
console.log('curl -X POST http://localhost:7071/api/app/cases \\');
console.log('  -H "Content-Type: application/json" \\');
console.log('  -H "Authorisation: Device test-device-1:test-device-secret-123" \\');
console.log('  -d \'{"studentName":"Bob Chen","category":"IT Help","zID":"z2345678"}\'');
console.log('```\n');

console.log('🔐 Staff JWT Authentication:');
console.log('```bash');
console.log('# Get your cases');
console.log('curl -X GET http://localhost:7071/api/app/cases \\');
console.log('  -H "Authorization: Bearer YOUR_JWT_TOKEN"');
console.log('');
console.log('# Take a case');
console.log('curl -X POST http://localhost:7071/api/app/cases/CASE_ID/take \\');
console.log('  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\');
console.log('  -H "Content-Type: application/json"');
console.log('');
console.log('# Resolve a case');
console.log('curl -X POST http://localhost:7071/api/app/cases/CASE_ID/resolve \\');
console.log('  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\');
console.log('  -H "Content-Type: application/json"');
console.log('```\n');

console.log('⚠️  Important Notes for Azure Functions:');
console.log('1. Port changes from 3000 → 7071');
console.log('2. All routes need /api/app prefix');
console.log('3. Body parsing might work differently (we fixed this earlier)');
console.log('4. SignalR routes are different (/api/signalr/*)');
console.log('5. Auth endpoints: /api/app/auth/*\n');

console.log('🔧 Quick Setup:');
console.log('```bash');
console.log('cd backend');
console.log('npm run build  # Build first');
console.log('nvm exec 22 npm run start:functions');
console.log('```\n');

console.log('✅ Your Staff Details (same for both modes):');
console.log('- Employee No: aad-9188040d-6c67-4c5b-b112-36a304b66dad-00000000');
console.log('- Role: STAFF');
console.log('- User ID: cmfsavlun00008obqhusdip94');

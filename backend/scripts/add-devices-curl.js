#!/usr/bin/env node

// Script showing how to add feedback/registration devices using curl

console.log('📱 Adding Feedback/Registration Devices with Curl');
console.log('=================================================\n');

console.log('🔄 Device Pairing Process:');
console.log('1. Staff generates QR code/pairing token');
console.log('2. Device uses token to complete pairing');
console.log('3. Device receives credentials for API access\n');

console.log('📋 Method 1: Using Development Test Token (Easiest)');
console.log('============================================\n');

console.log('🎯 Step 1: Complete pairing for Registration Device');
console.log('```bash');
console.log('curl -X POST http://localhost:7071/api/app/pair/complete \\');
console.log('  -H "Content-Type: application/json" \\');
console.log('  -d \'{');
console.log('    "pairingToken": "test-token-123",');
console.log('    "deviceName": "Registration Kiosk 1",');
console.log('    "mode": "REGISTRATION"');
console.log('  }\'');
console.log('```\n');

console.log('🎯 Step 2: Complete pairing for Feedback Device');
console.log('```bash');
console.log('curl -X POST http://localhost:7071/api/app/pair/complete \\');
console.log('  -H "Content-Type: application/json" \\');
console.log('  -d \'{');
console.log('    "pairingToken": "test-token-123",');
console.log('    "deviceName": "Feedback iPad 1",');
console.log('    "mode": "FEEDBACK"');
console.log('  }\'');
console.log('```\n');

console.log('📋 Method 2: Full Pairing Process (Production-like)');
console.log('=============================================\n');

console.log('🔐 Step 1: Generate pairing token (requires staff JWT)');
console.log('```bash');
console.log('curl -X POST http://localhost:7071/api/app/pair/generate-qr \\');
console.log('  -H "Authorization: Bearer YOUR_STAFF_JWT_TOKEN" \\');
console.log('  -H "Content-Type: application/json"');
console.log('```');
console.log('Response will contain: { "pairingToken": "abc123...", "qrUrl": "..." }\n');

console.log('📱 Step 2: Complete pairing with the token');
console.log('```bash');
console.log('curl -X POST http://localhost:7071/api/app/pair/complete \\');
console.log('  -H "Content-Type: application/json" \\');
console.log('  -d \'{');
console.log('    "pairingToken": "PAIRING_TOKEN_FROM_STEP_1",');
console.log('    "deviceName": "My New Device",');
console.log('    "mode": "REGISTRATION"');
console.log('  }\'');
console.log('```\n');

console.log('🎛️  Device Mode Options:');
console.log('- "REGISTRATION" - For creating new cases (student check-in)');
console.log('- "FEEDBACK" - For collecting feedback on resolved cases\n');

console.log('📤 Expected Response (pairing complete):');
console.log('```json');
console.log('{');
console.log('  "deviceId": "new-device-id",');
console.log('  "deviceSecret": "generated-secret-key",');
console.log('  "wsToken": "websocket-jwt-token",');
console.log('  "message": "Device paired successfully"');
console.log('}');
console.log('```\n');

console.log('✅ Using the New Device:');
console.log('After pairing, use the deviceId and deviceSecret for API calls:');
console.log('```bash');
console.log('curl -X POST http://localhost:7071/api/app/cases \\');
console.log('  -H "Content-Type: application/json" \\');
console.log('  -H "Authorisation: Device NEW_DEVICE_ID:NEW_DEVICE_SECRET" \\');
console.log('  -d \'{"studentName":"Test User","category":"Academic"}\'');
console.log('```\n');

console.log('💡 Quick Setup for Multiple Devices:');
console.log('```bash');
console.log('# Registration Device');
console.log('curl -X POST http://localhost:7071/api/app/pair/complete \\');
console.log('  -H "Content-Type: application/json" \\');
console.log('  -d \'{"pairingToken":"test-token-123","deviceName":"Registration Kiosk","mode":"REGISTRATION"}\'');
console.log('');
console.log('# Feedback Device');
console.log('curl -X POST http://localhost:7071/api/app/pair/complete \\');
console.log('  -H "Content-Type: application/json" \\');
console.log('  -d \'{"pairingToken":"test-token-123","deviceName":"Feedback iPad","mode":"FEEDBACK"}\'');
console.log('```');

// Simple test to verify our pairing status endpoint logic
const { DeviceService } = require('./dist/services/device.service');

async function testPairingEndpoint() {
  console.log('Testing Pairing Status Endpoint Logic...\n');

  // Test 1: Non-existent device
  console.log('Test 1: Non-existent device');
  try {
    const result1 = await DeviceService.checkPairingStatus('fake-device-id');
    console.log('Result:', { isPaired: result1 });
    console.log('Expected: { isPaired: false }\n');
  } catch (error) {
    console.error('Error:', error.message, '\n');
  }

  // Test 2: Empty device ID
  console.log('Test 2: Empty device ID');
  try {
    const result2 = await DeviceService.checkPairingStatus('');
    console.log('Result:', { isPaired: result2 });
  } catch (error) {
    console.error('Error:', error.message);
  }

  console.log('\nEndpoint logic tests completed!');
  console.log('\nFor iPad app integration:');
  console.log('GET /device/pairing-status/{deviceId}');
  console.log('Response: { "isPaired": true/false }');
  
  process.exit(0);
}

testPairingEndpoint().catch(console.error);

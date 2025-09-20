#!/usr/bin/env node

// Script to create a test device for development
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function createTestDevice() {
  try {
    console.log('Creating test device...');
    
    // Create a test device secret
    const deviceSecret = 'test-device-secret-123';
    const secretHash = crypto.createHash('sha256').update(deviceSecret).digest('hex');
    
    // Create or update test device
    const device = await prisma.kioskDevice.upsert({
      where: { id: 'test-device-1' },
      update: {
        name: 'Test Device 1',
        secretHash: secretHash,
        mode: 'REGISTRATION',
        lastSeenAt: new Date(),
        deletedAt: null,
      },
      create: {
        id: 'test-device-1',
        name: 'Test Device 1',
        secretHash: secretHash,
        mode: 'REGISTRATION',
        lastSeenAt: new Date(),
      },
    });
    
    console.log('✅ Test device created successfully!');
    console.log('Device ID:', device.id);
    console.log('Device Name:', device.name);
    console.log('Device Secret:', deviceSecret);
    console.log('');
    console.log('🔑 Use this authentication header for API calls:');
    console.log(`Authorisation: Device test-device-1:${deviceSecret}`);
    console.log('');
    console.log('📝 Example curl command to create a case:');
    console.log(`curl -X POST https://api.localhost/api/app/cases \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -H "Authorisation: Device test-device-1:${deviceSecret}" \\`);
    console.log(`  -d '{`);
    console.log(`    "studentName": "John Smith",`);
    console.log(`    "category": "Academic",`);
    console.log(`    "zID": "z1234567"`);
    console.log(`  }'`);
    
  } catch (error) {
    console.error('❌ Error creating test device:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestDevice();

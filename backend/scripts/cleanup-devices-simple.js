const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanupAllDevices() {
  console.log('🧹 Starting device cleanup...');
  
  try {
    // Use transaction to ensure all operations succeed or fail together
    await prisma.$transaction(async (tx) => {
      // Step 1: Delete all feedback records
      console.log('📝 Deleting feedback records...');
      const deletedFeedback = await tx.feedback.deleteMany({});
      console.log(`   ✅ Deleted ${deletedFeedback.count} feedback records`);

      // Step 2: Delete all feedback sessions
      console.log('📊 Deleting feedback sessions...');
      const deletedFeedbackSessions = await tx.feedbackSession.deleteMany({});
      console.log(`   ✅ Deleted ${deletedFeedbackSessions.count} feedback sessions`);

      // Step 3: Delete all pairing sessions
      console.log('🔗 Deleting pairing sessions...');
      const deletedPairingSessions = await tx.pairingSession.deleteMany({});
      console.log(`   ✅ Deleted ${deletedPairingSessions.count} pairing sessions`);

      // Step 4: Clear current lock references from devices
      console.log('🔓 Clearing device lock references...');
      const clearedDevices = await tx.kioskDevice.updateMany({
        where: { currentLockId: { not: null } },
        data: { currentLockId: null }
      });
      console.log(`   ✅ Cleared lock references from ${clearedDevices.count} devices`);

      // Step 5: Delete all kiosk locks
      console.log('🔒 Deleting kiosk locks...');
      const deletedLocks = await tx.kioskLock.deleteMany({});
      console.log(`   ✅ Deleted ${deletedLocks.count} kiosk locks`);

      // Step 6: Delete all kiosk devices
      console.log('📱 Deleting kiosk devices...');
      const deletedDevices = await tx.kioskDevice.deleteMany({});
      console.log(`   ✅ Deleted ${deletedDevices.count} kiosk devices`);

      // Step 7: Update any cases that were in RESOLVED_PENDING_FEEDBACK to RESOLVED
      console.log('📋 Updating pending feedback cases...');
      const updatedCases = await tx.studentCase.updateMany({
        where: { status: 'RESOLVED_PENDING_FEEDBACK' },
        data: { 
          status: 'RESOLVED',
          resolvedAt: new Date()
        }
      });
      console.log(`   ✅ Updated ${updatedCases.count} cases from pending feedback to resolved`);
    });

    console.log('');
    console.log('✅ Device cleanup completed successfully!');
    console.log('📊 Summary: All devices, locks, and related data have been removed');
    console.log('🔄 You can now start fresh with device pairing');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Add confirmation prompt
function askForConfirmation() {
  return new Promise((resolve) => {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('⚠️  This will DELETE ALL devices, locks, and related data. Are you sure? (yes/no): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

async function main() {
  console.log('🚨 DEVICE CLEANUP SCRIPT 🚨');
  console.log('This script will remove:');
  console.log('  - All Kiosk Devices');
  console.log('  - All Device Locks');
  console.log('  - All Feedback Sessions');
  console.log('  - All Feedback Records');
  console.log('  - All Pairing Sessions');
  console.log('  - Update pending feedback cases to resolved');
  console.log('');

  // Check if we're in production
  if (process.env.NODE_ENV === 'production') {
    console.log('❌ This script is disabled in production environment for safety');
    process.exit(1);
  }

  const confirmed = await askForConfirmation();
  
  if (confirmed) {
    await cleanupAllDevices();
  } else {
    console.log('❌ Cleanup cancelled by user');
  }
}

// Run the script
main().catch((error) => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});

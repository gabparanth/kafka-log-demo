// Gate 1 Test: Verify outbox write works
require('dotenv').config({ path: '../../.env' });

const {
  initOutboxLogger,
  generateCorrelationId,
  logToOutbox,
  getOutboxStats,
  getRecentMessages,
  closeOutboxLogger
} = require('./outbox-logger');

async function testGate1() {
  console.log('=== Gate 1 Test: Local MongoDB + Outbox Collection ===\n');

  try {
    // Step 1: Connect to local MongoDB
    console.log('1. Connecting to local MongoDB...');
    await initOutboxLogger();
    console.log('   ✓ Connected\n');

    // Step 2: Write a test log to outbox
    console.log('2. Writing test log to outbox...');
    const correlationId = generateCorrelationId();
    const entry = await logToOutbox(
      'test-service',
      'INFO',
      'Gate 1 test message',
      correlationId,
      { testId: 'gate-1' }
    );
    console.log(`   ✓ Written with messageId: ${entry.messageId}\n`);

    // Step 3: Verify it's in the database
    console.log('3. Verifying entry in database...');
    const stats = await getOutboxStats();
    console.log('   Stats:', stats);

    const recent = await getRecentMessages(1);
    console.log('   Recent entry:', JSON.stringify(recent[0], null, 2));

    // Step 4: Verify status is pending
    if (recent[0] && recent[0].status === 'pending') {
      console.log('\n=== ✓ GATE 1 PASSED ===');
      console.log('Entry written to outbox with status: pending\n');
    } else {
      console.log('\n=== ✗ GATE 1 FAILED ===');
      console.log('Entry not found or status incorrect\n');
    }

  } catch (error) {
    console.error('\n=== ✗ GATE 1 FAILED ===');
    console.error('Error:', error.message);
  } finally {
    await closeOutboxLogger();
    process.exit(0);
  }
}

testGate1();

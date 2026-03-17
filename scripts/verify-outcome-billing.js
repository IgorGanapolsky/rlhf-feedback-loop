const billing = require('./billing');
const { provisionApiKey, validateApiKey, recordUsage, loadKeyStore, saveKeyStore } = billing;
const assert = require('assert');

async function test() {
  console.log('Testing Outcome-Based Billing...');

  // 1. Provision a key with a starter pack (500 credits)
  const customerId = 'test_outcome_user_' + Date.now();
  const provisioned = provisionApiKey(customerId, { packId: 'starter' });
  console.log('Provisioned:', provisioned);
  assert.strictEqual(provisioned.remainingCredits, 500);

  // 2. Validate the key
  const validation = validateApiKey(provisioned.key);
  console.log('Validation:', validation);
  assert.strictEqual(validation.valid, true);
  assert.strictEqual(validation.remainingCredits, 500);
  assert.strictEqual(validation.unlimited, false);

  // 3. Record usage and check decrement
  const usage = recordUsage(provisioned.key);
  console.log('Usage 1:', usage);
  assert.strictEqual(usage.remainingCredits, 499);

  // 4. Test credit exhaustion
  // Manually set credits to 1
  const store = loadKeyStore();
  store.keys[provisioned.key].remainingCredits = 1;
  saveKeyStore(store);
  
  const usage2 = recordUsage(provisioned.key);
  console.log('Usage 2 (1 credit left):', usage2);
  assert.strictEqual(usage2.remainingCredits, 0);

  const usage3 = recordUsage(provisioned.key);
  console.log('Usage 3 (0 credits left):', usage3);
  assert.strictEqual(usage3.recorded, false);
  assert.strictEqual(usage3.reason, 'out_of_credits');

  const finalValidation = validateApiKey(provisioned.key);
  console.log('Final Validation:', finalValidation);
  assert.strictEqual(finalValidation.valid, false);
  assert.strictEqual(finalValidation.reason, 'out_of_credits');

  console.log('Outcome-Based Billing Verification PASSED');
}

test().catch(err => {
  console.error('Verification FAILED:', err);
  console.error(err.stack);
  process.exit(1);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  listSubagentProfiles,
  getSubagentProfile,
  validateSubagentProfiles,
} = require('../scripts/subagent-profiles');

test('lists and loads subagent profiles', () => {
  const names = listSubagentProfiles();
  assert.ok(names.includes('pr_workflow'));
  const profile = getSubagentProfile('pr_workflow');
  assert.equal(profile.mcpProfile, 'default');
});

test('subagent profiles validate against mcp policy', () => {
  const result = validateSubagentProfiles();
  assert.equal(result.valid, true);
  assert.equal(result.issues.length, 0);
});

test('listSubagentProfiles returns array with length >= 2', () => {
  const names = listSubagentProfiles();
  assert.ok(Array.isArray(names), 'should return an array');
  assert.ok(names.length >= 2, `expected >= 2 profiles, got ${names.length}`);
});

test('loadSubagentProfiles returns object with profiles', () => {
  const { loadSubagentProfiles } = require('../scripts/subagent-profiles');
  const data = loadSubagentProfiles();
  assert.ok(data.profiles, 'loaded data must have profiles key');
  assert.equal(typeof data.profiles, 'object');
});

test('getSubagentProfile pr_workflow has mcpProfile field', () => {
  const profile = getSubagentProfile('pr_workflow');
  assert.ok(profile.mcpProfile, 'pr_workflow profile must have mcpProfile');
  assert.equal(typeof profile.mcpProfile, 'string');
});

test('validateSubagentProfiles returns valid true when profiles are correct', () => {
  const result = validateSubagentProfiles();
  assert.equal(result.valid, true);
  assert.ok(Array.isArray(result.issues), 'issues should be an array');
});

test('unknown profile throws error', () => {
  assert.throws(
    () => getSubagentProfile('nonexistent_profile_xyz'),
    /Unknown subagent profile/,
    'should throw for unknown profile name'
  );
});

/**
 * Test Scenarios for SMCR Wizard
 * Tests the three critical scenarios identified in code review
 */

const API_BASE = 'http://localhost:3002/api';

// Helper to make API calls
async function apiCall(method, path, body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${path}`, options);
  const data = await response.json();
  return { status: response.status, data };
}

// Test colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function assert(condition, message) {
  if (condition) {
    log(`✓ ${message}`, 'green');
  } else {
    log(`✗ ${message}`, 'red');
    throw new Error(`Assertion failed: ${message}`);
  }
}

// Scenario 1: UUID Mapping with Individual Changes
async function testScenario1() {
  log('\n=== SCENARIO 1: UUID Mapping with Individual Changes ===', 'blue');
  log('Test: Create draft with 3 individuals, save, modify individuals, save again', 'yellow');

  // Step 1: Create initial draft with 3 individuals
  const initialPayload = {
    firmProfile: {
      firmName: 'Test Firm Alpha',
      firmType: 'solo',
      smcrCategory: 'Core',
      jurisdictions: ['UK'],
      isCASSFirm: false,
      optUp: false,
    },
    responsibilityRefs: ['A', 'B'],
    responsibilityOwners: {},
    individuals: [
      { id: 'temp-1', name: 'Alice Smith', smfRoles: ['SMF16'], email: 'alice@test.com' },
      { id: 'temp-2', name: 'Bob Jones', smfRoles: ['SMF17'], email: 'bob@test.com' },
      { id: 'temp-3', name: 'Carol White', smfRoles: ['SMF1'], email: 'carol@test.com' },
    ],
    fitnessResponses: [
      { questionId: 'temp-1::honesty::0', sectionId: 'honesty', response: 'Alice is honest', evidence: 'evidence1.pdf' },
      { questionId: 'temp-1::honesty::1', sectionId: 'honesty', response: 'Alice background check', evidence: '' },
      { questionId: 'temp-2::honesty::0', sectionId: 'honesty', response: 'Bob is honest', evidence: 'evidence2.pdf' },
      { questionId: 'temp-3::competence::0', sectionId: 'competence', response: 'Carol is competent', evidence: '' },
    ],
  };

  log('Creating initial draft...', 'yellow');
  const createResult = await apiCall('POST', '/firms', initialPayload);
  if (createResult.status !== 201 && createResult.status !== 200) {
    console.error('API Error:', createResult.data);
  }
  assert(createResult.status === 201 || createResult.status === 200, 'Draft created successfully');
  const draftId = createResult.data.id;
  log(`Draft ID: ${draftId}`, 'green');

  // Step 2: Load the draft
  log('\nLoading draft...', 'yellow');
  const loadResult = await apiCall('GET', `/firms/${draftId}`);
  assert(loadResult.status === 200, 'Draft loaded successfully');
  assert(loadResult.data.individuals.length === 3, '3 individuals loaded');
  assert(loadResult.data.fitnessResponses.length === 4, '4 fitness responses loaded');

  const dbIndividuals = loadResult.data.individuals;
  log(`Loaded individuals: ${dbIndividuals.map(i => i.name).join(', ')}`, 'green');

  // Step 3: Modify - remove temp-2 (Bob), add 2 new individuals
  log('\nModifying individuals (remove Bob, add David & Eve)...', 'yellow');
  const updatePayload = {
    firmProfile: initialPayload.firmProfile,
    responsibilityRefs: ['A', 'B'],
    responsibilityOwners: {},
    individuals: [
      { id: 'temp-1', name: 'Alice Smith', smfRoles: ['SMF16'], email: 'alice@test.com' },
      { id: 'temp-3', name: 'Carol White', smfRoles: ['SMF1'], email: 'carol@test.com' },
      { id: 'temp-4', name: 'David Brown', smfRoles: ['SMF18'], email: 'david@test.com' },
      { id: 'temp-5', name: 'Eve Green', smfRoles: ['SMF2'], email: 'eve@test.com' },
    ],
    fitnessResponses: [
      // Keep Alice's responses (temp-1)
      { questionId: 'temp-1::honesty::0', sectionId: 'honesty', response: 'Alice is honest', evidence: 'evidence1.pdf' },
      { questionId: 'temp-1::honesty::1', sectionId: 'honesty', response: 'Alice background check', evidence: '' },
      // Keep Carol's responses (temp-3)
      { questionId: 'temp-3::competence::0', sectionId: 'competence', response: 'Carol is competent', evidence: '' },
      // Add new responses for David (temp-4)
      { questionId: 'temp-4::honesty::0', sectionId: 'honesty', response: 'David is trustworthy', evidence: 'evidence4.pdf' },
      // Add new responses for Eve (temp-5)
      { questionId: 'temp-5::competence::0', sectionId: 'competence', response: 'Eve is skilled', evidence: '' },
    ],
  };

  const updateResult = await apiCall('PUT', `/firms/${draftId}`, updatePayload);
  assert(updateResult.status === 200, 'Draft updated successfully');

  // Step 4: Verify UUID mapping worked correctly
  log('\nVerifying UUID mapping...', 'yellow');
  const verifyResult = await apiCall('GET', `/firms/${draftId}`);
  assert(verifyResult.status === 200, 'Draft re-loaded successfully');
  assert(verifyResult.data.individuals.length === 4, '4 individuals after update');
  assert(verifyResult.data.fitnessResponses.length === 5, '5 fitness responses after update');

  const finalIndividuals = verifyResult.data.individuals;
  log(`Final individuals: ${finalIndividuals.map(i => i.name).join(', ')}`, 'green');

  // Verify each individual has their fitness responses with correct UUIDs
  finalIndividuals.forEach((individual) => {
    const responses = verifyResult.data.fitnessResponses.filter((r) =>
      r.questionId.startsWith(individual.id + '::')
    );
    log(`  ${individual.name}: ${responses.length} fitness response(s)`, 'green');
    assert(responses.length > 0, `${individual.name} has fitness responses with correct UUID`);
  });

  // Cleanup
  await apiCall('DELETE', `/firms/${draftId}`);
  log('\n✓ SCENARIO 1 PASSED', 'green');
}

// Scenario 2: Responsibility Reassignment Flow
async function testScenario2() {
  log('\n=== SCENARIO 2: Responsibility Reassignment Flow ===', 'blue');
  log('Test: Assign responsibilities, remove individual, verify stats, reassign', 'yellow');

  // Step 1: Create draft with responsibilities assigned to Individual A
  const initialPayload = {
    firmProfile: {
      firmName: 'Test Firm Beta',
      firmType: 'solo',
      smcrCategory: 'Core',
      jurisdictions: ['UK'],
      isCASSFirm: false,
      optUp: false,
    },
    responsibilityRefs: ['A', 'B', 'C'],
    responsibilityOwners: {
      'A': 'temp-1',
      'B': 'temp-1',
      'C': 'temp-2',
    },
    individuals: [
      { id: 'temp-1', name: 'Individual A', smfRoles: ['SMF16'], email: 'a@test.com' },
      { id: 'temp-2', name: 'Individual B', smfRoles: ['SMF17'], email: 'b@test.com' },
    ],
    fitnessResponses: [],
  };

  log('Creating draft with responsibility assignments...', 'yellow');
  const createResult = await apiCall('POST', '/firms', initialPayload);
  assert(createResult.status === 201 || createResult.status === 200, 'Draft created successfully');
  const draftId = createResult.data.id;

  // Step 2: Verify initial state
  log('\nVerifying initial assignments...', 'yellow');
  const loadResult = await apiCall('GET', `/firms/${draftId}`);
  const respWithOwners = loadResult.data.responsibilities.filter(r => r.ownerId).length;
  assert(respWithOwners === 3, `3 responsibilities have owners (got ${respWithOwners})`);

  // Step 3: Remove Individual A
  log('\nRemoving Individual A...', 'yellow');
  const updatePayload1 = {
    ...initialPayload,
    individuals: [
      { id: 'temp-2', name: 'Individual B', smfRoles: ['SMF17'], email: 'b@test.com' },
    ],
    responsibilityOwners: {
      'C': 'temp-2', // Only B's assignments remain
    },
  };

  await apiCall('PUT', `/firms/${draftId}`, updatePayload1);

  // Step 4: Verify stats show unassigned
  log('Verifying unassigned count...', 'yellow');
  const afterRemovalResult = await apiCall('GET', `/firms/${draftId}`);
  const unassigned = afterRemovalResult.data.responsibilities.filter(r => !r.ownerId).length;
  assert(unassigned === 2, `2 responsibilities unassigned after removal (got ${unassigned})`);

  // Step 5: Reassign to Individual B
  log('\nReassigning to Individual B...', 'yellow');
  const updatePayload2 = {
    ...updatePayload1,
    responsibilityOwners: {
      'A': 'temp-2',
      'B': 'temp-2',
      'C': 'temp-2',
    },
  };

  await apiCall('PUT', `/firms/${draftId}`, updatePayload2);

  // Step 6: Verify all assigned
  log('Verifying all responsibilities assigned...', 'yellow');
  const finalResult = await apiCall('GET', `/firms/${draftId}`);
  const allAssigned = finalResult.data.responsibilities.filter(r => r.ownerId).length;
  assert(allAssigned === 3, `All 3 responsibilities assigned (got ${allAssigned})`);

  // Cleanup
  await apiCall('DELETE', `/firms/${draftId}`);
  log('\n✓ SCENARIO 2 PASSED', 'green');
}

// Scenario 3: Draft Load/Save Cycle
async function testScenario3() {
  log('\n=== SCENARIO 3: Draft Load/Save Cycle ===', 'blue');
  log('Test: Complete all steps, save, load, verify all data', 'yellow');

  // Step 1: Create complete draft
  const completePayload = {
    firmProfile: {
      firmName: 'Test Firm Gamma',
      firmType: 'solo',
      smcrCategory: 'Enhanced',
      jurisdictions: ['UK', 'EU'],
      isCASSFirm: true,
      optUp: true,
    },
    responsibilityRefs: ['A', 'B', 'C', 'D'],
    responsibilityOwners: {
      'A': 'temp-1',
      'B': 'temp-1',
      'C': 'temp-2',
      'D': 'temp-2',
    },
    individuals: [
      { id: 'temp-1', name: 'John Doe', smfRoles: ['SMF1'], email: 'john@test.com' },
      { id: 'temp-2', name: 'Jane Smith', smfRoles: ['SMF16'], email: 'jane@test.com' },
    ],
    fitnessResponses: [
      { questionId: 'temp-1::honesty::0', sectionId: 'honesty', response: 'John honesty check', evidence: 'john-honesty.pdf' },
      { questionId: 'temp-1::honesty::1', sectionId: 'honesty', response: 'John background', evidence: '' },
      { questionId: 'temp-1::competence::0', sectionId: 'competence', response: 'John competence', evidence: 'john-comp.pdf' },
      { questionId: 'temp-2::honesty::0', sectionId: 'honesty', response: 'Jane honesty check', evidence: '' },
      { questionId: 'temp-2::competence::0', sectionId: 'competence', response: 'Jane competence', evidence: 'jane-comp.pdf' },
      { questionId: 'temp-2::financial::0', sectionId: 'financial', response: 'Jane financial check', evidence: '' },
    ],
  };

  log('Creating complete draft...', 'yellow');
  const createResult = await apiCall('POST', '/firms', completePayload);
  assert(createResult.status === 201 || createResult.status === 200, 'Complete draft created');
  const draftId = createResult.data.id;

  // Step 2: Load draft and verify all data
  log('\nLoading and verifying complete draft...', 'yellow');
  const loadResult = await apiCall('GET', `/firms/${draftId}`);

  // Verify firm profile
  assert(loadResult.data.firmName === 'Test Firm Gamma', 'Firm name preserved');
  assert(loadResult.data.firmType === 'solo', 'Firm type preserved');
  assert(loadResult.data.smcrCategory === 'Enhanced', 'SMCR category preserved');
  assert(loadResult.data.isCASSFirm === true, 'CASS designation preserved');
  assert(loadResult.data.optUp === true, 'OptUp flag preserved');
  assert(loadResult.data.jurisdictions.length === 2, 'Jurisdictions preserved');

  // Verify responsibilities (assigned + unassigned)
  log('Verifying responsibilities...', 'yellow');
  const responsibilities = loadResult.data.responsibilities;
  assert(responsibilities.length === 4, `4 assigned responsibilities loaded (got ${responsibilities.length})`);

  const assignedWithOwners = responsibilities.filter(r => r.ownerId).length;
  assert(assignedWithOwners === 4, `All 4 assigned responsibilities have owners (got ${assignedWithOwners})`);

  // Verify individuals
  log('Verifying individuals...', 'yellow');
  assert(loadResult.data.individuals.length === 2, '2 individuals loaded');
  const john = loadResult.data.individuals.find(i => i.name === 'John Doe');
  const jane = loadResult.data.individuals.find(i => i.name === 'Jane Smith');
  assert(john !== undefined, 'John Doe found');
  assert(jane !== undefined, 'Jane Smith found');

  // Verify fitness responses for all individuals
  log('Verifying fitness responses...', 'yellow');
  assert(loadResult.data.fitnessResponses.length === 6, `6 fitness responses loaded (got ${loadResult.data.fitnessResponses.length})`);

  const johnResponses = loadResult.data.fitnessResponses.filter(r => r.questionId.startsWith(john.id + '::'));
  const janeResponses = loadResult.data.fitnessResponses.filter(r => r.questionId.startsWith(jane.id + '::'));

  assert(johnResponses.length === 3, `John has 3 responses (got ${johnResponses.length})`);
  assert(janeResponses.length === 3, `Jane has 3 responses (got ${janeResponses.length})`);

  // Verify evidence links preserved
  const withEvidence = loadResult.data.fitnessResponses.filter(r => r.evidence && r.evidence.length > 0);
  assert(withEvidence.length === 3, `3 responses have evidence links (got ${withEvidence.length})`);

  // Cleanup
  await apiCall('DELETE', `/firms/${draftId}`);
  log('\n✓ SCENARIO 3 PASSED', 'green');
}

// Run all tests
async function runTests() {
  try {
    log('Starting SMCR Wizard Test Suite...', 'blue');
    log('Ensure dev server is running at http://localhost:3002\n', 'yellow');

    await testScenario1();
    await testScenario2();
    await testScenario3();

    log('\n========================================', 'green');
    log('ALL TESTS PASSED ✓✓✓', 'green');
    log('========================================\n', 'green');
    process.exit(0);
  } catch (error) {
    log(`\n✗ TEST FAILED: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

runTests();

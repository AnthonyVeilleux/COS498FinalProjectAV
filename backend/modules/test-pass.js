// test-password-utils.js
const { validatePassword, hashPassword, comparePassword } = require('./password-utils');

async function testPasswordUtils() {
  console.log('=== Testing Password Validation ===\n');
  
  // Test valid password
  const validResult = validatePassword('MySecure123!');
  console.log('Valid password test:', validResult.valid); // true
  console.log('Errors:', validResult.errors); // []
  
  // Test invalid passwords
  const weakPasswords = [
    'short',           // Too short
    'nouppercase123!', // No uppercase
    'NOLOWERCASE123!', // No lowercase
    'NoNumbersHere!',  // No numbers
    'NoSpecialChars123' // No special characters
  ];
  
  weakPasswords.forEach(pwd => {
    const result = validatePassword(pwd);
    console.log(`\nPassword: "${pwd}"`);
    console.log('Valid:', result.valid);
    console.log('Errors:', result.errors);
  });
  
  console.log('\n=== Testing Password Hashing ===\n');
  
  // Test hashing
  const password = 'TestPassword123!';
  const hash1 = await hashPassword(password);
  const hash2 = await hashPassword(password);
  
  console.log('Original password:', password);
  console.log('Hash 1:', hash1);
  console.log('Hash 2:', hash2);
  console.log('Hashes are different (due to salt):', hash1 !== hash2);
  
  // Test comparison
  console.log('\n=== Testing Password Comparison ===\n');
  
  const correctMatch = await comparePassword(password, hash1);
  const wrongMatch = await comparePassword('WrongPassword', hash1);
  
  console.log('Correct password matches:', correctMatch); // true
  console.log('Wrong password matches:', wrongMatch); // false
}

testPasswordUtils().catch(console.error);

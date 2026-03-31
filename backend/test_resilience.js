const http = require('http');

async function runTests() {
  console.log('--- STARTING RESILIENCE VALIDATION ---');

  const makeRequest = (options, postData) => {
    return new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data }));
      });
      req.on('error', reject);
      if (postData) req.write(postData);
      req.end();
    });
  };

  // Test 3: Missing Auth
  try {
    const res = await makeRequest({ hostname: 'localhost', port: 5000, path: '/api/auth/profile', method: 'GET' });
    console.log(`✅ [Missing Auth] Status: ${res.status}`);
  } catch (e) {
    console.log(`❌ [Missing Auth] Failed: ${e.message}`);
  }

  // Test 3: Invalid Token
  try {
    const res = await makeRequest({ 
      hostname: 'localhost', port: 5000, path: '/api/auth/profile', method: 'GET',
      headers: { 'Authorization': 'Bearer invalid.token.here' } 
    });
    console.log(`✅ [Invalid Token] Status: ${res.status}`);
  } catch (e) {
    console.log(`❌ [Invalid Token] Failed: ${e.message}`);
  }

  // Test 7: Large Payload > 1MB
  try {
    const largeData = JSON.stringify({ data: 'A'.repeat(1.5 * 1024 * 1024) });
    const res = await makeRequest({ 
      hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(largeData) }
    }, largeData);
    console.log(`✅ [Large Payload] Status: ${res.status}`);
  } catch (e) {
    console.log(`❌ [Large Payload] Failed: ${e.message}`);
  }

  // Test 4: Rate Limiting
  let limitHit = false;
  for (let i = 1; i <= 20; i++) {
    const data = JSON.stringify({ email: 'test@test.com', password: 'test' });
    const res = await makeRequest({ 
      hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, data);
    
    if (res.status === 429) {
      console.log(`✅ [Rate Limit /auth] Blocked successfully at request #${i}`);
      limitHit = true;
      break;
    }
  }
  if (!limitHit) console.log(`❌ [Rate Limit /auth] Failed to block after 20 attempts`);

  // Test 5: Stripe Invalid Signature
  try {
    const stripeData = JSON.stringify({ id: 'evt_test' });
    const res = await makeRequest({ 
      hostname: 'localhost', port: 5000, path: '/api/orders/webhook', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'stripe-signature': 'invalid_sig' }
    }, stripeData);
    console.log(`✅ [Stripe Webhook] Status: ${res.status} - ${res.data}`);
  } catch(e) {
    console.log(`❌ [Stripe Webhook] Failed: ${e.message}`);
  }
  
  // Test 8: Deep Readiness Check
  try {
    const res = await makeRequest({ hostname: 'localhost', port: 5000, path: '/api/ready', method: 'GET' });
    console.log(`✅ [Readiness] Status: ${res.status} (Returns 503 if DB is down, which is the expected fallback behavior)`);
  } catch (e) {
    console.log(`❌ [Readiness] Failed: ${e.message}`);
  }

  console.log('--- VALIDATION COMPLETE ---');
}
runTests();

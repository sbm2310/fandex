// Creates a throwaway account on the local API, for flows that need one. Signing up through
// the app's form doesn't work under test: iOS replaces a new password with its "Automatic
// Strong Password". The flow signs in through the app instead, and deletes the account at the end.
const email = `e2e-${Date.now()}@example.test`;
const password = `e2e-${Math.random().toString(36).slice(2)}-pass`;
const response = http.post(`${API_URL}/api/auth/sign-up/email`, {
  headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:8081' },
  body: JSON.stringify({ name: 'Maestro', email, password }),
});
if (response.status !== 200) {
  throw new Error(`Couldn't create the test account: ${response.status} ${response.body}`);
}
output.email = email;
output.password = password;

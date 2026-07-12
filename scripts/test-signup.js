const { readFileSync, existsSync } = require("fs");
const { resolve } = require("path");

const envPath = resolve(__dirname, "../.env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    const value = match[2].trim().replace(/^"|"$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function signup(email) {
  const res = await fetch(`${url}/auth/v1/signup`, {
    method: "POST",
    headers: {
      apikey: key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password: "QATestPass123!Secure",
      data: { full_name: "QA Test User" },
    }),
  });
  const text = await res.text();
  console.log(email, res.status, text.slice(0, 500));
}

async function main() {
  await signup(`qa.jobagent.${Date.now()}@jobagent-e2e.test`);
  await signup("jobagent.test.2026@gmail.com");
}

main();

async function run() {
  const res = await fetch("https://database-interpreters.rewvid.easypanel.host/api/interpreters", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      externalId: "test-" + Date.now(),
      name: "Test User",
      tariffPerMinute: 0.15,
      emailCorporativo: "test" + Date.now() + "@example.com",
      password: "securepassword"
    })
  });
  console.log("Status:", res.status);
  const text = await res.text();
  console.log("Response:", text);
}
run();

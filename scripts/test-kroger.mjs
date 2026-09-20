import fs from "fs";

function loadEnvFile(path = ".env.local") {
  const text = fs.readFileSync(path, "utf8");

  for (const line of text.split("\n")) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) continue;

    const index = trimmed.indexOf("=");
    if (index === -1) continue;

    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();

    process.env[key] ??= value;
  }
}

loadEnvFile();

const CLIENT_ID = process.env.KROGER_CLIENT_ID;
const CLIENT_SECRET = process.env.KROGER_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  throw new Error("Missing KROGER_CLIENT_ID or KROGER_CLIENT_SECRET");
}

const BASE_URL = "https://api-ce.kroger.com";

async function getToken() {
  const credentials = Buffer.from(
    `${CLIENT_ID}:${CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch(`${BASE_URL}/v1/connect/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "product.compact",
    }),
  });

  if (!response.ok) {
    console.error(await response.text());
    throw new Error(`Token request failed: ${response.status}`);
  }

  return response.json();
}

async function findStores(token) {
  const params = new URLSearchParams({
    "filter.zipCode.near": "90815",
    "filter.radiusInMiles": "10",
    "filter.limit": "5",
  });

  const response = await fetch(
    `${BASE_URL}/v1/locations?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    console.error(await response.text());
    throw new Error(`Location request failed: ${response.status}`);
  }

  return response.json();
}

async function findProducts(token, locationId) {
  const params = new URLSearchParams({
    "filter.term": "eggs",
    "filter.locationId": locationId,
    "filter.limit": "5",
  });

  const response = await fetch(
    `${BASE_URL}/v1/products?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    console.error(await response.text());
    throw new Error(`Product request failed: ${response.status}`);
  }

  return response.json();
}

async function main() {
  console.log("1. Authenticating with Kroger...");

  const tokenData = await getToken();

  console.log("✅ Authentication successful");
  console.log(`Token expires in: ${tokenData.expires_in} seconds`);

  console.log("\n2. Finding nearby Kroger-family stores...");

  const locations = await findStores(tokenData.access_token);

  console.log(
    JSON.stringify(
      locations.data?.map((store) => ({
        locationId: store.locationId,
        name: store.name,
        chain: store.chain,
        address: store.address,
      })),
      null,
      2
    )
  );

  const store = locations.data?.[0];

  if (!store) {
    console.log("❌ No stores returned.");
    return;
  }

  console.log(
    `\n3. Searching for eggs at ${store.name} (${store.locationId})...`
  );

  const products = await findProducts(
    tokenData.access_token,
    store.locationId
  );

  console.log(
  JSON.stringify(products.data?.[0], null, 2)
);
}

main().catch((error) => {
  console.error("\n❌ Kroger test failed:");
  console.error(error);
  process.exit(1);
});
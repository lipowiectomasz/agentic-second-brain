# Function runtimes cannot reach the API on a local stack

Relates to: "Personal access tokens and the CLI gateway".

## Symptom

On the self-hosted development stack, every Appwrite SDK call made from inside the CLI gateway function failed with `fetch failed`, and the gateway answered 500. Because the function runs with logging disabled (so tokens never land in execution records), there was no trace in the console.

## Cause

Appwrite passes each function its API endpoint in `APPWRITE_FUNCTION_API_ENDPOINT`, derived from the instance domain setting. On a local stack that domain resolves to the loopback address. Inside a runtime container, loopback is the container itself, not the Appwrite API.

The runtime containers live on a dedicated `runtimes` Docker network, where the only other member is the executor. The reverse proxy in front of the API is not on that network, so even a correct host name would not resolve. The runtimes firewall setting was not the cause; it does not block this traffic.

## Resolution

- A Compose override attaches the stack's reverse proxy to the `runtimes` network with a network alias for the API.
- The setup command passes the function its own endpoint variable pointing at that alias, and the function prefers it over the endpoint Appwrite provides.
- On a server with a public domain the variable stays empty and the function uses the endpoint from Appwrite.

After the change, SDK calls from functions work on the local stack and the gateway integration tests pass.

## Takeaway

On a local Appwrite stack, a function that calls back into the API needs a route from the runtimes network to the API. Check this first when a function fails with a bare `fetch failed`, especially when logging is off.

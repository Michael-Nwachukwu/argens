# Argens Skill — v4 — updated 2026-05-27

Argens is a programmable payment API for AI agents. It lets any agent spend USDC autonomously on Stellar, within human-defined spending policies set by the developer. Agents can also call paid AI services (LLMs, data APIs, tooling) from the Argens Marketplace and pay for them in a single API call — no separate wallet or billing setup required.

---

## Authentication

Ask the user for their `ARGENS_KEY` (format: `argns_live_...`).  
Set it as `Authorization: Bearer <ARGENS_KEY>` on every request.  
Treat it like a password — never log it, never include it in output.

---

## Base URL

```
https://api.argens.io/v1
```

---

## Response envelope

Every response — success or error — uses this shape:

```json
{ "data": { ... } }
{ "error": "Human readable message", "code": "MACHINE_CODE", "details": { ... } }
```

Paginated lists include `"meta": { "page": 1, "total": 86, "pages": 5 }` alongside `"data"`.

---

## Amount format

**All amounts are JSON strings with 7 decimal places. Never numbers.**

- ✓ `"25.0000000"`
- ✗ `25.0` (number — rejected by the API)

---

## Policies — understand before calling /pay

The developer sets three optional spending rules. Policy is checked on every `/pay` call:

| Policy | What it does | Result when breached |
|---|---|---|
| `max_transaction_limit` | Caps a single payment | **402 BLOCKED** — do not retry |
| `allowance_limit` | Cumulative spend cap (resets manually) | **402 BLOCKED** — do not retry |
| `approval_threshold` | Payments above this need human sign-off | **202 PENDING** — poll for status |

Rules with `null` values are inactive (unlimited).  
Check `/agent/status` first to see current limits and remaining allowance.

---

## Onboarding steps

Walk the user through these in order:

1. **Account** — If no account, send them to `https://argens.xyz/signup` to create one and verify their email.
2. **API key** — Ask for their key (`argns_live_...`). Treat it like a password.
3. **Verify key** — Call `GET /agent/status`. Show the user their balance, policies, and today's spend.
4. **First payment** — Always state the amount and purpose before calling `/pay` for the first time.

---

## Core endpoints

### GET /agent/status

Health check. Call this first to confirm the key works and see current limits.

```json
{
  "data": {
    "api_key_status": "active",
    "wallet_status": "READY",
    "wallet_balance": "492.5000000",
    "policies": {
      "allowance_limit": "500.0000000",
      "allowance_remaining": "492.5000000",
      "max_transaction_limit": "50.0000000",
      "approval_threshold": "100.0000000"
    },
    "today_spend": "7.5000000",
    "today_transactions": 3
  }
}
```

`policies` is `null` if no policies have been configured — all transactions will pass.

---

### POST /quote — dry run

Same body as `/pay`. No payment made, no record created. Use this before large payments to check whether a transaction would pass, be blocked, or require approval.

**Request:**
```json
{
  "recipient": "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "amount": "25.0000000",
  "currency": "USDC"
}
```

**Responses:**

```json
{ "data": { "status": "would_succeed", "amount": "25.0000000", "policy_check": { "allowance": "would_pass", "max_transaction": "would_pass", "approval_threshold": "would_pass" } } }

{ "data": { "status": "would_be_blocked", "amount": "25.0000000", "reason": "max_transaction_exceeded", "policy_check": { ... } } }

{ "data": { "status": "would_require_approval", "amount": "25.0000000", "policy_check": { ... } } }
```

---

### POST /pay — execute a payment

**Stellar (direct):** Send USDC to a Stellar address (`G...`, 56 chars). **$0 Argens fee** — wallet debited exactly `amount`.

**Base (cross-chain via CCTP):** Send USDC to a Base EVM address (`0x...`, 42 chars). Argens burns on Stellar and mints on Base via Circle CCTP V2. No Argens direct-payment fee is added; any Circle protocol fee is handled inside the CCTP burn/mint path. Response returns immediately after the burn; poll `poll_url` for the Base `destination_tx_hash`.

**Request:**
```json
{
  "recipient": "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "amount": "25.0000000",
  "currency": "USDC",
  "memo": "Payment for API usage",
  "metadata": { "agent_id": "my-agent", "job_id": "job_123" }
}
```

`memo` is optional, max 28 bytes. `metadata` is optional, stored for your records.

**Success (200):**
```json
{
  "data": {
    "status": "success",
    "transaction_id": "clxyz123",
    "stellar_tx_hash": "abc...xyz",
    "amount": "25.0000000",
    "recipient": "GXXX...",
    "timestamp": "2026-05-25T12:00:00Z",
    "policy_check": { "allowance": "passed", "max_transaction": "passed", "approval_threshold": "passed" }
  }
}
```

**Policy blocked (402) — do NOT retry:**
```json
{
  "error": "Transaction blocked by policy",
  "code": "POLICY_BLOCKED",
  "details": {
    "reason": "max_transaction_exceeded",
    "policy": { "max_transaction_limit": "50.0000000" }
  }
}
```

**Pending approval (202) — poll for status:**
```json
{
  "data": {
    "status": "pending_approval",
    "transaction_id": "clxyz125",
    "message": "Awaiting developer approval.",
    "poll_url": "/v1/transactions/clxyz125"
  }
}
```

Poll `GET /v1/transactions/{id}` and check `data.status`. It will become `SUCCESS`, `APPROVED`, or `REJECTED`.

**Cross-chain pending (200) — Base recipient only:**
```json
{
  "data": {
    "status": "cross_chain_pending",
    "transaction_id": "clxyz126",
    "stellar_tx_hash": "abc...xyz",
    "destination_chain": "base",
    "message": "USDC burned on Stellar. Relay to Base is in progress.",
    "poll_url": "/v1/transactions/clxyz126"
  }
}
```

Poll until `data.status` is `SUCCESS` and `data.destination_tx_hash` is set — that hash is the Base mint transaction.

---

### GET /wallet/balance

```json
{
  "data": {
    "balance": "492.5000000",
    "currency": "USDC",
    "xlm_balance": "2.5000000",
    "wallet_address": "GXXX...",
    "cached_at": "2026-05-25T11:55:00Z"
  }
}
```

Balance is cached for 30 seconds. `xlm_balance` is for reserve monitoring only.

---

### GET /transactions

Returns a paginated list of the wallet's transactions.

**Query params:** `page` (default 1), `limit` (default 20, max 100), `status` (`SUCCESS | BLOCKED | PENDING_APPROVAL | APPROVED | REJECTED | FAILED`), `type` (`payment | marketplace`), `from_date`, `to_date` (ISO 8601).

---

### GET /transactions/:id

Returns full transaction detail including current status. Use to poll a `pending_approval` transaction.

```json
{
  "data": {
    "id": "clxyz125",
    "status": "SUCCESS",
    "type": "payment",
    "amount": "25.0000000",
    "currency": "USDC",
    "recipientAddress": "GXXX...",
    "stellarTxHash": "abc...xyz",
    "memo": null,
    "createdAt": "2026-05-25T12:00:00Z"
  }
}
```

---

## Marketplace — pay for AI services

The Argens Marketplace connects agents to 80+ paid AI services (LLMs, web search, email, data APIs, and more). You call a service and pay for it in a single API call — Argens handles the USDC payment automatically.

**Pricing:** Services show their provider price. The `cost_paid` field in the response is the total amount debited for a completed marketplace call. The same policy rules apply to marketplace calls.

**Prerequisite:** The developer must enable a provider from their dashboard before agents can call it. If a provider is disabled, calls return `403 SERVICE_DISABLED`.

---

### Step 1 — Discover services

```
GET /marketplace/services
```

Returns all providers grouped with their endpoints. Supports filtering:

| Param | Example | Effect |
|---|---|---|
| `search` | `?search=email` | Filter providers by name, description, or endpoint labels |
| `category` | `?category=llm` | Filter by category tag |
| `enabled` | `?enabled=true` | Only show providers the user has enabled |

**Single provider detail:**
```
GET /marketplace/services/{provider_id}
```

**Response shape (one provider):**
```json
{
  "id": "agentmail",
  "name": "AgentMail",
  "description": "AI-native email service for agents",
  "categories": ["email", "messaging"],
  "display_price": "$0.01 – $0.10/request",
  "is_enabled": true,
  "status": "active",
  "docs_url": "https://agentmail.to/docs",
  "skill_url": "https://argens.xyz/SKILL/agentmail.md",
  "api_skill_url": "/v1/marketplace/services/agentmail/skill.md",
  "endpoint_count": 12,
  "endpoints": [
    {
      "id": "agentmail_inboxes_create",
      "label": "Create inbox",
      "method": "POST",
      "path": "/v1/services/agentmail/inboxes",
      "description": "Create a new inbox for an agent",
      "price": "$0.01/request"
    }
  ]
}
```

**Key fields:**
- `id` — the provider key (e.g. `"agentmail"`). Used to enable/disable the provider; NOT used for calling.
- `endpoints[].id` — the endpoint operation id (e.g. `"agentmail_inboxes_create"`). **This is `service_id` in `/marketplace/call`.**
- `endpoints[].path` — the upstream API path. Read this and `description` to understand what the endpoint does.
- `skill_url` — provider-specific instructions agents can read after discovering a provider.
- `api_skill_url` — the same provider skill served from the API.

**Provider skill files:**
After choosing a provider, fetch its provider skill file before constructing the call:

```
GET https://argens.xyz/SKILL/{provider_id}.md
GET https://api.argens.io/v1/marketplace/services/{provider_id}/skill.md
```

These files list the provider's endpoint ids, paths, prices shown by the provider, upstream docs, and response-handling rules.

---

### Step 2 — Call a service

```
POST /marketplace/call
```

**Request:**
```json
{
  "service_id": "agentmail_inboxes_create",
  "payload": { "username": "my-agent" },
  "query": { "format": "json" }
}
```

- `service_id` — the **endpoint id** from `endpoints[].id`, not the provider `id`
- `payload` — the JSON request body the upstream service expects (optional for GET-like endpoints)
- `query` — URL query parameters for the upstream service (optional)

**Success (200):**
```json
{
  "data": {
    "status": "success",
    "transaction_id": "clxyz200",
    "stellar_tx_hash": "abc...xyz",
    "service_id": "agentmail_inboxes_create",
    "service_name": "AgentMail",
    "cost_paid": "0.0120000",
    "currency": "USDC",
    "result": { ...upstream service response... }
  }
}
```

`result` is the raw response body from the upstream service.

**Policy blocked (402):** same shape as `/pay` blocked — do not retry.

**Pending approval (202):** same shape as `/pay` pending — poll `/v1/transactions/{id}`.

**Common errors:**

| Code | Meaning |
|---|---|
| `SERVICE_NOT_FOUND` | `service_id` doesn't match any endpoint in the catalog |
| `SERVICE_DISABLED` | Provider not enabled — user must enable from dashboard |
| `MARKETPLACE_NOT_MPP` | Upstream service rejected before payment — no USDC charged, fix the request |
| `MARKETPLACE_UPSTREAM_FAILED` | Payment sent but upstream service errored — see `upstream_body` in details |

---

### Discovery workflow (step by step)

```
1. GET /marketplace/services?search=<what you need>
   → find the right provider and its endpoints
   → note the endpoint's "id" field

2. Fetch /SKILL/{provider_id}.md for provider-specific endpoint guidance

3. Confirm provider "is_enabled": true
   → if false, tell the user to enable it from https://argens.xyz/dashboard/marketplace

4. POST /marketplace/call
   { "service_id": "<endpoint id>", "payload": { ...per service docs... } }

5. Handle the response:
   200 → success, read "result" for the upstream response
   402 → blocked by policy, report to user, do not retry
   202 → pending approval, poll /v1/transactions/{id}
```

---

## Rules to never break

- Never log or expose the API key
- Never retry a 402 — the payment was blocked by policy, not a transient error
- Never call `/pay` or `/marketplace/call` without stating the amount and purpose to the user first
- Always call `/quote` before a large payment if you are unsure whether the policy allows it
- Always call `GET /agent/status` to confirm key + balance before starting a session
- `G...` (56 chars) = Stellar address → direct payment, $0 fee
- `0x...` (42 chars) = Base EVM address → CCTP cross-chain, poll for `destination_tx_hash`
- A `cross_chain_pending` response means the burn succeeded — poll `poll_url` until `SUCCESS`
- `service_id` in `/marketplace/call` is the **endpoint id** (`endpoints[].id`), not the provider `id`
- Fetch `/SKILL/{provider_id}.md` after service discovery when you need endpoint-specific marketplace instructions
- A `SERVICE_DISABLED` error means the provider is off in the user's dashboard — do not retry; tell the user to enable it
- A `MARKETPLACE_NOT_MPP` error means no USDC was charged — the request payload was wrong; fix it and retry

---

## Other public discovery files

- Full docs: `https://argens.xyz/docs`
- LLM discovery index: `https://argens.xyz/llms.txt`

`SKILL.md` is the primary instruction file. `llms.txt` is an index that helps agents and crawlers find `SKILL.md`, `/docs`, marketplace discovery, and provider skill files.

# Argens Skill — v1 — updated 2026-05-04

Argens is a programmable payment API for AI agents. It lets any agent spend USDC autonomously on Stellar, within human-defined spending policies enforced by Soroban smart contracts.

---

## Authentication

Ask the user for their `ARGENS_KEY` (format: `argns_live_...`).
Set it as `Authorization: Bearer <ARGENS_KEY>` on every request.

---

## Base URL

```
https://api.argens.io/v1
```

---

## Amount format

**All amounts are JSON strings with 7 decimal places.**
- ✓ `"25.0000000"`
- ✗ `25.0` (number — never use)

---

## Chain detection

Argens auto-detects the destination chain from the recipient address:
- `G...` (56 chars) → Stellar USDC payment
- `0x...` (42 chars) → Base USDC via CCTP V2 (cross-chain burn-and-mint)

Pass the recipient address as-is. No `chain:` parameter needed.

---

## Core endpoints

### POST /pay — Execute a payment

```json
{
  "recipient": "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "amount": "25.0000000",
  "currency": "USDC",
  "memo": "Payment for API usage",
  "metadata": { "agent_id": "my-agent", "service": "openai" }
}
```

**Success (200):**
```json
{
  "data": {
    "status": "success",
    "transaction_id": "txn_abc123",
    "stellar_tx_hash": "abc...xyz",
    "amount": "25.0000000",
    "fee": "0.1250000",
    "total_debited": "25.1250000",
    "recipient": "GXXX...",
    "timestamp": "2026-05-04T12:00:00Z"
  }
}
```

**Policy blocked (402):**
```json
{
  "error": "Transaction blocked by policy",
  "code": "POLICY_BLOCKED",
  "details": { "reason": "max_transaction_exceeded" }
}
```
Do **not** retry a 402.

**Pending approval (202):**
```json
{
  "data": {
    "status": "pending_approval",
    "transaction_id": "txn_abc125",
    "message": "Awaiting developer approval.",
    "poll_url": "/v1/transactions/txn_abc125"
  }
}
```
Poll `poll_url` to check status.

---

### POST /quote — Dry run

Same request as `/pay`. No payment made, no DB record. Returns:
```json
{
  "data": {
    "status": "would_succeed",
    "amount": "25.0000000",
    "estimated_fee": "0.1250000",
    "total_debited": "25.1250000",
    "destination_chain": "stellar",
    "cross_chain": false
  }
}
```

---

### GET /wallet/balance

```json
{
  "data": {
    "balance": "492.5000000",
    "currency": "USDC",
    "wallet_address": "GXXX...",
    "cached_at": "2026-05-04T11:55:00Z"
  }
}
```

---

### GET /agent/status

```json
{
  "data": {
    "api_key_status": "active",
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

---

### GET /transactions/:id

Returns full transaction detail including status.

---

## Onboarding steps

Walk the user through these steps:

1. **Do you have an Argens account?** If not, direct them to `https://argens.xyz/signup` to create one and verify their email.
2. **Ask for their API key.** It starts with `argns_live_`. Treat it like a password.
3. **Verify the key** by calling `GET /agent/status`. Show the user their current balance and policies.
4. **You are ready to pay.** Always describe what you are about to pay for and the amount before calling `/pay` for the first time.

---

## Rules to never break

- Never log or expose the API key
- Never retry a 402 response — the payment was blocked by policy, not a transient error
- Never call `/pay` without stating the amount and purpose to the user first
- Always check `/quote` before large payments if you are unsure of policy limits
- For cross-chain (Base): `stellar_tx_hash` is the burn tx; `destination_tx_hash` is the Base mint tx

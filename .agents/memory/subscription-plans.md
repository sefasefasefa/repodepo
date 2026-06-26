---
name: Subscription Plans
description: All 8 subscription plans for Prnhbbbb — 3 standard + 5 adult-specific (18+).
---

# Subscription Plans (SubscriptionPlan model)

Table: `subscription_plans` | App: `apps/subscriptions/models.py`

## Standard Plans
| Name        | Price    | Cycle    | Popular |
|-------------|----------|----------|---------|
| Ücretsiz    | $0.00    | monthly  | No      |
| Pro Aylık   | $9.99    | monthly  | No      |
| Pro Yıllık  | $99.99   | yearly   | Yes     |

## 18+ Adult Plans (name prefix: 🔞)
| Name                  | Price    | Cycle    | Popular | Notes                                  |
|-----------------------|----------|----------|---------|----------------------------------------|
| 🔞 Adult Temel        | $14.99   | monthly  | No      | Basic adult library access             |
| 🔞 Adult Premium      | $24.99   | monthly  | Yes     | Full library + creator DMs + 200 tokens|
| 🔞 Adult VIP Yıllık   | $199.99  | yearly   | No      | Everything + 500 tokens/month          |
| 🔞 Creator Fan Club   | $7.99    | monthly  | No      | Single creator fan membership          |
| 🔞 Adult Ömür Boyu    | $499.99  | lifetime | No      | One-time lifetime access + 1000 tok/mo |

## Active Test Subscriptions (dev seed)
- vip1 → 🔞 Adult Premium
- vip2 → 🔞 Adult VIP Yıllık
- vip3 → 🔞 Creator Fan Club
- user2, user4, creator4 → Pro Aylık
- user6 → Pro Yıllık
- user5, user8, user10 → 🔞 Adult Temel (user5 has cancel_at_period_end=True)
- user3 → expired Pro Aylık (historical record)

**Why:** Documented so future agents don't need to re-inspect DB to understand plan tiers or set up test subscriptions.

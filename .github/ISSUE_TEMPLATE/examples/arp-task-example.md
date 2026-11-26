<!-- A worked example of .github/ISSUE_TEMPLATE/arp-task.md, filled in.
ARP's own test runs the Definition of Ready gate over this file and fails the
build if any check fails, so what you read here is a body the gate accepts —
not an illustration that drifted from it. Copy the shape, not the content. -->

**Goal**

An empty cart is rejected at checkout with a 422 and the error code `cart_empty`,
instead of reaching the payment step and failing there with a provider error the
buyer cannot act on.

**Context on main**

refined against `ef01cda`

- `NewCart` — `internal/cart/cart.go:42`
- `Checkout` — `internal/checkout/checkout.go:118`

**Task block**

```arp-task
depends on: none
files:
  - `internal/cart/cart.go`
  - `internal/cart/cart_test.go` (new)
  - `migrations/20261014120000_cart_empty_guard.go` (new)
touches hotspots: `internal/cart/cart.go`
tests:
  - SRS-12: `TestCartRejectsEmpty` — `internal/cart/cart_test.go`
```

**Steps**

1. The guard belongs in `NewCart`, not in the HTTP layer: `Checkout` is one of
   three callers and the other two must reject an empty cart too.
2. Return the existing `ErrCartEmpty` sentinel — do not add a second error type
   for the same condition.
3. Write the failing test first: `TestCartRejectsEmpty` must fail against main
   before the fix, and the reviewer reverts the fix to prove it.

**Acceptance**

- [ ] SRS-12: `TestCartRejectsEmpty` — `internal/cart/cart_test.go`
- [ ] SRS-12: `TestCheckoutSurfacesCartEmptyAs422` — `internal/checkout/checkout_test.go`

**Out of scope**

- The buyer-facing wording of the error (its own issue, needs translation review)
- Carts that become empty after a stock recount, which has its own requirement

**Migration ts:** 20261014120000

**Size:** S

**Open questions:** none

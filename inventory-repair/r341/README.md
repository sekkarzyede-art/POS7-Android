# R341: barcode-identity guard (staged, NOT yet APK-integrated)

- `identity.cjs` normalizes **numeric** leading zeroes for identity lookup only.
- Multiple product records remain ambiguous unless an **explicit approved alias** selects exactly one canonical product.
- Existing stock and historical invoice references stay unchanged.
- `safeQuantity` applies uniquely identified stock movements after the actual count, rejecting duplicate movement IDs and unsafe numbers.
- This guard must be incorporated into tablet's R340 patch AND the store-scoped cloud approval flow before enabling an APK. No server-side stock or invoice changes were applied.
- Test locally: `node inventory-repair/r341/identity.test.cjs`.

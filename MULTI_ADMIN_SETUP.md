# Nova Vault Multi-Admin Setup

This build adds a Super Admin → Partner Admin → User hierarchy to the existing Nova Vault app.

## Roles

- `super_admin`: the existing owner account (`davehack966@gmail.com`)
- `admin`: partner/admin accounts created from the Super Admin panel
- `user`: normal customers

## How it works

1. Sign in as the Super Admin.
2. Open **Admin Panel → Admins**.
3. Enter a partner admin's name and email.
4. Nova creates:
   - an admin profile
   - a unique referral code
   - a referral registration URL
   - default permissions
5. Copy the partner's registration URL and give it to them.
6. Users who register through that URL are stored with the partner's `adminId`.
7. The partner signs in/registers using the same email used when the admin profile was created. Nova binds their Firebase Auth UID to the admin profile.
8. The partner sees only wallets/users assigned to their admin ID.

## Admin permissions

The Super Admin can toggle:

- View Users
- Edit Wallet
- Adjust Balance
- View Transactions

Balance changes create both a `balanceLedger` record and an `auditLogs` record.

Wallet address changes create an `auditLogs` record.

## New Firestore collections

- `admins`
- `referralLinks`
- `users`
- `balanceLedger`
- `auditLogs`

Existing `wallets`, `transactions`, and `withdrawals` documents now use `adminId` where applicable.

## Existing users

The Super Admin can assign an existing wallet/user from:

**Admin Panel → Users → Admin dropdown**

That writes the assignment to both the wallet and user profile.

## Important Firebase step

Deploy `firestore.rules` to the Firebase project before relying on the multi-admin feature in production.

The rules protect:

- partner admin access to only assigned users
- admin profile permissions
- referral-code registration
- audit/ledger records
- Super Admin controls

The current Nova Vault application still performs some user balance mutations directly from the client because that is how the original app was built. For a production financial system, balance-changing operations should ultimately be moved to trusted server-side code/Cloud Functions.

## Referral URL

The generated URL uses the current site's origin:

`https://YOUR-DOMAIN/?ref=NV-XXXXXXXX`

No hardcoded production domain is used.


### Partner admin authentication

When the Super Admin creates a partner admin, Nova Vault provisions a Firebase Email/Password
account in a secondary Firebase Auth instance so the Super Admin's current session is not replaced.
The partner receives a Firebase password-reset email and chooses their own password.

If the email already has a Firebase Auth account, provisioning may report that the email is already in
use. In that case the existing account can sign in with the same email; `App.jsx` binds its Firebase UID
to the matching active `admins/{adminId}` profile.

Before production use, confirm that **Authentication → Sign-in method → Email/Password** is enabled
in the existing `nova-vault-app` Firebase project and that your Firebase Authentication email action
settings are configured for your deployed Vercel domain.

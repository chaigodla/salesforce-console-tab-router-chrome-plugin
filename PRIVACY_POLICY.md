# Privacy Policy — Salesforce Console Tab Router

_Last updated: 2026-07-08_

Salesforce Console Tab Router ("the extension") is an internal productivity tool.
This policy describes what the extension does and does not do with information.

## Summary
The extension does **not** collect, store, sell, or transmit any personal or
sensitive user data. It performs all of its work locally in the browser.

## What the extension accesses
To reroute Salesforce links into the Lightning Console, the extension reads the
following **in memory only**, at the moment a tab is opened:

- The URL of newly opened browser tabs, solely to determine whether the URL
  matches the configured Salesforce interception pattern.
- Tab and window identifiers provided by the Chrome extension APIs, used to
  activate the console tab and close the redundant tab.

This information is used immediately to make a routing decision and is then
discarded. It is never written to disk, never logged to any remote system, and
never sent to any server or third party.

## What the extension does not do
- It does not collect personally identifiable information.
- It does not track browsing activity.
- It does not use analytics or advertising services.
- It does not load or execute any remotely hosted code.
- It does not share any data with third parties.

## Permissions
The extension requests only the permissions required for its single purpose
(`tabs`, `webNavigation`, and host access to the configured Salesforce domain).
See the store listing for a per-permission explanation.

## Data retention
None. No user data is retained by the extension.

## Contact
Questions about this policy: chay.godla@autodesk.com

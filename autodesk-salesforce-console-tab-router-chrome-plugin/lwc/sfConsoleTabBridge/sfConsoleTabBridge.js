// =============================================================================
// Salesforce Console Tab Router — LWC Bridge  (sfConsoleTabBridge.js)
//
// Utility bar component that:
//   1. Listens on window.postMessage for routing requests relayed by the
//      Chrome extension content script.
//   2. Validates origin and message structure.
//   3. Opens the pageReference the extension already parsed as a primary
//      console tab.
//   4. Posts an acknowledgement back to the content script.
//
// Placement: Lightning Console App → Utility Bar → Add sfConsoleTabBridge
//
// Security:
//   - Validates event.origin === window.location.origin (same SF domain only).
//   - Deduplicates by correlationId to prevent replay.
// =============================================================================

import { LightningElement, wire } from 'lwc';
import {
    IsConsoleNavigation,
    openTab,
    refreshTab
} from 'lightning/platformWorkspaceApi';

const SF_BRIDGE_LOG    = '[SF-Router Bridge]';
const MSG_PAGE_REQUEST = 'SF_PAGE_REQUEST';
const MSG_PAGE_ACK     = 'SF_PAGE_ACK';

// Module-level dedup set — survives component re-renders within the session
const _processedCorrIds = new Set();

// Records (keyed by target page) we've opened this session. Used to detect a
// *reopen* — opening a record whose console tab was previously closed. The
// Workspace API dedupes primary tabs by record id and can hand back a
// just-disposed tab that renders blank ("blink"), so on a reopen we force the
// tab to reload via refreshTab.
const _openedTabKeys = new Set();

// Build a stable key for a resolved pageReference (type + record + relationship).
function tabKeyFor(pageReference) {
    const a = (pageReference && pageReference.attributes) || {};
    return [
        pageReference && pageReference.type,
        a.recordId || '',
        a.relationshipApiName || ''
    ].join('|');
}

export default class SfConsoleTabBridge extends LightningElement {

    // ── Console detection ──────────────────────────────────────────────────
    @wire(IsConsoleNavigation)
    isConsoleNavigation;

    // Expose to template
    get isActive() {
        return !!this.isConsoleNavigation;
    }

    // ── Lifecycle ──────────────────────────────────────────────────────────
    _boundHandler = null;

    connectedCallback() {
        this._boundHandler = this._onWindowMessage.bind(this);
        window.addEventListener('message', this._boundHandler);
        console.log(SF_BRIDGE_LOG, 'Bridge connected — listening for extension routing requests');
    }

    disconnectedCallback() {
        if (this._boundHandler) {
            window.removeEventListener('message', this._boundHandler);
            this._boundHandler = null;
        }
        console.log(SF_BRIDGE_LOG, 'Bridge disconnected');
    }

    // ── Message handler ──────────────────────────────────────────────────────

    async _onWindowMessage(event) {
        // ── Security: same-origin only ─────────────────────────────────────
        if (event.origin !== window.location.origin) return;

        const data = event.data;
        if (!data || data.type !== MSG_PAGE_REQUEST) return;

        const { correlationId, payload } = data;

        if (!correlationId || !payload) {
            console.warn(SF_BRIDGE_LOG, 'Malformed message — missing required fields');
            return;
        }

        // ── Dedup ──────────────────────────────────────────────────────────
        if (_processedCorrIds.has(correlationId)) {
            console.warn(SF_BRIDGE_LOG, '[' + correlationId + '] Already processed — ignoring');
            this._ack(correlationId, 'duplicate');
            return;
        }
        _processedCorrIds.add(correlationId);

        console.log(SF_BRIDGE_LOG, '[' + correlationId + '] Routing: ' + payload.url);

        // ── Require console context ────────────────────────────────────────
        if (!this.isConsoleNavigation) {
            console.warn(SF_BRIDGE_LOG, 'Not a console app — cannot open tab');
            this._ack(correlationId, 'not-console');
            return;
        }

        try {
            // Any query params the extension parsed ride along on the
            // pageReference as `state`. Lightning navigation preserves only
            // namespaced (c__) state keys and drops the rest, so deep-link params
            // must be c__-prefixed (e.g. ?c__context=gainsight) to reach the tab.
            const pageReference = payload.pageReference || null;
            if (!pageReference) {
                console.warn(SF_BRIDGE_LOG, '[' + correlationId + '] Nothing to open (unresolved)');
                this._ack(correlationId, 'error');
                return;
            }

            console.log(SF_BRIDGE_LOG, '[' + correlationId + '] Opening primary tab');
            const tabKey = tabKeyFor(pageReference);
            const isReopen = _openedTabKeys.has(tabKey);

            const tabId = await openTab({ pageReference: pageReference, focus: true });
            _openedTabKeys.add(tabKey);

            // Reopen after the tab was closed can reuse a disposed/blank tab —
            // force it to reload so the record view actually renders.
            if (isReopen && tabId) {
                try {
                    await refreshTab(tabId, { includeAllSubtabs: true });
                    console.log(SF_BRIDGE_LOG, '[' + correlationId + '] Refreshed reopened tab ' + tabId);
                } catch (refreshErr) {
                    console.warn(SF_BRIDGE_LOG, '[' + correlationId + '] refreshTab failed:', refreshErr);
                }
            }

            console.log(SF_BRIDGE_LOG, '[' + correlationId + '] Tab opened');
            this._ack(correlationId, 'ok');

        } catch (err) {
            console.error(SF_BRIDGE_LOG, '[' + correlationId + '] Failed to open tab:', err);
            this._ack(correlationId, 'error');
        }
    }

    // ── Acknowledgement ────────────────────────────────────────────────────

    /**
     * Posts an ack back to the content script via window.postMessage.
     *
     * @param {string} correlationId
     * @param {string} result  'ok' | 'duplicate' | 'not-console' | 'error'
     */
    _ack(correlationId, result) {
        window.postMessage(
            { type: MSG_PAGE_ACK, correlationId, result },
            window.location.origin
        );
    }
}

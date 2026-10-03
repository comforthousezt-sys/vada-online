# VADA UI contract

Business source: docs/RULES_UA.md, shared/types.ts and shared/engine.ts implement the approved masterplan; the user selected HOSTiQ for the client on 2026-10-03.

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Form | components/Field.tsx | This contract | lobby, trade, chat | browser flows |
| Select/Listbox | native select | This contract | OS popup accepted | keyboard + narrow screen |
| Scrollbar | tokens.css and styles.css | DESIGN.md | same global baseline | computed styles |
| Toast | App status live region | This contract | success/error text | browser failures |
| Dialog | components/Modal.tsx | This contract | guide, rules, confirmation | Escape and focus restoration |
| Commands | useGame.ts | engine and server | local, online | integration tests |

Create/join opens the lobby; failed create/join preserves typed fields and inline error. Online controls are disabled while a command is pending and during reconnect. No optimistic game mutation. Stale commands refresh the personalized view and show a retry hint. Commands have immutable operation IDs and expected game versions. Resume tokens are stored only in sessionStorage, outside URLs and analytics.

Each economic turn is one command. Own secret cards and objectives appear only in the private panel. Other players show counts. Vote buttons appear only for the fixed attendance list. The HTML map supports keyboard selection even when WebGL fails. Read-only spectators are not supported in this release.

Leaving the active local match for the menu retains its autosave. Creating a replacement practice match requires an app dialog. Online room membership survives refresh in the same tab; lost credentials cannot be recovered by entering a room code. Chat uses plain text through React escaping. Complete trades recheck both participants and execute atomically.

Only practice save files and match reports use browser storage/downloads. Cloud profile, billing, QR ownership and permanent collections are roadmap items; no permissions are invented for them.

# Strip OctoPrint / Moonraker / Bambu adapters

## Goal

This deployment fork only talks to PrusaLink printers. The server still
carries adapters and types for OctoPrint, Moonraker (Klipper), and Bambu Lab
— dead code we don't trigger. Removing them shrinks the surface area, the
bundle, and the maintenance burden of upstream merges.

The UI already hides these vendors (the printer-type dropdown is
PrusaLink-only). This branch is about the **backend** strip.

## Scope (audited from `main` 2026-05-28, re-audited on `strip-multi-vendor-adapters` 2026-05-28)

The first audit said "655 lines / 25 files". A re-audit found **666 lines
across 104 files** — the 25 was counting only the *consumers* outside the
vendor source dirs, not the dirs themselves. Same scope conceptually, larger
volume of code being deleted (the vendor dirs hold dozens of DTO files), same
volume of patches in consumer files. Rough buckets:

### Easy — direct deletions (already executed once and reverted, ~20 min)

- **Service directories** (~30 files):
  - `server/src/services/octoprint/**`
  - `server/src/services/moonraker/**`
  - `server/src/services/bambu/**`
  - `server/src/services/{octoprint,moonraker,bambu}.api.ts`
- **DI / tokens** (`server/src/container.ts`, `server/src/container.tokens.ts`):
  - Remove `octoprintApi`, `octoprintClient`, `moonrakerApi`, `moonrakerClient`,
    `bambuApi`, `bambuClient`, `bambuFtpAdapter`, `bambuMqttAdapter`,
    `octoPrintSockIoAdapter`, `moonrakerWebsocketAdapter` from both files.
- **Tasks** — `server/src/tasks.ts` + `server/src/tasks/printer-websocket-restore.task.ts`:
  the restore task only reauths OctoPrint sessions. Delete the file, drop the
  registration in `tasks.ts`, drop the token + DI entry.
- **Factory / interface** — collapse the printer-type union to just `PrusaLinkType = 2`:
  - `server/src/services/printer-api.factory.ts` (4 branches → 1)
  - `server/src/services/printer-api.interface.ts` (drop `OctoprintType`/`MoonrakerType`/`BambuType` constants, narrow `PrinterTypesEnum` + `PrinterType` union)
  - `server/src/services/socket.factory.ts` (4 branches → 1)
- **Direct consumers** of the dropped constants:
  - `server/src/entities/printer.entity.ts` — change `@Column({ default: OctoprintType })` to `default: PrusaLinkType`.
  - `server/src/middleware/printer.ts` — drop OctoPrint/Moonraker/Bambu switch arms, leave only the PrusaLink one.
  - `server/src/controllers/settings.controller.ts` — drop `updateMoonrakerSupport` and `updateBambuSupport` route handlers (and their imports from `settings-service.validation`).
  - `server/src/controllers/printer-files.controller.ts` — drop `BambuType` branch in `getAcceptedFileExtensions`.
  - `server/src/services/core/yaml.service.ts` — strip the 4-type allowlist; coerce non-PrusaLink imports to PrusaLink.
  - `server/src/services/validators/printer-service.validation.ts` — drop the OctoPrint apiKey schema branch; keep only the PrusaLink username/password refinement.
  - `server/src/utils/printer-compatibility.util.ts` — collapse `COMPATIBILITY` and `PRINTER_TYPE_LABEL` to PrusaLink only.

#### Additional consumers found on re-audit (2026-05-28)

The original audit missed these — they have to land alongside the above for a green build:

- `server/src/controllers/printer-settings.controller.ts` — the whole controller
  is OctoPrint (`OctoprintClient.getSettings`, `updatePrinterNameSetting`).
  Either delete it and its route registration, or rewrite to PrusaLink. Closest
  PrusaLink equivalent would be `GET /api/v1/info` / `PUT /api/v1/printer/name`
  if we want feature parity, but the UI may not even consume this — verify
  before rewriting.
- `server/src/controllers/printer.controller.ts:308` — `@route("/:id/octoprint/server/restart")`
  handler. Delete; no PrusaLink analogue.
- `server/src/controllers/server-public.controller.ts:55` — the public boot
  payload exposes `["octoprint", "klipper", "prusaLink", "bambu"]` keyed by the
  experimental flags. Collapse to `["prusaLink"]`.
- `server/src/shared/websocket-rpc-extended.adapter.ts` — Moonraker-only
  JSON-RPC websocket helper. Delete the file outright once Moonraker is gone.
- `server/src/shared/default-http-client.builder.ts` — imports from
  `octoprint/constants/octoprint-service.constants`. **This is the third
  consumer of the header constants** (the original plan listed only the
  PrusaLink HTTP client builder + `prusa-link.api.ts`). PR 1 has to repoint
  all three.

#### Server-settings flags — bigger than just route handlers

`experimentalMoonrakerSupport` and `experimentalBambuSupport` aren't only in
`settings.controller.ts` — they're persisted DB columns wired through the
entire settings pipeline:

- `server/src/constants/server-settings.constants.ts:23-24` — defaults.
- `server/src/entities/settings.entity.ts:20-21` — TypeORM column types.
- `server/src/state/settings.store.ts` — 4 read sites + 2 setters
  (`setExperimentalMoonrakerSupport`, `setExperimentalBambuSupport`).
- `server/src/shared/runtime-settings.migration.ts:61-66` — settings-shape
  migration (reads old entity, writes new shape).
- `server/src/controllers/server-public.controller.ts:46-58` — gates the
  vendor list in the public boot payload.

Removing them cleanly means a TypeORM migration that drops the two columns.
Acceptable alternative: leave the columns in the DB schema (mark `@deprecated`
in the entity) and just strip all the read/write code — then there's nothing
to migrate for existing installs.

#### Lower-priority cleanups (optional in this strip)

- `server/src/controllers/printer.controller.ts:174` — JSDoc link to
  `docs.octoprint.org`. Just a comment; trivial.
- `server/src/utils/swagger/generator.ts:20` — API description string
  mentions OctoPrint/Klipper/BambuLab. Trivial.
- `server/src/controllers/slicer-compat.controller.ts:61` and
  `server/src/server.constants.ts:24` — `defaultAcceptedBambuExtensions: [".3mf"]`.
  The `.3mf` format is **not** Bambu-exclusive (PrusaSlicer also produces 3MF),
  so the constant is mis-named, not dead. Rename to
  `defaultAccepted3mfExtensions` (or just inline) rather than delete.
- `server/src/utils/parsers/3mf.parser.ts` — handles both generic single-plate
  3MF and Bambu Lab's multi-plate variant. Stays as-is; it's a file-format
  parser, not a vendor adapter. Keep but drop the "(Bambu Lab format)" wording
  from the file header so it doesn't read as vendor-specific.

There are **diffs from the May 2026 attempt for each of the above files
preserved in the git history** (commits that touched them on the previous,
reverted attempt) — useful as a reference but don't cherry-pick blindly, the
abort happened before the harder problems below were solved.

### Hard — the cache + socket-store entanglement

The three real blockers, all in `server/src/state/`:

- `printer-events.cache.ts`
- `printer-socket.store.ts` *(added on re-audit — was missed in the original list)*
- `test-printer-socket.store.ts`

`printer-socket.store.ts` imports `OctoprintWebsocketAdapter` + `OctoprintType` and
has a vendor-specific reauth branch (`if (socket.printerType === OctoprintType
&& (socket as OctoprintWebsocketAdapter).needsReauth())`) that runs on the
PrinterWebsocketTask interval. Same handling as the other two stores.

These mix imports from all four vendors:

```ts
// printer-events.cache.ts (today, on main)
import { WsMessage, messages, type OctoPrintEventDto } from "@/services/octoprint/dto/octoprint-event.dto";
import { MR_WsMessage, type MoonrakerEventDto } from "@/services/moonraker/constants/moonraker-event.dto";
import type { PrinterObjectsQueryDto } from "@/services/moonraker/dto/objects/printer-objects-query.dto";
import { SubscriptionType } from "@/services/moonraker/moonraker-websocket.adapter";
import { octoPrintEvent } from "@/services/octoprint/octoprint-websocket.adapter";
import { moonrakerEvent } from "@/services/moonraker/constants/moonraker.constants";
import { prusaLinkEvent } from "@/services/prusa-link/constants/prusalink.constants";
import type { PrusaLinkEventDto } from "@/services/prusa-link/constants/prusalink-event.dto";
import { bambuEvent, type BambuEventDto } from "@/services/bambu/bambu-mqtt.adapter";
import type { CurrentMessageDto } from "@/services/octoprint/dto/websocket/current-message.dto";
```

`PrinterEventsCache` is the live-state hub the Socket.IO gateway and the
print-job logic both read from. It owns the runtime view of every printer
across every vendor — it's not a leaf to delete, it's the trunk.

Three options for handling it, in order of effort and cleanliness:

1. **Restore minimal vendor-type stubs** (~30 min, least invasive)
   Recreate the deleted types as thin standalone files under
   `server/src/services/_legacy-vendor-stubs/` (or similar), containing only
   the symbols `PrinterEventsCache` and `TestPrinterSocketStore` reference.
   Mark them `@deprecated`. The cache code keeps compiling untouched.
   Pros: lands the rest of the strip in one PR. Cons: the cache still has
   four-vendor logic, dead branches inside.

2. **Refactor the cache to be vendor-agnostic** (~1–2 h, cleanest)
   Define a single `PrinterEventDto` discriminated union (or just `unknown`
   + per-printer routing) in `services/printer-api.interface.ts`. Rewrite
   `printer-events.cache.ts` and `test-printer-socket.store.ts` to handle
   only that. This is the right answer; pair it with an actual smoke test
   that exercises a PrusaLink poll cycle.

3. **Restore the adapters with stubbed bodies** (~45 min, lazy)
   Bring back `octoprint/`, `moonraker/`, `bambu/` directories, but replace
   every method body with `throw new Error("vendor adapter stripped")`.
   The cache and DI keep their imports; nothing they're attached to ever
   gets called because the UI hides the vendors. Reduces almost no code.

**Recommended:** option 1 for this PR, follow up with option 2 in a separate
PR once the rest of the strip is landed and stable.

## What broke during the May 2026 attempt

Working chronologically (`git reflog` if you need them):

1. Deleted service dirs + top-level `.api.ts` files.
2. Patched `container.ts`, `container.tokens.ts`, `tasks.ts`, the factory,
   interface, middleware, socket factory, compatibility util, both
   controllers, yaml service, validator, entity. Build still failed.
3. `printer-events.cache.ts` and `test-printer-socket.store.ts` blew the
   build with `UNRESOLVED_IMPORT` errors for each missing vendor type.
4. Reverted everything with `git checkout HEAD -- server/src`. The PrusaLink
   adapter HTTP-header constants (`@/services/octoprint/constants/octoprint-service.constants`)
   were also used by the PrusaLink HTTP client builder — that re-pointing
   does need to happen, into a neutral location like
   `server/src/constants/http-headers.constants.ts`.

## Suggested PR breakdown

To keep review tractable:

1. **PR 1**: Move shared HTTP header constants out of `octoprint/` into
   `server/src/constants/http-headers.constants.ts`. Repoint **5** importers:
   `octoprint/utils/api.utils.ts`,
   `octoprint/utils/octoprint-http-client.builder.ts`,
   `prusa-link/prusa-link.api.ts`,
   `prusa-link/utils/prusa-link-http-client.builder.ts`,
   `shared/default-http-client.builder.ts`. Delete the old file. Trivial
   rename, no behavior change.
2. **PR 2**: Restore minimal stubs + delete service dirs + patch all the
   easy files. Get to a green build with the cache intact (option 1 above).
   Includes the re-audit additions: drop `printer-settings.controller.ts`,
   the `/octoprint/server/restart` route in `printer.controller.ts`, the
   vendor list in `server-public.controller.ts`, the moonraker-only
   `shared/websocket-rpc-extended.adapter.ts`, and the `experimental*Support`
   plumbing across constants/entity/store/migration/public-controller.
3. **PR 3**: Frontend cleanup — drop the now-dead `OctoPrintType`,
   `MoonrakerType`, `BambuType` references in
   `client/src/shared/printer-types.constants.ts`, and any orphaned
   `@/store/features.store` entries for `klipper` / `bambu` /
   `prusaLink` feature flags.
4. **PR 4** (later): Refactor `PrinterEventsCache` (plus `PrinterSocketStore`
   and `TestPrinterSocketStore`) to be vendor-agnostic (option 2 above).

## Validation checklist for each PR

Tests are gone, so verify by running the actual server against a real
PrusaLink endpoint:

- [ ] `yarn build` is green.
- [ ] `yarn start` boots, log has no new ERR lines vs. main.
- [ ] `curl http://localhost:4000/api/v2/auth/login-required` returns 200.
- [ ] After FirstTimeSetup wizard, add a PrusaLink printer via the UI.
- [ ] Confirm the printer shows live state (temperature / job progress)
      in the dashboard.
- [ ] Send a print, watch it run, watch it finish.
- [ ] `yarn doctor` still passes 8/8.

## Out of scope on this branch

- Removing the per-printer maintenance toggle from the print queue — that's
  a behavior change, not a vendor strip.
- Camera Streams — independent feature, separate cleanup.
- The `apiRoute = /api/v2` constant — orthogonal.

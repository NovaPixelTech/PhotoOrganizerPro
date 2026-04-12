# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### Photo Organizer (`/`)

A full-stack photo and video organizer web app.

**Features:**
- Upload photos/videos by selecting files or entire folders
- Extracts EXIF metadata (date created, GPS coordinates)
- Reverse-geocodes GPS → human-readable city/country names (via Nominatim, no API key required)
- Organizes files into: `/Organized/<Location>/<Year>/<Month.Year>/Photos|Videos/`
- Copy or Move mode (user chooses at runtime)
- Dry run mode (preview without moving files)
- Duplicate detection
- Progress tracking with live polling
- Download organized files as ZIP archive
- Handles: JPG, HEIC, PNG, MOV, MP4 and more

**Frontend:** React + Vite at `artifacts/photo-organizer/`
**Backend routes:** `artifacts/api-server/src/routes/organize.ts`
**Metadata lib:** `artifacts/api-server/src/lib/metadata.ts`
**Geocoder lib:** `artifacts/api-server/src/lib/geocoder.ts`
**Sessions lib:** `artifacts/api-server/src/lib/sessions.ts`

**Backend dependencies added:**
- `multer` — multipart file upload handling
- `exif-reader` — EXIF metadata extraction
- `heic-convert` — HEIC to JPEG conversion for EXIF reading
- `archiver` — ZIP archive creation for download
- `axios` — HTTP requests to Nominatim geocoding API

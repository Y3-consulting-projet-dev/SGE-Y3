# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

SGE-Y3 is the employee evaluation platform for the Ycube AC consulting firm ("Système de Gestion des Évaluations"). It models the firm's annual appraisal cycle: each person self-evaluates, their hierarchy reviews them, RH calibrates/validates, and associates make final decisions. The UI and all domain data are in **French** — match that language in user-facing strings, status values, and messages.

The actual application lives in [sge-y3/](sge-y3/): a `backend/` (Express + MongoDB) and a `frontend/` (React + Vite). There is no root-level package.json — run commands from inside `backend/` or `frontend/`.

## Commands

Backend (`cd sge-y3/backend`):
- `npm run dev` — start API with nodemon (auto-reload) on `PORT` (default 5000)
- `npm start` — start API without reload
- `npm run seed:users` — import/update users from a CSV (`REGISTRE DU PERSONNEL (1).csv`); accepts an optional path arg, otherwise uses the default path several levels above the repo. All seeded users get the password `Ycube@c2026`.

Frontend (`cd sge-y3/frontend`):
- `npm run dev` — Vite dev server on `0.0.0.0:5173`
- `npm run build` — production build to `dist/`
- `npm run lint` — ESLint over the project
- `npm run preview` — serve the built `dist/`

There is **no test suite** (`backend` `npm test` is a placeholder that exits 1).

### Required backend env (`sge-y3/backend/.env`)
`MONGO_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN` (default `24h`), `PORT` (default 5000), and optional `FRONTEND_URL` for CORS origin.

### Frontend → backend wiring
The API base URL is **hardcoded** in [sge-y3/frontend/src/lib/apiBase.js](sge-y3/frontend/src/lib/apiBase.js) (currently a LAN IP). Change it there when the backend host changes — it is not driven by an env var.

## Architecture

### Roles are derived, never stored as a role field
A user has only a `grade` and a `department` (+ `code_categorie`). Everything else is computed:
- [backend/src/utils/userMapping.js](sge-y3/backend/src/utils/userMapping.js) maps grade↔category↔role and computes `permission_role` (`admin` / `rh_assistant` / `manager` / `collaborator`). Specific RH people are hardcoded by email here (`ASSISTANT_RH_EMAIL`, `FULL_RH_EMAILS`).
- On login, [authController.js](sge-y3/backend/src/controllers/authController.js) bakes `role`, `permission_role`, `grade`, `code_categorie` into the JWT and the returned user object.
- The frontend re-derives a *dashboard role* in [frontend/src/App.jsx](sge-y3/frontend/src/App.jsx) `getDashboardRole()` (note: it has its own copy of the RH/support email lists and adds a `support` and `rh-assistant` distinction). App.jsx is the router — it switches the whole page on `userRole`; there is **no react-router**. (`frontend/src/routes/index.jsx` exists but is dead/stale code referencing non-existent paths — ignore it.)

When changing role logic, you almost always need to touch both `userMapping.js` (backend authorization) and `App.jsx` (frontend dashboard selection) to keep them in sync.

### Authorization
Two-layer: [authMiddleware.js](sge-y3/backend/src/middleware/authMiddleware.js) `requireAuth` (verifies JWT, loads the User, checks `is_active`) then a role guard from [collaboratorMiddleware.js](sge-y3/backend/src/middleware/collaboratorMiddleware.js) (`requireAssistant` / `requireSenior` / `requireManager` / `requireRh` / `requireAssociate`). These guards check `request.user.grade` / `department` / `code_categorie` directly. Every protected route chains `requireAuth, requireRole, handler`.

### Backend layout — one slice per role
Routes/controllers are organized by evaluation actor, each mounted under `/api/<role>` in [app.js](sge-y3/backend/src/app.js): `auth`, `collaborator` (Assistants), `senior`, `manager`, `committee`, `rh`, `associate`. To find an endpoint, start in the matching `routes/*.js` file (they list every route compactly) then the matching `controllers/*Controller.js`.

### The evaluation data model
- **[EvaluationInstance](sge-y3/backend/src/models/EvaluationInstance.js)** is the central document: one self-evaluation per (`cycle_label`, `evalue_id`, `template_type`), unique-indexed. It holds `sections` (each with `pages` → `themes`, or flat `criteria`), `mission_evaluations`, a `status` from a fixed French enum (`Brouillon` → `En cours` → `Soumis au Manager`/`Soumis a RH`/… → `Valide RH` → `Cloture`), and peer-review fields. The status enum encodes the whole workflow — read it to understand the cycle.
- **Review documents** mirror this shape for hierarchical reviews: [ManagerMemberReview](sge-y3/backend/src/models/ManagerMemberReview.js), [SeniorAssistantReview](sge-y3/backend/src/models/SeniorAssistantReview.js), [AssociateManagerReview](sge-y3/backend/src/models/AssociateManagerReview.js), and [CommitteeDecision](sge-y3/backend/src/models/CommitteeDecision.js). They share the same `section → page → theme` / `mission → criteria` nesting (scores are 1–5).

### Evaluation templates come from a competency matrix
The set of sections/criteria a person sees is **generated**, not stored per-user-by-hand:
- [backend/src/data/competencyMatrix.generated.json](sge-y3/backend/src/data/competencyMatrix.generated.json) (~170KB) is the source matrix of competencies by grade/department.
- [utils/competencyMatrix.js](sge-y3/backend/src/utils/competencyMatrix.js), [utils/assistantEvaluationTemplate.js](sge-y3/backend/src/utils/assistantEvaluationTemplate.js), and [utils/seniorEvaluationTemplate.js](sge-y3/backend/src/utils/seniorEvaluationTemplate.js) build the per-grade template (including special handling for Support roles, hardcoded by email).
- [utils/evaluationHelpers.js](sge-y3/backend/src/utils/evaluationHelpers.js) is the shared scoring/validation layer: progress %, section status (`A faire`/`En cours`/`Complete`), averages, `normalizeSections` (the canonical normalizer for incoming section payloads), and the submit-time validators (required scores answered, low-score pages need a comment, section/final comment length). Use these helpers rather than re-implementing scoring or validation in a controller.

### Frontend layout
Pages live under [frontend/src/components/pages/](sge-y3/frontend/src/components/pages/) grouped by role (`collaborator/`, `senior/`, `manager/`, `rh/`, `associé/`, `support/`, `comite/`, `auth/`). Each role's top-level dashboard component (e.g. `VueRH`, `Vuecabinet`, `ManagerDashboard`) is rendered directly by `App.jsx` and owns its own internal navigation/state. Per-feature API calls are wrapped in [frontend/src/lib/](sge-y3/frontend/src/lib/) modules (`associateOverview.js`, `managerOverview.js`, `rhOverview.js`, `seniorEvaluation.js`, `committee.js`, …), all going through the `request()` helper in [lib/auth.js](sge-y3/frontend/src/lib/auth.js), which injects the Bearer token from `localStorage` (key `sge-auth-session`).

Stack: React 19, Vite, Tailwind CSS 3, shadcn/Radix UI primitives, `lucide-react` icons. Path alias `@/` → `src/` (see `jsconfig.json` / `vite.config.js`).

## Conventions

- **Passwords** are stored as a bcrypt hash wrapped in a Mongoose `Buffer` field (`Buffer.from(hash, 'utf8')`), not a plain string. Compare with `user.password.toString('utf8')` before `bcrypt.compare`. Preserve this when touching auth.
- Mongoose models use a French `collection` name and snake_case timestamp fields (`created_at` / `updated_at`); `User.toSafeObject()` is the only shape that should leave the API for a user.
- Controller responses and validation messages are French sentences — keep them consistent with existing wording.
- Scores are integers 1–5 (`min: 1, max: 5`) throughout the review schemas; `null` means unanswered.

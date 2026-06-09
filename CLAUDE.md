# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

SGE-Y3 is a performance evaluation management system for Y3 Consulting (ycubeac.com), a French consulting firm. The application manages multi-perspective annual evaluation cycles across 7 distinct roles. Everything is in French — UI labels, variable names, comments, and domain concepts.

The code lives entirely under `sge-y3/`, split into `backend/` and `frontend/`.

---

## Commands

### Backend (`sge-y3/backend/`)

```bash
npm run dev        # Start with nodemon (auto-reload)
npm start          # Start without auto-reload
npm run seed:users # Seed users from importUsers.js
```

Requires a running MongoDB instance. Connection string in `backend/.env`:
```
MONGO_URI=mongodb://localhost:27017/sge_y3
JWT_SECRET=sge_y3_secret_key_2026
PORT=5000
```

### Frontend (`sge-y3/frontend/`)

```bash
npm run dev        # Vite dev server on port 5173 (accessible on all interfaces)
npm run build      # Production build → dist/
npm run lint       # ESLint
npm run preview    # Serve the dist/ build
```

The frontend expects the backend at `http://localhost:5000/api` by default (override via `VITE_API_URL`). The Vite alias `@` maps to `src/`.

---

## Architecture

```
React SPA (port 5173)
    ↕ REST/JSON
Express.js API (port 5000)
    ↕ Mongoose ODM
MongoDB (sge_y3 database)
```

There is no router library on the frontend. `App.jsx` is a single state machine: if the user is not authenticated it shows `LoginPage`; once logged in, it renders one of six lazy-loaded dashboard shells based on the computed role. Navigation within a dashboard is handled by each dashboard component internally (sidebar/tab state).

---

## Role system — the most important thing to understand

Roles are **not stored on the User document**. They are computed at runtime from a combination of `grade`, `department`, `email`, and `permission_role` fields.

**Backend source of truth:** `src/utils/userMapping.js`
**Frontend mirror:** `src/App.jsx` (`getDashboardRole` function)

The mapping logic (simplified):

| Condition | Resolved role |
|-----------|--------------|
| Email in `FULL_RH_EMAILS` | `rh` / `admin` |
| Email `fatoumata.ouattara@ycubeac.com` OR (RH dept + grade Assistant) | `rh-assistant` |
| `user.role === 'associate'` OR grade `Associé` | `associate` |
| Email in `SUPPORT_EMAILS` | `support` |
| grade `Senior` or `Assistant manager` | `senior` (frontend) / `manager` (backend) |
| grade `Manager` or `Senior manager` | `manager` |
| grade `Assistant` | `collaborator` |

When adding features that are role-gated, always check both `userMapping.js` (backend) and `App.jsx` (frontend) — they must stay in sync.

**Grade → category code mapping** (used in competency matrix lookups):
- `Assistant` → `8C`, `Senior` → `9A`, `Assistant manager` → `9B`, `Manager` → `10B`, `Senior manager` → `10C`, `Associé` → `11`

---

## Evaluation lifecycle

Each evaluation is an `EvaluationInstance` document. Status transitions:

```
Brouillon → En cours → Soumis au Manager / Soumis aux Managers
         → Soumis a RH → Valide RH → Transmis a l associe
         → En correction → Cloture
```

An instance is uniquely identified by `(cycle_label, evalue_id, template_type)` — this is a compound unique index.

**Sub-documents inside an instance:**
- `sections[]` — pages of criteria, each criterion scored 1–5
- `mission_evaluations[]` — mission-based evaluations with their own recipients and criteria
- `anonymous_feedback[]` — anonymous comments targeting another user
- `peer_review_sections[]` — peer review written by a manager/senior

---

## Data model

Key collections in MongoDB:

| Collection | Model file | Purpose |
|---|---|---|
| `users` | `User.js` | Employee accounts (no plain-text role field; role computed from grade/dept/email) |
| `evaluation_instances` | `EvaluationInstance.js` | Self-evaluation forms, one per employee per cycle |
| `manager_member_reviews` | `ManagerMemberReview.js` | Manager's evaluation of a direct report |
| `senior_assistant_reviews` | `SeniorAssistantReview.js` | Senior's evaluation of an assistant |
| `associate_manager_reviews` | `AssociateManagerReview.js` | Associate's evaluation of managers |
| `committee_decisions` | `CommitteeDecision.js` | Final committee classification (CA/CB/CC/CD) |

`User.password` is stored as `Buffer` (bcrypt hash). Always use `user.toSafeObject()` when sending user data to the client — it strips the password field.

---

## API structure

All routes are mounted under `/api/` in `src/app.js`:

| Prefix | File | Who uses it |
|---|---|---|
| `/api/auth` | `authRoutes.js` | Login (all roles) |
| `/api/collaborator` | `collaboratorRoutes.js` | Assistants self-evaluation |
| `/api/senior` | `seniorRoutes.js` | Seniors evaluating assistants |
| `/api/manager` | `managerRoutes.js` | Managers (self-eval + team eval) |
| `/api/committee` | `committeeRoutes.js` | Committee decisions |
| `/api/rh` | `rhRoutes.js` | RH dashboard, syntheses, questionnaires |
| `/api/associate` | `associateRoutes.js` | Associate/Partner views |
| `/api/support` | `supportRoutes.js` | Support staff evaluations |

All routes except `/api/auth/login` go through `requireAuth` middleware (JWT Bearer token validation). The JWT payload's `sub` field is the user's MongoDB `_id`.

---

## Competency matrix

`src/data/competencyMatrix.generated.json` (2 435 lines, auto-generated — do not edit manually) maps `(department, grade)` pairs to evaluation criteria organised by sections (SAVOIR FAIRE, SAVOIR ETRE) and themes. The helper `src/utils/competencyMatrix.js` provides the lookup functions. When creating a new evaluation instance, the matrix is used to populate the `sections[]` template.

---

## Frontend conventions

- API calls are organised in `src/lib/` — one file per role/domain (e.g., `managerOverview.js`, `rhOverview.js`). Each file wraps `fetch` with the stored JWT from `localStorage` (via `src/lib/auth.js`).
- All dashboard roots receive three props: `user` (current user object), `onLogout`, `onUserUpdate` (called after profile changes to refresh the session).
- Tailwind + shadcn/ui for styling. The shadcn config is at `frontend/components.json`; path alias `@/components/ui/` for primitives.
- Some page components are very large (e.g., `Monautoevaluation.jsx` ~135 KB). Prefer editing targeted sections rather than rewriting.

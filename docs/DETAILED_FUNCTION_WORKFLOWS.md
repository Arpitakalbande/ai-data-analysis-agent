# Project Function Workflows

This document describes the workflows, inputs, outputs, side-effects, and call relationships for the key modules and functions in the project.

**Note:** File links point to the workspace source files for reference.

---

## Overview
- **Project root API entry points**: [backend/main.py](backend/main.py#L1-L200) and [backend/app/main.py](backend/app/main.py#L1-L200)
- **Agents and tasks**: [backend/app/agents](backend/app/agents)
- **Core utilities**: [backend/app/core](backend/app/core)
- **Routers (API endpoints)**: [backend/app/routers](backend/app/routers)

---

## backend/main.py (audit)
File: [backend/main.py](backend/main.py#L1-L300)

Note: several endpoints in `backend/main.py` reference external modules that are not present in this repository (imports such as `llm.slide_planner`, `llm.rag_pipeline`, and `parsers.pdf_parser` / `parsers.docx_parser`). These endpoints therefore cannot function without those external packages or the missing modules.

Audit findings for `backend/main.py`:
- The file defines endpoints related to a slide-generation/RAG pipeline (`generate_slides`, `generate_slides_with_context`, `generate_from_file`, `process_file`, `clear_context`).
- The implementation calls into `llm.*` and `parsers.*` modules which are not present under the workspace; they are external dependencies or omitted components.
- Because those imports are unresolved, treat these endpoints as out-of-scope for a documentation focused strictly on fully implemented project functionality.

Action taken in this document: removed the detailed walkthrough of the slide-generation endpoints and replaced it with this audit note. If you want these endpoints documented here as soon as they're functional, add the missing `llm/` and `parsers/` modules (or supply the real implementations) and I will re-document them precisely.

---

## backend/config.py
File: [backend/config.py](backend/config.py#L1-L100)
- Responsibility: Load environment variables via `dotenv` and expose `ANTHROPIC_API_KEY` and `MODEL_NAME` constants.
- Workflow: On import, calls `load_dotenv()` then reads `os.getenv`.

---

## backend/app/celery_app.py
File: [backend/app/celery_app.py](backend/app/celery_app.py#L1-L200)
- Responsibility: Configure Celery app used by background tasks.
- Key configuration:
  - `broker="memory://"` and `backend="cache+memory://"` for in-process testing.
  - `task_always_eager=True` so tasks run synchronously during development.
  - `include` points to agent modules (EDA, charts, insights, file processing).
- Workflow: Importing `celery_app` yields configured `Celery` instance for task registration and execution.

---

## backend/app/agents/insight_agent.py
File: [backend/app/agents/insight_agent.py](backend/app/agents/insight_agent.py#L1-L300)
Functions and workflow:
- `generate_synthetic_insights(analysis: dict) -> str`:
  - Purpose: Create a text report summarizing EDA when external LLM is not available.
  - Inputs: EDA dict with keys like `row_count`, `column_count`, `dtypes`, `missing_values`, `preprocessing`.
  - Workflow: Builds a markdown-style report string using provided metrics and returns it.
  - Side effects: None.

- `generate_insights(self, analysis_id: str)` (Celery task)
  - Purpose: Fetch analysis by `analysis_id`, request an LLM (Anthropic) to generate detailed insights, fallback to synthetic insights if API unavailable.
  - Workflow:
    1. Read analysis object via `get_analysis(analysis_id)`.
    2. Validate presence of EDA; update job/analysis status via `update_analysis_status`.
    3. If `settings.ANTHROPIC_API_KEY` present, build a prompt with EDA content and call Anthropic client.
    4. On success, set `insights_text` to returned text; otherwise call `generate_synthetic_insights`.
    5. Call `save_insights` and set status to completed.
  - Side effects: updates persisted analysis via `save_insights` and analysis status via `update_analysis_status`.
  - Error handling: catches API exceptions, logs, uses fallback text.

---

## backend/app/agents/file_processor.py
File: [backend/app/agents/file_processor.py](backend/app/agents/file_processor.py#L1-L200)
- Celery task `process_file(self, job_id: str, content: bytes, filename: str)`
  - Purpose: Convert uploaded bytes into a DataFrame and save job data.
  - Workflow:
    1. `update_job_status(job_id, 'processing', progress=10)`
    2. Deserialize content into pandas DataFrame depending on file extension: CSV or Excel.
    3. Update progress and call `save_job_data(job_id, {...})` containing `data` (df.to_dict), `filename`, `columns`, `rows`.
    4. Update job status to `completed` on success.
    5. On exceptions, mark job `failed` and re-raise error.
  - Side effects: Persists job JSON files via `job_manager_file` utilities.

---

## backend/app/agents/eda_agent.py
File: [backend/app/agents/eda_agent.py](backend/app/agents/eda_agent.py#L1-L400)
- Celery task `run_eda(self, analysis_id: str)`
  - Purpose: Perform EDA preprocessing, descriptive stats, correlations, and save results.
  - Workflow (high level):
    1. Load analysis (metadata) and job data using `get_analysis()` and `get_job_data()`.
    2. Construct pandas DataFrame from job data; perform cleaning (strip, normalize, NaN handling).
    3. Record preprocessing metrics: duplicates removed, missing values, cleaned_rows, quality score.
    4. Compute per-column metadata: dtypes, missing counts/percentages.
    5. Numeric column stats: mean, median, std, min/max, quantiles, skewness, kurtosis (safe_float helper used to guard NaN/Inf)
    6. Categorical column stats: unique count, top values, mode.
    7. Correlation matrix and data quality summary.
    8. Persist cleaned job payload and call `save_analysis(analysis_id, eda)`.
    9. Update analysis status through progress ticks (10→100).
  - Outputs: saved EDA JSON (via `save_analysis`) and return value of the task includes `eda` and preprocessing info.
  - Error handling: raises ValueError on missing data or if DataFrame empties after preprocessing.

---

## backend/app/agents/chart_agent.py
File: [backend/app/agents/chart_agent.py](backend/app/agents/chart_agent.py#L1-L500)
- Celery task `generate_charts(self, analysis_id: str)`
  - Purpose: Generate Plotly chart JSON payloads for numeric and categorical columns and save them.
  - Workflow:
    1. Load analysis and job data.
    2. Build summary tables and dataset statistics as Plotly `Figure`s serialized with `fig.to_json()`.
    3. For each numeric column: create histogram with box marginal, add to `charts` list.
    4. If more than one numeric column: create correlation heatmap and box plots.
    5. For categorical columns: build bar charts for top categories.
    6. Add descriptive statistics table as a chart payload.
    7. Save charts via `save_charts(analysis_id, charts)` and update status.
  - Outputs: list of chart payloads stored in analysis JSON.

---

## backend/app/main.py
File: [backend/app/main.py](backend/app/main.py#L1-L200)
- Application factory and router registration.
- `init_db()` called on import to ensure DB models created.
- Includes CORS middleware and mounts routers for auth, upload, analyze, charts, insights, dashboard, export, connect, status.
- `health_check()` returns simple `healthy` status.

---

## backend/app/core/database.py
File: [backend/app/core/database.py](backend/app/core/database.py#L1-L200)
- `get_db()` dependency: yields SQLAlchemy `SessionLocal` and ensures `db.close()`.
- `init_db()` calls `Base.metadata.create_all(bind=engine)` to create tables.
- Uses `settings.DATABASE_URL` from [backend/app/core/config.py](backend/app/core/config.py#L1-L200).

---

## backend/app/core/config.py
File: [backend/app/core/config.py](backend/app/core/config.py#L1-L200)
- Centralized `Settings` via `pydantic_settings.BaseSettings` as `settings`.
- Contains Anthropic, JWT, DB, and file paths configuration.
- Reads `.env` using `Config.env_file`.

---

## backend/app/core/job_manager_file.py
File: [backend/app/core/job_manager_file.py](backend/app/core/job_manager_file.py#L1-L400)
- Purpose: Lightweight file-backed job store in `./jobs_data` directory.
- Important functions:
  - `_get_job_file(job_id)` returns Path for job JSON
  - `_load_job(job_id)` reads JSON and handles corruption
  - `_save_job(job_id, data)` writes JSON atomically (temp file + replace) with `_json_default` helper for datetimes and numpy types
  - `create_job(job_id)` create minimal job entry (status pending)
  - `update_job_status(job_id, status, progress)` updates job state
  - `save_job_data(job_id, data)` attach processed data and mark job completed
  - `get_job_data(job_id)` returns stored `data` or None
  - `create_analysis(analysis_id, job_id, user_id)` create analysis meta entry
  - `save_analysis(analysis_id, eda_result)` persist EDA
  - `update_analysis_status(analysis_id, status, progress)` update analysis state
  - `save_charts(analysis_id, charts)` and `save_insights(analysis_id, insights)` store additional outputs
  - `get_analysis(analysis_id)` retrieves full analysis
  - `get_status(entity_id, entity_type)` obtain status summary for job or analysis
- Side effects: writes JSON files under `./jobs_data`.
- Atomicity: writes to `.json.tmp` then replaces file to reduce corruption risk.

---

## backend/app/core/security.py
File: [backend/app/core/security.py](backend/app/core/security.py#L1-L200)
- `hash_password(password: str) -> str` uses `bcrypt` to hash passwords.
- `verify_password(plain_password, hashed_password) -> bool` verifies bcrypt hash.
- `create_access_token(user_id, email, expires_delta) -> str` creates JWT with `exp`.
- `verify_token(token) -> Optional[TokenData]` decodes JWT and returns `TokenData` pydantic model or None.
- `get_current_user(authorization: str = Header(None)) -> TokenData` FastAPI dependency to validate header and raise `401` if invalid or missing.
- Security notes: `JWT_SECRET` and other settings are in `settings`; rotate in production.

---

## backend/app/routers
Files: all under [backend/app/routers](backend/app/routers)

General pattern for routers:
- Each router defines Pydantic request/response models when needed.
- Each endpoint uses core helpers from `app.core.*` and agent tasks from `app.agents.*`.
- Typical workflows:
  - `upload`: accept file, store into job manager, call `process_file` agent synchronously (tasks run eagerly in dev), return `job_id`.
  - `analyze`: create analysis, trigger `run_eda`, return `analysis_id` and preprocessing summary.
  - `charts`: trigger `generate_charts` and return stored charts for analysis.
  - `insights`: trigger `generate_insights` and return stored insights.
  - `export`: generate reproducible Python code for an analysis or return analysis JSON.
  - `connect`: reflect database tables and optionally load table content as a job (stores as job payload)
  - `status`: query job or analysis progress and list recent analyses by scanning `jobs_data` files.
  - `auth`: signup, login, token generation, and `/me` to fetch current user (requires JWT dependency).

Refer to specific router files for implementation details (examples):
- [backend/app/routers/upload.py](backend/app/routers/upload.py#L1-L200)
- [backend/app/routers/analyze.py](backend/app/routers/analyze.py#L1-L200)
- [backend/app/routers/charts.py](backend/app/routers/charts.py#L1-L200)
- [backend/app/routers/insights.py](backend/app/routers/insights.py#L1-L200)
- [backend/app/routers/export.py](backend/app/routers/export.py#L1-L300)
- [backend/app/routers/connect.py](backend/app/routers/connect.py#L1-L400)
- [backend/app/routers/status.py](backend/app/routers/status.py#L1-L300)
- [backend/app/routers/auth.py](backend/app/routers/auth.py#L1-L200)

---

## backend/app/models/user.py
File: [backend/app/models/user.py](backend/app/models/user.py#L1-L200)
- SQLAlchemy `User` model with fields `id`, `email`, `hashed_password`, `created_at`, `updated_at`.
- `__repr__` provides readable string representation used in debugging.

---

## How to use this documentation
- The file `docs/DETAILED_FUNCTION_WORKFLOWS.md` is generated in the repository root `docs/` directory.
- For per-function deep dives or to include examples, I can expand sections to include sequence diagrams, example payloads, and call graphs.

---

## Next steps (suggested)
- Add inline docstrings to functions with parameter and return type descriptions.
- Generate API reference (OpenAPI) from FastAPI and attach usage examples.
- Create sequence diagrams for the common flows: Upload→Process→Analyze→Charts→Insights.

---

End of document.

---

## **Authentication: Implementation & Guidance**

- **Relevant files**:
  - `backend/app/routers/auth.py` ([backend/app/routers/auth.py](backend/app/routers/auth.py#L1-L200))
  - `backend/app/core/security.py` ([backend/app/core/security.py](backend/app/core/security.py#L1-L200))
  - `backend/app/models/user.py` ([backend/app/models/user.py](backend/app/models/user.py#L1-L200))
  - `backend/app/core/config.py` ([backend/app/core/config.py](backend/app/core/config.py#L1-L200))

- **Overview (what is implemented)**:
  - The project provides a basic email/password authentication flow: **signup**, **login**, and a protected endpoint **/auth/me** to read the current user.
  - Passwords are hashed with `bcrypt` before storing in the `users` table (`User.hashed_password`). See `hash_password()` and `verify_password()` in `security.py`.
  - JSON Web Tokens (JWT) are used for stateless authentication. Tokens are created with `create_access_token(user_id, email, expires_delta)` and verified with `verify_token(token)` (HS256 by default). Key settings live in `settings` (`JWT_SECRET`, `JWT_ALGORITHM`, `JWT_EXPIRATION_HOURS`).

- **Endpoints and purpose**:
  - `POST /auth/signup` (`signup` in `auth.py`):
    - Accepts `email` and `password`, creates a `User` record with a UUID id, stores the `hashed_password`, and returns an `access_token` (JWT) in the response.
  - `POST /auth/login` (`login` in `auth.py`):
    - Validates credentials using `verify_password()`. On success returns an `access_token` (JWT).
  - `GET /auth/me` (`get_current_user_info` in `auth.py`):
    - Protected endpoint. Uses FastAPI dependency `get_current_user` (defined in `security.py`) which expects `Authorization: Bearer <token>` header and returns `TokenData` (user_id, email, exp). The endpoint looks up the `User` in the DB and returns user metadata.

- **Token format & validation**:
  - Tokens are standard JWTs signed with `JWT_SECRET` and algorithm `JWT_ALGORITHM` (HS256 by default). Payload includes `user_id`, `email`, `iat`, and `exp` (expiration timestamp).
  - `verify_token()` decodes the token and returns `TokenData` or `None` on invalid/expired token. `get_current_user` raises HTTP 401 for missing/invalid tokens.

- **Where to add auth to other endpoints**:
  - Use FastAPI `Depends(get_current_user)` on a path operation parameter to require authentication, for example:

    - Add `current_user: TokenData = Depends(get_current_user)` to the route signature.

  - When you require DB access to the authenticated user, add both `current_user: TokenData = Depends(get_current_user)` and `db: Session = Depends(get_db)` then query `User` using `current_user.user_id`.

- **Example: call protected endpoint**
  - Request header:

    - `Authorization: Bearer <access_token>`

  - Example curl to call `/auth/me` after login:

    ```bash
    curl "http://localhost:8000/auth/me" -H "Authorization: Bearer <access_token>"
    ```

- **Security considerations & recommendations for a full-stack developer**:
  1. **Rotate `JWT_SECRET` in production** and keep it outside source control (use environment variables). `settings` reads `.env` but ensure secure provisioning.
  2. **Use HTTPS** in production to protect tokens in transit.
  3. **Short-lived access tokens + refresh tokens**: the project currently only issues access tokens. For better UX and security, implement refresh tokens (store refresh tokens securely; rotate and revoke on logout).
  4. **Token storage on the client**: Prefer `httpOnly` secure cookies for web apps to mitigate XSS, or store tokens in secure storage for native apps. If you use localStorage, be aware of XSS risks.
  5. **CSRF**: If storing tokens in cookies, protect stateful routes with CSRF protections or use SameSite cookie attributes.
  6. **Password policies**: Enforce strong password rules and consider rate-limiting login attempts to reduce brute-force risks.
  7. **Account management**: Implement email verification, password reset flows, and token revocation for compromised accounts.
  8. **CORS**: `app/main.py` sets `FRONTEND_URL` in `settings`. Ensure CORS origins are restricted to your frontend in production.
  9. **Sensitive logging**: Avoid logging raw passwords, tokens, or other secrets. Current code logs errors; ensure logs are scrubbed in production.

- **Missing features (consider adding)**:
  - Refresh token endpoint and storage (rotating refresh tokens).
  - Logout endpoint that revokes tokens (requires token revocation strategy or maintained token blacklist/store).
  - Rate limiting on `POST /auth/login`.
  - Multi-factor authentication (MFA) support for increased security.

- **How to test auth locally**:
  1. Run the FastAPI app (from `backend`):

     ```bash
     uvicorn app.main:app --reload --port 8000
     ```

  2. Sign up a user via `POST /auth/signup` using `curl` or Postman, capture the returned `access_token`.
  3. Call `GET /auth/me` with `Authorization: Bearer <access_token>` to verify the token and user lookup.

If you want, I can now: add example code snippets showing how to protect other endpoints with `Depends(get_current_user)`, or implement a refresh-token flow skeleton (server + client notes). Let me know which you prefer.

---

## Sequence Diagrams (main flows)

The following sequence diagrams illustrate the implemented end-to-end flows: Upload → Process → Analyze → Charts → Insights.

```mermaid
sequenceDiagram
    participant Client
    participant UploadAPI as /upload
    participant JobManager as JobManager
    participant FileProcessor as process_file(task)
    participant AnalyzeAPI as /analyze
    participant EDAAgent as run_eda(task)
    participant ChartsAPI as /charts
    participant ChartsAgent as generate_charts(task)
    participant InsightsAPI as /insights
    participant InsightsAgent as generate_insights(task)

    Client->>UploadAPI: POST /upload (file)
    UploadAPI->>JobManager: create_job(job_id)
    UploadAPI->>FileProcessor: process_file(job_id, content, filename)
    FileProcessor->>JobManager: save_job_data(job_id, payload)
    FileProcessor->>JobManager: update_job_status(job_id, completed)

    Client->>AnalyzeAPI: POST /analyze (job_id)
    AnalyzeAPI->>JobManager: create_analysis(analysis_id)
    AnalyzeAPI->>EDAAgent: run_eda(analysis_id)
    EDAAgent->>JobManager: get_job_data(job_id)
    EDAAgent->>JobManager: save_analysis(analysis_id, eda)
    EDAAgent->>JobManager: update_analysis_status(analysis_id, completed)

    Client->>ChartsAPI: POST /charts (analysis_id)
    ChartsAPI->>ChartsAgent: generate_charts(analysis_id)
    ChartsAgent->>JobManager: save_charts(analysis_id, charts)

    Client->>InsightsAPI: POST /insights (analysis_id)
    InsightsAPI->>InsightsAgent: generate_insights(analysis_id)
    InsightsAgent->>JobManager: save_insights(analysis_id, insights)

```

---

## OpenAPI & cURL Examples

Base URL: `http://localhost:8000` (adjust port as needed when running the FastAPI app)

- Upload file (CSV/Excel) — create a job and start file processing

```bash
curl -X POST "http://localhost:8000/upload" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@/path/to/data.csv"
```

Response (example):

```json
{ "job_id": "<uuid>", "message": "File uploaded and processed successfully" }
```

- Analyze job — start EDA for a processed job

```bash
curl -X POST "http://localhost:8000/analyze" \
  -H "Content-Type: application/json" \
  -d '{"job_id":"<job_id>"}'
```

Response (example):

```json
{ "analysis_id": "<uuid>", "message": "EDA completed", "preprocessing": {...} }
```

- Get analysis results

```bash
curl "http://localhost:8000/analyze/<analysis_id>"
```

- Generate charts (trigger and fetch saved charts)

```bash
curl -X POST "http://localhost:8000/charts" \
  -H "Content-Type: application/json" \
  -d '{"analysis_id":"<analysis_id>"}'

curl "http://localhost:8000/charts/<analysis_id>"
```

- Generate insights (trigger LLM or fallback synthetic insights)

```bash
curl -X POST "http://localhost:8000/insights" \
  -H "Content-Type: application/json" \
  -d '{"analysis_id":"<analysis_id>"}'

curl "http://localhost:8000/insights/<analysis_id>"
```

- Export analysis or auto-generated Python reproduction script

```bash
curl "http://localhost:8000/export/analysis/<analysis_id>"

curl "http://localhost:8000/export/python/<analysis_id>" -o analysis_<id>.py
```

- Connect to database and load table (example)

```bash
curl -X POST "http://localhost:8000/connect-db" \
  -H "Content-Type: application/json" \
  -d '{"connection_string":"postgresql://user:pass@host/db","db_type":"postgres"}'

# To load a table
curl -X POST "http://localhost:8000/connect-db/load-table" \
  -H "Content-Type: application/json" \
  -d '{"connection_string":"postgresql://user:pass@host/db","db_type":"postgres","table":"my_table","limit":1000}'
```

- Status endpoints

```bash
curl "http://localhost:8000/status/job/<job_id>"
curl "http://localhost:8000/status/analysis/<analysis_id>"
curl "http://localhost:8000/status/analyses"
```

- Authentication (signup, login, get current user)

Sign up:

```bash
curl -X POST "http://localhost:8000/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"secret"}'
```

Login:

```bash
curl -X POST "http://localhost:8000/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"secret"}'
```

Use token for protected endpoint:

```bash
curl "http://localhost:8000/auth/me" -H "Authorization: Bearer <access_token>"
```

---

Notes:
- Replace `<job_id>` and `<analysis_id>` with actual UUIDs returned by endpoints.
- The FastAPI app must be running (`uvicorn app.main:app --reload` from `backend` or similar) and ports adjusted to match your setup.

---

I've added sequence diagrams and OpenAPI/cURL examples to this documentation and updated the TODOs accordingly.

-- =============================================================================
-- TIRP Power BI SQL Views
-- Star schema design for Power BI Desktop / Power BI Service
--
-- Connection: Direct Query or Import mode
-- Refresh: Incremental on vw_fact_time_entries using date_key
-- =============================================================================

-- ─── Dimension: Date Spine ───────────────────────────────────────────────────
-- Pre-generated date dimension (2020-01-01 to 2030-12-31)
-- No dependency on data — always complete

CREATE OR REPLACE VIEW vw_dim_date AS
WITH date_series AS (
  SELECT generate_series(
    '2020-01-01'::date,
    '2030-12-31'::date,
    '1 day'::interval
  )::date AS date_day
)
SELECT
  TO_CHAR(date_day, 'YYYYMMDD')::integer       AS date_key,
  date_day                                       AS date,
  EXTRACT(YEAR FROM date_day)::integer           AS year,
  EXTRACT(QUARTER FROM date_day)::integer        AS quarter,
  EXTRACT(MONTH FROM date_day)::integer          AS month_num,
  TO_CHAR(date_day, 'Month')                     AS month_name,
  TO_CHAR(date_day, 'Mon')                       AS month_short,
  EXTRACT(WEEK FROM date_day)::integer           AS iso_week,
  EXTRACT(DOW FROM date_day)::integer            AS day_of_week,    -- 0=Sun, 6=Sat
  TO_CHAR(date_day, 'Day')                       AS day_name,
  CASE WHEN EXTRACT(DOW FROM date_day) IN (0, 6) THEN FALSE ELSE TRUE END AS is_weekday,
  DATE_TRUNC('week', date_day)::date             AS week_start_monday,
  DATE_TRUNC('month', date_day)::date            AS month_start,
  DATE_TRUNC('quarter', date_day)::date          AS quarter_start,
  DATE_TRUNC('year', date_day)::date             AS year_start,
  TO_CHAR(date_day, 'YYYY-"Q"Q')                AS year_quarter,
  TO_CHAR(date_day, 'YYYY-MM')                   AS year_month
FROM date_series;

-- ─── Dimension: User ─────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW vw_dim_user AS
SELECT
  u.id                                    AS user_key,
  u.email,
  u.name                                  AS full_name,
  u.title,
  u.department,
  u.role,
  u."weeklyTarget"                        AS weekly_target_hours,
  u."isActive"                            AS is_active,
  mgr.id                                  AS manager_key,
  mgr.name                                AS manager_name,
  mgr.email                               AS manager_email,
  mgr.title                               AS manager_title,
  l2.id                                   AS level2_manager_key,
  l2.name                                 AS level2_manager_name,
  l3.id                                   AS level3_manager_key,
  l3.name                                 AS level3_manager_name,
  cc.id                                   AS cost_center_key,
  cc.name                                 AS cost_center_name,
  cc.code                                 AS cost_center_code,
  u."createdAt"                           AS user_created_at
FROM users u
LEFT JOIN users mgr  ON mgr.id  = u."managerId"
LEFT JOIN users l2   ON l2.id   = mgr."managerId"
LEFT JOIN users l3   ON l3.id   = l2."managerId"
LEFT JOIN cost_centers cc ON cc.id = u."costCenterId";

-- ─── Dimension: Project ───────────────────────────────────────────────────────

CREATE OR REPLACE VIEW vw_dim_project AS
SELECT
  p.id          AS project_key,
  p.name        AS project_name,
  p.code        AS project_code,
  p.status      AS project_status,
  p.capital     AS is_capital,
  p.color       AS project_color,
  p."createdAt" AS project_created_at
FROM projects p;

-- ─── Dimension: Organisation (Org Tree) ──────────────────────────────────────

CREATE OR REPLACE VIEW vw_dim_org AS
WITH RECURSIVE org_tree AS (
  -- Roots (no manager)
  SELECT
    u.id,
    u.name,
    u.email,
    u.title,
    u.role,
    u."managerId",
    0 AS depth,
    u.id::text AS path
  FROM users u
  WHERE u."managerId" IS NULL

  UNION ALL

  SELECT
    u.id,
    u.name,
    u.email,
    u.title,
    u.role,
    u."managerId",
    ot.depth + 1,
    ot.path || ' > ' || u.id::text
  FROM users u
  JOIN org_tree ot ON ot.id = u."managerId"
)
SELECT
  id        AS user_key,
  name      AS full_name,
  email,
  title,
  role,
  "managerId" AS manager_key,
  depth     AS org_depth,
  path      AS org_path
FROM org_tree;

-- ─── Fact Table: Time Entries ─────────────────────────────────────────────────
-- Central fact table. Optimized for star schema joins.

CREATE OR REPLACE VIEW vw_fact_time_entries AS
SELECT
  te.id                                           AS entry_key,
  TO_CHAR(te.date, 'YYYYMMDD')::integer           AS date_key,
  te.date                                         AS entry_date,
  te."userId"                                     AS user_key,
  te."projectId"                                  AS project_key,
  te."initiativeId"                               AS initiative_key,
  te."categoryId"                                 AS category_key,
  te."timesheetId"                                AS timesheet_key,
  te.hours::float                                 AS hours,
  te.status                                       AS entry_status,
  te.source                                       AS entry_source,
  -- Denormalized for convenience (reduces join depth in Power BI)
  u.name                                          AS user_name,
  u.email                                         AS user_email,
  u.department                                    AS user_department,
  u.title                                         AS user_title,
  mgr.name                                        AS manager_name,
  cc.name                                         AS cost_center_name,
  cc.code                                         AS cost_center_code,
  p.name                                          AS project_name,
  p.code                                          AS project_code,
  p.capital                                       AS is_capital,
  ini.name                                        AS initiative_name,
  cat.name                                        AS category_name,
  cat.code                                        AS category_code,
  ts."weekStart"                                  AS timesheet_week_start,
  ts.status                                       AS timesheet_status,
  te."createdAt"                                  AS created_at,
  te."updatedAt"                                  AS updated_at
FROM time_entries te
JOIN users u         ON u.id = te."userId"
JOIN projects p      ON p.id = te."projectId"
JOIN categories cat  ON cat.id = te."categoryId"
LEFT JOIN users mgr          ON mgr.id = u."managerId"
LEFT JOIN cost_centers cc    ON cc.id = u."costCenterId"
LEFT JOIN initiatives ini    ON ini.id = te."initiativeId"
LEFT JOIN timesheets ts      ON ts.id = te."timesheetId";

-- ─── Summary: Weekly ─────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW vw_time_summary_weekly AS
SELECT
  DATE_TRUNC('week', te.date)::date               AS week_start,
  TO_CHAR(DATE_TRUNC('week', te.date), 'YYYY-"W"IW') AS iso_week_label,
  te."userId"                                     AS user_key,
  u.name                                          AS user_name,
  u.department,
  mgr.name                                        AS manager_name,
  te."projectId"                                  AS project_key,
  p.code                                          AS project_code,
  p.name                                          AS project_name,
  te."categoryId"                                 AS category_key,
  cat.name                                        AS category_name,
  te.status,
  SUM(te.hours)::float                            AS total_hours,
  COUNT(*)                                        AS entry_count
FROM time_entries te
JOIN users u         ON u.id = te."userId"
JOIN projects p      ON p.id = te."projectId"
JOIN categories cat  ON cat.id = te."categoryId"
LEFT JOIN users mgr  ON mgr.id = u."managerId"
GROUP BY
  DATE_TRUNC('week', te.date),
  te."userId", u.name, u.department,
  mgr.name,
  te."projectId", p.code, p.name,
  te."categoryId", cat.name,
  te.status;

-- ─── Summary: Monthly ────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW vw_time_summary_monthly AS
SELECT
  DATE_TRUNC('month', te.date)::date              AS month_start,
  TO_CHAR(te.date, 'YYYY-MM')                     AS year_month,
  EXTRACT(YEAR FROM te.date)::integer             AS year,
  EXTRACT(MONTH FROM te.date)::integer            AS month_num,
  te."userId"                                     AS user_key,
  u.name                                          AS user_name,
  u.department,
  mgr.id                                          AS manager_key,
  mgr.name                                        AS manager_name,
  cc.name                                         AS cost_center_name,
  te."projectId"                                  AS project_key,
  p.code                                          AS project_code,
  p.name                                          AS project_name,
  p.capital                                       AS is_capital,
  te."categoryId"                                 AS category_key,
  cat.name                                        AS category_name,
  te.status,
  SUM(te.hours)::float                            AS total_hours,
  COUNT(*)                                        AS entry_count,
  u."weeklyTarget"::float * 4.33                  AS monthly_target_hours
FROM time_entries te
JOIN users u         ON u.id = te."userId"
JOIN projects p      ON p.id = te."projectId"
JOIN categories cat  ON cat.id = te."categoryId"
LEFT JOIN users mgr  ON mgr.id = u."managerId"
LEFT JOIN cost_centers cc ON cc.id = u."costCenterId"
GROUP BY
  DATE_TRUNC('month', te.date),
  TO_CHAR(te.date, 'YYYY-MM'),
  EXTRACT(YEAR FROM te.date),
  EXTRACT(MONTH FROM te.date),
  te."userId", u.name, u.department, u."weeklyTarget",
  mgr.id, mgr.name,
  cc.name,
  te."projectId", p.code, p.name, p.capital,
  te."categoryId", cat.name,
  te.status;

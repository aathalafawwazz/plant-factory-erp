# Plant Factory ERP — SARC UGM

Sistem Manajemen Plant Factory berbasis web untuk Smart Agriculture Research Center (SARC), Universitas Gadjah Mada.

## Tech Stack

- **Frontend:** Next.js 16 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui
- **Backend:** Supabase (PostgreSQL + Auth + RLS)
- **Deployment:** Vercel (frontend), Supabase Cloud (backend)

## Getting Started

### 1. Clone & Install

```bash
git clone <repo-url>
cd plant-factory-erp
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the migration file:
   - `supabase/migrations/00001_initial_schema.sql`
3. Then run the seed file:
   - `supabase/seed.sql`
4. Copy your project URL and anon key from Settings > API

### 3. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Create First User

In Supabase Dashboard > Authentication > Users, create a new user with email/password. The `profiles` table will auto-populate via trigger.

To set admin role, run in SQL Editor:

```sql
UPDATE profiles SET role = 'admin' WHERE id = '<user-uuid>';
```

### 5. Run Dev Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
  app/
    (auth)/login/          Login page
    (dashboard)/           Authenticated app shell
      page.tsx             Dashboard
      lubang/              Hole management + rack map
      tanam/               Planting cycles
      lingkungan/          Environmental logs
  components/
    rack-map.tsx           Interactive rack visualization
    hole-detail-panel.tsx  Hole detail slide-over
    nav-sidebar.tsx        Navigation (mobile bottom + desktop sidebar)
    status-badge.tsx       Color-coded status badges
    ui/                    shadcn/ui components
  lib/
    supabase/              Supabase client (browser + server)
    types/database.ts      TypeScript types for all tables
    constants.ts           Status configs, rack layout, nav items
supabase/
  migrations/              SQL migration files
  seed.sql                 480 holes + crop catalog seed data
```

## Physical Layout

- 2 racks (A, B) x 3 tiers x 4 lanes x 20 holes = **480 planting holes**
- Hole ID format: `A-2-3-15` = Rak A, Tingkat 2, Lajur 3, Lubang 15

## Roles

| Role     | Access                                    |
|----------|-------------------------------------------|
| admin    | Full access + user management             |
| operator | Input planting events, env logs, harvests |
| viewer   | Read-only access (for PI/supervisor)      |

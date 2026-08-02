export interface DocFileInfo {
  filename: string;
  title: string;
  description: string;
  icon: string;
}

export const DOC_SUITE_FILES: DocFileInfo[] = [
  {
    filename: "SUMMARY.md",
    title: "1. Executive Summary & Index",
    description: "Ringkasan proyek, daftar modul, tech stack, & link referensi ke seluruh dokumen.",
    icon: "FileText",
  },
  {
    filename: "PRD.md",
    title: "2. Product Requirement Document",
    description: "Dokumen PRD utama lengkap (Problem, Goals, User Persona, Requirements, Criteria).",
    icon: "ClipboardText",
  },
  {
    filename: "MODULES.md",
    title: "3. Deep Module Breakdown",
    description: "Pendalaman detail per modul, workflow, izin role, & UI Requirement.",
    icon: "SquaresFour",
  },
  {
    filename: "BUSINESS_RULES.md",
    title: "4. Business Rules Specification",
    description: "Aturan bisnis komprehensif (Global, Validation, Pricing, Finance, Approval, Restriction).",
    icon: "ShieldCheck",
  },
  {
    filename: "FLOWS.md",
    title: "5. Business & System Flows",
    description: "Alur kerja sistem (Business Flow, User Flow, Approval Flow, State Transitions).",
    icon: "GitFork",
  },
  {
    filename: "DATABASE.md",
    title: "6. Database Blueprint & ERD",
    description: "Skema database (Entity, Table, Field, Type, PK/FK, Index, Enum, Relasi, Migration).",
    icon: "Database",
  },
  {
    filename: "API.md",
    title: "7. REST API Documentation",
    description: "Spesifikasi Endpoint API (Method, Body, Response, Auth, Validation, Errors, Pagination).",
    icon: "CodeBlock",
  },
  {
    filename: "UI_GUIDELINE.md",
    title: "8. UI/UX Design System",
    description: "Standar antarmuka (Design System, Palette, Typography, Components, States).",
    icon: "Palette",
  },
  {
    filename: "SECURITY.md",
    title: "9. Security Architecture",
    description: "Protokol Keamanan (Auth, RBAC, JWT, Rate Limiting, OWASP Protection, Audit Log).",
    icon: "Lock",
  },
  {
    filename: "TESTING.md",
    title: "10. Test Suite & QA Blueprint",
    description: "Dokumentasi Pengujian (Acceptance, Positive/Negative, Edge Case, UAT, Smoke Test).",
    icon: "CheckSquareOffset",
  },
  {
    filename: "ARCHITECTURE.md",
    title: "11. System Architecture",
    description: "Arsitektur Sistem (High Level, Layer Architecture, Folder Structure, Event & Cache).",
    icon: "Kanban",
  },
  {
    filename: "CODING_GUIDELINES.md",
    title: "12. Coding Standards",
    description: "Standar Kode & Konvensi (Naming, Folder Structure, Clean Code, SOLID, Commits).",
    icon: "TerminalWindow",
  },
  {
    filename: "AI_RULES.md",
    title: "13. AI Agent Rules & Context",
    description: "Aturan konteks khusus AI Coding Tools (Cursor, Windsurf, Claude Code, Copilot).",
    icon: "Robot",
  },
  {
    filename: "ROADMAP.md",
    title: "14. Product Roadmap & Timeline",
    description: "Rencana pengembangan, prioritas versi, milestone, & estimasi waktu pengerjaan.",
    icon: "TrendUp",
  },
  {
    filename: "CHANGELOG.md",
    title: "15. Changelog & Version Log",
    description: "Riwayat perubahan versi (Added, Changed, Fixed, Deprecated).",
    icon: "ClockCounterClockwise",
  },
  {
    filename: "DEPLOYMENT.md",
    title: "16. DevOps & Deployment Blueprint",
    description: "Panduan Deployment (Docker, CI/CD, Env Vars, Reverse Proxy, Backup, Monitoring).",
    icon: "CloudArrowUp",
  },
];

export function getDocPrompt(filename: string, prdContent: string, projectBrief?: string): string {
  const baseContext = `
--- KONTEKS DOKUMEN PRD UTAMA ---
${prdContent}

${projectBrief ? `--- BRIEF AWAL PROYEK ---\n${projectBrief}\n` : ""}
`;

  const commonInstruction = `
INSTRUKSI UTAMA HASIL:
1. Buatlah dokumen Markdown (.md) yang sangat profesional, detail, terstruktur rapi, dan komprehensif tanpa memotong informasi penting.
2. Gunakan Bahasa Indonesia profesional teknis (terutama istilah industri software engineering yang umum).
3. Jika terdapat informasi detail yang belum disebutkan secara spesifik dalam PRD di atas, berikan asumsi teknis yang masuk akal dan tandai sebagai **[Assumption]** agar pengguna dapat meninjaunya.
4. Sertakan tautan navigasi Markdown antar dokumen (misal: [PRD.md](file:///PRD.md), [DATABASE.md](file:///DATABASE.md)) untuk keterhubungan antar dokumen.
`;

  switch (filename) {
    case "SUMMARY.md":
      return `${baseContext}
Hasilkan dokumen **SUMMARY.md** yang menjadi entry point utama seluruh paket dokumentasi proyek ini.
${commonInstruction}

DOKUMEN WAJIB MEMILIKI SEKSI EKSPLISIT:
# 📌 Master Project Summary & Documentation Index
1. **Nama Project & Metadata**
2. **Deskripsi Singkat Proyek**
3. **Tujuan Utama Sistem**
4. **Target Pengguna & Stakeholders**
5. **Value Proposition**
6. **Tech Stack Rekomendasi (Frontend, Backend, Database, Cloud/Infra)**
7. **Arsitektur Singkat Systems**
8. **Daftar Ringkasan Seluruh Modul**
9. **Project Scope (In-Scope & Out-of-Scope)**
10. **Index Tautan Navigasi Dokumentasi (Tautan ke 15 File .md Lainnya)**
`;

    case "PRD.md":
      return `${baseContext}
Hasilkan dokumen **PRD.md** (Product Requirement Document) lengkap dan komprehensif.
${commonInstruction}

DOKUMEN WAJIB MEMILIKI SEKSI EKSPLISIT:
# 📋 Product Requirement Document (PRD)
1. **Executive Summary**
2. **Background & Market Need**
3. **Problem Statement**
4. **Goals & Core Value**
5. **Measurable Objectives & KPIs**
6. **User Personas (Minimal 2-3 Persona)**
7. **User Stories (Tabel format: As a [role], I want [feature], So that [benefit])**
8. **Functional Requirements (Daftar fitur detail bertingkat)**
9. **Non-Functional Requirements (Performance, Scalability, Availability, Security)**
10. **Scope & Out of Scope**
11. **Success Metrics**
12. **Acceptance Criteria & Definition of Done**
13. **Future Considerations**
`;

    case "MODULES.md":
      return `${baseContext}
Hasilkan dokumen **MODULES.md** yang membedah seluruh modul sistem secara mendalam.
${commonInstruction}

DOKUMEN WAJIB MEMILIKI SEKSI EKSPLISIT:
# 📦 Detailed Module Architecture & Sub-Feature Breakdown
Rincikan setiap modul utama dalam aplikasi dengan struktur wajib per modul:
- **Tujuan Modul**
- **Deskripsi Operasional**
- **Daftar Menu & Sub-Menu**
- **Daftar Fitur Detail**
- **Workflow Modul**
- **User Role & Hak Akses (Permissions)**
- **Business Rules Modul**
- **Validasi Data & Input Constraints**
- **Status Lifecycle (State Transitions)**
- **Integrasi dengan Modul Lain**
- **UI & UX Requirements**
- **Future Enhancements**
`;

    case "BUSINESS_RULES.md":
      return `${baseContext}
Hasilkan dokumen **BUSINESS_RULES.md** yang memuat seluruh aturan bisnis aplikasi.
${commonInstruction}

DOKUMEN WAJIB MENGELOMPOKKAN ATURAN SECARA EKSPLISIT KEDALAM SEKSI:
# 📜 Comprehensive Business Rules Specification
1. **Global Rules (Aturan Umum Sistem)**
2. **Module-Specific Rules**
3. **Validation & Input Rules**
4. **Pricing, Calculation & Tariff Rules** (jika ada transaksi/biaya)
5. **Inventory / Data Management Rules**
6. **Finance & Transaction Rules**
7. **Accounting & Reconciliation Rules**
8. **Approval & Authorization Rules**
9. **Automation & Scheduled System Rules**
10. **Restriction & Prohibition Rules (Batasan & Larangan)**
`;

    case "FLOWS.md":
      return `${baseContext}
Hasilkan dokumen **FLOWS.md** yang memuat seluruh alur bisnis dan alur pengguna secara langkah demi langkah.
${commonInstruction}

DOKUMEN WAJIB MEMILIKI SEKSI EKSPLISIT:
# 🔄 Business Flows & User Journey Blueprint
1. **End-to-End Business Flow (Langkah 1 s/d Selesai)**
2. **Detailed User Journey & Screen Flows**
3. **Approval & Authorization Flows**
4. **State Transition Flows (Siklus hidup entitas data)**
5. **Alternative Flows (Jalur Alternatif)**
6. **Exception & Error Handling Flows (Kondisi Gagal / Error)**
Sertakan diagram berbasis teks atau format langkah bernomor yang terstruktur.
`;

    case "DATABASE.md":
      return `${baseContext}
Hasilkan dokumen **DATABASE.md** yang menjadi blueprint lengkap arsitektur database.
${commonInstruction}

DOKUMEN WAJIB MEMILIKI SEKSI EKSPLISIT:
# 🗄️ Database Blueprint & Schema Specifications
1. **Entity Overview & ERD Logic**
2. **Daftar Tabel & Kolom Detail (Tabel Markdown berisi: Field Name, Data Type, Primary/Foreign Key, Nullable, Default, Description)**
3. **Primary Key & Foreign Key Relationships**
4. **Indexes & Performance Optimization Constraints**
5. **Custom Enums & Constant Values**
6. **Relationship Rules (One-to-One, One-to-Many, Many-to-Many)**
7. **Data Normalization Notes & Integrity Triggers**
8. **Initial Migration Blueprint SQL / ORM Schema Notes**
`;

    case "API.md":
      return `${baseContext}
Hasilkan dokumen **API.md** yang berisi dokumentasi RESTful API lengkap.
${commonInstruction}

DOKUMEN WAJIB MEMILIKI SEKSI EKSPLISIT:
# 🔌 RESTful API Documentation & Endpoint Specification
Untuk setiap endpoint (Auth, User, Transactions, Modules), jabarkan:
- **Endpoint Path & HTTP Method** (misal: \`POST /api/v1/auth/login\`)
- **Deskripsi Endpoint**
- **Authentication & Authorization Scope Required**
- **Request Parameters & Body Payload (JSON Example)**
- **Validasi Input**
- **Response Success (200/201 JSON Example)**
- **Response Error (400, 401, 403, 404, 422, 500 JSON Examples)**
- **Pagination, Filtering & Sorting Parameters**
`;

    case "UI_GUIDELINE.md":
      return `${baseContext}
Hasilkan dokumen **UI_GUIDELINE.md** yang mengatur standar desain dan komponen antarmuka.
${commonInstruction}

DOKUMEN WAJIB MEMILIKI SEKSI EKSPLISIT:
# 🎨 UI/UX Design System & Interface Guidelines
1. **Design Principles & Visual Aesthetics**
2. **Color Palette Tokens (Primary, Accent, Background, Surface, Muted, Error, Success)**
3. **Typography Standard & Heading Hierarchy**
4. **Layout Grid, Spacing & Breakpoints (sm, md, lg, xl)**
5. **Core UI Components Standard (Buttons, Forms, Inputs, Cards, Tables)**
6. **Interactive Overlays (Modals, Drawers, Toast Notifications)**
7. **UI Component States (Default, Hover, Active, Disabled, Loading, Empty State, Error State)**
8. **Responsive Design Rules & Mobile Overrides**
`;

    case "SECURITY.md":
      return `${baseContext}
Hasilkan dokumen **SECURITY.md** yang menetapkan arsitektur keamanan aplikasi.
${commonInstruction}

DOKUMEN WAJIB MEMILIKI SEKSI EKSPLISIT:
# 🔒 Security Architecture & Compliance Guidelines
1. **Authentication Strategy (JWT, Session, Refresh Tokens)**
2. **Authorization & RBAC (Role-Based Access Control) Matrix**
3. **Password Policy & Hashing Strategy (Argon2 / bcrypt)**
4. **Token Security & Lifecycle Management**
5. **Audit Logging & Activity Tracking**
6. **Rate Limiting & DDoS Prevention Policies**
7. **CSRF & XSS Prevention Strategies**
8. **SQL Injection & Data Sanitization**
9. **Data Encryption Standard (At Rest & In Transit TLS 1.3)**
10. **Security Checklist for Production Deployment**
`;

    case "TESTING.md":
      return `${baseContext}
Hasilkan dokumen **TESTING.md** yang berisi skenario dan skema pengujian QA.
${commonInstruction}

DOKUMEN WAJIB MEMILIKI SEKSI EKSPLISIT:
# 🧪 Quality Assurance & Comprehensive Test Suite
1. **Test Strategy Overview (Unit, Integration, E2E, UAT)**
2. **Acceptance Test Cases (Tabel: ID, Scenario, Pre-condition, Action, Expected Result)**
3. **Positive Test Scenarios**
4. **Negative Test Scenarios & Edge Cases**
5. **Integration & API Test Cases**
6. **Regression Testing Plan**
7. **UAT (User Acceptance Testing) Checklist**
8. **Smoke Testing Checklist before Release**
`;

    case "ARCHITECTURE.md":
      return `${baseContext}
Hasilkan dokumen **ARCHITECTURE.md** yang mendokumentasikan struktur dan arsitektur sistem.
${commonInstruction}

DOKUMEN WAJIB MEMILIKI SEKSI EKSPLISIT:
# 🏗️ System Architecture & Engineering Blueprint
1. **High-Level System Architecture Diagram & Description**
2. **Layer Architecture (Presentation, Business Logic, Data Access)**
3. **Recommended Folder & Directory Structure**
4. **Service & Repository Pattern Implementation**
5. **Dependency Flow & Injection Principles**
6. **Event-Driven Architecture & Message Queue (jika ada)**
7. **Caching Strategy (Redis / Memory)**
8. **Storage Architecture & Asset Management**
`;

    case "CODING_GUIDELINES.md":
      return `${baseContext}
Hasilkan dokumen **CODING_GUIDELINES.md** yang berisi aturan dan konvensi penulisan kode.
${commonInstruction}

DOKUMEN WAJIB MEMILIKI SEKSI EKSPLISIT:
# 💻 Engineering Standards & Coding Guidelines
1. **Naming Conventions (Variables, Functions, Components, Files, Classes)**
2. **Folder & Module Conventions**
3. **Component Architecture Rules**
4. **Clean Code & Refactoring Rules**
5. **SOLID & DRY Principles Application**
6. **Global Error Handling & Exception Standards**
7. **Structured Logging Standards**
8. **Git Commit Conventions (Conventional Commits: feat, fix, docs, refactor)**
9. **Git Branching Strategy (main, develop, feature/*, hotfix/*)**
`;

    case "AI_RULES.md":
      return `${baseContext}
Hasilkan dokumen **AI_RULES.md** khusus sebagai instruksi dan konteks permanen bagi AI Coding Assistant (Cursor, Windsurf, Claude Code, GitHub Copilot).
${commonInstruction}

DOKUMEN WAJIB MEMILIKI SEKSI EKSPLISIT:
# 🤖 Permanent AI Coding Assistant Rules & Directives
1. **Core Behavioral Guidelines for AI Coding Agents**
2. **Strict Rules (NO Duplicates, Use Reusable Components, Strict TypeScript, Environment Variables)**
3. **Architecture & File Location Constraints**
4. **Error Handling & Anti-Pattern Prohibition**
5. **Code Style & Formatting Mandates**
6. **Database & API Mutation Guardrails**
7. **Context Injection Rules for Prompting**
Dokumen ini dibuat khusus agar pengguna bisa menyalinnya langsung sebagai system prompt di .cursorrules / AGENTS.md.
`;

    case "ROADMAP.md":
      return `${baseContext}
Hasilkan dokumen **ROADMAP.md** yang berisi rencana timeline dan rilis versi.
${commonInstruction}

DOKUMEN WAJIB MEMILIKI SEKSI EKSPLISIT:
# 🗺️ Product Roadmap & Release Milestones
1. **Product Development Phases & Versions (v1.0 MVP, v1.5, v2.0)**
2. **Feature Prioritization Matrix (Must-Have, Should-Have, Could-Have)**
3. **Detailed Milestone Schedule & Deliverables**
4. **Timeline & Resource Allocation Matrix**
`;

    case "CHANGELOG.md":
      return `${baseContext}
Hasilkan dokumen **CHANGELOG.md** yang memuat riwayat iterasi dan perubahan proyek.
${commonInstruction}

DOKUMEN WAJIB MEMILIKI SEKSI EKSPLISIT:
# 📜 Project Changelog & Version History
1. **Changelog Standards (Keep a Changelog format)**
2. **Initial Version v1.0.0 Release Notes**
3. **Categorized Log Structure (Added, Changed, Deprecated, Removed, Fixed, Security)**
`;

    case "DEPLOYMENT.md":
      return `${baseContext}
Hasilkan dokumen **DEPLOYMENT.md** yang mendokumentasikan skema deployment dan DevOps.
${commonInstruction}

DOKUMEN WAJIB MEMILIKI SEKSI EKSPLISIT:
# 🚀 Deployment, Infrastructure & DevOps Blueprint
1. **Environment Configuration (Development, Staging, Production)**
2. **Required Environment Variables Matrix (Name, Type, Sample, Description)**
3. **Docker & Containerization Setup (Dockerfile & docker-compose.yml notes)**
4. **CI/CD Pipeline Workflow (GitHub Actions / GitLab CI)**
5. **Minimum Server & Cloud Infrastructure Requirements**
6. **Reverse Proxy (Nginx / Caddy) & SSL Configuration**
7. **Background Workers, Queue & Storage Setup**
8. **Backup, Database Dump & Disaster Recovery Plan**
9. **System Monitoring, Healthcheck & Logging Setup**
10. **Pre-Flight Production Deployment Checklist**
`;

    default:
      return `${baseContext}\nHasilkan dokumentasi teknis ${filename} secara lengkap, terstruktur, dan menggunakan format Markdown yang rapi.`;
  }
}

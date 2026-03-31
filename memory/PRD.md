# ParkGuard - Product Requirements Document

## Original Problem Statement
Build a complete production-ready frontend for ParkGuard - a smart parking solution using QR codes, real-time notifications, VoIP calling, and e-commerce. Connects to a Node.js + Express + PostgreSQL backend.

## Architecture
- **Frontend**: React CRA (Emergent env) with Tailwind CSS, Zustand, Axios, shadcn-ui
- **Backend (Mock)**: FastAPI mimicking Node.js Express API responses using MongoDB
- **Real Backend**: Node.js + Express + PostgreSQL (user-deployed separately)

## User Personas
- **Vehicle Owner**: Registers vehicles, views QR codes, manages incidents
- **Public Scanner**: Scans QR codes, reports incidents, contacts owners
- **Admin**: Manages products, orders, users, views analytics

## What's Been Implemented (2026-03-31)
- [x] Mock backend (FastAPI) with all API endpoints matching Node.js backend
- [x] Core library: API client (`lib/api.js`), Zustand stores (`lib/store.js`), Socket.IO client (`lib/socket.js`)
- [x] Seeded test data (admin user, test user, 5 QR sticker products, test vehicle)
- [x] Deployment readiness: all env vars, query optimizations, no hardcoded values

## Prioritized Backlog
### P0 - Critical (Next)
- [ ] All frontend pages (Landing, Login, Register, Dashboard, Vehicles, Scanner, Shop, Orders, Incidents, Profile, Admin)
- [ ] Layout components (Navbar, Sidebar, DashboardLayout)
- [ ] Protected routes with auth guards

### P1 - Important
- [ ] Real-time notification dropdown
- [ ] Stripe checkout integration
- [ ] QR code rendering and download
- [ ] Incident reporting form

### P2 - Nice to Have
- [ ] Dark mode
- [ ] PWA support
- [ ] Camera-based QR scanner
- [ ] Map integration for incidents
- [ ] Framer Motion animations

## Next Tasks
1. Build all frontend pages and components
2. Implement routing with react-router-dom
3. Style per design guidelines (Swiss & High-Contrast archetype)
4. Test with testing agent

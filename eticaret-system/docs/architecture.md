# Architecture

This document describes the high-level architecture for the e-commerce system.

## Structure

- `apps/web`: Customer-facing and admin web application.
- `apps/api`: API service for commerce operations.
- `apps/worker`: Background jobs and asynchronous processing.
- `packages/database`: Database schema, migrations, and data access helpers.
- `packages/integrations`: Third-party provider integrations.
- `packages/shared`: Shared types, utilities, and domain logic.
- `packages/ui`: Reusable UI components.

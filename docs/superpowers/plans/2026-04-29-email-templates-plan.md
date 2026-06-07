# Email Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Привести email-шаблоны AVATERRA к единому тёплому профессиональному стилю.

**Architecture:** Не меняем БД. Улучшаем дефолтные шаблоны, добавляем helper-функции для транзакционных писем и подключаем их к route-файлам.

**Tech Stack:** Next.js App Router, TypeScript, Prisma, `sendTransactionalEmail`, `wrapEmailHtml`.

---

## Tasks

- [x] Обновить дефолтные notification templates.
- [x] Добавить fallback-события и labels для админки.
- [x] Улучшить базовый шаблон массовой рассылки.
- [x] Добавить helper-функции `buildEmailVerificationEmail`, `buildPasswordResetEmail`, `buildTicketCreatedEmail`, `buildTicketManagerNotificationEmail`, `buildTicketAutoReplyEmail`.
- [x] Подключить helper-функции в `register`, `resend-verification`, `forgot-password`, `tickets`.
- [x] Подключить helper-функции в `contact`, `tickets/[id]/messages`, `admin/leads/convert`, `admin/settings/test-email`.
- [x] Обновить дефолтные платежные шаблоны в `lib/settings.ts`.
- [x] Добавить smoke-test `scripts/email-templates-smoke-test.ts`.
- [x] Запустить smoke-test, TypeScript и lints.

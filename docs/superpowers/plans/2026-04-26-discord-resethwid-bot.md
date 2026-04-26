# Discord Reset HWID Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Node.js Discord bot with a `/resethwid` slash command that privately resets a reseller user's HWID by username.

**Architecture:** Keep the bot lightweight. Store the slash command definition in a command module, isolate reseller HTTP requests in a service module, and keep bootstrapping plus interaction dispatch in the entrypoint. Validate allowed Discord user IDs before any reseller API calls.

**Tech Stack:** Node.js, discord.js, built-in `fetch`, Node test runner (`node:test`)

---

### Task 1: Create the reseller API client

**Files:**
- Create: `src/services/resellerApi.js`
- Test: `tests/resellerApi.test.js`

- [ ] **Step 1: Write failing tests** for username lookup, successful HWID reset, and API error propagation.
- [ ] **Step 2: Run** `node --test tests/resellerApi.test.js` and verify the tests fail for missing implementation.
- [ ] **Step 3: Implement** a minimal API client with `getUserIdByUsername` and `resetHwidByUserId`.
- [ ] **Step 4: Run** `node --test tests/resellerApi.test.js` and verify the tests pass.

### Task 2: Create command handler logic

**Files:**
- Create: `src/commands/resethwid.js`
- Test: `tests/resethwidCommand.test.js`

- [ ] **Step 1: Write failing tests** for unauthorized callers, user-not-found flow, success flow, and API failure flow.
- [ ] **Step 2: Run** `node --test tests/resethwidCommand.test.js` and verify the tests fail for missing implementation.
- [ ] **Step 3: Implement** the slash command definition plus handler logic with ephemeral responses only.
- [ ] **Step 4: Run** `node --test tests/resethwidCommand.test.js` and verify the tests pass.

### Task 3: Wire the bot runtime and command deployment

**Files:**
- Create: `src/config.js`
- Create: `src/index.js`
- Create: `src/deploy-commands.js`
- Create: `.env.example`
- Create: `package.json`
- Create: `README.md`

- [ ] **Step 1: Add a failing smoke test** for config parsing in `tests/config.test.js`.
- [ ] **Step 2: Run** `node --test tests/config.test.js` and verify the test fails for missing implementation.
- [ ] **Step 3: Implement** environment parsing, startup wiring, slash command deployment, and usage docs.
- [ ] **Step 4: Run** `node --test` and verify the full test suite passes.

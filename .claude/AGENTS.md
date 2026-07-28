# Claude Configuration & Agents Index

This directory (`.claude/`) contains agent system instructions, skill definitions, and guidance for AI assistants working within the `ERP-Automation` codebase.

## Agents (`.claude/agents/`)

- [QA Automation Engineer (`qa-engineer`)](file:///home/trootech/Documents/Project/Erpforce/ERP-Automation/.claude/agents/qa-engineer.md)
  - **Role**: Specialized AI agent for E2E Playwright test strategy, POM development, test case execution, and defect triage.

## Skills (`.claude/skills/`)

- [QA Playwright Test Creator (`qa-playwright-test-creator`)](file:///home/trootech/Documents/Project/Erpforce/ERP-Automation/.claude/skills/qa-playwright-test-creator/SKILL.md)
  - **Purpose**: Step-by-step workflow to scaffold Page Object Model classes, handle test data (`config/testData.js`), and write serial Playwright specs.

- [QA Test Case Generator (`qa-test-case-generator`)](file:///home/trootech/Documents/Project/Erpforce/ERP-Automation/.claude/skills/qa-test-case-generator/SKILL.md)
  - **Purpose**: Canonical rules for generating test checklists covering Core CRUD, Field Validations, Approval Workflows, and Listing Pages based on `DEFAULT_TEST_CASES.md`.

- [QA Bug Triage & Debugger (`qa-bug-triage-debugger`)](file:///home/trootech/Documents/Project/Erpforce/ERP-Automation/.claude/skills/qa-bug-triage-debugger/SKILL.md)
  - **Purpose**: Diagnostic protocol to analyze Playwright failures, debug auth/401 issues, fix dynamic dropdown timing bugs, and file defect reports.

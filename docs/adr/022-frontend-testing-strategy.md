# ADR-022: Frontend Testing Strategy

## Status
Accepted

## Date
2026-03-18

## Context
The frontend has 18 test files covering core hooks and components, but significant gaps remain. The actor, select, and anti-pattern modules have no tests. There are no end-to-end tests validating full user flows. There is no visual regression testing to catch unintended UI changes. Component documentation is informal — new developers must read source code to understand available components and their props. As the frontend grows with replay (ADR-017), export (ADR-018), and sharing (ADR-019) features, untested surface area increases the risk of regressions.

## Decision
Expand the frontend testing strategy across four tiers: unit/component tests, E2E tests, Storybook component documentation, and visual regression testing. Target 80%+ code coverage.

### Tier 1: Complete Unit and Component Test Coverage
Fill gaps in the existing Vitest + Testing Library test suite.

**Missing hook tests to add:**
- `use-actor-events.test.ts` — actor channel message routing, actor lifecycle
- `use-select-events.test.ts` — select clause matching, timeout handling
- `use-anti-patterns.test.ts` — GlobalScope detection, unstructured concurrency warnings
- `use-event-retention.test.ts` — event window sizing, cleanup behavior
- `use-keyboard-nav.test.ts` — focus management, keyboard shortcut handling

**Missing component tests to add:**
- `actors/ActorMailbox.test.tsx` — message queue rendering, capacity display
- `actors/ActorTimeline.test.tsx` — actor lifecycle visualization
- `select/SelectClauseView.test.tsx` — clause rendering, winner highlighting
- `anti-patterns/AntiPatternList.test.tsx` — warning display, severity levels
- `anti-patterns/AntiPatternDetail.test.tsx` — explanation and fix suggestion rendering
- `sync/DeadlockVisualization.test.tsx` — deadlock cycle rendering
- `validation-dashboard/*.test.tsx` — dashboard panels and rule results
- `ExceptionPropagationOverlay.test.tsx` — exception chain rendering
- `VirtualizedEventList.test.tsx` — virtual scrolling, large list performance

**Test patterns:**
```typescript
// Hook tests use renderHook from @testing-library/react
const { result } = renderHook(() => useActorEvents(mockSessionId));

// Component tests use render + user-event
render(<ActorMailbox actor={mockActor} messages={mockMessages} />);
expect(screen.getByText('inbox')).toBeInTheDocument();
await userEvent.click(screen.getByRole('button', { name: /expand/i }));
```

All new tests follow existing conventions: colocated with source files, using the mock data from `src/mocks/mock-data.ts`, extending the mock server as needed.

### Tier 2: Playwright E2E Tests
Add end-to-end tests for critical user flows using Playwright.

**Test directory:** `frontend/e2e/`

**Critical flows to test:**
1. **Session lifecycle:** Create session, verify it appears in list, navigate to detail view, delete session
2. **Scenario execution:** Select scenario, run it, verify events populate in EventsList, verify CoroutineTree renders nodes
3. **Panel interactions:** Switch between tabs (Events, Threads, Channels, Flow), verify each panel renders content
4. **Validation:** Run scenario with known violations, verify ValidationPanel shows warnings/errors
5. **Replay:** Open completed session, use replay controls (play, pause, step), verify panels update (ADR-017)
6. **Sharing:** Generate share link, open shared URL, verify read-only mode (ADR-019)

**Playwright configuration:**
```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:3000',
  },
  webServer: [
    {
      command: 'cd ../backend && ./gradlew run',
      port: 8080,
      reuseExistingServer: true,
    },
    {
      command: 'pnpm dev',
      port: 3000,
      reuseExistingServer: true,
    },
  ],
});
```

**NPM scripts:**
```json
{
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui",
  "test:e2e:headed": "playwright test --headed"
}
```

### Tier 3: Storybook Component Documentation
Add Storybook for interactive component documentation and development.

**Stories to create for each major panel:**
- `CoroutineTree.stories.tsx` — empty state, single coroutine, deep hierarchy, with cancellation
- `CoroutineTreeGraph.stories.tsx` — small graph, large graph, with animations
- `ThreadLanesView.stories.tsx` — single thread, multi-thread, with dispatcher labels
- `EventsList.stories.tsx` — empty, few events, many events (virtualized)
- `ChannelTimeline.stories.tsx` — unbuffered, buffered, closed channel
- `FlowOperatorChain.stories.tsx` — simple chain, complex chain with backpressure
- `ValidationPanel.stories.tsx` — no violations, warnings only, errors and warnings
- `DeadlockVisualization.stories.tsx` — no deadlock, simple cycle, complex cycle

Each story documents:
- Default props and states
- Interactive controls (Storybook Controls addon)
- Edge cases (empty data, error states, loading states)

**NPM scripts:**
```json
{
  "storybook": "storybook dev -p 6006",
  "build-storybook": "storybook build"
}
```

### Tier 4: Visual Regression with Chromatic
Use Chromatic (Storybook-based) for automated visual regression testing.

- Chromatic captures screenshots of every story on each PR
- Visual diffs are reviewed in the Chromatic UI
- CI blocks merging on unreviewed visual changes

**CI integration:**
```yaml
- name: Visual Regression
  run: npx chromatic --project-token=${{ secrets.CHROMATIC_TOKEN }}
```

### Coverage Targets
| Category | Current | Target |
|---|---|---|
| Hooks | ~60% | 90% |
| Components | ~40% | 80% |
| Overall | ~45% | 80% |
| E2E flows | 0 | 6 critical flows |
| Stories | 0 | 30+ stories |

### CI Integration
Update `ci-frontend.yml` to run the full test suite:

```yaml
jobs:
  test:
    steps:
      - run: pnpm test --coverage
      - run: pnpm test:e2e
      - run: npx chromatic --project-token=${{ secrets.CHROMATIC_TOKEN }}
```

Coverage reports are uploaded as CI artifacts and coverage thresholds are enforced (fail if below 80%).

## Alternatives Considered

### Cypress Instead of Playwright
Cypress is a mature E2E testing framework with excellent developer experience. However, Playwright is faster (parallel execution by default), supports multiple browsers natively, has better TypeScript support, and does not require a separate process for the test runner. Playwright's auto-waiting and web-first assertions reduce flakiness.

### Percy Instead of Chromatic
Percy is a visual regression service that works with any testing framework (not just Storybook). However, Chromatic integrates natively with Storybook — it runs stories directly without requiring a separate test harness. Percy is also more expensive for open-source projects. Chromatic's free tier is generous for our volume.

### No Storybook (Documentation via Tests Only)
Tests verify behavior but do not serve as interactive documentation. Storybook provides a browseable component catalog that helps new developers understand the UI, enables design reviews, and serves as the foundation for visual regression testing. The documentation value justifies the setup cost.

### Testing Library Only (No E2E)
Component tests with Testing Library cover individual components well but do not validate the integration between frontend, routing, API calls, and SSE streaming. E2E tests catch integration issues that unit tests miss, such as SSE connection handling, route transitions, and data flow between panels.

## Consequences

### Positive
- 80%+ coverage reduces regression risk as new features (replay, export, sharing) are added
- Playwright E2E tests validate critical user flows end-to-end, catching integration bugs
- Storybook provides living documentation that stays in sync with the codebase
- Visual regression testing catches unintended UI changes automatically
- Structured test strategy makes it clear what needs testing for new features

### Negative
- Playwright E2E tests require both backend and frontend running, making CI slower (mitigated by parallelization)
- Storybook adds build dependencies and configuration overhead
- Chromatic has usage limits on the free tier — may need a paid plan as story count grows
- Maintaining stories alongside components is an ongoing effort — stories can become stale if not updated
- 80% coverage target may encourage testing implementation details rather than behavior if not carefully applied

## Related
- ADR-003: Test Strategy (original test strategy, this ADR extends it)
- ADR-017: Replay Engine Design (replay controls need E2E testing)
- ADR-019: Session Sharing (shared view needs E2E testing)

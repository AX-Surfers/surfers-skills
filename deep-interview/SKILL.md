---
name: deep-interview
description: Socratic deep interview with mathematical ambiguity gating before implementation begins
argument-hint: "<idea or vague description>"
---

<Purpose>
Deep Interview replaces vague ideas with a crystal-clear specification by asking targeted questions that expose hidden assumptions, measuring clarity across weighted dimensions, and refusing to proceed to implementation until ambiguity drops below a threshold. It produces one artifact: a spec file the user (or any implementation step) can act on next.
</Purpose>

<Use_When>
- User has a vague idea and wants thorough requirements gathering before anything gets built
- User says "deep interview", "interview me", "ask me everything", "don't assume", "make sure you understand"
- User says "I have a vague idea" / "not sure exactly what I want"
- Task is complex enough that jumping straight to building would waste effort on scope discovery
</Use_When>

<Do_Not_Use_When>
- User has a detailed, specific request with concrete acceptance criteria — just build it
- User wants to brainstorm/explore options, not converge on one spec
- User wants a quick fix or single small change
- User says "just do it" / "skip the questions" — respect that; end with a spec marked "pending", don't force questions
- User already has a written spec and asks to execute it directly
</Do_Not_Use_When>

<Why_This_Exists>
The hard part of building something is rarely the building — it's knowing exactly what to build. A single "what do you want?" question tends to surface features, not assumptions. Socratic questioning — repeatedly asking "what are you assuming?" — surfaces the gaps that would otherwise turn into "that's not what I meant" after the work is done.
</Why_This_Exists>

<Execution_Policy>
- Ask ONE question at a time — never batch multiple questions
- Target the WEAKEST clarity dimension with each question
- Before scoring begins, run a one-time topology check that confirms the top-level components of the request (Round 0, below)
- State explicitly, every round: which dimension is weakest, its score/gap, and why the next question targets it
- If working against an existing codebase, gather the relevant facts yourself (read files, search) BEFORE asking the user about them — never ask what you can discover
- Score ambiguity after every answer — show the score transparently
- If the request has multiple independent components, score and target each one explicitly so depth on one component can't hide ambiguity in the others
- Do not proceed to implementation until ambiguity ≤ threshold AND the user explicitly approves moving forward
- Allow early exit at any point with a clear warning about what's still unclear
- Keep enough state to resume if the conversation is interrupted
</Execution_Policy>

<Steps>

## Phase 0: Set the threshold

Default ambiguity threshold: **20%**. If the user states a different tolerance ("good enough", "be thorough", a specific number), use that instead. State the threshold once, up front:

> Deep Interview threshold: 20% (default — tell me if you want tighter or looser)

## Phase 1: Initialize

1. Parse the user's idea from their request.
2. Detect brownfield vs. greenfield: if you're working inside an existing project and the idea references modifying/extending something, this is brownfield.
3. For brownfield: before asking anything, look through the relevant part of the codebase yourself (read files, search for related code/config) and keep notes — call this `context`. Use it to avoid asking the user things the code already answers.
4. If the user's initial description is very long (pasted logs, transcripts, long documents), summarize it into a concise version first, and interview from that summary — don't let raw bulk crowd out the actual questions.
5. Announce:

> Starting deep interview. I'll ask targeted questions to understand this thoroughly before building anything. After each answer I'll show a clarity score. We'll move to implementation once ambiguity drops below 20%.
>
> **Your idea:** "{initial_idea}"
> **Type:** {greenfield|brownfield}
> **Current ambiguity:** 100% (haven't started yet)

## Round 0: Confirm the shape of the request

Do this once, before any scoring, to stop depth-first questioning from overfitting to whichever part the user described in the most detail.

1. From the idea (+ codebase context if brownfield), list the top-level components — independent things that can each succeed or fail on their own. Usually 1–6. Group smaller items under the nearest component rather than listing every sub-feature.
2. Ask one confirmation question:

```
Round 0 | Confirming scope

I'm reading this as {N} top-level piece(s):
1. {component_name}: {one_sentence_description}
2. ...

Is that right? Anything to add, remove, merge, split, or explicitly set aside for later?
```

3. Lock in the confirmed list (and anything explicitly deferred) — keep this in your working notes for the rest of the interview.
4. If the user confirms a single component, proceed straight into Phase 2 with that one component.

## Phase 2: Interview Loop

Repeat until `ambiguity ≤ threshold` or the user exits early:

### Step 2a — Pick the next question

Identify the component + dimension pair with the lowest clarity score. State in one sentence why that's the bottleneck right now, then ask a question aimed specifically at improving it. Questions should expose **assumptions**, not collect feature lists.

If the user's own description of the core "thing" keeps shifting (they call it a workflow, then an inbox, then a planner), stop asking about features and ask what it fundamentally *is* first.

**Question styles by dimension:**

| Dimension | Style | Example |
|---|---|---|
| Goal clarity | "What exactly happens when...?" | "When you say 'manage tasks', what's the first concrete action a user takes?" |
| Constraints | "What are the boundaries?" | "Does this need to work offline, or can it assume a connection?" |
| Success criteria | "How would we know it works?" | "If I showed you the finished thing, what would make you say 'yes, that's it'?" |
| Context (brownfield) | "How does this fit what's already there?" | "I see X already does Y in {file/pattern}. Should this extend that, or is it meant to be separate?" |
| Scope-fuzzy | "What IS this, really?" | "You've called this a workflow, an inbox, and a planner. Which one is the actual core thing?" |

### Step 2b — Ask it

Use whatever interactive question tool is available (e.g. a multiple-choice-with-free-text prompt). Present it with context:

```
Round {n} | Targeting: {weakest_dimension} | Why now: {one_sentence_reason} | Ambiguity: {score}%

{question}
```

### Step 2c — Score ambiguity

After each answer, score clarity 0.0–1.0 on each active dimension:

1. **Goal clarity** — can the objective be stated in one sentence, with clear entities and relationships, no qualifiers?
2. **Constraint clarity** — are the boundaries and non-goals clear?
3. **Success criteria clarity** — could you write a test that verifies "done"?
4. **Context clarity** (brownfield only) — do you understand the existing system well enough to change it safely?

For each: a score, a one-sentence justification, and (if <0.9) what's still unclear.

**Ambiguity formula:**

- Greenfield: `ambiguity = 1 − (goal × 0.40 + constraints × 0.30 + criteria × 0.30)`
- Brownfield: `ambiguity = 1 − (goal × 0.35 + constraints × 0.25 + criteria × 0.25 + context × 0.15)`

Also track the key entities/nouns mentioned each round, and note whether they're stabilizing (same names reappearing) or still shifting round to round — this is a good signal of whether the conversation is converging.

### Step 2d — Report progress

```
Round {n} complete.

| Dimension | Score | Gap |
|---|---|---|
| Goal | {s} | {gap or "Clear"} |
| Constraints | {s} | {gap or "Clear"} |
| Success Criteria | {s} | {gap or "Clear"} |
| Context (brownfield) | {s} | {gap or "Clear"} |
| **Ambiguity** | **{score}%** | |

**Next target:** {dimension} — {why}

{score <= threshold ? "Threshold met — ready to move forward." : "Next question focuses on: " + weakest_dimension}
```

### Step 2e — Soft limits

- **Round 3+**: allow early exit if the user says "enough" / "let's go" / "build it"
- **Round 10**: soft check-in — "We're at 10 rounds, ambiguity is {score}%. Keep going, or proceed with what we have?"
- **Round 20**: hard stop — proceed with current clarity, noting the risk

## Phase 3: Perspective Shifts (optional, use if ambiguity is stalling)

At certain points, deliberately change the angle of questioning:

- **Contrarian** (round 4+): challenge a core assumption — "What if the opposite were true? What if that constraint doesn't actually exist?"
- **Simplifier** (round 6+): probe for unnecessary complexity — "What's the simplest version that would still be valuable? Which constraints are load-bearing vs. just assumed?"
- **Essence-finder** (round 8+, if ambiguity is still >30%): if questions aren't converging, ask what the thing fundamentally *is* rather than what it does.

Use each mode once, then return to normal questioning.

## Phase 4: Write the Spec

When ambiguity ≤ threshold (or a limit is hit), write a spec file: `deep-interview-{slug}.md` in the current directory (or wherever the user prefers).

```markdown
# Deep Interview Spec: {title}

## Metadata
- Rounds: {count}
- Final ambiguity: {score}%
- Type: greenfield | brownfield
- Threshold: {threshold}
- Status: {PASSED | EARLY_EXIT}

## Scope
{List each confirmed component from Round 0 — active ones with a one-line summary of what was clarified, deferred ones with the reason they were set aside.}

## Goal
{Crystal-clear goal statement covering every active component.}

## Constraints
- ...

## Non-Goals
- {explicitly excluded scope}

## Acceptance Criteria
- [ ] {testable criterion}
- [ ] ...

## Assumptions Exposed & Resolved
| Assumption | Challenge | Resolution |
|---|---|---|

## Technical Context
{Brownfield: relevant findings from the codebase. Greenfield: technology choices/constraints discussed.}

## Interview Transcript
<details>
<summary>Full Q&A ({n} rounds)</summary>

### Round 1
**Q:** ...
**A:** ...
**Ambiguity:** {score}%

...
</details>
```

## Phase 5: What Happens Next

The spec is a deliverable, not an automatic trigger. Present it to the user and ask directly:

> Spec is ready (ambiguity: {score}%). Want me to start building this now, or would you like to review/adjust the spec first?

- If they say build it — proceed to implementation using the spec as the source of truth.
- If they want to refine — go back to Phase 2.
- If they want to stop here — leave the spec file as the deliverable.

Do not chain into any other automated pipeline on your own; the spec becoming "pending → building" is a decision the user makes explicitly each time.

</Steps>

<Escalation_And_Stop_Conditions>
- **Hard cap at 20 rounds**: proceed with whatever clarity exists, note the risk
- **Soft warning at 10 rounds**: offer to continue or proceed
- **Early exit (round 3+)**: allowed, with a clear warning about what's still unclear
- **User says "stop"/"cancel"**: stop immediately
- **Ambiguity stuck (±5% for 3 rounds straight)**: switch to the essence-finder question style
- **All dimensions ≥0.9**: skip straight to the spec even if round count is low
</Escalation_And_Stop_Conditions>

<Ambiguity_Score_Interpretation>
| Score | Meaning | Action |
|---|---|---|
| 0–10% | Crystal clear | Proceed immediately |
| ≤ threshold | Clear enough | Proceed |
| Just above threshold | Minor gaps | One or two more rounds |
| ~30–50% | Significant gaps | Keep focusing on weakest dimensions |
| ~50–70% | Very unclear | Consider reframing (essence-finder question) |
| >70% | Almost nothing known | Early stage, keep going |
</Ambiguity_Score_Interpretation>

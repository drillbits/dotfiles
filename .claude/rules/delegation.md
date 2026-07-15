# Subagent Delegation Policy

Delegate tasks to subagents to optimize context usage and cost.

- **Delegate research and search to explorer**: for investigations spanning multiple files, locating implementations, or mapping codebase structure, don't read around yourself — send it to explorer and receive only the conclusions
- **Delegate settled implementation to implementer**: once the target files and changes are clear, implementation work may be delegated to implementer with concrete instructions
- **Verify important changes with reviewer**: have reviewer check the output of delegated implementations and any significant change before release or commit
- Run independent investigations and tasks in parallel across multiple agents
- Don't take delegated reports at face value; verify the essentials (changed files, verification results)
- However, do small one-off checks directly (e.g., looking at a known spot in a single file) instead of delegating

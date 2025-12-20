// Dean voice: dry humor, practical, kinda a butthead

export function wcScopePickerPromptText() {
  return "Alright. What are we messing with?\nPick one: Sprint or Project.";
}

export function wcSprintPickerPromptText() {
  return "Which sprint?\nPick the one you mean. I am not guessing wrong on purpose.";
}

export function wcProjectPickerPromptText() {
  return "Which project?\nPick one so I can put the words in the right place.";
}

export function wcNoProjectsText() {
  return "You don't have any projects yet.\nMake one with `/project create`, or start a sprint and log without a project.";
}

export function wcConfirmSetPromptText({ targetLabel, newX, currentNet, deltaSigned } = {}) {
  return (
    `Confirm /wc set\n` +
    `Target: ${targetLabel ?? 'Unknown'}\n\n` +
    `New value: ${newX ?? '?'}\n` +
    `Current net: ${currentNet ?? '?'}\n` +
    `Delta: ${deltaSigned ?? '?'}\n\n` +
    "Hit confirm if that's right. If not, cancel and try again."
  ).trim();
}

export function wcConfirmAddPromptText({ targetLabel, addingN, currentNet, newX } = {}) {
  return (
    `Confirm /wc add\n` +
    `Target: ${targetLabel ?? 'Unknown'}\n\n` +
    `Adding: ${addingN ?? '?'}\n` +
    `Current net: ${currentNet ?? '?'}\n` +
    `New value: ${newX ?? '?'}\n\n` +
    "Hit confirm if that's right. If not, cancel and try again."
  ).trim();
}

export function wcConfirmBaselinePromptText({ sprintIdentifier, activeOrEnded, baselineB } = {}) {
  return (
    `Confirm baseline\n` +
    `Sprint: ${sprintIdentifier ?? 'Unknown'} (${activeOrEnded ?? 'active'})\n\n` +
    `Baseline: ${baselineB ?? '?'}\n\n` +
    'This is display-only. Your sprint progress still starts at 0.'
  ).trim();
}

export function wcConfirmUndoPromptText({ targetLabel, entryType, entryAmountSigned, entryTimestamp } = {}) {
  return (
    `Confirm undo\n` +
    `Target: ${targetLabel ?? 'Unknown'}\n\n` +
    `Undoing: ${entryType ?? 'ENTRY'} ${entryAmountSigned ?? '?'} at ${entryTimestamp ?? '?'}\n\n` +
    "If that's the wrong one, cancel. No shame."
  ).trim();
}

export function wcConfirmTimeoutText() {
  return 'Timed out.\nIf you still want to do it, run the command again.';
}

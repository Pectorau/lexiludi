export function canValidateDefinitionChoice(choice: number | null, isResolved: boolean) {
  return choice !== null && !isResolved;
}

export function canOfferSecondChance(isCorrect: boolean, enabled: boolean, alreadyUsed: boolean) {
  return !isCorrect && enabled && !alreadyUsed;
}

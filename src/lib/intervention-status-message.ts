export const interventionStatusMessages: Record<string, string> = {
  EN_ROUTE: "Votre professionnel est en route",
  IN_PROGRESS: "Votre intervention a commencé",
  COMPLETED: "Votre intervention est terminée",
};

// Make older automatic status messages readable without rewriting stored conversations.
export function formatInterventionStatusMessage(text: string) {
  const match = /^Statut de l[’']intervention\s*:\s*(EN_ROUTE|IN_PROGRESS|COMPLETED)$/.exec(text);
  return match ? interventionStatusMessages[match[1]] : text;
}

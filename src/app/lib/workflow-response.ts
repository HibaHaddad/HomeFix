import { WorkflowError } from "./workspace-mutations";
export function workflowErrorResponse(error: unknown) {
  if (error instanceof WorkflowError) return Response.json({ error: error.message }, { status: error.status });
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  const databaseConflict = error instanceof Error && error.name.startsWith("PrismaClient") && /23P01|exclusion constraint|could not serialize|serialization failure|deadlock/i.test(error.message);
  if (["P2034", "P2002", "P2004", "P2025"].includes(code) || databaseConflict) return Response.json({ error: "Le créneau ou les données viennent de changer. Actualisez puis réessayez." }, { status: 409 });
  if (error instanceof Error && error.constructor === Error) return Response.json({ error: error.message }, { status: 400 });
  console.error("Intervention workflow failed", error);
  return Response.json({ error: "L’opération n’a pas pu être enregistrée. Réessayez dans un instant." }, { status: 500 });
}

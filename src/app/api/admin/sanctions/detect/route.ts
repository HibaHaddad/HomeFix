import { adminMutation } from "@/app/lib/admin-http";
import { detectSanctions } from "@/app/lib/sanctions";
export async function POST(request: Request) { return adminMutation(request, async () => Response.json({ detected: await detectSanctions() })); }

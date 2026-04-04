import { z } from "zod";
import { withAuth, requireAdmin } from "@/lib/api-handler";
import { ok, Errors } from "@/lib/api-response";
import { JiraDcClient } from "@/lib/integrations/jira-dc/client";
import { SCOPES } from "@/lib/scopes";

const TestSchema = z.object({
  baseUrl: z.string().url("Must be a valid URL"),
  pat: z.string().min(1, "PAT is required"),
});

// POST — tests the Jira DC connection with the given credentials.
// Does NOT persist anything — purely a connectivity check.
export const POST = withAuth(async (req, ctx) => {
  const guard = requireAdmin(ctx);
  if (guard) return guard;

  const body = await req.json().catch(() => null);
  const parsed = TestSchema.safeParse(body);
  if (!parsed.success) {
    return Errors.badRequest("Invalid request body", parsed.error.flatten());
  }

  try {
    const client = new JiraDcClient(parsed.data.baseUrl, parsed.data.pat);
    const me = await client.testConnection();
    return ok({ connected: true, displayName: me.displayName, username: me.name });
  } catch (err) {
    return ok({
      connected: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}, SCOPES.INTEGRATIONS_WRITE);

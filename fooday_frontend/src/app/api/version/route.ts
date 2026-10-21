export const dynamic = "force-dynamic";

/** Reports the deployed commit SHA so clients can detect a newer build. */
export async function GET() {
  const version = process.env.VERCEL_GIT_COMMIT_SHA || "dev";
  return Response.json(
    { version },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}

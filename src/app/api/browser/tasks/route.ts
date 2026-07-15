import { NextRequest, NextResponse } from "next/server";
import { resolveApiUser } from "@/lib/api/auth";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import {
  cancelBrowserTask,
  enqueueBrowserTask,
  getBrowserTask,
  listBrowserTasks,
} from "@/lib/browser/queue";

export async function GET(request: NextRequest) {
  const limited = await rateLimit(request, {
    ...RATE_LIMIT_PRESETS.browserWorker,
    keyPrefix: "browser-tasks",
  });
  if (limited) return limited;

  try {
    const user = await resolveApiUser();
    const tasks = await listBrowserTasks(user.id);
    return NextResponse.json({ tasks });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, {
    ...RATE_LIMIT_PRESETS.browserWorker,
    keyPrefix: "browser-tasks",
  });
  if (limited) return limited;

  try {
    const user = await resolveApiUser();
    const body = await request.json();

    if (body.action === "cancel" && body.taskId) {
      const result = await cancelBrowserTask(body.taskId, user.id);
      return NextResponse.json({ cancelled: result.count > 0 });
    }

    if (body.action === "status" && body.taskId) {
      const task = await getBrowserTask(body.taskId);
      if (!task || task.userId !== user.id) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json({ task });
    }

    const task = await enqueueBrowserTask({
      userId: user.id,
      applicationId: body.applicationId,
      type: body.type || "PREPARE_APPLICATION",
      platform: body.platform,
      payload: body.payload,
    });

    return NextResponse.json({ task });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Task failed";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

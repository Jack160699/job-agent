import { NextRequest, NextResponse } from "next/server";
import { resolveApiUserDev } from "@/lib/api/auth";
import {
  cancelBrowserTask,
  enqueueBrowserTask,
  getBrowserTask,
  listBrowserTasks,
} from "@/lib/browser/queue";

export async function GET() {
  try {
    const user = await resolveApiUserDev();
    const tasks = await listBrowserTasks(user.id);
    return NextResponse.json({ tasks });
  } catch {
    return NextResponse.json({ tasks: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await resolveApiUserDev();
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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

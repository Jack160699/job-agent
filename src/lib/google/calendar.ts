import { google } from "googleapis";
import { getAuthenticatedClient } from "./oauth";
import prisma from "@/lib/db";

export async function syncInterviewsToCalendar(userId: string) {
  const auth = await getAuthenticatedClient(userId);
  const calendar = google.calendar({ version: "v3", auth });

  const interviews = await prisma.interview.findMany({
    where: { userId, status: "SCHEDULED", calendarId: null },
    take: 20,
  });

  let synced = 0;
  for (const interview of interviews) {
    const event = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: interview.title,
        description: interview.notes || undefined,
        location: interview.location || interview.meetingUrl || undefined,
        start: {
          dateTime: interview.scheduledAt.toISOString(),
          timeZone: "UTC",
        },
        end: {
          dateTime: new Date(
            interview.scheduledAt.getTime() + interview.durationMin * 60000
          ).toISOString(),
          timeZone: "UTC",
        },
      },
    });

    await prisma.interview.update({
      where: { id: interview.id },
      data: { calendarId: event.data.id || undefined },
    });
    synced++;
  }

  return { synced };
}

export async function createInterviewFromEmail(
  userId: string,
  input: {
    title: string;
    company: string;
    scheduledAt: Date;
    meetingUrl?: string;
    applicationId?: string;
  }
) {
  const interview = await prisma.interview.create({
    data: {
      userId,
      applicationId: input.applicationId,
      title: input.title,
      company: input.company,
      scheduledAt: input.scheduledAt,
      meetingUrl: input.meetingUrl,
      status: "SCHEDULED",
    },
  });

  try {
    const auth = await getAuthenticatedClient(userId);
    const calendar = google.calendar({ version: "v3", auth });
    const event = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: input.title,
        description: `Interview at ${input.company}`,
        location: input.meetingUrl,
        start: { dateTime: input.scheduledAt.toISOString(), timeZone: "UTC" },
        end: {
          dateTime: new Date(input.scheduledAt.getTime() + 3600000).toISOString(),
          timeZone: "UTC",
        },
      },
    });
    await prisma.interview.update({
      where: { id: interview.id },
      data: { calendarId: event.data.id || undefined },
    });
  } catch {
    // Calendar sync optional
  }

  return interview;
}

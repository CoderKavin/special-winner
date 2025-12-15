import type { IA, Milestone, DeepWorkSettings } from "../types";
import { DEFAULT_DEEP_WORK_SETTINGS } from "../types";
import { detectMilestonePhase } from "./learning";
import { isDeepWorkPhase, getMinimumSessionHours } from "./deepwork";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = "https://www.googleapis.com/auth/calendar";
const CALENDAR_NAME = "IB Deadlines - Kavin";

// Google Calendar color IDs
const COLOR_MAP: Record<string, string> = {
  math: "9", // Blue
  physics: "3", // Purple
  economics: "10", // Green
  english: "6", // Orange
  history: "11", // Red
};

// Darker colors for deep work blocks
const DEEP_WORK_COLOR_MAP: Record<string, string> = {
  math: "1", // Lavender (darker feel)
  physics: "3", // Purple (keeping as deep)
  economics: "2", // Sage
  english: "4", // Flamingo
  history: "11", // Red (keeping as intense)
};

interface GoogleAuth {
  accessToken: string;
  expiresAt: number;
}

let googleAuth: GoogleAuth | null = null;
let calendarId: string | null = null;

export function isGoogleCalendarConfigured(): boolean {
  return !!GOOGLE_CLIENT_ID;
}

export async function initGoogleAuth(): Promise<boolean> {
  if (!GOOGLE_CLIENT_ID) {
    console.warn("Google Client ID not configured");
    return false;
  }

  return new Promise((resolve) => {
    // Load the Google Identity Services library
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      resolve(true);
    };
    script.onerror = () => {
      console.error("Failed to load Google Identity Services");
      resolve(false);
    };
    document.head.appendChild(script);
  });
}

export async function signInWithGoogle(): Promise<string | null> {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error("Google Client ID not configured");
  }

  return new Promise((resolve, reject) => {
    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: (response: { access_token?: string; error?: string }) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }
        if (response.access_token) {
          googleAuth = {
            accessToken: response.access_token,
            expiresAt: Date.now() + 3600 * 1000, // 1 hour
          };
          resolve(response.access_token);
        }
      },
    });

    tokenClient.requestAccessToken();
  });
}

export function isSignedIn(): boolean {
  return googleAuth !== null && googleAuth.expiresAt > Date.now();
}

export function signOut(): void {
  if (googleAuth) {
    google.accounts.oauth2.revoke(googleAuth.accessToken, () => {
      googleAuth = null;
      calendarId = null;
    });
  }
}

async function getOrCreateCalendar(): Promise<string> {
  if (calendarId) return calendarId;

  if (!googleAuth) {
    throw new Error("Not signed in to Google");
  }

  // List calendars to find existing one
  const listResponse = await fetch(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList",
    {
      headers: {
        Authorization: `Bearer ${googleAuth.accessToken}`,
      },
    },
  );

  if (!listResponse.ok) {
    throw new Error("Failed to list calendars");
  }

  const calendars = await listResponse.json();
  const existingCalendar = calendars.items?.find(
    (cal: { summary: string }) => cal.summary === CALENDAR_NAME,
  );

  if (existingCalendar) {
    calendarId = existingCalendar.id;
    return calendarId as string;
  }

  // Create new calendar
  const createResponse = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${googleAuth.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: CALENDAR_NAME,
        description: "IB Internal Assessment deadlines and milestones",
        timeZone: "Asia/Kolkata",
      }),
    },
  );

  if (!createResponse.ok) {
    throw new Error("Failed to create calendar");
  }

  const newCalendar = await createResponse.json();
  calendarId = newCalendar.id;
  return calendarId!;
}

function milestoneToEvent(
  ia: IA,
  milestone: Milestone,
  settings: DeepWorkSettings = DEFAULT_DEEP_WORK_SETTINGS,
) {
  const phase =
    milestone.phase || detectMilestonePhase(milestone.milestone_name);
  const isDeepWork = isDeepWorkPhase(phase);
  const minimumHours = getMinimumSessionHours(phase, settings);

  // Event starts at 9:00 AM Kerala IST (UTC+5:30)
  const deadlineDate = milestone.deadline;

  // Calculate duration with buffers for deep work
  const coreDurationHours = Math.max(
    milestone.estimated_hours * milestone.buffer_multiplier,
    isDeepWork ? minimumHours : 0,
  );

  // Add prep and decompress buffers for deep work
  const prepMinutes = isDeepWork ? settings.prepBufferMinutes : 0;
  const decompressMinutes = isDeepWork ? settings.decompressBufferMinutes : 0;
  // Adjust start time to account for prep buffer
  const startHour = 9 - Math.ceil(prepMinutes / 60);
  const startMinute = prepMinutes % 60;
  const startDateTime = `${deadlineDate}T${startHour.toString().padStart(2, "0")}:${startMinute.toString().padStart(2, "0")}:00+05:30`;

  const endHour =
    9 + Math.ceil(coreDurationHours) + Math.ceil(decompressMinutes / 60);
  const endDateTime = `${deadlineDate}T${endHour.toString().padStart(2, "0")}:00:00+05:30`;

  // Build description with deep work information
  let description = milestone.description;
  description += `\n\n📊 Estimated time: ${coreDurationHours.toFixed(1)} hours`;

  if (isDeepWork) {
    description += `\n\n🎯 DEEP WORK SESSION`;
    description += `\n• Phase: ${phase.charAt(0).toUpperCase() + phase.slice(1)}`;
    description += `\n• Minimum recommended: ${minimumHours}h`;
    if (prepMinutes > 0) {
      description += `\n• Prep time: ${prepMinutes} minutes`;
    }
    if (decompressMinutes > 0) {
      description += `\n• Decompress time: ${decompressMinutes} minutes`;
    }
    description += `\n\n⚠️ This is uninterrupted focus time. Please do not schedule meetings or interruptions during this block.`;
  }

  description += `\n\n📁 Part of: ${ia.name}`;

  // Use deeper colors for deep work
  const colorId = isDeepWork
    ? DEEP_WORK_COLOR_MAP[ia.subjectColor] || COLOR_MAP[ia.subjectColor]
    : COLOR_MAP[ia.subjectColor] || "1";

  // Build event title with deep work indicator
  const titlePrefix = isDeepWork ? "🔒 DEEP WORK: " : "";
  const summary = `${titlePrefix}[${ia.name.split(" ")[0]}] ${milestone.milestone_name}`;

  return {
    summary,
    description,
    start: {
      dateTime: startDateTime,
      timeZone: "Asia/Kolkata",
    },
    end: {
      dateTime: endDateTime,
      timeZone: "Asia/Kolkata",
    },
    colorId,
    // Mark as BUSY for deep work, FREE for regular work
    transparency: isDeepWork ? "opaque" : "transparent",
    // Add focus time for deep work
    visibility: "default",
    reminders: {
      useDefault: false,
      overrides: isDeepWork
        ? [
            { method: "popup", minutes: 1440 }, // 1 day before
            { method: "popup", minutes: 120 }, // 2 hours before (prep time)
            { method: "popup", minutes: 15 }, // 15 minutes before (final prep)
          ]
        : [
            { method: "popup", minutes: 1440 }, // 1 day before
            { method: "popup", minutes: 60 }, // 1 hour before
          ],
    },
  };
}

export async function syncMilestoneToCalendar(
  ia: IA,
  milestone: Milestone,
  existingEventId?: string,
  settings?: DeepWorkSettings,
): Promise<string> {
  if (!googleAuth) {
    throw new Error("Not signed in to Google");
  }

  const calId = await getOrCreateCalendar();
  const event = milestoneToEvent(ia, milestone, settings);

  if (existingEventId) {
    // Update existing event
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(existingEventId)}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${googleAuth.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      },
    );

    if (!response.ok) {
      // If update fails (event might be deleted), create new
      if (response.status === 404) {
        return syncMilestoneToCalendar(ia, milestone, undefined, settings);
      }
      throw new Error("Failed to update calendar event");
    }

    const updatedEvent = await response.json();
    return updatedEvent.id;
  } else {
    // Create new event
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${googleAuth.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      },
    );

    if (!response.ok) {
      throw new Error("Failed to create calendar event");
    }

    const newEvent = await response.json();
    return newEvent.id;
  }
}

export async function syncAllMilestones(
  ias: IA[],
  existingEventIds: Record<string, string>,
  onProgress?: (completed: number, total: number) => void,
  settings?: DeepWorkSettings,
): Promise<Record<string, string>> {
  const newEventIds: Record<string, string> = { ...existingEventIds };

  const allMilestones = ias.flatMap((ia) =>
    ia.milestones.map((m) => ({ ia, milestone: m })),
  );

  for (let i = 0; i < allMilestones.length; i++) {
    const { ia, milestone } = allMilestones[i];
    onProgress?.(i, allMilestones.length);

    try {
      const eventId = await syncMilestoneToCalendar(
        ia,
        milestone,
        existingEventIds[milestone.id],
        settings,
      );
      newEventIds[milestone.id] = eventId;
    } catch (error) {
      console.error(`Failed to sync milestone ${milestone.id}:`, error);
    }

    // Small delay to avoid rate limiting
    if (i < allMilestones.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  onProgress?.(allMilestones.length, allMilestones.length);
  return newEventIds;
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  if (!googleAuth || !calendarId) {
    return;
  }

  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${googleAuth.accessToken}`,
      },
    },
  );
}

// Type declaration for Google Identity Services
declare global {
  interface Window {
    google: typeof google;
  }
  const google: {
    accounts: {
      oauth2: {
        initTokenClient: (config: {
          client_id: string;
          scope: string;
          callback: (response: {
            access_token?: string;
            error?: string;
          }) => void;
        }) => {
          requestAccessToken: () => void;
        };
        revoke: (token: string, callback: () => void) => void;
      };
    };
  };
}

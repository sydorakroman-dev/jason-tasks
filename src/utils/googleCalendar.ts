const SCOPES = 'https://www.googleapis.com/auth/calendar.events';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

let gapiInited = false;
let gisInited = false;
let tokenClient: any = null;

export async function initGoogleApi(clientId: string): Promise<void> {
  if (!clientId) throw new Error('No Google Client ID configured');

  await loadScript('https://apis.google.com/js/api.js');
  await new Promise<void>((res) => window.gapi.load('client', res));
  await window.gapi.client.init({ discoveryDocs: [DISCOVERY_DOC] });
  gapiInited = true;

  await loadScript('https://accounts.google.com/gsi/client');
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: '',
  });
  gisInited = true;
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = reject;
    document.body.appendChild(s);
  });
}

export async function ensureAuth(): Promise<void> {
  if (!gapiInited || !gisInited) throw new Error('Google API not initialized');
  if (window.gapi.client.getToken()) return;
  await new Promise<void>((resolve, reject) => {
    tokenClient.callback = (resp: any) => {
      if (resp.error) reject(new Error(resp.error));
      else resolve();
    };
    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

export interface CalendarEventInput {
  title: string;
  description?: string;
  dueDate: string;       // YYYY-MM-DD
  attendeeEmail?: string;
}

export async function createCalendarEvent(input: CalendarEventInput): Promise<string> {
  await ensureAuth();
  const event: any = {
    summary: input.title,
    description: input.description || '',
    start: { date: input.dueDate },
    end:   { date: input.dueDate },
  };
  if (input.attendeeEmail) {
    event.attendees = [{ email: input.attendeeEmail }];
    event.guestsCanModify = false;
  }
  const resp = await window.gapi.client.calendar.events.insert({
    calendarId: 'primary',
    resource: event,
    sendUpdates: input.attendeeEmail ? 'all' : 'none',
  });
  return resp.result.id as string;
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  await ensureAuth();
  await window.gapi.client.calendar.events.delete({
    calendarId: 'primary',
    eventId,
  });
}

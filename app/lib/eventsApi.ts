import { supabase } from "./supabaseClient";
import { ShowEvent } from "../mockEvents";

type EventRow = {
  id: string;
  user_id?: string;
  title: string;
  artist: string;
  type: string;
  location: string;
  show_date: string;
  agency: string;
  source_url: string;
  status_lifecycle: string;
  user_notes: string;
  expenses: ShowEvent["expenses"];
  ticket_stages: ShowEvent["ticketStages"];
  fan_events: ShowEvent["fanEvents"];
  curated_shops: ShowEvent["curatedShops"];
};

function rowToEvent(row: EventRow): ShowEvent {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    type: row.type as ShowEvent["type"],
    location: row.location,
    showDate: row.show_date,
    agency: row.agency,
    sourceUrl: row.source_url,
    statusLifecycle: row.status_lifecycle as ShowEvent["statusLifecycle"],
    userNotes: row.user_notes,
    expenses: row.expenses || [],
    ticketStages: row.ticket_stages || [],
    fanEvents: row.fan_events || [],
    curatedShops: row.curated_shops || [],
  };
}

function eventToRow(event: ShowEvent): Omit<EventRow, "user_id"> {
  return {
    id: event.id,
    title: event.title,
    artist: event.artist,
    type: event.type,
    location: event.location,
    show_date: event.showDate,
    agency: event.agency,
    source_url: event.sourceUrl,
    status_lifecycle: event.statusLifecycle,
    user_notes: event.userNotes,
    expenses: event.expenses,
    ticket_stages: event.ticketStages,
    fan_events: event.fanEvents,
    curated_shops: event.curatedShops,
  };
}

export async function fetchEvents(): Promise<ShowEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .order("show_date", { ascending: true });
  if (error) throw error;
  return (data || []).map(rowToEvent);
}

export async function syncEvents(
  newEvents: ShowEvent[],
  previousEvents: ShowEvent[]
): Promise<void> {
  const removedIds = previousEvents
    .filter((old) => !newEvents.some((e) => e.id === old.id))
    .map((e) => e.id);

  if (removedIds.length > 0) {
    const { error } = await supabase.from("events").delete().in("id", removedIds);
    if (error) throw error;
  }

  if (newEvents.length > 0) {
    const rows = newEvents.map(eventToRow);
    const { error } = await supabase.from("events").upsert(rows);
    if (error) throw error;
  }
}

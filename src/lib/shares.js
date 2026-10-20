import { SHARES, currentUser, requestSync, toRemoteTrip } from './sync'
import { supabase } from './supabase'

/* Inviting people to see and edit a trip (the chapri-apps backend's
   triplanner_trip_shares). An invite is stored by email and never checked
   against accounts, so the app says the same thing whoever is invited:
   whoever signs in with that email — now or later — sees the trip. Only the
   owner invites or removes people; someone a trip is shared with can leave. */

export const MAX_PEOPLE = 10

const normal = email => email.trim().toLowerCase()
export const isEmail = email => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normal(email))

// What the server says, fit to show; anything else is a connection problem.
function explain(error) {
  if (error?.code === '22023') return new Error(error.message)
  return new Error('That did not go through — check your connection and try again')
}

export async function listInvites(trip) {
  const me = currentUser()
  const { data, error } = await supabase
    .from(SHARES)
    .select('email, created_at')
    .eq('owner_id', me.id)
    .eq('trip_id', trip.id)
    .order('created_at')
  if (error) throw explain(error)
  return data.map(r => r.email)
}

export async function invite(trip, email) {
  const me = currentUser()
  // The trip must be in the account before anyone can be invited to it.
  const { error: tripError } = await supabase
    .from('triplanner_trips')
    .upsert(
      { user_id: me.id, id: trip.id, data: toRemoteTrip(trip), updated_at: trip.updatedAt ?? new Date().toISOString() },
      { onConflict: 'user_id,id', ignoreDuplicates: true },
    )
  if (tripError) throw explain(tripError)
  // Inviting someone twice is the same as once.
  const { error } = await supabase
    .from(SHARES)
    .upsert(
      { owner_id: me.id, trip_id: trip.id, email: normal(email) },
      { onConflict: 'owner_id,trip_id,email', ignoreDuplicates: true },
    )
  if (error) throw explain(error)
  requestSync()
}

export async function removeInvite(trip, email) {
  const me = currentUser()
  const { error } = await supabase.from(SHARES).delete().eq('owner_id', me.id).eq('trip_id', trip.id).eq('email', email)
  if (error) throw explain(error)
}

// Stop seeing a trip shared with you. Its owner keeps it.
export async function leaveTrip(trip) {
  const me = currentUser()
  const { ownerId, tripId } = trip.sharedFrom
  const { error } = await supabase
    .from(SHARES)
    .delete()
    .eq('owner_id', ownerId)
    .eq('trip_id', tripId)
    .eq('email', normal(me?.email ?? ''))
  if (error) throw explain(error)
}

/**
 * Оновлення живої стрічки активності (присутність + події) без повного перезавантаження.
 */

const EMPTY_LIVE = { asking: [], answering: [], learning: [], in_room: [] };

export function emptyLiveFeed() {
  return {
    events: [],
    liveNow: { ...EMPTY_LIVE },
    totals: { asking: 0, answering: 0, learning: 0, inRoom: 0 },
  };
}

function computeTotals(liveNow) {
  return {
    asking: (liveNow.asking || []).length,
    answering: (liveNow.answering || []).length,
    learning: (liveNow.learning || []).length,
    inRoom: (liveNow.in_room || []).length,
  };
}

export function mergePresenceIntoFeed(feed, presence) {
  if (!presence?.userId || !presence?.status) return feed;

  const liveNow = {
    asking: [...(feed.liveNow?.asking || [])],
    answering: [...(feed.liveNow?.answering || [])],
    learning: [...(feed.liveNow?.learning || [])],
    in_room: [...(feed.liveNow?.in_room || [])],
  };

  for (const key of Object.keys(liveNow)) {
    liveNow[key] = liveNow[key].filter((u) => u.userId !== presence.userId);
  }

  if (liveNow[presence.status]) {
    liveNow[presence.status] = [presence, ...liveNow[presence.status]];
  }

  return {
    ...feed,
    liveNow,
    totals: computeTotals(liveNow),
  };
}

export function mergeEventIntoFeed(feed, event, limit = 40) {
  if (!event?.id) return feed;
  const events = [
    event,
    ...(feed.events || []).filter((e) => e.id !== event.id),
  ].slice(0, limit);
  return { ...feed, events };
}

export function handleActivityWsPayload(feed, payload) {
  if (!payload || typeof payload !== 'object') return feed;
  if (payload.type === 'presence' && payload.presence) {
    return mergePresenceIntoFeed(feed, payload.presence);
  }
  if (payload.type === 'event' && payload.event) {
    return mergeEventIntoFeed(feed, payload.event);
  }
  return feed;
}

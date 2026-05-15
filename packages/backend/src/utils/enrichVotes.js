import Vote from '../models/Vote.js';

export async function enrichWithVotes(entity, entityType, userId = null) {
  if (!entity) return entity;
  return Vote.enrichEntity(entity, entityType, userId);
}

export async function enrichManyWithVotes(entities, entityType, userId = null) {
  return Vote.enrichMany(entities, entityType, userId);
}

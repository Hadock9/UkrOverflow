/**
 * SQL-фрагменти для підрахунку голосів з таблиці votes.
 */

export function voteTotalExpr(entityType, entityIdRef) {
  const et = String(entityType).replace(/'/g, "''");
  return `(
    (SELECT COUNT(*) FROM votes WHERE entity_type = '${et}' AND entity_id = ${entityIdRef} AND vote_type = 'up')
    -
    (SELECT COUNT(*) FROM votes WHERE entity_type = '${et}' AND entity_id = ${entityIdRef} AND vote_type = 'down')
  )`;
}

export function voteUpvotesExpr(entityType, entityIdRef) {
  const et = String(entityType).replace(/'/g, "''");
  return `(SELECT COUNT(*) FROM votes WHERE entity_type = '${et}' AND entity_id = ${entityIdRef} AND vote_type = 'up')`;
}

export function voteDownvotesExpr(entityType, entityIdRef) {
  const et = String(entityType).replace(/'/g, "''");
  return `(SELECT COUNT(*) FROM votes WHERE entity_type = '${et}' AND entity_id = ${entityIdRef} AND vote_type = 'down')`;
}

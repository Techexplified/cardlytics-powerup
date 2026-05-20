const BASE = "https://api.trello.com/1";

export function buildAuth(key, token) {
  return `key=${key}&token=${token}`;
}

export async function getBoard(key, token, boardId) {
  const res = await fetch(`${BASE}/boards/${boardId}?${buildAuth(key, token)}&fields=name`);
  if (!res.ok) throw new Error(`Trello error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function getBoardCards(key, token, boardId) {
  const res = await fetch(
    `${BASE}/boards/${boardId}/cards?${buildAuth(key, token)}&fields=id,name,idMembers,labels,due,dateLastActivity,idList`
  );
  if (!res.ok) throw new Error(`Trello error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function getMemberId(key, token, username) {
  const res = await fetch(`${BASE}/members/${username}?${buildAuth(key, token)}&fields=id`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.id || null;
}

export async function getListCards(key, token, listId) {
  const res = await fetch(`${BASE}/lists/${listId}/cards?${buildAuth(key, token)}&fields=id`);
  if (!res.ok) return [];
  return res.json();
}

export function computeStats(cards, memberId) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfWeek = new Date(startOfDay);
  endOfWeek.setDate(startOfDay.getDate() + 7);
  const staleThreshold = new Date(now);
  staleThreshold.setDate(now.getDate() - 30);

  let assigned = 0, dueThisWeek = 0, overdue = 0;
  let unassigned = 0, withLabel = 0, stale = 0, createdToday = 0;

  for (const card of cards) {
    if (memberId && card.idMembers.includes(memberId)) assigned++;
    if (card.idMembers.length === 0) unassigned++;
    if (card.labels && card.labels.length > 0) withLabel++;

    if (card.due) {
      const due = new Date(card.due);
      if (due < now) overdue++;
      else if (due <= endOfWeek) dueThisWeek++;
    }

    if (card.dateLastActivity) {
      const lastActive = new Date(card.dateLastActivity);
      if (lastActive < staleThreshold) stale++;
      if (lastActive >= startOfDay) createdToday++;
    }
  }

  return { assigned, dueThisWeek, overdue, unassigned, withLabel, stale, createdToday };
}
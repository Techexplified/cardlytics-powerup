const BASE = "https://api.trello.com/1";

export function buildAuth(key, token) {
  return `key=${key}&token=${token}`;
}

export async function getBoard(key, token, boardId) {
  const res = await fetch(
    `${BASE}/boards/${boardId}?${buildAuth(key, token)}&fields=name`
  );
  if (!res.ok) throw new Error(`Trello error ${res.status}`);
  return res.json();
}

export async function getBoardCards(key, token, boardId) {
  const res = await fetch(
    `${BASE}/boards/${boardId}/cards?${buildAuth(key, token)}&fields=id,name,idMembers,labels,due,dueComplete,dateLastActivity,idList`
  );
  if (!res.ok) throw new Error(`Trello error ${res.status}`);
  return res.json();
}

export async function getMemberId(key, token) {
  const res = await fetch(`${BASE}/members/me?${buildAuth(key, token)}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.id;
}

export async function getMemberDetails(key, token, memberId) {
  const res = await fetch(
    `${BASE}/members/${memberId}?${buildAuth(key, token)}&fields=fullName,initials,avatarHash`
  );
  if (!res.ok) return null;
  return res.json();
}

export async function getListCards(key, token, listId) {
  const res = await fetch(
    `${BASE}/lists/${listId}/cards?${buildAuth(key, token)}&fields=id,name,idMembers,labels,due,dueComplete,dateLastActivity,idList`
  );
  if (!res.ok) return [];
  return res.json();
}

export function computeStats(cards, memberId) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfWeek = new Date(startOfDay);
  endOfWeek.setDate(startOfDay.getDate() + 7);
  const staleThreshold = new Date(now);
  staleThreshold.setDate(now.getDate() - 14);

  let assigned = 0, dueThisWeek = 0, overdue = 0,
      unassigned = 0, withLabel = 0, stale = 0, createdToday = 0;

  for (const card of cards) {
    if (memberId && card.idMembers?.includes(memberId)) assigned++;
    if (!card.idMembers || card.idMembers.length === 0) unassigned++;
    if (card.labels && card.labels.length > 0) withLabel++;
    if (card.due && !card.dueComplete) {
      const due = new Date(card.due);
      if (due < now) overdue++;
      else if (due >= startOfDay && due <= endOfWeek) dueThisWeek++;
    }
    if (card.dateLastActivity) {
      const lastActive = new Date(card.dateLastActivity);
      if (lastActive < staleThreshold) stale++;
    }
    const timestamp = parseInt(card.id.substring(0, 8), 16) * 1000;
    const createdDate = new Date(timestamp);
    if (createdDate >= startOfDay) createdToday++;
  }

  return { assigned, dueThisWeek, overdue, unassigned, withLabel, stale, createdToday };
}

export function computeDetailStats(cards) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfWeek = new Date(startOfDay);
  endOfWeek.setDate(startOfDay.getDate() + 7);

  const labelCounts = {};
  let dueThisWeek = 0, withLabel = 0;

  for (const card of cards) {
    if (card.labels && card.labels.length > 0) {
      withLabel++;
      for (const lbl of card.labels) {
        const key = lbl.color || "none";
        labelCounts[key] = (labelCounts[key] || { count: 0, name: lbl.color, color: lbl.color });
        labelCounts[key].count++;
      }
    }
    if (card.due && !card.dueComplete) {
      const due = new Date(card.due);
      if (due >= startOfDay && due <= endOfWeek) dueThisWeek++;
    }
  }

  return { labelCounts, dueThisWeek, withLabel, total: cards.length };
}

export async function getBoardLists(key, token, boardId) {
  const res = await fetch(
    `${BASE}/boards/${boardId}/lists?${buildAuth(key, token)}&fields=id,name`
  );
  if (!res.ok) return [];
  return res.json();
}

// ➕ Create a Cardlytics tracker card
// - pos=top so it appears at the top of the list
// - cover color makes it visually distinct from regular cards
export async function createCard(key, token, listId, name, desc, coverColor = "blue") {
  const url = `${BASE}/cards?${buildAuth(key, token)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      idList: listId,
      name,
      desc,
      pos: "top",
      cover: {
        color: coverColor,
        brightness: "dark",
        size: "normal",
      },
    }),
  });
  if (!res.ok) {
    const errorText = await res.text();
    console.error("Trello API Error:", errorText);
    throw new Error("Failed to create card");
  }
  return res.json();
}
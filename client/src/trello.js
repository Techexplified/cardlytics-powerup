const BASE = "https://api.trello.com/1";

// 🔐 Build auth query
export function buildAuth(key, token) {
  return `key=${key}&token=${token}`;
}

// 📋 Get board info
export async function getBoard(key, token, boardId) {
  const res = await fetch(
    `${BASE}/boards/${boardId}?${buildAuth(key, token)}&fields=name`
  );
  if (!res.ok) throw new Error(`Trello error ${res.status}`);
  return res.json();
}

// 🧾 Get all cards from board
export async function getBoardCards(key, token, boardId) {
  const res = await fetch(
    `${BASE}/boards/${boardId}/cards?${buildAuth(
      key,
      token
    )}&fields=id,name,idMembers,labels,due,dueComplete,dateLastActivity,idList`
  );
  if (!res.ok) throw new Error(`Trello error ${res.status}`);
  return res.json();
}

// 👤 Get current user ID + full member info
export async function getMemberId(key, token) {
  const res = await fetch(`${BASE}/members/me?${buildAuth(key, token)}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.id;
}

// 👥 Get member details by ID (name + initials + avatar)
export async function getMemberDetails(key, token, memberId) {
  const res = await fetch(
    `${BASE}/members/${memberId}?${buildAuth(key, token)}&fields=fullName,initials,avatarHash`
  );
  if (!res.ok) return null;
  return res.json();
}

// 📌 Get cards in specific list
export async function getListCards(key, token, listId) {
  const res = await fetch(
    `${BASE}/lists/${listId}/cards?${buildAuth(
      key,
      token
    )}&fields=id,name,idMembers,labels,due,dueComplete,dateLastActivity,idList`
  );
  if (!res.ok) return [];
  return res.json();
}

// 📊 Compute all stats
export function computeStats(cards, memberId) {
  const now = new Date();

  const startOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const endOfWeek = new Date(startOfDay);
  endOfWeek.setDate(startOfDay.getDate() + 7);

  const staleThreshold = new Date(now);
  staleThreshold.setDate(now.getDate() - 14);

  let assigned = 0,
    dueThisWeek = 0,
    overdue = 0,
    unassigned = 0,
    withLabel = 0,
    stale = 0,
    createdToday = 0;

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

// 📊 Compute stats for the details view (with label breakdown)
export function computeDetailStats(cards) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfWeek = new Date(startOfDay);
  endOfWeek.setDate(startOfDay.getDate() + 7);

  const labelCounts = {};
  let dueThisWeek = 0;
  let withLabel = 0;

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

// 📋 Get all lists from board
export async function getBoardLists(key, token, boardId) {
  const res = await fetch(
    `${BASE}/boards/${boardId}/lists?${buildAuth(key, token)}&fields=id,name`
  );
  if (!res.ok) return [];
  return res.json();
}

// ➕ Create a new card
export async function createCard(key, token, listId, name, desc) {
  const url = `${BASE}/cards?${buildAuth(key, token)}&idList=${listId}&name=${encodeURIComponent(name)}&desc=${encodeURIComponent(desc)}`;
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) {
    const errorText = await res.text();
    console.error("Trello API Error:", errorText);
    throw new Error("Failed to create card");
  }
  return res.json();
}
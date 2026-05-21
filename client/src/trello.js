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

// 👤 Get current user ID
export async function getMemberId(key, token) {
  const res = await fetch(`${BASE}/members/me?${buildAuth(key, token)}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.id;
}

// 📌 Get cards in specific list
export async function getListCards(key, token, listId) {
  const res = await fetch(
    `${BASE}/lists/${listId}/cards?${buildAuth(
      key,
      token
    )}&fields=id`
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
  staleThreshold.setDate(now.getDate() - 14); // ✅ 14 days

  let assigned = 0,
    dueThisWeek = 0,
    overdue = 0,
    unassigned = 0,
    withLabel = 0,
    stale = 0,
    createdToday = 0;

  for (const card of cards) {
    // ✅ Assigned to me
    if (memberId && card.idMembers?.includes(memberId)) {
      assigned++;
    }

    // ✅ Unassigned
    if (!card.idMembers || card.idMembers.length === 0) {
      unassigned++;
    }

    // ✅ With label
    if (card.labels && card.labels.length > 0) {
      withLabel++;
    }

    // ✅ Due logic
    if (card.due && !card.dueComplete) {
      const due = new Date(card.due);

      if (due < now) {
        overdue++;
      } else if (due >= startOfDay && due <= endOfWeek) {
        dueThisWeek++;
      }
    }

    // ✅ Stale cards
    if (card.dateLastActivity) {
      const lastActive = new Date(card.dateLastActivity);

      if (lastActive < staleThreshold) {
        stale++;
      }
    }

    // ✅ Created today (from ID)
    const timestamp = parseInt(card.id.substring(0, 8), 16) * 1000;
    const createdDate = new Date(timestamp);

    if (createdDate >= startOfDay) {
      createdToday++;
    }
  }

  return {
    assigned,
    dueThisWeek,
    overdue,
    unassigned,
    withLabel,
    stale,
    createdToday,
  };
}
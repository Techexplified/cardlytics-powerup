const BASE = "https://api.trello.com/1";

export function buildAuth(key, token) {
  return `key=${key}&token=${token}`;
}

export async function getBoard(key, token, boardId) {
  const res = await fetch(
    `${BASE}/boards/${boardId}?${buildAuth(key, token)}&fields=name`,
  );
  if (!res.ok) throw new Error(`Trello error ${res.status}`);
  return res.json();
}

export async function getBoardCards(key, token, boardId) {
  const res = await fetch(
    `${BASE}/boards/${boardId}/cards?${buildAuth(key, token)}&fields=id,name,idMembers,labels,due,dueComplete,dateLastActivity,idList,desc`,
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
    `${BASE}/members/${memberId}?${buildAuth(key, token)}&fields=fullName,initials,avatarHash`,
  );
  if (!res.ok) return null;
  return res.json();
}

export async function getListCards(key, token, listId) {
  const res = await fetch(
    `${BASE}/lists/${listId}/cards?${buildAuth(key, token)}&fields=id,name,idMembers,labels,due,dueComplete,dateLastActivity,idList,desc`,
  );
  if (!res.ok) return [];
  return res.json();
}

// ── Exported so App.jsx can use the same week boundaries everywhere ───────────
export function getWeekBounds(now) {
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // "this week" = from start of today through the end of the upcoming Sunday
  const endOfWeek = new Date(startOfDay);
  const daysUntilSunday = 7 - startOfDay.getDay(); // 0=Sun gives 7, 1=Mon gives 6, etc.
  endOfWeek.setDate(startOfDay.getDate() + daysUntilSunday);

  return { startOfDay, startOfWeek: startOfDay, endOfWeek };
}

export function computeStats(cards, memberId) {
  const now = new Date();
  const { startOfDay, startOfWeek, endOfWeek } = getWeekBounds(now);
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
    if (card.due) {
      const due = new Date(card.due);
      if (due < now && !card.dueComplete) overdue++; // overdue only if not complete
      if (due >= startOfWeek && due < endOfWeek) dueThisWeek++; // due this week regardless of completion
    }
    if (card.dateLastActivity) {
      const lastActive = new Date(card.dateLastActivity);
      if (lastActive < staleThreshold) stale++;
    }
    const timestamp = parseInt(card.id.substring(0, 8), 16) * 1000;
    const createdDate = new Date(timestamp);
    if (createdDate >= startOfDay) createdToday++;
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

export function computeDetailStats(cards) {
  const now = new Date();
  const { startOfWeek, endOfWeek } = getWeekBounds(now);

  const labelCounts = {};
  let dueThisWeek = 0,
    withLabel = 0;

  for (const card of cards) {
    if (card.labels && card.labels.length > 0) {
      withLabel++;
      for (const lbl of card.labels) {
        const key = lbl.color || "none";
        if (!labelCounts[key])
          labelCounts[key] = { count: 0, name: lbl.color, color: lbl.color };
        labelCounts[key].count++;
      }
    }
    if (card.due && !card.dueComplete) {
      const due = new Date(card.due);
      // ── Use calendar week (Sunday→Sunday) consistently ────────────────────
      if (due >= startOfWeek && due < endOfWeek) dueThisWeek++;
    }
  }

  return { labelCounts, dueThisWeek, withLabel, total: cards.length };
}

export async function getBoardLists(key, token, boardId) {
  const res = await fetch(
    `${BASE}/boards/${boardId}/lists?${buildAuth(key, token)}&fields=id,name`,
  );
  if (!res.ok) return [];
  return res.json();
}

// ── Convert base64 data URL to Blob without fetch (avoids CSP issues) ────────
function dataUrlToBlob(dataUrl) {
  const base64Data = dataUrl.split(",")[1];
  const byteCharacters = atob(base64Data);
  const byteArray = new Uint8Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteArray[i] = byteCharacters.charCodeAt(i);
  }
  return new Blob([byteArray], { type: "image/jpeg" });
}

// ── Create a Cardlytics tracker card ─────────────────────────────────────────
export async function createCard(
  key,
  token,
  listId,
  name,
  desc,
  coverColor = "blue",
  coverImageDataUrl = null,
) {
  // Step 1: create the card
  const createParams = new URLSearchParams({
    key,
    token,
    idList: listId,
    name,
    desc,
    pos: "top",
  });
  const createRes = await fetch(`${BASE}/cards`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: createParams.toString(),
  });
  if (!createRes.ok) {
    const err = await createRes.text();
    console.error("Trello createCard error:", err);
    throw new Error("Failed to create card");
  }
  const card = await createRes.json();

  // Step 2a: if a custom image was provided, upload it as an attachment
  if (coverImageDataUrl) {
    try {
      const blob = dataUrlToBlob(coverImageDataUrl);
      const formData = new FormData();
      formData.append("key", key);
      formData.append("token", token);
      formData.append("file", blob, "cover.jpg");
      formData.append("setCover", "false");

      const attachRes = await fetch(`${BASE}/cards/${card.id}/attachments`, {
        method: "POST",
        body: formData,
      });

      if (attachRes.ok) {
        const attachment = await attachRes.json();

        // Step 2b: set that attachment as the card cover
        await fetch(`${BASE}/cards/${card.id}?key=${key}&token=${token}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cover: {
              idAttachment: attachment.id,
              brightness: "dark",
              size: "full",
            },
          }),
        });
      } else {
        console.warn("Attachment upload failed:", await attachRes.text());
      }
    } catch (err) {
      console.warn("Cover image upload error:", err);
    }
  } else {
    // Step 2b: apply cover color via JSON body
    const coverRes = await fetch(
      `${BASE}/cards/${card.id}?key=${key}&token=${token}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cover: {
            color: coverColor,
            brightness: "dark",
            size: "full",
          },
        }),
      },
    );
    if (!coverRes.ok) {
      console.warn("Cover color apply failed:", await coverRes.text());
    }
  }

  return card;
}

// ➕ Create a new list on a board
export async function createList(key, token, boardId, name) {
  const res = await fetch(
    `${BASE}/lists?${buildAuth(key, token)}&idBoard=${boardId}&name=${encodeURIComponent(name)}`,
    { method: "POST" },
  );
  if (!res.ok) throw new Error("Failed to create list");
  return res.json();
}

// ── Apply user-configured filters to a card array ────────────────────────────
// filters shape (mirrors CardConfigModal onSave output):
//   { due: string[], members: string[], labels: string[], lists: string[],
//     customDateFrom: string, customDateTo: string }
// memberId: the current user's Trello member ID (used to resolve "me")
export function applyFilters(cards, filters, memberId) {
  if (!filters) return cards;

  const now = new Date();

  return cards.filter((card) => {
    // ── Due filter ────────────────────────────────────────────────────────────
    if (filters.due && filters.due.length > 0) {
      const due = card.due ? new Date(card.due) : null;
      const matches = filters.due.some((d) => {
        if (d === "nodate") return !due;
        if (!due) return false;
        if (d === "overdue") return due < now && !card.dueComplete;
        if (d === "2days")
          return due >= now && due <= new Date(now.getTime() + 2 * 86400000);
        if (d === "1week")
          return due >= now && due <= new Date(now.getTime() + 7 * 86400000);
        if (d === "2weeks")
          return due >= now && due <= new Date(now.getTime() + 14 * 86400000);
        if (d === "1month")
          return due >= now && due <= new Date(now.getTime() + 30 * 86400000);
        if (d === "custom") {
          const from = filters.customDateFrom
            ? new Date(filters.customDateFrom)
            : null;
          const to = filters.customDateTo
            ? new Date(filters.customDateTo)
            : null;
          if (from && due < from) return false;
          if (to && due > to) return false;
          return true;
        }
        return false;
      });
      if (!matches) return false;
    }

    // ── Member / assigned filter ──────────────────────────────────────────────
    if (filters.members && filters.members.length > 0) {
      // FIX #5: guard against null memberId before resolving "me"
      const resolvedIds = filters.members
        .map((id) => (id === "me" && memberId ? memberId : id))
        .filter(Boolean); // remove any remaining null/undefined

      const cardMembers = card.idMembers || [];
      const hasMatch = resolvedIds.some((id) => cardMembers.includes(id));
      if (!hasMatch) return false;
    }

    // ── Label filter (by label id) ────────────────────────────────────────────
    if (filters.labels && filters.labels.length > 0) {
      const cardLabelIds = (card.labels || []).map((l) => l.id);
      const hasMatch = filters.labels.some((id) => cardLabelIds.includes(id));
      if (!hasMatch) return false;
    }

    // ── List filter ───────────────────────────────────────────────────────────
   // ── List filter ───────────────────────────────────────────────────────────
    if (filters.lists && filters.lists.length > 0) {
      if (!filters.lists.includes(card.idList)) return false;
    }

    // ── Status filter ─────────────────────────────────────────────────────────
    if (filters.status && filters.status.length > 0) {
      const now = new Date();
      const matches = filters.status.some(s => {
        if (s === "complete")   return card.dueComplete === true;
        if (s === "incomplete") return !card.dueComplete;
        if (s === "overdue")    return card.due && new Date(card.due) < now && !card.dueComplete;
        return false;
      });
      if (!matches) return false;
    }

    // ── Activity filter ───────────────────────────────────────────────────────
    if (filters.activity && filters.activity.length > 0) {
      const now = new Date();
      const last = card.dateLastActivity ? new Date(card.dateLastActivity) : null;
      const matches = filters.activity.some(a => {
        if (!last) return false;
        const diffDays = (now - last) / 86400000;
        if (a === "1day")    return diffDays <= 1;
        if (a === "3days")   return diffDays <= 3;
        if (a === "7days")   return diffDays <= 7;
        if (a === "14days")  return diffDays <= 14;
        if (a === "30days")  return diffDays <= 30;
        if (a === "stale14") return diffDays > 14;
        if (a === "stale30") return diffDays > 30;
        return false;
      });
      if (!matches) return false;
    }

    return true;
  });
}

// ── Workspace boards (for Board scope dropdown) ──────────────────────────────
export async function getWorkspaceBoards(key, token) {
  const res = await fetch(
    `${BASE}/members/me/boards?${buildAuth(key, token)}&fields=id,name&filter=open`,
  );
  if (!res.ok) return [];
  return res.json(); // [{ id, name }, ...]
}

export async function getBoardMembers(key, token, boardId) {
  const res = await fetch(
    `${BASE}/boards/${boardId}/members?${buildAuth(key, token)}&fields=id,fullName,initials`,
  );
  if (!res.ok) return [];
  return res.json();
}

export async function getBoardLabels(key, token, boardId) {
  const res = await fetch(
    `${BASE}/boards/${boardId}/labels?${buildAuth(key, token)}&fields=id,name,color&limit=200`,
  );
  if (!res.ok) return [];
  return res.json();
}

function dedupeById(arr) {
  const seen = new Set();
  return arr.filter((x) => x?.id && !seen.has(x.id) && seen.add(x.id));
}

// ── Fetch lists/members/labels scoped to a board, or merged across all boards ─
// targetBoardId === null  ->  merge across every board in `boards`
export async function getBoardScopedData(key, token, targetBoardId, boards = []) {
  if (targetBoardId === null) {
    const results = await Promise.all(
      boards.map((b) => getBoardScopedData(key, token, b.id, boards)),
    );
    return {
      lists: results.flatMap((r, i) =>
        r.lists.map((l) => ({ ...l, name: `${boards[i].name}: ${l.name}` })),
      ),
      members: dedupeById(results.flatMap((r) => r.members)),
      boardLabels: dedupeById(results.flatMap((r) => r.boardLabels)),
    };
  }

  const [lists, members, boardLabels] = await Promise.all([
    getBoardLists(key, token, targetBoardId),
    getBoardMembers(key, token, targetBoardId),
    getBoardLabels(key, token, targetBoardId),
  ]);
  return { lists, members, boardLabels };
}

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

// ── Convert base64 data URL to Blob without fetch (avoids CSP issues) ────────
function dataUrlToBlob(dataUrl) {
  const base64Data = dataUrl.split(',')[1];
  const byteCharacters = atob(base64Data);
  const byteArray = new Uint8Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteArray[i] = byteCharacters.charCodeAt(i);
  }
  return new Blob([byteArray], { type: 'image/jpeg' });
}

// ── Create a Cardlytics tracker card ─────────────────────────────────────────
export async function createCard(key, token, listId, name, desc, coverColor = "blue", coverImageDataUrl = null) {
  // Step 1: create the card
  const createParams = new URLSearchParams({ key, token, idList: listId, name, desc, pos: "top" });
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
    const coverRes = await fetch(`${BASE}/cards/${card.id}?key=${key}&token=${token}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cover: {
          color: coverColor,
          brightness: "dark",
          size: "full",
        },
      }),
    });
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
    { method: "POST" }
  );
  if (!res.ok) throw new Error("Failed to create list");
  return res.json();
} 

export async function updateCardCover(key, token, cardId, coverImageDataUrl, desc) {
  const blob = dataUrlToBlob(coverImageDataUrl);

  const formData = new FormData();
  formData.append("key", key);
  formData.append("token", token);
  formData.append("file", blob, "cover.jpg");
  formData.append("setCover", "true");

  await fetch(`https://api.trello.com/1/cards/${cardId}/attachments`, {
    method: "POST",
    body: formData,
  });

  // ✅ ALSO update description
  await fetch(`https://api.trello.com/1/cards/${cardId}?key=${key}&token=${token}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ desc }),
  });
}
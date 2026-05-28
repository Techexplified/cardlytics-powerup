const BASE = "https://api.trello.com/1";

export function buildAuth(key, token) {
  return `key=${key}&token=${token}`;
}

// ================= FETCH =================

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

export async function getListCards(key, token, listId) {
  const res = await fetch(
    `${BASE}/lists/${listId}/cards?${buildAuth(key, token)}&fields=id,name,idMembers,labels,due,dueComplete,dateLastActivity,idList`
  );
  if (!res.ok) return [];
  return res.json();
}

export async function getBoardLists(key, token, boardId) {
  const res = await fetch(
    `${BASE}/boards/${boardId}/lists?${buildAuth(key, token)}&fields=id,name`
  );
  if (!res.ok) return [];
  return res.json();
}

// ================= CREATE CARD =================

export async function createCard(
  key,
  token,
  listId,
  name,
  desc,
  coverColor = "blue",
  coverImageDataUrl = null
) {
  const params = new URLSearchParams({
    key,
    token,
    idList: listId,
    name,
    desc,
    pos: "top",
  });

  const res = await fetch(`${BASE}/cards`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) throw new Error("Failed to create card");
  const card = await res.json();

  // 👉 If image
  if (coverImageDataUrl) {
    const blob = await (await fetch(coverImageDataUrl)).blob();

    const formData = new FormData();
    formData.append("file", blob, `cover-${Date.now()}.jpg`); // 🔥 UNIQUE NAME
    formData.append("key", key);
    formData.append("token", token);

    const attachRes = await fetch(
      `${BASE}/cards/${card.id}/attachments`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (attachRes.ok) {
      const attachment = await attachRes.json();

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
    }
  } else {
    // color fallback
    await fetch(`${BASE}/cards/${card.id}?key=${key}&token=${token}`, {
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
  }

  return card;
}

// ================= UPDATE CARD =================

export async function updateCard(key, token, cardId, updates) {
  const params = new URLSearchParams({ key, token, ...updates });

  const res = await fetch(`${BASE}/cards/${cardId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  if (!res.ok) throw new Error("Failed to update card");
  return res.json();
}

// ================= FIXED COVER UPDATE 🔥 =================

export async function updateCardCover(
  key,
  token,
  cardId,
  coverImageDataUrl
) {
  try {
    const blob = await (await fetch(coverImageDataUrl)).blob();

    const form = new FormData();
    form.append("file", blob, `cover-${Date.now()}.jpg`); // 🔥 VERY IMPORTANT
    form.append("key", key);
    form.append("token", token);

    // STEP 1: Upload attachment
    const attachRes = await fetch(
      `${BASE}/cards/${cardId}/attachments`,
      {
        method: "POST",
        body: form,
      }
    );

    if (!attachRes.ok) {
      console.error("Attachment upload failed");
      return;
    }

    const attachment = await attachRes.json();

    // STEP 2: Set as cover
    const coverRes = await fetch(
      `${BASE}/cards/${cardId}?key=${key}&token=${token}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cover: {
            idAttachment: attachment.id,
            size: "full",
            brightness: "dark",
          },
        }),
      }
    );

    if (!coverRes.ok) {
      console.error("Cover update failed");
    }
  } catch (err) {
    console.error("updateCardCover error:", err);
  }
}
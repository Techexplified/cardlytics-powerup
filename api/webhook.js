import { createCanvas } from "@napi-rs/canvas";

export default async function handler(req, res) {
  if (req.method === "HEAD") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const key = process.env.TRELLO_API_KEY;
  const token = process.env.TRELLO_TOKEN;
  const BASE = "https://api.trello.com/1";

  const COVER_COLORS = {
    assigned: "#1565c0",
    dueThisWeek: "#f57f17",
    overdue: "#b71c1c",
    unassigned: "#6a1b9a",
    withLabel: "#e65100",
    stale: "#212121",
    createdToday: "#1b5e20",
    cardsInList: "#0277bd",
  };

  function generateImage(count, colorHex) {
    const W = 800, H = 320;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = colorHex;
    ctx.fillRect(0, 0, W, H);

    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "rgba(255,255,255,0.07)");
    grad.addColorStop(1, "rgba(0,0,0,0.25)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    const numStr = String(count);
    const fontSize = numStr.length > 3 ? 90 : numStr.length > 2 ? 110 : 130;
    ctx.font = `900 ${fontSize}px sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 28;
    ctx.fillText(numStr, W / 2, H / 2);

    return canvas.toBuffer("image/jpeg");
  }

  try {
    const body = req.body;
    const boardId = body?.model?.id || body?.action?.data?.board?.id;
    if (!boardId) return res.status(200).json({ ok: true, skipped: "no boardId" });

    const cardsRes = await fetch(`${BASE}/boards/${boardId}/cards?key=${key}&token=${token}&fields=id,name,idMembers,labels,due,dueComplete,dateLastActivity,idList`);
    const allCards = await cardsRes.json();

    const meRes = await fetch(`${BASE}/members/me?key=${key}&token=${token}`);
    const me = await meRes.json();
    const memberId = me.id;

    const isTrackerCard = (name) => {
      const lower = name.toLowerCase();
      return ["assigned to me","due this week","overdue cards","unassigned cards","cards with a label","stale cards","created today","cards in list"].some(p => lower.includes(p));
    };

    const filtered = allCards.filter(c => !isTrackerCard(c.name));
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfWeek = new Date(startOfDay);
    endOfWeek.setDate(startOfDay.getDate() + 7);
    const staleThreshold = new Date(now);
    staleThreshold.setDate(now.getDate() - 14);

    const stats = {
      assigned:     filtered.filter(c => c.idMembers?.includes(memberId)).length,
      dueThisWeek:  filtered.filter(c => c.due && !c.dueComplete && new Date(c.due) >= now && new Date(c.due) <= endOfWeek).length,
      overdue:      filtered.filter(c => c.due && !c.dueComplete && new Date(c.due) < now).length,
      unassigned:   filtered.filter(c => !c.idMembers?.length).length,
      withLabel:    filtered.filter(c => c.labels?.length > 0).length,
      stale:        filtered.filter(c => c.dateLastActivity && new Date(c.dateLastActivity) < staleThreshold).length,
      createdToday: filtered.filter(c => new Date(parseInt(c.id.substring(0,8), 16) * 1000) >= startOfDay).length,
    };

    const nameToType = {
      "assigned to me": "assigned",
      "due this week": "dueThisWeek",
      "overdue cards": "overdue",
      "unassigned cards": "unassigned",
      "cards with a label": "withLabel",
      "stale cards": "stale",
      "created today": "createdToday",
    };

    const emoji = { assigned:"📌", dueThisWeek:"📅", overdue:"⚠️", unassigned:"👤", withLabel:"🏷️", stale:"💤", createdToday:"✨", cardsInList:"📋" };
    const label = { assigned:"Assigned to Me", dueThisWeek:"Due This Week", overdue:"Overdue Cards", unassigned:"Unassigned Cards", withLabel:"Cards With Label", stale:"Stale Cards", createdToday:"Created Today", cardsInList:"Cards in List" };

    const listsRes = await fetch(`${BASE}/boards/${boardId}/lists?key=${key}&token=${token}&fields=id,name`);
    const lists = await listsRes.json();
    const cardlyticsList = lists.find(l => l.name === "Cardlytics");
    if (!cardlyticsList) return res.status(200).json({ ok: true, skipped: "no list" });

    const tcRes = await fetch(`${BASE}/lists/${cardlyticsList.id}/cards?key=${key}&token=${token}&fields=id,name,desc`);
    const trackerCards = (await tcRes.json()).filter(c => isTrackerCard(c.name));

    for (const card of trackerCards) {
      const lower = card.name.toLowerCase();
      const matchedKey = Object.keys(nameToType).find(k => lower.includes(k));
      if (!matchedKey) continue;

      const type = nameToType[matchedKey];
      const metaMatch = card.desc?.match(/\[_\]: cardlytics:mode:(board|list)(?::listId:([a-f0-9]+))?/);
      let newCount = stats[type] ?? 0;

      if (metaMatch?.[1] === "list" && metaMatch?.[2]) {
        const lcRes = await fetch(`${BASE}/lists/${metaMatch[2]}/cards?key=${key}&token=${token}&fields=id,name,idMembers,labels,due,dueComplete,dateLastActivity`);
        const lc = (await lcRes.json()).filter(c => !isTrackerCard(c.name));
        newCount = lc.filter(c => {
          if (type === "assigned") return c.idMembers?.includes(memberId);
          if (type === "unassigned") return !c.idMembers?.length;
          if (type === "withLabel") return c.labels?.length > 0;
          if (type === "overdue") return c.due && !c.dueComplete && new Date(c.due) < now;
          if (type === "dueThisWeek") return c.due && new Date(c.due) >= now && new Date(c.due) <= endOfWeek;
          return true;
        }).length;
      }

      const oldCount = parseInt(card.desc?.match(/^(\d+)/)?.[1] ?? "-1");
      if (oldCount === newCount) continue;

      const metaTag = card.desc?.match(/\[_\]: cardlytics:mode:[^\n]+/)?.[0] || "";

      // Update name and desc
      await fetch(`${BASE}/cards/${card.id}?key=${key}&token=${token}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${emoji[type]} ${label[type]} — ${newCount}`,
          desc: `${newCount} card(s) tracked by Cardlytics.${metaTag ? `\n\n${metaTag}` : ""}`,
        }),
      });

      // Generate and upload new cover image
      const imgBuffer = generateImage(newCount, COVER_COLORS[type] || "#1565c0");
      const formData = new FormData();
      formData.append("key", key);
      formData.append("token", token);
      formData.append("file", new Blob([imgBuffer], { type: "image/jpeg" }), "cover.jpg");

      const attachRes = await fetch(`${BASE}/cards/${card.id}/attachments`, {
        method: "POST",
        body: formData,
      });

      if (attachRes.ok) {
        const attachment = await attachRes.json();
        await fetch(`${BASE}/cards/${card.id}?key=${key}&token=${token}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cover: { idAttachment: attachment.id, brightness: "dark", size: "full" }
          }),
        });
      }
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).json({ error: err.message });
  }
}
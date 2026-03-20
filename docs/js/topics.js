/**
 * Topics view - browse by exam topics with importance ranks
 */
const Topics = (() => {
  let topicsData = null;
  let container = null;
  let onNavigate = null;

  const RANK_STYLES = {
    S: { label: "S", color: "#c0392b", bg: "#fdecea" },
    A: { label: "A", color: "#b8860b", bg: "#fef9e7" },
    B: { label: "B", color: "#2874a6", bg: "#ebf5fb" },
    C: { label: "C", color: "#707070", bg: "#f2f2f2" },
  };

  async function init(callback) {
    onNavigate = callback;
    const resp = await fetch("data/topics.json");
    topicsData = await resp.json();
  }

  function getArticleRank(articleNum) {
    if (!topicsData) return null;
    return topicsData.articleRanks[articleNum] || null;
  }

  function rankBadge(rank) {
    const s = RANK_STYLES[rank];
    if (!s) return "";
    return `<span class="rank-badge rank-${rank}" style="color:${s.color};background:${s.bg}">${s.label}</span>`;
  }

  function render() {
    container = document.getElementById("map-container");
    container.innerHTML = "";

    // Rank legend
    const legend = document.createElement("div");
    legend.className = "topics-legend";
    legend.innerHTML = `
      <span class="legend-label">重要度:</span>
      ${Object.entries(RANK_STYLES).map(([k, v]) =>
        `<span class="rank-badge rank-${k}" style="color:${v.color};background:${v.bg}">${k}</span>
         <span class="legend-desc">${topicsData.ranks[k]}</span>`
      ).join("")}
    `;
    container.appendChild(legend);

    // Category sections
    for (const category of topicsData.categories) {
      const section = document.createElement("div");
      section.className = "topics-category";

      const catHeader = document.createElement("h2");
      catHeader.className = "topics-category-name";
      catHeader.textContent = category.name;
      section.appendChild(catHeader);

      const topicsList = document.createElement("div");
      topicsList.className = "topics-list";

      for (const topic of category.topics) {
        const card = document.createElement("div");
        card.className = "topic-card";

        const header = document.createElement("div");
        header.className = "topic-card-header";

        const badge = document.createElement("span");
        const rs = RANK_STYLES[topic.rank];
        badge.className = `rank-badge rank-${topic.rank}`;
        badge.style.color = rs.color;
        badge.style.background = rs.bg;
        badge.textContent = topic.rank;

        const name = document.createElement("span");
        name.className = "topic-card-name";
        name.textContent = topic.name;

        header.appendChild(badge);
        header.appendChild(name);
        card.appendChild(header);

        if (topic.note) {
          const note = document.createElement("p");
          note.className = "topic-card-note";
          note.textContent = topic.note;
          card.appendChild(note);
        }

        // Article links
        const articlesEl = document.createElement("div");
        articlesEl.className = "topic-card-articles";

        for (const artNum of topic.articles) {
          const link = document.createElement("a");
          link.className = "topic-article-link";
          link.href = "#";
          link.textContent = artNum.replace(/_/g, "の") + "条";

          const artRank = topicsData.articleRanks[artNum];
          if (artRank) {
            const ars = RANK_STYLES[artRank];
            link.style.borderColor = ars.color;
          }

          link.addEventListener("click", (e) => {
            e.preventDefault();
            if (onNavigate) onNavigate(artNum, topic.sectionId);
          });
          articlesEl.appendChild(link);
        }

        card.appendChild(articlesEl);

        // Section link
        if (topic.sectionId) {
          const sectionLink = document.createElement("a");
          sectionLink.className = "topic-section-link";
          sectionLink.href = "#";
          sectionLink.textContent = "条文構造で見る →";
          sectionLink.addEventListener("click", (e) => {
            e.preventDefault();
            if (onNavigate) onNavigate(null, topic.sectionId);
          });
          card.appendChild(sectionLink);
        }

        topicsList.appendChild(card);
      }

      section.appendChild(topicsList);
      container.appendChild(section);
    }
  }

  return { init, render, getArticleRank, rankBadge, RANK_STYLES };
})();

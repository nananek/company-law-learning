/**
 * Map rendering - structure-based layout mirroring 六法 organization.
 * No proportional sizing; order and hierarchy are what matter.
 */
const LawMap = (() => {
  let data = null;
  let container = null;
  let currentNode = null;
  let onSectionClick = null;
  let onArticleClick = null;

  const PART_COLORS = {
    "root-part1": "#3B82F6",
    "root-part2": "#10B981",
    "root-part3": "#14B8A6",
    "root-part4": "#F59E0B",
    "root-part5": "#8B5CF6",
    "root-part6": "#EC4899",
    "root-part7": "#6B7280",
    "root-part8": "#EF4444",
  };

  function getPartColor(nodeId) {
    // Walk up to find the part-level id
    for (const key of Object.keys(PART_COLORS)) {
      if (nodeId && nodeId.startsWith(key)) return PART_COLORS[key];
    }
    return "#3B82F6";
  }

  // Build a flat lookup of id -> node
  const nodeIndex = new Map();

  function buildIndex(node, parent) {
    const id = node.id || "root";
    node._parent = parent;
    nodeIndex.set(id, node);
    if (node.children) {
      for (const child of node.children) {
        buildIndex(child, node);
      }
    }
  }

  function init(hierarchyData, callbacks) {
    data = hierarchyData;
    container = document.getElementById("map-container");
    onSectionClick = callbacks.onSectionClick;
    onArticleClick = callbacks.onArticleClick;
    buildIndex(data, null);
    renderRoot();
  }

  // Extract 第X編, 第X章 etc. prefix from full name
  function extractNum(name) {
    const m = name.match(/^(第[一二三四五六七八九十百千]+[編章節款目])/);
    return m ? m[1] : "";
  }

  function extractShortNum(name) {
    const m = name.match(/^第([一二三四五六七八九十百千]+)[編章節款目]/);
    return m ? m[1] : "";
  }

  // === Root view: all 8 parts with their chapters inline ===
  function renderRoot() {
    currentNode = data;
    container.innerHTML = "";

    const grid = document.createElement("div");
    grid.className = "map-grid map-grid--parts";

    for (const part of data.children || []) {
      const color = PART_COLORS[part.id] || "#3B82F6";

      const el = document.createElement("div");
      el.className = "map-part";
      el.style.setProperty("--part-color", color);

      // Header row
      const header = document.createElement("div");
      header.className = "map-part-header";

      const numEl = document.createElement("span");
      numEl.className = "map-part-num";
      numEl.textContent = extractNum(part.name);

      const nameEl = document.createElement("span");
      nameEl.className = "map-part-name";
      nameEl.textContent = part.nameShort;

      const rangeEl = document.createElement("span");
      rangeEl.className = "map-part-range";
      rangeEl.textContent = part.articleRange;

      header.appendChild(numEl);
      header.appendChild(nameEl);
      header.appendChild(rangeEl);
      el.appendChild(header);

      // Children (chapters) as inline tags
      if (part.children && part.children.length > 0) {
        const childContainer = document.createElement("div");
        childContainer.className = "map-part-children";

        for (const child of part.children) {
          const card = document.createElement("div");
          card.className = "map-card";
          card.style.setProperty("--part-color", color);

          const cardName = document.createElement("div");
          cardName.className = "map-card-name";
          cardName.textContent = child.nameShort;

          const cardRange = document.createElement("div");
          cardRange.className = "map-card-range";
          cardRange.textContent = child.articleRange;

          card.appendChild(cardName);
          card.appendChild(cardRange);

          card.addEventListener("click", () => {
            if (child.children && child.children.length > 0) {
              if (onSectionClick) onSectionClick(child);
            } else {
              if (onArticleClick) onArticleClick(child);
            }
          });

          childContainer.appendChild(card);
        }

        el.appendChild(childContainer);
      } else {
        // Part with no sub-sections (e.g. 第六編 外国会社) - make the whole row clickable
        header.style.cursor = "pointer";
        header.addEventListener("click", () => {
          if (onArticleClick) onArticleClick(part);
        });
      }

      grid.appendChild(el);
    }

    container.appendChild(grid);
  }

  // === Drill-down view: show children of a node as cards ===
  function renderNode(node) {
    currentNode = node;
    container.innerHTML = "";

    if (!node.children || node.children.length === 0) {
      // Leaf: load and show articles
      renderArticleList(node);
      return;
    }

    const color = getPartColor(node.id);
    const grid = document.createElement("div");
    grid.className = "map-grid map-grid--drill";

    for (const child of node.children) {
      const card = document.createElement("div");
      card.className = "map-drill-card";
      card.style.setProperty("--part-color", color);

      const numEl = document.createElement("div");
      numEl.className = "map-drill-card-num";
      numEl.textContent = extractNum(child.name);

      const nameEl = document.createElement("div");
      nameEl.className = "map-drill-card-name";
      nameEl.textContent = child.nameShort;

      const rangeEl = document.createElement("div");
      rangeEl.className = "map-drill-card-range";
      rangeEl.textContent = child.articleRange;

      card.appendChild(numEl);
      card.appendChild(nameEl);
      card.appendChild(rangeEl);

      // Show sub-children as small tags (preview)
      if (child.children && child.children.length > 0) {
        const tagsContainer = document.createElement("div");
        tagsContainer.className = "map-drill-card-children";
        for (const grandchild of child.children) {
          const tag = document.createElement("span");
          tag.className = "map-drill-child-tag";
          tag.textContent = grandchild.nameShort;
          tagsContainer.appendChild(tag);
        }
        card.appendChild(tagsContainer);
      }

      card.addEventListener("click", () => {
        if (child.children && child.children.length > 0) {
          if (onSectionClick) onSectionClick(child);
        } else {
          if (onArticleClick) onArticleClick(child);
        }
      });

      grid.appendChild(card);
    }

    container.appendChild(grid);
  }

  // === Leaf view: show article list for a section ===
  async function renderArticleList(node) {
    container.innerHTML = '<div class="loading">読み込み中</div>';

    const articles = await ArticlePanel.loadArticles(node.id);
    if (!articles || !articles.articles) {
      container.innerHTML = '<p style="color:var(--text-muted);padding:20px">条文データが見つかりません</p>';
      return;
    }

    container.innerHTML = "";
    const color = getPartColor(node.id);
    const list = document.createElement("div");
    list.className = "map-article-list";

    for (const art of articles.articles) {
      const item = document.createElement("div");
      item.className = "map-article-item";
      item.style.setProperty("--part-color", color);

      // Importance rank badge
      const rank = typeof Topics !== "undefined" ? Topics.getArticleRank(art.num) : null;
      if (rank) {
        const badge = document.createElement("span");
        badge.className = `rank-badge rank-${rank}`;
        const rs = Topics.RANK_STYLES[rank];
        badge.style.color = rs.color;
        badge.style.background = rs.bg;
        badge.textContent = rank;
        item.appendChild(badge);
      }

      const numEl = document.createElement("span");
      numEl.className = "map-article-num";
      numEl.textContent = art.title;

      const captionEl = document.createElement("span");
      captionEl.className = "map-article-caption";
      captionEl.textContent = art.caption || "";

      item.appendChild(numEl);
      item.appendChild(captionEl);

      item.addEventListener("click", () => {
        ArticlePanel.showArticle(art);
      });

      list.appendChild(item);
    }

    container.appendChild(list);
  }

  function zoomTo(nodeId) {
    const node = nodeIndex.get(nodeId);
    if (!node) return null;

    if (node.children && node.children.length > 0) {
      renderNode(node);
    } else {
      renderArticleList(node);
    }
    return node;
  }

  function zoomToRoot() {
    renderRoot();
    return data;
  }

  function getNode(nodeId) {
    return nodeIndex.get(nodeId) || null;
  }

  function getCurrentNode() {
    return currentNode;
  }

  return { init, zoomTo, zoomToRoot, getNode, getCurrentNode, renderArticleList };
})();

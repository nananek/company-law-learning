/**
 * Application entry point - state management, routing, module wiring
 */
(async function () {
  // State
  const state = {
    path: [],         // Navigation path: [{id, name}, ...]
    hierarchyData: null,
  };

  // Load hierarchy data
  const resp = await fetch("data/hierarchy.json");
  state.hierarchyData = await resp.json();

  // Show article count
  document.getElementById("article-count").textContent =
    state.hierarchyData.articleCount + "条";

  // Initialize article panel
  ArticlePanel.init();

  // Build a map of id -> node data for path resolution
  const nodeMap = new Map();
  function buildNodeMap(node, parent) {
    const id = node.id || "root";
    nodeMap.set(id, { ...node, parent });
    if (node.children) {
      for (const child of node.children) {
        buildNodeMap(child, node);
      }
    }
  }
  buildNodeMap(state.hierarchyData, null);

  // Initialize treemap
  Treemap.init(state.hierarchyData, {
    onTileClick: (d) => {
      // d is a D3 hierarchy node
      const nodeId = d.data.id;
      navigateTo(nodeId);
    },
    onArticleClick: (d) => {
      // Leaf section - show articles list
      const sectionId = d.data.id;
      const sectionName = d.data.name || d.data.nameShort;
      ArticlePanel.showSectionArticles(sectionId, sectionName);
    },
  });

  // Initialize search
  Search.init((item) => {
    // Navigate to the section containing the article
    const sectionId = item.sectionId;
    navigateToSection(sectionId);
    // Then show the specific article
    ArticlePanel.showArticleByNum(item.num, sectionId);
  });

  // Navigation
  function navigateTo(nodeId) {
    const zoomed = Treemap.zoomTo(nodeId);
    if (zoomed) {
      // Build path from root to this node
      const path = [];
      let current = zoomed;
      while (current.parent) {
        path.unshift({ id: current.data.id || "root", name: current.data.nameShort || current.data.name });
        current = current.parent;
      }
      state.path = path;
      updateBreadcrumb();
      updateHash();
      ArticlePanel.hide();
    }
  }

  function navigateToSection(sectionId) {
    // Try to zoom to the section, or its parent if it's a leaf
    const zoomed = Treemap.zoomTo(sectionId);
    if (zoomed) {
      const path = [];
      let current = zoomed;
      while (current.parent) {
        path.unshift({ id: current.data.id || "root", name: current.data.nameShort || current.data.name });
        current = current.parent;
      }
      state.path = path;
      updateBreadcrumb();
      updateHash();
    } else {
      // Section is a leaf - zoom to its parent
      const nodeData = nodeMap.get(sectionId);
      if (nodeData && nodeData.parent) {
        const parentId = nodeData.parent.id || "root";
        navigateToSection(parentId);
      }
    }
  }

  function navigateToRoot() {
    Treemap.zoomToRoot();
    state.path = [];
    updateBreadcrumb();
    updateHash();
    ArticlePanel.hide();
  }

  // Breadcrumb
  function updateBreadcrumb() {
    const list = document.getElementById("breadcrumb-list");
    list.innerHTML = "";

    // Root item
    const rootLi = document.createElement("li");
    const rootA = document.createElement("a");
    rootA.href = "#/";
    rootA.textContent = "会社法";
    rootA.dataset.id = "root";
    rootA.addEventListener("click", (e) => {
      e.preventDefault();
      navigateToRoot();
    });
    rootLi.appendChild(rootA);
    list.appendChild(rootLi);

    // Path items
    for (let i = 0; i < state.path.length; i++) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = "#/" + state.path.slice(0, i + 1).map(p => p.id).join("/");
      a.textContent = state.path[i].name;
      a.dataset.id = state.path[i].id;

      if (i < state.path.length - 1) {
        a.addEventListener("click", (e) => {
          e.preventDefault();
          navigateTo(a.dataset.id);
        });
      }

      li.appendChild(a);
      list.appendChild(li);
    }
  }

  // URL hash routing
  function updateHash() {
    const hash = state.path.length > 0
      ? "#/" + state.path.map(p => p.id).join("/")
      : "#/";
    history.replaceState(null, "", hash);
  }

  function handleHash() {
    const hash = location.hash.replace(/^#\/?/, "");
    if (!hash) {
      navigateToRoot();
      return;
    }

    const parts = hash.split("/");
    const targetId = parts[parts.length - 1];
    if (targetId && targetId !== "root") {
      navigateTo(targetId);
    }
  }

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (ArticlePanel.isVisible()) {
        ArticlePanel.hide();
      } else if (state.path.length > 0) {
        // Go up one level
        if (state.path.length === 1) {
          navigateToRoot();
        } else {
          navigateTo(state.path[state.path.length - 2].id);
        }
      }
    }

    // "/" to focus search
    if (e.key === "/" && !e.target.matches("input")) {
      e.preventDefault();
      document.getElementById("search-input").focus();
    }
  });

  // Handle initial hash
  window.addEventListener("hashchange", handleHash);
  if (location.hash && location.hash !== "#/") {
    handleHash();
  }
})();

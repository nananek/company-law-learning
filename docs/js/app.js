/**
 * Application entry point - state management, routing, module wiring
 */
(async function () {
  const state = {
    path: [],
    hierarchyData: null,
    currentView: "structure",  // "structure" | "topics"
  };

  // Load hierarchy data
  const resp = await fetch("data/hierarchy.json");
  state.hierarchyData = await resp.json();

  // Initialize article panel
  ArticlePanel.init();

  // Initialize topics
  await Topics.init((articleNum, sectionId) => {
    // Navigate from topics view: switch to structure and show article
    if (articleNum) {
      switchView("structure");
      navigateTo(sectionId);
      ArticlePanel.showArticleByNum(articleNum, sectionId);
    } else {
      switchView("structure");
      navigateTo(sectionId);
    }
  });

  // Initialize map
  LawMap.init(state.hierarchyData, {
    onSectionClick: (node) => {
      navigateTo(node.id);
    },
    onArticleClick: (node) => {
      navigateTo(node.id);
    },
  });

  // Initialize search
  Search.init((item) => {
    if (state.currentView !== "structure") {
      switchView("structure");
    }
    const sectionId = item.sectionId;
    navigateTo(sectionId);
    ArticlePanel.showArticleByNum(item.num, sectionId);
  });

  // === View tab switching ===
  const tabs = document.querySelectorAll(".view-tab");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      switchView(tab.dataset.view);
    });
  });

  function switchView(view) {
    state.currentView = view;
    tabs.forEach(t => t.classList.toggle("active", t.dataset.view === view));

    const breadcrumb = document.getElementById("breadcrumb");

    if (view === "topics") {
      breadcrumb.style.display = "none";
      Topics.render();
      ArticlePanel.hide();
    } else {
      breadcrumb.style.display = "";
      if (state.path.length > 0) {
        navigateTo(state.path[state.path.length - 1].id);
      } else {
        LawMap.zoomToRoot();
      }
    }
  }

  // Navigation
  function navigateTo(nodeId) {
    const node = LawMap.getNode(nodeId);
    if (!node) return;

    LawMap.zoomTo(nodeId);

    const path = [];
    let cur = node;
    while (cur && cur._parent) {
      path.unshift({ id: cur.id || "root", name: cur.nameShort || cur.name });
      cur = cur._parent;
    }
    state.path = path;
    updateBreadcrumb();
    updateHash();
    ArticlePanel.hide();
    document.getElementById("map-container").scrollTop = 0;
  }

  function navigateToRoot() {
    LawMap.zoomToRoot();
    state.path = [];
    updateBreadcrumb();
    updateHash();
    ArticlePanel.hide();
    document.getElementById("map-container").scrollTop = 0;
  }

  // Breadcrumb
  function updateBreadcrumb() {
    const list = document.getElementById("breadcrumb-list");
    list.innerHTML = "";

    const rootLi = document.createElement("li");
    const rootA = document.createElement("a");
    rootA.href = "#/";
    rootA.textContent = "会社法";
    rootA.addEventListener("click", (e) => {
      e.preventDefault();
      navigateToRoot();
    });
    rootLi.appendChild(rootA);
    list.appendChild(rootLi);

    for (let i = 0; i < state.path.length; i++) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = "#/" + state.path.slice(0, i + 1).map(p => p.id).join("/");
      a.textContent = state.path[i].name;

      const pathId = state.path[i].id;
      if (i < state.path.length - 1) {
        a.addEventListener("click", (e) => {
          e.preventDefault();
          navigateTo(pathId);
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

    if (hash === "topics") {
      switchView("topics");
      return;
    }

    const parts = hash.split("/");
    const targetId = parts[parts.length - 1];
    if (targetId && targetId !== "root") {
      if (state.currentView !== "structure") {
        switchView("structure");
      }
      navigateTo(targetId);
    }
  }

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (ArticlePanel.isVisible()) {
        ArticlePanel.hide();
      } else if (state.path.length > 0) {
        if (state.path.length === 1) {
          navigateToRoot();
        } else {
          navigateTo(state.path[state.path.length - 2].id);
        }
      }
    }

    if (e.key === "/" && !e.target.matches("input")) {
      e.preventDefault();
      document.getElementById("search-input").focus();
    }
  });

  window.addEventListener("hashchange", handleHash);
  if (location.hash && location.hash !== "#/") {
    handleHash();
  }
})();

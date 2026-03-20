/**
 * Search functionality using Fuse.js
 */
const Search = (() => {
  let fuse = null;
  let searchIndex = null;
  let onResultSelect = null;
  let debounceTimer = null;

  const input = () => document.getElementById("search-input");
  const resultsEl = () => document.getElementById("search-results");

  async function init(callback) {
    onResultSelect = callback;

    // Load search index
    const resp = await fetch("data/search-index.json");
    searchIndex = await resp.json();

    fuse = new Fuse(searchIndex, {
      keys: [
        { name: "num", weight: 3 },
        { name: "title", weight: 2 },
        { name: "caption", weight: 2 },
        { name: "text", weight: 1 },
      ],
      threshold: 0.3,
      includeScore: true,
      minMatchCharLength: 1,
    });

    input().addEventListener("input", onInput);
    input().addEventListener("focus", onFocus);
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".search-wrapper")) {
        hideResults();
      }
    });

    // Keyboard navigation
    input().addEventListener("keydown", onKeydown);
  }

  function onInput(e) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const query = e.target.value.trim();
      if (!query) {
        hideResults();
        return;
      }
      performSearch(query);
    }, 150);
  }

  function onFocus() {
    const query = input().value.trim();
    if (query) {
      performSearch(query);
    }
  }

  function performSearch(query) {
    if (!fuse) return;

    // Normalize: "296" -> search for article number
    const results = fuse.search(query, { limit: 20 });
    showResults(results);
  }

  function showResults(results) {
    const el = resultsEl();
    el.innerHTML = "";

    if (results.length === 0) {
      el.innerHTML = '<div class="search-result-item"><span class="result-title" style="color:var(--text-muted)">該当なし</span></div>';
      el.classList.remove("hidden");
      return;
    }

    for (const result of results) {
      const item = result.item;
      const div = document.createElement("div");
      div.className = "search-result-item";
      div.tabIndex = 0;

      const numDisplay = item.num.replace(/_/g, "の");
      div.innerHTML = `
        <div class="result-title">第${numDisplay}条</div>
        <div class="result-caption">${item.caption || ""}</div>
        <div class="result-path">${item.sectionId.replace(/root-/g, "").replace(/-/g, " > ")}</div>
      `;

      div.addEventListener("click", () => {
        if (onResultSelect) onResultSelect(item);
        hideResults();
        input().value = "";
      });

      el.appendChild(div);
    }

    el.classList.remove("hidden");
  }

  function hideResults() {
    resultsEl().classList.add("hidden");
  }

  let selectedIdx = -1;

  function onKeydown(e) {
    const items = resultsEl().querySelectorAll(".search-result-item");
    if (!items.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      selectedIdx = Math.min(selectedIdx + 1, items.length - 1);
      highlightItem(items);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedIdx = Math.max(selectedIdx - 1, 0);
      highlightItem(items);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIdx >= 0 && items[selectedIdx]) {
        items[selectedIdx].click();
      }
      selectedIdx = -1;
    } else if (e.key === "Escape") {
      hideResults();
      input().blur();
      selectedIdx = -1;
    }
  }

  function highlightItem(items) {
    items.forEach((item, i) => {
      item.style.background = i === selectedIdx ? "var(--bg-hover)" : "";
    });
    if (items[selectedIdx]) {
      items[selectedIdx].scrollIntoView({ block: "nearest" });
    }
  }

  return { init, hideResults };
})();

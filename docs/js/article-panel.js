/**
 * Article display panel
 */
const ArticlePanel = (() => {
  const panel = () => document.getElementById("article-panel");
  const titleEl = () => document.getElementById("panel-title");
  const captionEl = () => document.getElementById("panel-caption");
  const bodyEl = () => document.getElementById("panel-body");
  const closeBtn = () => document.getElementById("panel-close");

  // Cache loaded article data
  const cache = new Map();

  function init() {
    closeBtn().addEventListener("click", hide);
  }

  function show() {
    panel().classList.remove("hidden");
  }

  function hide() {
    panel().classList.add("hidden");
  }

  function isVisible() {
    return !panel().classList.contains("hidden");
  }

  async function loadArticles(sectionId) {
    if (cache.has(sectionId)) {
      return cache.get(sectionId);
    }

    const fname = sectionId.replace(/\//g, "-") + ".json";
    const resp = await fetch(`data/articles/${fname}`);
    if (!resp.ok) return null;

    const data = await resp.json();
    cache.set(sectionId, data);
    return data;
  }

  function showSectionArticles(sectionId, sectionName) {
    show();
    titleEl().textContent = sectionName;
    captionEl().textContent = "";
    bodyEl().innerHTML = '<div class="loading">読み込み中</div>';

    loadArticles(sectionId).then(data => {
      if (!data || !data.articles) {
        bodyEl().innerHTML = '<p style="color:var(--text-muted)">条文データが見つかりません</p>';
        return;
      }

      const list = document.createElement("ul");
      list.className = "section-articles-list";

      for (const art of data.articles) {
        const li = document.createElement("li");
        const link = document.createElement("div");
        link.className = "section-article-link";
        link.innerHTML = `
          <span class="art-num">${art.title}</span>
          <span class="art-caption">${art.caption || ""}</span>
        `;
        link.addEventListener("click", () => showArticle(art));
        li.appendChild(link);
        list.appendChild(li);
      }

      bodyEl().innerHTML = "";
      bodyEl().appendChild(list);
    });
  }

  function showArticle(article) {
    show();
    titleEl().textContent = article.title;
    captionEl().textContent = article.caption || "";

    const body = document.createElement("div");

    if (article.paragraphs) {
      for (const para of article.paragraphs) {
        const div = document.createElement("div");
        div.className = "article-paragraph";

        // Paragraph text
        const textDiv = document.createElement("div");
        textDiv.className = "paragraph-text";

        if (para.num) {
          const numSpan = document.createElement("span");
          numSpan.className = "paragraph-num";
          numSpan.textContent = para.num + " ";
          textDiv.appendChild(numSpan);
        }

        const textSpan = document.createElement("span");
        textSpan.textContent = para.text;
        textDiv.appendChild(textSpan);
        div.appendChild(textDiv);

        // Items (号)
        if (para.items && para.items.length > 0) {
          const itemsDiv = document.createElement("div");
          itemsDiv.className = "article-items";

          for (const item of para.items) {
            const itemDiv = document.createElement("div");
            itemDiv.className = "article-item";

            const itemTitle = document.createElement("span");
            itemTitle.className = "item-title";
            itemTitle.textContent = item.title;
            itemDiv.appendChild(itemTitle);

            const itemText = document.createElement("span");
            itemText.textContent = " " + item.text;
            itemDiv.appendChild(itemText);

            // Subitems
            if (item.subitems && item.subitems.length > 0) {
              const subDiv = document.createElement("div");
              subDiv.className = "article-subitems";
              for (const si of item.subitems) {
                const siDiv = document.createElement("div");
                siDiv.className = "article-subitem";
                siDiv.innerHTML = `<span class="subitem-title">${si.title}</span> ${si.text}`;
                subDiv.appendChild(siDiv);
              }
              itemDiv.appendChild(subDiv);
            }

            itemsDiv.appendChild(itemDiv);
          }
          div.appendChild(itemsDiv);
        }

        body.appendChild(div);
      }
    }

    bodyEl().innerHTML = "";
    bodyEl().appendChild(body);
  }

  async function showArticleByNum(articleNum, sectionId) {
    // Load the section and find the article
    const data = await loadArticles(sectionId);
    if (!data || !data.articles) return;

    const article = data.articles.find(a => a.num === articleNum);
    if (article) {
      showArticle(article);
    }
  }

  return { init, show, hide, isVisible, showSectionArticles, showArticle, showArticleByNum, loadArticles };
})();

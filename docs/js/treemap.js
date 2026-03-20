/**
 * Treemap rendering and zoom logic using D3.js
 */
const Treemap = (() => {
  let svg, width, height;
  let currentRoot = null;
  let hierarchyRoot = null;
  let treemapLayout = null;
  let onTileClick = null;
  let onArticleClick = null;

  // Color darkening for deeper levels
  function darkenColor(hex, depth) {
    const factor = Math.max(0.5, 1 - depth * 0.12);
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${Math.round(r * factor)}, ${Math.round(g * factor)}, ${Math.round(b * factor)})`;
  }

  function init(data, callbacks) {
    onTileClick = callbacks.onTileClick;
    onArticleClick = callbacks.onArticleClick;

    svg = d3.select("#treemap");
    const container = document.getElementById("treemap-container");
    width = container.clientWidth;
    height = container.clientHeight;

    svg.attr("viewBox", `0 0 ${width} ${height}`);

    // Build D3 hierarchy
    hierarchyRoot = d3.hierarchy(data)
      .sum(d => {
        // Leaf nodes get their articleCount or 1
        if (!d.children || d.children.length === 0) {
          return d.articleCount || 1;
        }
        return 0;
      })
      .sort((a, b) => b.value - a.value);

    treemapLayout = d3.treemap()
      .size([width, height])
      .paddingOuter(4)
      .paddingInner(3)
      .paddingTop(0)
      .round(true);

    treemapLayout(hierarchyRoot);
    currentRoot = hierarchyRoot;

    render(hierarchyRoot);

    // Handle resize
    window.addEventListener("resize", () => {
      width = container.clientWidth;
      height = container.clientHeight;
      svg.attr("viewBox", `0 0 ${width} ${height}`);
      treemapLayout.size([width, height]);
      treemapLayout(hierarchyRoot);
      render(currentRoot);
    });
  }

  function render(root) {
    currentRoot = root;
    svg.selectAll("*").remove();

    const nodes = root.children || [];
    if (nodes.length === 0) return;

    // Calculate position relative to root
    const x0 = root.x0, y0 = root.y0;
    const kx = width / (root.x1 - root.x0);
    const ky = height / (root.y1 - root.y0);

    const groups = svg.selectAll("g.tile")
      .data(nodes, d => d.data.id || d.data.name)
      .enter()
      .append("g")
      .attr("class", d => {
        const isLeaf = !d.children || d.children.length === 0;
        return isLeaf ? "tile tile-article" : "tile";
      })
      .style("opacity", 0)
      .on("click", (event, d) => {
        event.stopPropagation();
        const hasChildren = d.children && d.children.length > 0;
        if (hasChildren) {
          if (onTileClick) onTileClick(d);
        } else {
          // Leaf node - show articles for this section
          if (onArticleClick) onArticleClick(d);
        }
      });

    // Animate in
    groups.transition().duration(400).style("opacity", 1);

    // Draw rectangles
    groups.append("rect")
      .attr("class", "tile-rect")
      .attr("x", d => (d.x0 - x0) * kx)
      .attr("y", d => (d.y0 - y0) * ky)
      .attr("width", d => Math.max(0, (d.x1 - d.x0) * kx))
      .attr("height", d => Math.max(0, (d.y1 - d.y0) * ky))
      .attr("rx", 4)
      .attr("fill", d => {
        const depth = d.depth - root.depth;
        return darkenColor(d.data.color || "#6B7280", depth);
      });

    // Add labels
    groups.each(function(d) {
      const g = d3.select(this);
      const tileW = (d.x1 - d.x0) * kx;
      const tileH = (d.y1 - d.y0) * ky;
      const tx = (d.x0 - x0) * kx;
      const ty = (d.y0 - y0) * ky;

      if (tileW < 30 || tileH < 20) return;

      const padding = 8;
      const centerX = tx + tileW / 2;
      const centerY = ty + tileH / 2;

      // Section name
      const nameShort = d.data.nameShort || d.data.name || "";
      const isSmall = tileW < 80 || tileH < 50;
      const fontSize = isSmall ? 11 : (tileW < 140 ? 13 : 14);

      // Truncate name if needed
      const maxChars = Math.floor(tileW / (fontSize * 0.7));
      const displayName = nameShort.length > maxChars
        ? nameShort.slice(0, maxChars - 1) + "…"
        : nameShort;

      if (displayName) {
        g.append("text")
          .attr("class", "tile-text tile-text-name")
          .attr("x", centerX)
          .attr("y", centerY - (isSmall ? 0 : 6))
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "central")
          .style("font-size", fontSize + "px")
          .text(displayName);
      }

      // Article range (if enough space)
      if (!isSmall && tileH > 45 && d.data.articleRange) {
        g.append("text")
          .attr("class", "tile-text tile-text-range")
          .attr("x", centerX)
          .attr("y", centerY + 14)
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "central")
          .text(d.data.articleRange);
      }

      // Article count badge (if enough space)
      if (!isSmall && tileH > 65 && d.data.articleCount) {
        g.append("text")
          .attr("class", "tile-text tile-text-count")
          .attr("x", centerX)
          .attr("y", centerY + 30)
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "central")
          .text(d.data.articleCount + "条");
      }
    });
  }

  function zoomTo(nodeId) {
    // Find the node by id in the hierarchy
    let target = null;
    hierarchyRoot.each(d => {
      if (d.data.id === nodeId) target = d;
    });

    if (target && target.children && target.children.length > 0) {
      render(target);
      return target;
    }
    return null;
  }

  function zoomToRoot() {
    render(hierarchyRoot);
    return hierarchyRoot;
  }

  function getCurrentRoot() {
    return currentRoot;
  }

  return { init, zoomTo, zoomToRoot, getCurrentRoot, render };
})();

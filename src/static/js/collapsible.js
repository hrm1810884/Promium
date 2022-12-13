d3.tsv("./data/process_data.tsv").then(function (text) {
  createVisualization(text);
});

// Main function to draw and set up the visualization, once we have the data.
function createVisualization(tsv) {
  const json = buildHierarchy(tsv);

  const WIDTH = 1000;
  const HEIGHT = 1000;

  let index = 0;

  const root = d3.hierarchy(json);
  const transform = d3.zoomIdentity;
  let node;
  let link;

  const svg = d3
    .select("body")
    .append("svg")
    .call(
      d3
        .zoom()
        .scaleExtent([1 / 2, 8])
        .on("zoom", zoomed)
    )
    .append("g")
    .attr("transform", "translate(40,0)");

  const simulation = d3
    .forceSimulation()
    .force(
      "link",
      d3.forceLink().id((d) => d.id)
    )
    .force("charge", d3.forceManyBody().strength(-15).distanceMax(300))
    .force("center", d3.forceCenter(WIDTH / 2, HEIGHT / 4))
    .on("tick", ticked);

  function update() {
    const nodes = flatten(root);
    const links = root.links();

    link = svg.selectAll(".link").data(links, (d) => d.target.id);

    link.exit().remove();

    const linkEnter = link
      .enter()
      .append("line")
      .attr("class", "link")
      .style("stroke", "#000")
      .style("opacity", "0.2")
      .style("stroke-width", 2);

    link = linkEnter.merge(link);

    node = svg.selectAll(".node").data(nodes, (d) => d.id);

    node.exit().remove();

    const nodeEnter = node
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("stroke", "#666")
      .attr("stroke-width", 2)
      .style("fill", color)
      .style("opacity", 1)
      .on("click", clicked)
      .call(
        d3
          .drag()
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended)
      );

    nodeEnter
      .append("circle")
      .attr("r", (d) => Math.sqrt(d.data.cpu) * 10 || 4)
      .style("text-anchor", (d) => (d.children ? "end" : "start"))
      .text((d) => d.data.command);

    node = nodeEnter.merge(node);
    simulation.nodes(nodes);
    simulation.force("link").links(links);
  }

  function color(d) {
    return d._children
      ? "#51A1DC" // collapsed package
      : d.children
      ? "#51A1DC" // expanded package
      : "#F94B4C"; // leaf node
  }

  function radius(d) {
    return d._children ? 8 : d.children ? 8 : 4;
  }

  function ticked() {
    link
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y);

    node.attr("transform", (d) => `translate(${d.x}, ${d.y})`);
  }

  function clicked(event, d) {
    if (!event.defaultPrevented) {
      if (d.children) {
        d._children = d.children;
        d.children = null;
      } else {
        d.children = d._children;
        d._children = null;
      }
      update();
    }
  }

  function dragstarted(event, d) {
    if (!event.active) {
      simulation.alphaTarget(0.3).restart();
    }
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }

  function dragended(event, d) {
    if (!event.active) {
      simulation.alphaTarget(0);
    }
    d.fx = null;
    d.fy = null;
  }

  function flatten(root) {
    const nodes = [];
    function recurse(node) {
      if (node.children) {
        node.children.forEach(recurse);
      }
      if (!node.id) {
        node.id = ++index;
      } else {
        ++index;
      }
      nodes.push(node);
    }
    recurse(root);
    return nodes;
  }

  function zoomed(event) {
    svg.attr("transform", event.transform);
  }

  update();
}

function buildHierarchy(tsv) {
  let root = { command: "root", children: [] };
  let parentNode = root;
  let childNode;
  for (let i = 0; i < tsv.length - 1; i++) {
    const currentRow = tsv[i];
    const nextRow = tsv[i + 1];
    const user = currentRow["USER"];
    const pid = parseInt(currentRow["PID"]);
    const cpu = parseFloat(currentRow["%CPU"]);
    const rss = parseFloat(currentRow["RSS"]);
    const stat = currentRow["STAT"];
    const command = currentRow["COMMAND"];
    const currentGene = parseInt(currentRow["GENE"]);
    const nextGene = parseInt(nextRow["GENE"]);

    if (nextGene > currentGene) {
      childNode = {
        command: command,
        user: user,
        pid: pid,
        cpu: cpu,
        rss: rss,
        stat: stat,
        parent: parentNode,
        children: [],
      };
      parentNode["children"].push(childNode);
      parentNode = childNode;
    } else if (nextGene == currentGene) {
      childNode = {
        command: command,
        user: user,
        pid: pid,
        cpu: cpu,
        rss: rss,
        stat: stat,
        parent: parentNode,
        children: [],
      };
      parentNode["children"].push(childNode);
    } else {
      childNode = {
        command: command,
        user: user,
        pid: pid,
        cpu: cpu,
        rss: rss,
        stat: stat,
        parent: parentNode,
        children: [],
      };
      parentNode["children"].push(childNode);
      const geneGap = currentGene - nextGene;
      for (let j = 0; j < geneGap; j++) {
        parentNode = parentNode["parent"];
      }
    }
  }
  return root;
}

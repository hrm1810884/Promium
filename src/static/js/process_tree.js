const NODE_TYPE = {
  // チャートのノードの種類
  root: {
    displayText: "root",
    colorLight: "#444",
    colorDark: "#222",
  },
  parent: {
    displayText: "parent",
    colorLight: "#888",
    colorDark: "#444",
  },
  leaf: {
    O: {
      displayText: "Running",
      colorLight: "#0218FF",
      colorDark: "#00084C",
    },
    D: {
      displayText: "Uninterruptible sleep",
      colorLight: "#F26523",
      colorDark: "#4C200B",
    },
    I: {
      displayText: "Process generating",
      colorLight: "#38B349",
      colorDark: "#184C1F",
    },
    Z: {
      displayText: "Zombie",
      colorLight: "#7053CC",
      colorDark: "#291F4C",
    },
    R: {
      displayText: "Runnable",
      colorLight: "#1A85F1",
      colorDark: "#082A4C",
    },
    S: {
      displayText: "Interruptible sleep",
      colorLight: "#FBF267",
      colorDark: "#4C4920",
    },
    T: {
      displayText: "Stopped",
      colorLight: "#ED1C24",
      colorDark: "#4C090C",
    },
    U: {
      displayText: "Unknown",
      colorLight: "#777",
      colorDark: "#777",
    },
  },
};

const [DIM_CHART, DIM_LEGEND, DIM_HIERARCHY] = initializeDimention();
const [chartSvg, legendSvg, hierarchySvg, tooltip] = initializeElement();
const INTERVAL_TIME = 5000000; // live モードの更新頻度 [ms]

const defineGradient = () => {
  const defs = chartSvg.append("defs");
  const capitalize = (string) => string[0].toUpperCase() + string.slice(1);
  const setGradient = (idString, colorLight, colorDark) => {
    const areaGradient = defs
      .append("radialGradient")
      .attr("id", `areaGradient${idString}`)
      .attr("cx", "0.5")
      .attr("cy", "0.5")
      .attr("fx", "0.3")
      .attr("fy", "0.3")
      .attr("r", "0.5");
    areaGradient
      .append("stop")
      .attr("offset", "0%")
      .attr("stop-color", colorLight);
    areaGradient
      .append("stop")
      .attr("offset", "100%")
      .attr("stop-color", colorDark);
  };

  Object.keys(NODE_TYPE).forEach((keyNode) => {
    const eachNode = NODE_TYPE[keyNode];
    if (keyNode === "leaf") {
      Object.keys(eachNode).forEach((keyStatus) => {
        const eachStatus = eachNode[keyStatus];
        setGradient(
          capitalize(keyNode) + keyStatus,
          eachStatus.colorLight,
          eachStatus.colorDark
        );
      });
    } else {
      setGradient(capitalize(keyNode), eachNode.colorLight, eachNode.colorDark);
    }
  });
};

defineGradient();

/**
 * DIM_CHART, DIM_LEGEND, DIM_HIERARCHY を初期化する
 * @returns [chart のサイズ, legend のサイズ, hierarychy のサイズ]
 */
function initializeDimention() {
  const chartDim = {};
  const legendDim = {};
  const hierarchyDim = {};

  // chartDim の初期化
  const chartStyle = window.getComputedStyle(document.getElementById("chart"));
  chartDim.container = {
    width: parseFloat(chartStyle.width.replace("px", "")),
    height: parseFloat(chartStyle.height.replace("px", "")),
  };
  chartDim.container.centerX = chartDim.container.width / 2;
  chartDim.container.centerY = chartDim.container.height / 2;

  // legendDim の初期化
  legendDim.each = {
    width: 250,
    height: 40,
    spacing: 3,
    radius: 3,
  };
  legendDim.container = {
    width: legendDim.each.width * 2 + legendDim.each.spacing,
    height:
      Object.keys(NODE_TYPE.leaf).length *
      (legendDim.each.height + legendDim.each.spacing),
  };

  // hierarchyDim の初期化
  hierarchyDim.rect = {
    height: 20,
    width: 80,
  };
  hierarchyDim.space = {
    padding: 30,
    height: 50,
    width: 120,
  };
  hierarchyDim.link = {
    left: 20,
  };
  hierarchyDim.container = {
    height: 0,
    width: 0,
  };

  return [chartDim, legendDim, hierarchyDim];
}

/**
 * SVG の要素を初期化する
 * @returns [svg for chart, svg for legend, svg for hierarchy]
 */
function initializeElement() {
  const chartElement = d3
    .select("#chart")
    .append("svg:svg")
    .attr("width", DIM_CHART.container.width)
    .attr("height", DIM_CHART.container.height)
    .call(
      d3
        .zoom()
        .scaleExtent([1 / 2, 8])
        .on("zoom", (event) => {
          chartElement.attr("transform", event.transform);
        })
    )
    .append("g");
  const legendElement = d3.select("#legendContent").append("svg:svg");
  const hierarchyElement = d3.select("#hierarchy").append("svg");
  const tooltip = d3.select("body").append("div").attr("class", "tooltip");
  return [chartElement, legendElement, hierarchyElement, tooltip];
}

/* 挙動と状態変数をセットする */
let isLiveModeOn = true; // リアルタイムで更新するか
let isCpuModeOn = true; // 表示するものが CPU なら true，メモリなら false
let timerIdLiveMode = setInterval(readAndVisualizeData, INTERVAL_TIME); // リアルタイムモードを司るタイマー id

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("helpButton").addEventListener("change", function () {
    const settingContainer = document.getElementById("settingContainer");
    const hierarchyContainer = document.getElementById("hierarchyContainer");
    const helpContentContainer = document.getElementById("helpContainer");
    if (this.checked) {
      settingContainer.style.visibility = "hidden";
      hierarchyContainer.style.visibility = "hidden";
      helpContentContainer.style.visibility = "visible";
    } else {
      helpContentContainer.style.visibility = "hidden";
      settingContainer.style.visibility = "visible";
      hierarchyContainer.style.visibility = "visible";
    }
  });

  document.getElementById("liveButton").addEventListener("change", function () {
    if (this.checked) {
      clearInterval(timerIdLiveMode);
      timerIdLiveMode = setInterval(readAndVisualizeData, INTERVAL_TIME);
    } else {
      clearInterval(timerIdLiveMode);
      readAndVisualizeData();
    }
  });

  for (const chartTab of document.getElementsByClassName("chart-tab")) {
    chartTab.addEventListener("change", function () {
      if (this.checked) {
        isCpuModeOn = this.id === "cpuTab";
        readAndVisualizeData();
      }
    });
  }
});

class Chart {
  constructor(json, hierarchy) {
    this.json = json;
    this.node = {};
    this.link = {};
    this.selectedNodeId = -1;
    this.hierarchy = hierarchy;

    Object.defineProperty(this, "DURATION", {
      value: 750,
    });
  }

  draw() {
    this.setBackgroundColor();
    this.root = d3.hierarchy(this.json);
    countChildren(this.root);
    this.setSimulation();
    this.update();
  }

  setBackgroundColor() {
    const sumUpPercentage = (source) => {
      let percentageSum = 0;
      function addPercentage(node) {
        if (isCpuModeOn && node.cpu) {
          percentageSum += node.cpu;
        }
        if (!isCpuModeOn && node.mem) {
          percentageSum += node.mem;
        }
        if (node.children) {
          node.children.forEach((childNode) => {
            addPercentage(childNode);
          });
        }
      }
      addPercentage(source);
      return percentageSum;
    };

    const convertHexToRgb = (hexString) => {
      if (hexString.slice(0, 1) === "#") {
        hexString = hexString.slice(1);
      }
      if (hexString.length === 3) {
        hexString =
          hexString.slice(0, 1) +
          hexString.slice(0, 1) +
          hexString.slice(1, 2) +
          hexString.slice(1, 2) +
          hexString.slice(2, 3) +
          hexString.slice(2, 3);
      }
      return [
        hexString.slice(0, 2),
        hexString.slice(2, 4),
        hexString.slice(4, 6),
      ].map((str) => parseInt(str, 16));
    };

    document.getElementById(
      "chart"
    ).style.backgroundColor = `rgba(${convertHexToRgb("#ED1C2")}, ${sumUpPercentage(this.json) / 200
      })`;
  }

  setSimulation() {
    this.simulation = d3
      .forceSimulation()
      .force(
        "link",
        d3.forceLink().id((d) => d.id)
      )
      .force(
        "collide",
        d3.forceCollide().radius((d) => d.r)
      )
      .force(
        "charge",
        d3
          .forceManyBody()
          .strength((d) => Math.min(-5 * d.value, -30))
          .distanceMax(200)
      )
      .force(
        "center",
        d3.forceCenter(DIM_CHART.container.centerX, DIM_CHART.container.centerY)
      )
      .on("tick", () => {
        this.link
          .attr("x1", (d) => d.source.x)
          .attr("y1", (d) => d.source.y)
          .attr("x2", (d) => d.target.x)
          .attr("y2", (d) => d.target.y);

        this.node.attr("transform", (d) => `translate(${d.x}, ${d.y})`);
      });
  }

  update() {
    const nodes = flatten(this.root);
    const links = this.root.links();
    const transition = chartSvg.transition()
        .duration(250)

    this.link = chartSvg
      .selectAll(".chart-link")
      .data(links, (d) => d.target.id);
    const linkExit = this.link.exit()
    
    linkExit.transition(transition)
    .remove()
    .attr("fill-opacity", 0)
    .attr("stroke-opacity", 0);;

    const linkEnter = this.link
      .enter()
      .append("line")
      .attr("class", "chart-link")
      .attr("id", (d) => `chartLink${d.source.id}-${d.target.id}`)
      .style("stroke", "#ccc")
      .style("opacity", "0.2")
      .style("stroke-width", 3);

    this.link = linkEnter.merge(this.link);

    this.node = chartSvg.selectAll(".chart-node").data(nodes, (d) => d.id);

    const nodeExit = this.node.exit()
    
    nodeExit.transition(transition)
        .remove()
        .attr("fill-opacity", 0)
        .attr("stroke-opacity", 0);

    this.node
      .exit()
      .transition(d3.transition().duration(this.DURATION))
      .attr("r", 1e-6)
      .remove();

    const nodeEnter = this.node
      .enter()
      .append("g")
      .attr("class", "chart-node")
      .attr("id", (d) => `chartNode${d.id}`)
      .attr("stroke", "#666")
      .attr("stroke-width", 0)
      .classed("shadow-circle", false)
      .style("fill", (d) => {
        if (d.data.command === "root") {
          return "url(#areaGradientRoot)";
        }
        if ("stat" in d.data) {
          return `url(#${"areaGradientLeaf" + d.data.stat[0]})`;
        }
        return "url(#areaGradientLeafU}";
      })
      .style("opacity", (d) => (d.data.command === "root" ? 0.9 : 0.5))
      .on("click", (event, clickedNodeData) => {
        this.clicked(clickedNodeData);
      })
      .on("mouseover", (event, hoveringNodeData) => {
        tooltip
          .style("visibility", "visible")
          .html(() =>
            isCpuModeOn
              ? `Command: ${hoveringNodeData.data.command}<br>CPU usage: ${hoveringNodeData.data.cpu} %`
              : `Command: ${hoveringNodeData.data.command}<br>Memory usage: ${hoveringNodeData.data.mem} %`
          );
      })
      .on("mousemove", (event, d) => {
        tooltip
          .style("top", event.pageY - 20 + "px")
          .style("left", event.pageX + 10 + "px");
      })
      .on("mouseout", (event, d) => {
        tooltip.style("visibility", "hidden");
      })
      .call(
        d3
          .drag()
          .on("start", (event, draggedNodeData) => {
            if (!event.active) {
              this.simulation.alphaTarget(0.3).restart();
            }
            draggedNodeData.fx = draggedNodeData.x;
            draggedNodeData.fy = draggedNodeData.y;
          })
          .on("drag", (event, draggedNodeData) => {
            draggedNodeData.fx = event.x;
            draggedNodeData.fy = event.y;
          })
          .on("end", (event, draggedNodeData) => {
            if (!event.active) {
              this.simulation.alphaTarget(0);
            }
            draggedNodeData.fx = null;
            draggedNodeData.fy = null;
          })
      )
      .sort((a, b) => b.depth - a.depth);

    nodeEnter.append("circle")
            .attr("r", (d) =>
              d.data.command === "root"
                ? 50
                : Math.max(Math.sqrt(isCpuModeOn ? d.data.cpu : d.data.mem) * 15, 5)
            )
            .style("text-anchor", (d) => (d.children ? "end" : "start"))
            .text((d) => d.data.command);

    const nodeUpdate = nodeEnter.merge(this.node);

    nodeUpdate
      .select("circle")
      .remove()

    nodeUpdate
      .append("circle")
      .attr("id", (d) => `chartCircle${d.id}`)
      .classed("shadow-circle", false)
      .attr("r", (d) =>
        d.data.command === "root"
          ? 50
          : Math.max(Math.sqrt(isCpuModeOn ? d.data.cpu : d.data.mem) * 15, 5)
      )
      .style("text-anchor", (d) => (d.children ? "end" : "start"))
      .text((d) => d.data.command);

    this.node = nodeUpdate
    /* simulation にノードとリンクをセットする */
    this.simulation.nodes(nodes);
    this.simulation.force("link").links(links);
  }

  /**
   * ノードがクリックされた時に実行される関数
   * @param {Object} event イベントオブジェクト
   * @param {Object} clickedNodeData クリックされたデータ
   */
  clicked(clickedNodeData) {
    const selectedColor = "white"
    const notSelectedColor = "#ccc"
    const selectedStrokeWidth = "5"
    const notSelectedStrokeWidth = "3"
    const highlightHierarchyNode = (nodeData) => {
      d3.selectAll("#hierarchy-node")
        .style("stroke", notSelectedColor)
        .style("stroke-width", notSelectedStrokeWidth)
      const selectedHierarchyNode = d3.select(`#hierarchyNode${nodeData.id}`)
      let daughter = nodeData
      selectedHierarchyNode.data()[0].ancestors().forEach((mother) => {
        d3.select(`#hierarchyNode${mother.id}`)
          .style(
            "stroke",
            this.selectedNodeId > 0 ? selectedColor : notSelectedColor
          )
          .style(
            "stroke-width",
            this.selectedNodeId > 0 ? selectedStrokeWidth : notSelectedStrokeWidth
          );
        daughter = mother;
      });
    };
    const changeNodeColorByClick = (nodeData) => {
      if (
        this.selectedNodeId < 0 ||
        this.selectedNodeId !== nodeData.id
      ) {
        this.selectedNodeId = nodeData.id;
      } else {
        this.selectedNodeId = -1;
      }
      const selectedColor = "white";
      const notSelectedColor = "#666";
      const selectedStrokeWidth = "5";
      const notSelectedStrokeWidth = "0";

      d3.selectAll(".chart-node").style("stroke", notSelectedColor)
        .style("stroke-width", notSelectedStrokeWidth)
      d3.select(`#chartNode${nodeData.id}`).style("stroke", this.selectedNodeId > 0 ? selectedColor : notSelectedColor)
        .style("stroke-width", this.selectedNodeId > 0 ? selectedStrokeWidth : notSelectedStrokeWidth)
    }

    changeNodeColorByClick(clickedNodeData);
    highlightHierarchyNode(clickedNodeData);
  }
}

class Legend {
  constructor(tsv, json) {
    this.tsv = tsv;
    this.json = json;
  }

  draw() {
    this.statusList = [];
    Object.keys(NODE_TYPE.leaf).forEach((data) => {
      this.statusList.push({
        stat: data,
        displayText: NODE_TYPE.leaf[data].displayText,
        isStatusDisplayed: false,
        buttonClickable: false,
      });
    });

    this.existingStatusList = this.selectExistingStatus(this.tsv);
    this.statusList.forEach((status) => {
      if (this.existingStatusList.includes(status.stat)) {
        status.isStatusDisplayed = true;
        status.buttonClickable = true;
      }
    });

    legendSvg
      .attr("width", DIM_LEGEND.container.width)
      .attr("height", DIM_LEGEND.container.height);

    legendSvg.selectAll("g").remove();

    const legendGroup = legendSvg
      .selectAll("g")
      .data(this.statusList)
      .enter()
      .append("svg:g")
      .attr("transform", (d, i) => {
        return i < 4
          ? "translate(0," +
              i * (DIM_LEGEND.each.height + DIM_LEGEND.each.spacing) +
              ")"
          : "translate(" +
              (DIM_LEGEND.each.width + DIM_LEGEND.each.spacing) +
              "," +
              (i - 4) * (DIM_LEGEND.each.height + DIM_LEGEND.each.spacing) +
              ")";
      });

    legendGroup
      .append("svg:rect")
      .attr("rx", DIM_LEGEND.each.radius)
      .attr("ry", DIM_LEGEND.each.radius)
      .attr("width", DIM_LEGEND.each.width)
      .attr("height", DIM_LEGEND.each.height)
      .style(
        "fill",
        (d) =>
          NODE_TYPE.leaf[d.stat in NODE_TYPE.leaf ? d.stat : "U"].colorLight
      )
      .style("opacity", (d) => (d.buttonClickable ? 0.6 : 0.1))
      .attr("class", (d) => "rect_" + d.stat);

    legendGroup
      .append("svg:text")
      .attr("x", DIM_LEGEND.each.width / 2)
      .attr("y", DIM_LEGEND.each.height / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", "middle")
      .text((d) => d.displayText);

    legendGroup.on("click", (event, clickedLegendData) => {
      d3.selectAll(".chart-node").attr("visibility", "visible");
      d3.selectAll("line").attr("visibility", "visible");

      if (clickedLegendData.buttonClickable) {
        clickedLegendData.isStatusDisplayed =
          !clickedLegendData.isStatusDisplayed;
      }
      let hiddenStat = [];
      this.statusList.forEach((data) => {
        if (!data.isStatusDisplayed) {
          hiddenStat.push(data.stat);
        }
      });

      this.root = d3.hierarchy(this.json);
      countChildren(this.root);
      flatten(this.root);

      this.root.eachAfter((node) => {
        node.hiddenValue = node.value;
        if (node.children) {
          for (const child of node.children) {
            if (
              child.hiddenValue === 1 &&
              hiddenStat.includes(child.data.stat[0])
            ) {
              d3.select(`#chartNode${child.id}`).attr("visibility", "hidden");
              node.hiddenValue -= child.value;
            }
          }
        }
      });

      d3.selectAll("line").attr("visibility", (lineData) =>
        d3.select(`#chartNode${lineData.target.id}`).attr("visibility")
      );

      countChildren(this.root);

      legendGroup.selectAll("rect").style("opacity", (d) => {
        if (d.isStatusDisplayed) {
          return 0.6;
        } else if (d.buttonClickable) {
          return 0.2;
        } else {
          return 0.1;
        }
      });
    });
  }

  selectExistingStatus(statusData) {
    let uniqueStatusList = [];
    statusData.forEach((status) => {
      const statFirstLetter = status.STAT[0];
      if (!uniqueStatusList.includes(statFirstLetter)) {
        uniqueStatusList.push(statFirstLetter);
      }
    });
    return uniqueStatusList;
  }
}

class Hierarchy {
  constructor(json) {
    Object.defineProperty(this, "DURATION", {
      value: 500,
    });
    this.json = json;
    this.link = {};
    this.node = {};
    this.chart = {};
    this.selectedNodeId = -1;
  }

  draw() {
    this.root = d3.hierarchy(this.json);
    this.tree = d3.tree();
    this.tree(this.root);
    countChildren(this.root);
    this.resetSvg();
    hierarchySvg.select("g").remove();
    this.group = hierarchySvg.append("g");
    // this.foldChildrenNode(this.root);
    this.update(this.root);
  }

  resetSvg() {
    DIM_HIERARCHY.container.height =
      this.root.value * DIM_HIERARCHY.rect.height +
      (this.root.value - 1) *
      (DIM_HIERARCHY.space.height - DIM_HIERARCHY.rect.height) +
      DIM_HIERARCHY.space.padding * 2;
    DIM_HIERARCHY.container.width =
      (this.root.height + 1) * DIM_HIERARCHY.rect.width +
      this.root.height *
      (DIM_HIERARCHY.space.width - DIM_HIERARCHY.rect.width) +
      DIM_HIERARCHY.space.padding * 2;
    hierarchySvg
      .attr("width", DIM_HIERARCHY.container.width)
      .attr("height", DIM_HIERARCHY.container.height);
  }

  foldChildrenNode(source) {
    const UNFOLDED_LAYER = 1;
    for (
      let currentLayer = source.height;
      currentLayer >= UNFOLDED_LAYER;
      --currentLayer
    ) {
      source.each((node) => {
        if (node.depth === currentLayer) {
          node._children = node.children;
          node.children = null;
        }
      });
    }
  }

  update(source) {
    countChildren(this.root);

    /**
     * ツリーの内容から各ノードの位置を計算する
     * @param {Object} treeData ツリーのデータ
     */
    const definePos = (treeData) => {
      /**
       * command が含まれる階層を親に向かって探索する
       * @param {Object} currentData 探索するノード
       * @param {String} command 探索するコマンド
       * @returns 探索するコマンドとそれが含まれる階層のノード
       */
      const seekParent = (currentData, command) => {
        const currentHierarchy = currentData.parent.children;
        const targetFound = currentHierarchy.find(
          (contents) => contents.data.command === command
        );
        return targetFound
          ? { command: command, hierarchy: currentHierarchy }
          : seekParent(currentData.parent, command);
      };

      /**
       * コマンドの配列に対して下にあるノードの数を計算する
       * @param {Object} commands 探索するコマンドの配列
       * @param {Object} currentData 探索ノード
       * @returns 各コマンドの下にあるノードの数の配列
       */
      const calcLeaves = (commands, currentData) => {
        const eachHierarchies = commands.map((command) =>
          seekParent(currentData, command)
        );
        const eachIdxes = eachHierarchies.map((item) =>
          item.hierarchy.findIndex(
            (contents) => contents.data.command === item.command
          )
        );
        const filteredHierarchies = eachHierarchies.map((item, idx) =>
          item.hierarchy.slice(0, eachIdxes[idx])
        );
        const values = filteredHierarchies.map((hierarchy) =>
          hierarchy.map((item) => item.value)
        );
        return values.flat();
      };

      /**
       * ノードの左からの位置を計算する
       * @param {Object} data ノードのデータ
       * @returns ノードの左からの位置
       */
      const defineX = (data) => {
        return (
          data.depth * 2 * DIM_HIERARCHY.link.left + DIM_HIERARCHY.space.padding
        );
      };

      /**
       * ノードの上からの位置を計算する
       * @param {Object} data ノードのデータ
       * @returns ノードの上からの位置
       */
      const defineY = (data) => {
        if (data.data.command === "root") {
          return DIM_HIERARCHY.space.padding;
        }
        const ancestorValues = data
          .ancestors()
          .map((item) => item.data.command);
        const leaves = calcLeaves(
          ancestorValues.slice(0, ancestorValues.length - 1),
          data
        );
        const sumLeaves = leaves.reduce(
          (previous, current) => previous + current,
          0
        );

        return (
          (data.depth + sumLeaves) * DIM_HIERARCHY.space.height +
          DIM_HIERARCHY.space.padding
        );
      };

      treeData.each((d) => {
        d.x = defineX(d);
        d.y = defineY(d);
      });
    };

    this.tree(this.root);
    definePos(this.root, DIM_HIERARCHY.space);
    const nodes = flatten(this.root);

    this.link = this.group
      .selectAll(".hierarchy-link")
      .data(this.root.links(), (d) => d.target.id);
    this.link.exit().remove();

    const linkEnter = this.link
      .enter()
      .append("path")
      .attr("class", "hierarchy-link")
      .attr("id", (d) => `hierarchyLink${d.source.id}-${d.target.id}`)
      .attr("fill", "none")
      .attr("stroke", "#ccc")
      .attr("d", (d) =>
        ` M ${source.xPrev}, ${source.yPrev + DIM_HIERARCHY.rect.height / 2}
            L ${d.source.x + DIM_HIERARCHY.link.left},
              ${source.yPrev + DIM_HIERARCHY.rect.height / 2}
            L ${d.source.x + DIM_HIERARCHY.link.left},
              ${d.source.y + DIM_HIERARCHY.rect.height}`
          .replace(/\r?\n/g, "")
          .replace(/\s+/g, " ")
      );

    const linkUpdate = linkEnter.merge(this.link);
    linkUpdate
      .transition()
      .duration(this.DURATION)
      .attr("d", (d) =>
        ` M ${d.target.x}, ${d.target.y + DIM_HIERARCHY.rect.height / 2}
            L ${d.source.x + DIM_HIERARCHY.link.left}, 
              ${d.target.y + DIM_HIERARCHY.rect.height / 2}
            L ${d.source.x + DIM_HIERARCHY.link.left},
              ${d.source.y + DIM_HIERARCHY.rect.height}`
          .replace(/\r?\n/g, "")
          .replace(/\s+/g, " ")
      );

    this.link
      .exit()
      .transition()
      .duration(this.DURATION)
      .attr("d", (d) =>
        ` M ${source.x}, ${source.y + DIM_HIERARCHY.rect.height / 2}
        L ${d.source.x + DIM_HIERARCHY.link.left}, 
          ${source.y + DIM_HIERARCHY.rect.height / 2}
        L ${d.source.x + DIM_HIERARCHY.link.left},
          ${d.source.y + DIM_HIERARCHY.rect.height}`
          .replace(/\r?\n/g, "")
          .replace(/\s+/g, " ")
      )
      .remove();

    this.node = this.group
      .selectAll(".hierarchy-node")
      .data(nodes, (d) => d.id);
    this.node.exit().remove();

    const nodeEnter = this.node
      .enter()
      .append("g")
      .attr("class", "hierarchy-node")
      .attr("transform", (d) => `translate(${d.x}, ${d.y})`)
      .on("click", (event, clickedNodeData) => {
        this.clicked(clickedNodeData);
      });
    nodeEnter
      .append("rect")
      .attr("width", DIM_HIERARCHY.rect.width)
      .attr("height", DIM_HIERARCHY.rect.height)
      .attr("stroke", "#ccc");
    nodeEnter
      .append("text")
      .text((d) => d.data.command)
      .attr("transform", `translate(5, 15)`)
      .attr("fill", "#ccc")
      .attr("stroke", "none");

    const nodeUpdate = nodeEnter.merge(this.node);
    nodeUpdate
      .transition()
      .duration(this.DURATION)
      .attr("transform", (d) => `translate(${d.x}, ${d.y})`);
    nodeUpdate
      .select("rect")
      .attr("id", (d) => `hierarchyNode${d.id}`)
      .style("fill", (d) => (d._children ? "#666" : "#222"));

    nodeEnter.select("text").style("fill-opacity", 1);

    const nodeExit = this.node
      .exit()
      .transition()
      .duration(this.DURATION)
      .attr("transform", (d) => `translate(${d.x}, ${d.y})`)
      .remove();
    nodeExit.select("rect").attr("height", 0).attr("width", 0);
    nodeExit.select("text").style("fill-opacity", 1e-6);

    this.node.each((d) => {
      d.xPrev = d.x;
      d.yPrev = d.y;
    });
  }

  clicked(clickedNodeData) {
    this.updateStatusId(clickedNodeData);
    this.toggle(clickedNodeData);
    this.update(clickedNodeData);
    this.highlightPath(clickedNodeData);
    this.highlightChartNode(clickedNodeData);
  }

  updateStatusId(nodeData) {
    if (this.selectedNodeId < 0 || this.selectedNodeId !== nodeData.id) {
      this.selectedNodeId = nodeData.id;
    } else {
      this.selectedNodeId = -1;
    }
  }

  toggle(d) {
    if (d.children) {
      d._children = d.children;
      d.children = null;
    } else {
      d.children = d._children;
      d._children = null;
    }
  }

  highlightPath(d) { }

  highlightChartNode(clickedNodeData) {
    const selectedColor = "white";
    const notSelectedColor = "none";
    d3.selectAll(".hierarchy-node").style("stroke", notSelectedColor);
    const selectedHierarchyNode = d3.select(
      `#hierarchyNode${clickedNodeData.id}`
    );
    selectedHierarchyNode.style(
      "fill",
      this.selectedNodeId > 0 ? selectedColor : notSelectedColor
    );
    d3.selectAll(".chart-node")
      .style("stroke", selectedColor)
      .style("stroke-width", 0);
    d3.selectAll(".chart-link")
      .style("stroke", "#ccc")
      .style("stroke-width", 3);
    let daughter = clickedNodeData;
    selectedHierarchyNode
      .data()[0]
      .ancestors()
      .forEach((mother) => {
        d3.select(`#chartNode${mother.id}`).style(
          "stroke-width",
          this.selectedNodeId > 0 ? 3 : 0
        );
        if (mother != clickedNodeData) {
          d3.select(`#chartLink${mother.id}-${daughter.id}`)
            .style("stroke", this.selectedNodeId > 0 ? selectedColor : "#ccc")
            .style("stroke-width", this.selectedNodeId > 0 ? 5 : 3);
        }
        daughter = mother;
      });
  }
}

readAndVisualizeData();

/**
 * プロセスのデータを読み込んで chart，legend，hierarchy をセットする
 */
function readAndVisualizeData() {
  const DATA_FILENAME = "./data/process_data.tsv";
  d3.tsv(DATA_FILENAME).then((tsv) => {
    createVisualization(tsv);
  });
}

/**
 * プロセスの TSV ファイルから chart，kegend，hierarchy をセットする
 * @param {Object} tsv 読み込んだ TSV ファイルの内容
 */
function createVisualization(tsv) {
  const json = buildHierarchy(tsv);

  const hierarchy = new Hierarchy(json);
  const chart = new Chart(json, hierarchy);
  const legend = new Legend(tsv, json);
  legend.draw();
  chart.draw();
  hierarchy.draw();
}

/**
 * 階層構造を配列にする
 * @param {Object} source 配列にしたい階層構造
 * @returns source に ID を振って配列に放り込んだもの
 *
 * 名前が flattern なのは入れ子になっているオブジェクトをユニークな ID を振って配列に放り込むことで
 * 平坦にしているからだと思う．誰がわかるか
 */
function flatten(source) {
  let index = 0;
  const nodes = [];
  recurse(source);

  /**
   * ノードにユニークな ID を振る
   * @param {Object} node ID を振り始めるノード
   */
  function recurse(node) {
    if (node.children) {
      node.children.forEach(recurse);
    }
    ++index;
    if (!node.id) {
      node.id = index;
    }
    nodes.push(node);
  }
  return nodes;
}

/**
 * 階層構造の全てのノードについて，自分と自分の子の人数の合計を value にセットする
 * @param {Object} source 根ノード
 */
function countChildren(source) {
  source.eachAfter((node) => {
    let childrenSum = 1;
    if (node.children) {
      for (const child of node.children) {
        childrenSum += child.value;
      }
    }
    node.value = childrenSum;
  });
}

/**
 * tsv ファイルの内容から親子関係を表す Object を返す
 * @param {Object} tsv 読み込んだ tsv ファイル
 * @returns tsv ファイルから生成した親子関係を表す Object
 */
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
    const mem = parseFloat(currentRow["%MEM"]);
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
        mem: mem,
        rss: rss,
        stat: stat,
        parent: parentNode,
        children: [],
      };
      parentNode["children"].push(childNode);
      parentNode = childNode;
    } else if (nextGene === currentGene) {
      childNode = {
        command: command,
        user: user,
        pid: pid,
        cpu: cpu,
        mem: mem,
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
        mem: mem,
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

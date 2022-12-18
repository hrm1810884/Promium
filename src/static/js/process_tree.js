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
    R: {
      displayText: "runnable",
      colorLight: "#1A85F1",
      colorDark: "#082A4C",
    },
    D: {
      displayText: "uninterruptible sleep",
      colorLight: "#F26523",
      colorDark: "#4C200B",
    },
    T: {
      displayText: "stopped",
      colorLight: "#ED1C24",
      colorDark: "#4C090C",
    },
    S: {
      displayText: "interruptible sleep",
      colorLight: "#FBF267",
      colorDark: "#4C4920",
    },
    Z: {
      displayText: "zombie",
      colorLight: "#7053CC",
      colorDark: "#291F4C",
    },
    I: {
      displayText: "process generating",
      colorLight: "#38B349",
      colorDark: "#184C1F",
    },
    O: {
      displayText: "running",
      colorLight: "#0218FF",
      colorDark: "#00084C",
    },
    U: {
      displayText: "unknown",
      colorLight: "#777",
      colorDark: "#777",
    },
  },
};

const [DIM_CHART, DIM_LEGEND, DIM_HIERARCHY] = initializeDimention();
const [chartSvg, legendSvg, hierarchySvg] = initializeSvgElement();
const INTERVAL_TIME = 1000000; // live モードの更新頻度 [ms]

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
    height: 30,
    spacing: 3,
    radius: 3,
  };
  legendDim.container = {
    width: legendDim.each.width,
    height:
      Object.keys(NODE_TYPE.leaf).length *
      (legendDim.each.height + legendDim.each.spacing),
  };

  // hierarchyDim の初期化
  const hierarchyStyle = window.getComputedStyle(
    document.getElementById("hierarchyContainer")
  );
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
    width: parseFloat(hierarchyStyle.width.replace("px", "")),
    height: parseFloat(hierarchyStyle.height.replace("px", "")),
  };

  return [chartDim, legendDim, hierarchyDim];
}

/**
 * SVG の要素を初期化する
 * @returns [svg for chart, svg for legend, svg for hierarchy]
 */
function initializeSvgElement() {
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
  const hierarchyElement = d3
    .select("#hierarchy")
    .append("svg")
    .attr("width", DIM_HIERARCHY.container.width)
    .attr("height", DIM_HIERARCHY.container.height);
  return [chartElement, legendElement, hierarchyElement];
}

/* 挙動と状態変数をセットする */
let isLiveModeOn = true; // リアルタイムで更新するか
let isCpuModeOn = true; // 表示するものが CPU なら true，メモリなら false
let timerIdLiveMode = setInterval(readAndVisualizeData, INTERVAL_TIME); // リアルタイムモードを司るタイマー id

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("helpButton").addEventListener("change", function () {
    const sidebarContainer = document.getElementById("sidebar");
    const helpContentContainer = document.getElementById("helpContent");
    if (this.checked) {
      sidebarContainer.style.visibility = "hidden";
      helpContentContainer.style.visibility = "visible";
    } else {
      helpContentContainer.style.visibility = "hidden";
      sidebarContainer.style.visibility = "visible";
    }
  });

  document.getElementById("liveButton").addEventListener("change", function () {
    if (this.checked) {
      timerIdLiveMode = setInterval(readAndVisualizeData, INTERVAL_TIME);
    } else {
      clearInterval(timerIdLiveMode);
      readAndVisualizeData();
    }
  });

  document
    .getElementById("legendButton")
    .addEventListener("change", function () {
      const legendContentContainer = document.getElementById("legendContent");
      legendContentContainer.style.visibility = this.checked
        ? "visible"
        : "hidden";
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

  drawChart(json);
  drawLegend(tsv);
  drawHierarchy(json);

  /**
   * JSON ファイルから chart をセットする
   * @param {Object} json TSV から作った JSON ファイル
   */
  function drawChart(json) {
    const sumUpPercentage = (source) => {
      let percentageSum = 0;
      function addPercentage(node) {
        if (isCpuModeOn && node.cpu) {
          percentageSum += node.cpu;
        }
        if (!isCpuModeOn && node.rss) {
          percentageSum += node.cpu;
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

    const percentageSum = sumUpPercentage(json);
    document.getElementById(
      "chart"
    ).style.backgroundColor = `rgba(${convertHexToRgb("#ED1C2")}, ${
      percentageSum / 200
    })`;

    const root = d3.hierarchy(json);
    countChildren(root);
    let nodeChart;
    let linkChart;
    const defs = chartSvg.append("defs");

    /**
     * NODE_TYPE からグラデーションを定義する
     * @param {Object} defElement 定義を入れる SVG 要素
     */
    const defineGradient = (defElement) => {
      const capitalize = (string) => string[0].toUpperCase() + string.slice(1);
      const setGradient = (idString, colorLight, colorDark) => {
        const areaGradient = defElement
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
          setGradient(
            capitalize(keyNode),
            eachNode.colorLight,
            eachNode.colorDark
          );
        }
      });
    };

    defineGradient(defs);

    const simulation = d3
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
        d3.forceCenter(
          DIM_CHART.container.width / 2,
          DIM_CHART.container.height / 6
        )
      )
      .on("tick", ticked);

    updateChart();

    /**
     * chart の表示を更新する
     */
    function updateChart() {
      /* ノードとリンクを SVG にセットする */
      const nodes = flatten(root);
      const links = root.links();

      linkChart = chartSvg.selectAll(".link").data(links, (d) => d.target.id);
      linkChart.exit().remove();

      const linkEnter = linkChart
        .enter()
        .append("line")
        .attr("class", "link")
        .style("stroke", "#ccc")
        .style("opacity", "0.2")
        .style("stroke-width", 3);

      linkChart = linkEnter.merge(linkChart);

      nodeChart = chartSvg.selectAll(".chart-node").data(nodes, (d) => d.id);
      nodeChart.exit().remove();

      const nodeEnter = nodeChart
        .enter()
        .append("g")
        .attr("class", "chart-node")
        .attr("id", (d) => `chartNode${d.id}`)
        .attr("stroke", "#666")
        .attr("stroke-width", 0)
        .style("fill", selectColorForData)
        .style("opacity", (d) => (d.data.command === "root" ? 0.9 : 0.5))
        .on("click", chartNodeClicked)
        .call(
          d3
            .drag()
            .on("start", chartNodeDragStarted)
            .on("drag", chartNodeDragged)
            .on("end", chartNodeDragEnded)
        )
        .sort((a, b) => b.depth - a.depth);

      nodeEnter
        .append("circle")
        .attr("r", (d) =>
          d.data.command === "root"
            ? 50
            : Math.max(Math.sqrt(isCpuModeOn ? d.data.cpu : d.data.rss) * 15, 5)
        )
        .style("text-anchor", (d) => (d.children ? "end" : "start"))
        .text((d) => d.data.command);

      nodeChart = nodeEnter.merge(nodeChart);

      /* simulation にノードとリンクをセットする */
      simulation.nodes(nodes);
      simulation.nodes().forEach((node) => {
        if (!node.parent) {
          node.fx = DIM_CHART.container.centerX;
          node.fy = DIM_CHART.container.centerY;
        }
      });
      simulation.force("link").links(links);
    }

    /**
     * ノードとその子を固定する
     * @param {Object} parentNode 自身と子を固定するノード
     */
    function fixChildren(parentNode) {
      if (parentNode.children) {
        const radius = 200;
        const numChild = parentNode.children.length;
        parentNode.children.forEach((child) => {
          child.fx =
            parentNode.fx +
            radius * Math.cos((2 * Math.PI * child.index) / numChild);
          child.fy =
            parentNode.fy +
            radius * Math.sin((2 * Math.PI * child.index) / numChild);
        });
      }
    }

    /**
     * ノードとその子以降を固定する
     * @param {Object} parentNode 自身とその子以降を固定するノード
     */
    function fixAllGene(parentNode) {
      if (parentNode.children) {
        fixChildren(parentNode);
        parentNode.children.forEach((child) => {
          fixAllGene(child);
        });
      }
    }

    /**
     * データから階層・内容に応じて色を返す
     * @param {Object} d データ
     * @returns データの階層・内容に応じた色
     */
    function selectColorForData(d) {
      if (d.data.command === "root") {
        return "url(#areaGradientRoot)";
      }
      if (d._children || d.children) {
        return "url(#areaGradientParent)";
      }
      if ("stat" in d.data) {
        return `url(#${"areaGradientLeaf" + d.data.stat[0]})`;
      }
      return "url(#areaGradientLeafU}";
    }

    /**
     * 再計算時に実行される関数
     */
    function ticked() {
      linkChart
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);

      nodeChart.attr("transform", (d) => `translate(${d.x}, ${d.y})`);
    }

    /**
     * ノードがクリックされた時に実行される関数
     * @param {Object} event イベントオブジェクト
     * @param {Object} clickedNodeData クリックされたデータ
     */
    function chartNodeClicked(event, clickedNodeData) {
      const changeNodeColorByClick = (nodeData) => {
        const selectedColor = "red";
        const notSelectedColor = "#666";
        const selectedStrokeWidth = "3";
        const notSelectedStrokeWidth = "0";
        nodeChart
          .attr("stroke", (eachNodeData) => {
            if (eachNodeData.id === nodeData.id) {
              return d3.select(this).attr("stroke") === selectedColor
                ? notSelectedColor
                : selectedColor;
            } else {
              return notSelectedColor;
            }
          })
          .attr("stroke-width", (eachNodeData) => {
            if (eachNodeData.id === nodeData.id) {
              return d3.select(this).attr("stroke") === selectedStrokeWidth
                ? notSelectedStrokeWidth
                : selectedStrokeWidth;
            } else {
              return notSelectedStrokeWidth;
            }
          });
      };

      const highlightHierarchyNode = (nodeData) => {};

      changeNodeColorByClick(clickedNodeData);
      highlightHierarchyNode(clickedNodeData);
    }

    /**
     * ノードのドラッグ開始時に呼ばれる関数
     * @param {Object} event イベントオブジェクト
     * @param {Object} draggedNodeData ドラッグされたノードのデータ
     */
    function chartNodeDragStarted(event, draggedNodeData) {
      if (!event.active) {
        simulation.alphaTarget(0.3).restart();
      }
      draggedNodeData.fx = draggedNodeData.x;
      draggedNodeData.fy = draggedNodeData.y;
    }

    /**
     * ノードのドラッグ中に呼ばれる関数
     * @param {Object} event イベントオブジェクト
     * @param {Object} draggedNodeData ドラッグされたノードのデータ
     */
    function chartNodeDragged(event, draggedNodeData) {
      draggedNodeData.fx = event.x;
      draggedNodeData.fy = event.y;
    }

    /**
     * ノードのドラッグ終了時に呼ばれる関数
     * @param {Object} event イベントオブジェクト
     * @param {Object} d ドラッグされたノードのデータ
     */
    function chartNodeDragEnded(event, d) {
      if (!event.active) {
        simulation.alphaTarget(0);
      }
      d.fx = null;
      d.fy = null;
    }
  }

  /**
   * legend を描画する
   * @param {Object} tsv 読み込んだ TSV ファイルの内容
   */
  function drawLegend(tsv) {
    /**
     * プロセス一覧からユニークな要素を取得する
     * @param {Object} statusData プロセスの一覧
     * @returns ユニークなプロセスの配列
     */
    const selectUniqueStatus = (statusData) => {
      let statusIndex = 0;
      let uniqueStatusList = [];
      statusData.forEach((status) => {
        const statFirstLetter = status.STAT[0];
        if (
          uniqueStatusList
            .map((uniqueStatus) => uniqueStatus.stat)
            .indexOf(statFirstLetter) === -1
        ) {
          uniqueStatusList.push({
            stat: statFirstLetter,
            id: statusIndex,
            buttonClicked: false,
          });
          ++statusIndex;
        }
      });
      return uniqueStatusList;
    };
    const statusList = selectUniqueStatus(tsv);

    const sortedStatus = statusList
      .slice()
      .sort((a, b) => d3.ascending(a.stat, b.stat));

    legendSvg
      .attr("width", DIM_LEGEND.container.width)
      .attr("height", DIM_LEGEND.container.height);

    legendSvg.selectAll("g").remove();

    const legendGroup = legendSvg
      .selectAll("g")
      .data(sortedStatus)
      .enter()
      .append("svg:g")
      .attr(
        "transform",
        (d, i) =>
          "translate(0," +
          i * (DIM_LEGEND.each.height + DIM_LEGEND.each.spacing) +
          ")"
      );

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
      .style("opacity", 0.5)
      .attr("class", (d) => "rect_" + d.id);

    legendGroup
      .append("svg:text")
      .attr("x", DIM_LEGEND.each.width / 2)
      .attr("y", DIM_LEGEND.each.height / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", "middle")
      .text(
        (d) =>
          NODE_TYPE.leaf[d.stat in NODE_TYPE.leaf ? d.stat : "U"].displayText
      );

    legendGroup.on("click", legendRectClicked);

    /**
     * 四角形クリック時に呼ばれる関数
     * @param {Object} event イベントオブジェクト
     * @param {Object} clickedRectData クリックされた四角形のデータ
     */
    function legendRectClicked(event, clickedRectData) {
      if (clickedRectData.buttonClicked) {
        // ボタンが既に押されている時，ボタンをoffにし色を薄くする
        clickedRectData.buttonClicked = false;
        d3.selectAll(".rect_" + clickedRectData.id).style("opacity", 0.5);
        d3.selectAll("path").style("opacity", 1);
      } else {
        // ボタンがまだ押されていない時，他のボタンをoffにし、一旦すべてのボタンの色を薄くする
        statusList.forEach((data) => {
          data.buttonClicked = false;
        });
        d3.selectAll("rect").style("opacity", 0.5);

        // ボタンをonにし色を濃くする
        clickedRectData.buttonClicked = true;
        d3.selectAll(".rect_" + clickedRectData.id).style("opacity", 1);

        // 選択されたstatusのデータをハイライト表示する
        d3.selectAll("path").style("opacity", (data) => {
          if (!data.data || data.data.command === "root") {
            return 1;
          }
          return data.data.stat[0] === clickedRectData.stat ? 1 : 0.3;
        });
      }
    }
  }

  function drawHierarchy(json) {
    // 参考：https://qiita.com/e_a_s_y/items/dd1f0f9366ce5d1d1e7c
    const DURATION = 500;

    const root = d3.hierarchy(json);
    const tree = d3.tree();
    tree(root);

    countChildren(root);

    hierarchySvg.selectAll("g").remove();
    const hierarchyGroup = hierarchySvg.append("g");

    let linkHierarchy;
    let nodeHierarchy;
    let indexHierarchy = 0;
    updateHierarchy(root);

    function hierarchyNodeClicked(d) {
      toggleHierarchy(d);
      highlightChartNode(d);
      updateHierarchy(d);
    }

    function toggleHierarchy(d) {
      if (d.children) {
        d._children = d.children;
        d.children = null;
      } else {
        d.children = d._children;
        d._children = null;
      }
    }

    function updateHierarchy(source) {
      countChildren(root);

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
            data.depth * 2 * DIM_HIERARCHY.link.left +
            DIM_HIERARCHY.space.padding
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

      tree(root);
      definePos(root, DIM_HIERARCHY.space);
      const nodes = flatten(root);

      linkHierarchy = hierarchyGroup
        .selectAll(".link")
        .data(root.links(), (d) => d.target.id);
      linkHierarchy.exit().remove();

      const linkEnter = linkHierarchy
        .enter()
        .append("path")
        .attr("class", "link")
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

      const linkUpdate = linkEnter.merge(linkHierarchy);
      linkUpdate
        .transition()
        .duration(DURATION)
        .attr("d", (d) =>
          ` M ${d.target.x}, ${d.target.y + DIM_HIERARCHY.rect.height / 2}
              L ${d.source.x + DIM_HIERARCHY.link.left}, 
                ${d.target.y + DIM_HIERARCHY.rect.height / 2}
              L ${d.source.x + DIM_HIERARCHY.link.left},
                ${d.source.y + DIM_HIERARCHY.rect.height}`
            .replace(/\r?\n/g, "")
            .replace(/\s+/g, " ")
        );

      linkHierarchy
        .exit()
        .transition()
        .duration(DURATION)
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

      nodeHierarchy = hierarchyGroup
        .selectAll(".hierarchy-node")
        .data(nodes, (d) => d.id);
      nodeHierarchy.exit().remove();

      const nodeEnter = nodeHierarchy
        .enter()
        .append("g")
        .attr("class", "hierarchy-node")
        .attr("transform", (d) => `translate(${d.x}, ${d.y})`)
        .on("click", (event, d) => {
          hierarchyNodeClicked(d);
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

      const nodeUpdate = nodeEnter.merge(nodeHierarchy);
      nodeUpdate
        .transition()
        .duration(DURATION)
        .attr("transform", (d) => `translate(${d.x}, ${d.y})`);
      nodeUpdate
        .select("rect")
        .attr("id", (d) => `hierarchyRect${d.data.id}`)
        .style("fill", (d) => (d._children ? "#444" : "#222"));
      nodeEnter.select("text").style("fill-opacity", 1);

      const nodeExit = nodeHierarchy
        .exit()
        .transition()
        .duration(DURATION)
        .attr("transform", (d) => `translate(${d.x}, ${d.y})`)
        .remove();
      nodeExit.select("rect").attr("height", 0).attr("width", 0);
      nodeExit.select("text").style("fill-opacity", 1e-6);

      nodeHierarchy.each((d) => {
        d.xPrev = d.x;
        d.yPrev = d.y;
      });
    }

    function highlightChartNode(hierarchyNodeData) {
    }
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
      } else if (nextGene === currentGene) {
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
}

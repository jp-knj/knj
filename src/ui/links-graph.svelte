<script lang="ts">
  import { onMount } from "svelte";

  import blueskyLogo from "../images/bluesky-logo.svg?url";
  import githubLogo from "../images/github-logo.svg?url";
  import kenjiLogo from "../images/logo.png?url";
  import linkedinLogo from "../images/linkedin-logo.svg?url";
  import xLogo from "../images/x-logo.svg?url";
  import {
    linkEdges,
    linkNodes,
    type LinkEdge,
    type LinkIcon,
    type LinkNode,
    type Point,
  } from "../data/links";

  interface NodeDimensions {
    width: number;
    height: number;
  }

  interface DragState {
    nodeId: string;
    pointerId: number;
    startPointer: Point;
    startNode: Point;
    didDrag: boolean;
  }

  interface ResizeState {
    nodeId: string;
    pointerId: number;
    startPointer: Point;
    startSize: NodeDimensions;
  }

  interface EdgePath extends LinkEdge {
    path: string;
  }

  const DRAG_THRESHOLD = 5;
  const CANVAS_PADDING = 10;
  const WIDE_CANVAS_WIDTH = 720;
  const WIDE_CANVAS_HEIGHT = 904;
  const WIDE_NODE_OFFSET_Y = 72;
  const COMPACT_NODE_OFFSET_Y = 48;
  const iconSources: Record<LinkIcon, string> = {
    github: githubLogo,
    x: xLogo,
    linkedin: linkedinLogo,
    bluesky: blueskyLogo,
  };
  const nodeMap = new Map(linkNodes.map((node) => [node.id, node]));

  let canvas: HTMLDivElement;
  let canvasWidth = WIDE_CANVAS_WIDTH;
  let canvasHeight = WIDE_CANVAS_HEIGHT;
  let compact = false;
  let hoveredId: string | null = null;
  let focusedId: string | null = null;
  let selectedId: string | null = null;
  let suppressClickId: string | null = null;
  let drag: DragState | null = null;
  let resize: ResizeState | null = null;
  let topLayer = linkNodes.length + 1;
  let sizes = createInitialSizes(false);
  let positions = createInitialPositions(false, WIDE_CANVAS_WIDTH, sizes);
  let zOrder = Object.fromEntries(
    linkNodes.map((node, index) => [node.id, index + 2]),
  ) as Record<string, number>;
  let activeId: string | null;
  let activeNodeIds = new Set<string>();
  let activeEdgeIds = new Set<string>();
  let edgePaths: EdgePath[] = [];

  $: activeId = hoveredId ?? focusedId ?? selectedId;
  $: activeNodeIds = getActiveNodeIds(activeId);
  $: activeEdgeIds = new Set(
    linkEdges
      .filter(
        (edge) =>
          activeNodeIds.has(edge.source) && activeNodeIds.has(edge.target),
      )
      .map((edge) => edge.id),
  );
  $: edgePaths = buildEdgePaths(positions, sizes, compact);

  function getInitialNodeDimensions(
    node: LinkNode,
    compactMode = compact,
  ): NodeDimensions {
    if (node.kind === "hub") {
      return compactMode
        ? { width: 120, height: 120 }
        : { width: 144, height: 144 };
    }

    if (node.kind === "category") {
      return compactMode
        ? { width: 160, height: 60 }
        : { width: 184, height: 64 };
    }

    return compactMode
      ? { width: 180, height: 60 }
      : { width: 200, height: 64 };
  }

  function createInitialSizes(
    compactMode: boolean,
  ): Record<string, NodeDimensions> {
    return Object.fromEntries(
      linkNodes.map((node) => [
        node.id,
        getInitialNodeDimensions(node, compactMode),
      ]),
    );
  }

  function getNodeDimensions(
    node: LinkNode,
    compactMode = compact,
    currentSizes = sizes,
  ): NodeDimensions {
    return (
      currentSizes[node.id] ?? getInitialNodeDimensions(node, compactMode)
    );
  }

  function createInitialPositions(
    compactMode: boolean,
    width: number,
    currentSizes: Record<string, NodeDimensions>,
  ): Record<string, Point> {
    const layout = compactMode ? "compact" : "wide";

    return Object.fromEntries(
      linkNodes.map((node) => {
        const dimensions = getNodeDimensions(node, compactMode, currentSizes);
        const availableWidth = Math.max(
          0,
          width - dimensions.width - CANVAS_PADDING * 2,
        );
        const initial = node.initial[layout];

        return [
          node.id,
          {
            x: CANVAS_PADDING + initial.x * availableWidth,
            y:
              initial.y +
              (compactMode ? COMPACT_NODE_OFFSET_Y : WIDE_NODE_OFFSET_Y),
          },
        ];
      }),
    );
  }

  function clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
  }

  function constrainPoint(node: LinkNode, point: Point): Point {
    const dimensions = getNodeDimensions(node);

    return {
      x: clamp(
        point.x,
        CANVAS_PADDING,
        canvasWidth - dimensions.width - CANVAS_PADDING,
      ),
      y: clamp(
        point.y,
        CANVAS_PADDING,
        canvasHeight - dimensions.height - CANVAS_PADDING,
      ),
    };
  }

  function resizePositions(previousWidth: number, previousHeight: number): void {
    positions = Object.fromEntries(
      linkNodes.map((node) => {
        const dimensions = getNodeDimensions(node);
        const previousAvailableWidth = Math.max(
          1,
          previousWidth - dimensions.width - CANVAS_PADDING * 2,
        );
        const nextAvailableWidth = Math.max(
          1,
          canvasWidth - dimensions.width - CANVAS_PADDING * 2,
        );
        const previousAvailableHeight = Math.max(
          1,
          previousHeight - dimensions.height - CANVAS_PADDING * 2,
        );
        const nextAvailableHeight = Math.max(
          1,
          canvasHeight - dimensions.height - CANVAS_PADDING * 2,
        );
        const point = positions[node.id] ?? { x: 0, y: 0 };

        return [
          node.id,
          constrainPoint(node, {
            x:
              CANVAS_PADDING +
              ((point.x - CANVAS_PADDING) / previousAvailableWidth) *
                nextAvailableWidth,
            y:
              CANVAS_PADDING +
              ((point.y - CANVAS_PADDING) / previousAvailableHeight) *
                nextAvailableHeight,
          }),
        ];
      }),
    );
  }

  function moveNode(node: LinkNode, point: Point): void {
    positions = {
      ...positions,
      [node.id]: constrainPoint(node, point),
    };
  }

  function setNodeDimensions(
    node: LinkNode,
    requested: NodeDimensions,
  ): void {
    const point = positions[node.id] ?? { x: CANVAS_PADDING, y: CANVAS_PADDING };
    const minimum =
      node.kind === "hub"
        ? { width: 64, height: 64 }
        : { width: 88, height: 40 };
    const maximum = {
      width: Math.max(
        minimum.width,
        canvasWidth - point.x - CANVAS_PADDING,
      ),
      height: Math.max(
        minimum.height,
        canvasHeight - point.y - CANVAS_PADDING,
      ),
    };

    if (node.kind === "hub") {
      const side = clamp(
        requested.width,
        minimum.width,
        Math.min(maximum.width, maximum.height),
      );

      sizes = { ...sizes, [node.id]: { width: side, height: side } };
      return;
    }

    sizes = {
      ...sizes,
      [node.id]: {
        width: clamp(requested.width, minimum.width, maximum.width),
        height: clamp(requested.height, minimum.height, maximum.height),
      },
    };
  }

  function bringToFront(nodeId: string): void {
    topLayer += 1;
    zOrder = { ...zOrder, [nodeId]: topLayer };
  }

  function getAnchor(
    nodeId: string,
    side: "source" | "target",
    points: Record<string, Point>,
    compactMode: boolean,
    currentSizes: Record<string, NodeDimensions>,
  ): Point {
    const node = nodeMap.get(nodeId);
    const point = points[nodeId];

    if (!node || !point) {
      return { x: 0, y: 0 };
    }

    const dimensions = getNodeDimensions(node, compactMode, currentSizes);

    if (compactMode) {
      return {
        x: point.x + dimensions.width / 2,
        y: side === "source" ? point.y + dimensions.height : point.y,
      };
    }

    return {
      x: side === "source" ? point.x + dimensions.width : point.x,
      y: point.y + dimensions.height / 2,
    };
  }

  function fluidPath(
    start: Point,
    end: Point,
    compactMode: boolean,
    edgeId: string,
  ): string {
    const variation =
      (Array.from(edgeId).reduce((sum, character) => sum + character.charCodeAt(0), 0) %
        5 -
        2) *
      7;

    if (compactMode) {
      const distance = end.y - start.y;
      const bend = Math.max(42, Math.abs(distance) * 0.48) * (Math.sign(distance) || 1);

      return `M ${start.x} ${start.y} C ${start.x + variation} ${start.y + bend}, ${end.x - variation} ${end.y - bend}, ${end.x} ${end.y}`;
    }

    const distance = end.x - start.x;
    const bend = Math.max(52, Math.abs(distance) * 0.46) * (Math.sign(distance) || 1);

    return `M ${start.x} ${start.y} C ${start.x + bend} ${start.y + variation}, ${end.x - bend} ${end.y - variation}, ${end.x} ${end.y}`;
  }

  function buildEdgePaths(
    points: Record<string, Point>,
    currentSizes: Record<string, NodeDimensions>,
    compactMode: boolean,
  ): EdgePath[] {
    return linkEdges.map((edge) => {
      const sourceNode = nodeMap.get(edge.source);
      const targetNode = nodeMap.get(edge.target);
      const sourcePoint = points[edge.source];
      const targetPoint = points[edge.target];
      const sourceDimensions = sourceNode
        ? getNodeDimensions(sourceNode, compactMode, currentSizes)
        : { width: 0, height: 0 };
      const targetDimensions = targetNode
        ? getNodeDimensions(targetNode, compactMode, currentSizes)
        : { width: 0, height: 0 };
      const targetComesAfter = compactMode
        ? (targetPoint?.y ?? 0) + targetDimensions.height / 2 >=
          (sourcePoint?.y ?? 0) + sourceDimensions.height / 2
        : (targetPoint?.x ?? 0) + targetDimensions.width / 2 >=
          (sourcePoint?.x ?? 0) + sourceDimensions.width / 2;
      const start = getAnchor(
        edge.source,
        targetComesAfter ? "source" : "target",
        points,
        compactMode,
        currentSizes,
      );
      const end = getAnchor(
        edge.target,
        targetComesAfter ? "target" : "source",
        points,
        compactMode,
        currentSizes,
      );

      return {
        ...edge,
        path: fluidPath(start, end, compactMode, edge.id),
      };
    });
  }

  function getActiveNodeIds(nodeId: string | null): Set<string> {
    if (!nodeId) {
      return new Set();
    }

    const node = nodeMap.get(nodeId);

    if (!node || node.kind === "hub") {
      return new Set(linkNodes.map((candidate) => candidate.id));
    }

    if (node.kind === "category") {
      return new Set([
        "kenji",
        node.id,
        ...linkNodes
          .filter((candidate) => candidate.parentId === node.id)
          .map((candidate) => candidate.id),
      ]);
    }

    return new Set(["kenji", node.parentId ?? "", node.id]);
  }

  function activateNode(node: LinkNode): void {
    selectedId = node.id;

    if (node.href) {
      window.open(node.href, "_blank", "noopener,noreferrer");
    }
  }

  function handlePointerDown(event: PointerEvent, node: LinkNode): void {
    if (event.button !== 0 || !event.isPrimary) {
      return;
    }

    if (event.altKey) {
      handleResizePointerDown(event, node);
      return;
    }

    const target = event.currentTarget;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const current = positions[node.id] ?? { x: 0, y: 0 };

    bringToFront(node.id);
    target.focus({ preventScroll: true });
    target.setPointerCapture(event.pointerId);
    drag = {
      nodeId: node.id,
      pointerId: event.pointerId,
      startPointer: { x: event.clientX, y: event.clientY },
      startNode: current,
      didDrag: false,
    };
  }

  function handlePointerMove(event: PointerEvent): void {
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const delta = {
      x: event.clientX - drag.startPointer.x,
      y: event.clientY - drag.startPointer.y,
    };

    if (!drag.didDrag && Math.hypot(delta.x, delta.y) < DRAG_THRESHOLD) {
      return;
    }

    const node = nodeMap.get(drag.nodeId);

    if (!node) {
      return;
    }

    if (!drag.didDrag) {
      drag = { ...drag, didDrag: true };
    }

    moveNode(node, {
      x: drag.startNode.x + delta.x,
      y: drag.startNode.y + delta.y,
    });
    event.preventDefault();
  }

  function finishDrag(event: PointerEvent): void {
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const completedDrag = drag;

    drag = null;

    if (completedDrag.didDrag) {
      suppressClickId = completedDrag.nodeId;
      window.setTimeout(() => {
        if (suppressClickId === completedDrag.nodeId) {
          suppressClickId = null;
        }
      }, 0);
    }
  }

  function handleResizePointerDown(
    event: PointerEvent,
    node: LinkNode,
  ): void {
    if (event.button !== 0 || !event.isPrimary) {
      return;
    }

    const target = event.currentTarget;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    bringToFront(node.id);
    hoveredId = node.id;
    target.focus({ preventScroll: true });
    target.setPointerCapture(event.pointerId);
    resize = {
      nodeId: node.id,
      pointerId: event.pointerId,
      startPointer: { x: event.clientX, y: event.clientY },
      startSize: getNodeDimensions(node),
    };
    event.preventDefault();
    event.stopPropagation();
  }

  function handleResizePointerMove(event: PointerEvent): void {
    if (!resize || resize.pointerId !== event.pointerId) {
      return;
    }

    const node = nodeMap.get(resize.nodeId);

    if (!node) {
      return;
    }

    const delta = {
      x: event.clientX - resize.startPointer.x,
      y: event.clientY - resize.startPointer.y,
    };

    if (node.kind === "hub") {
      const dominantDelta =
        Math.abs(delta.x) >= Math.abs(delta.y) ? delta.x : delta.y;

      setNodeDimensions(node, {
        width: resize.startSize.width + dominantDelta,
        height: resize.startSize.height + dominantDelta,
      });
    } else {
      setNodeDimensions(node, {
        width: resize.startSize.width + delta.x,
        height: resize.startSize.height + delta.y,
      });
    }

    event.preventDefault();
    event.stopPropagation();
  }

  function finishResize(event: PointerEvent): void {
    if (!resize || resize.pointerId !== event.pointerId) {
      return;
    }

    const resizedNodeId = resize.nodeId;

    resize = null;
    suppressClickId = resizedNodeId;
    window.setTimeout(() => {
      if (suppressClickId === resizedNodeId) {
        suppressClickId = null;
      }
    }, 0);
    event.stopPropagation();
  }

  function handleResizeKeyDown(event: KeyboardEvent, node: LinkNode): void {
    if (event.key === "Escape") {
      selectedId = null;
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const distance = event.shiftKey ? 24 : 8;
    const current = getNodeDimensions(node);
    const next = { ...current };

    if (node.kind === "hub") {
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        next.width += distance;
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        next.width -= distance;
      } else {
        return;
      }

      next.height = next.width;
    } else if (event.key === "ArrowRight") {
      next.width += distance;
    } else if (event.key === "ArrowLeft") {
      next.width -= distance;
    } else if (event.key === "ArrowDown") {
      next.height += distance;
    } else if (event.key === "ArrowUp") {
      next.height -= distance;
    } else {
      return;
    }

    bringToFront(node.id);
    setNodeDimensions(node, next);
    event.preventDefault();
    event.stopPropagation();
  }

  function handleClick(event: MouseEvent, node: LinkNode): void {
    event.preventDefault();

    if (suppressClickId === node.id) {
      suppressClickId = null;
      return;
    }

    activateNode(node);
  }

  function handleKeyDown(event: KeyboardEvent, node: LinkNode): void {
    if (event.key === "Escape") {
      selectedId = null;
      event.preventDefault();
      return;
    }

    if (event.key === "Enter") {
      activateNode(node);
      event.preventDefault();
      return;
    }

    const direction: Record<string, Point> = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
    };
    const movement = direction[event.key];

    if (!movement) {
      return;
    }

    if (event.altKey) {
      handleResizeKeyDown(event, node);
      return;
    }

    const current = positions[node.id] ?? { x: 0, y: 0 };
    const distance = event.shiftKey ? 24 : 8;

    bringToFront(node.id);
    moveNode(node, {
      x: current.x + movement.x * distance,
      y: current.y + movement.y * distance,
    });
    event.preventDefault();
  }

  function handleCanvasClick(event: MouseEvent): void {
    const target = event.target;

    if (
      target instanceof Element &&
      target.closest("[data-link-node]")
    ) {
      return;
    }

    selectedId = null;
  }

  function handleCanvasKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      selectedId = null;
      event.preventDefault();
    }
  }

  function getAriaLabel(node: LinkNode): string {
    if (node.href) {
      return `${node.label}, external link. Drag to move; hold Alt or Option while dragging to resize.`;
    }

    if (node.kind === "link") {
      return `${node.label}, link unavailable. Drag to move; hold Alt or Option while dragging to resize.`;
    }

    if (node.kind === "hub") {
      return "Kenji, link tree hub. Select to highlight the full tree; hold Alt or Option while dragging to resize.";
    }

    return `${node.label} category. Select to highlight this branch; hold Alt or Option while dragging to resize.`;
  }

  onMount(() => {
    const media = window.matchMedia("(max-width: 56rem)");
    let initialized = false;

    const measure = (forceReset = false) => {
      const bounds = canvas.getBoundingClientRect();
      const nextCompact = media.matches;
      const modeChanged = compact !== nextCompact;
      const previousWidth = canvasWidth;
      const previousHeight = canvasHeight;

      compact = nextCompact;
      canvasWidth = bounds.width;
      canvasHeight = bounds.height;

      if (!initialized || modeChanged || forceReset) {
        sizes = createInitialSizes(compact);
        positions = createInitialPositions(compact, canvasWidth, sizes);
      } else {
        for (const node of linkNodes) {
          setNodeDimensions(node, getNodeDimensions(node));
        }
        resizePositions(previousWidth, previousHeight);
      }

      initialized = true;
    };
    const observer = new ResizeObserver(() => measure());
    const handleMediaChange = () => measure(true);

    measure();
    observer.observe(canvas);
    media.addEventListener("change", handleMediaChange);

    return () => {
      observer.disconnect();
      media.removeEventListener("change", handleMediaChange);
    };
  });
</script>

{#snippet nodeContents(node: LinkNode)}
  {#if node.kind === "hub"}
    <img class="link-node__hub-image" src={kenjiLogo} alt="" aria-hidden="true" />
    <span class="link-node__hub-label">HUB</span>
  {:else}
    <span class="link-node__lead" aria-hidden="true">
      {#if node.icon}
        <img src={iconSources[node.icon]} alt="" />
      {:else}
        <span class="link-node__signal"></span>
      {/if}
    </span>
    <span class="link-node__label">{node.label}</span>
    {#if node.href}
      <span class="link-node__arrow" aria-hidden="true">↗</span>
    {:else if node.kind === "link"}
      <span class="link-node__unavailable" aria-hidden="true">—</span>
    {/if}
  {/if}
{/snippet}

<div
  class:link-graph--compact={compact}
  class="link-graph"
  bind:this={canvas}
  role="group"
  tabindex="-1"
  aria-label="Interactive links mind map"
  aria-describedby="link-graph-instructions"
  onclick={handleCanvasClick}
  onkeydown={handleCanvasKeyDown}
>
  <p id="link-graph-instructions" class="link-graph__instructions">
    Tab to a node. Use the arrow keys to move it, Shift plus an arrow key to
    move farther, hold Alt or Option while dragging or pressing an arrow key
    to resize, Enter to select or open a link, and Escape to clear a selection.
  </p>

  <svg class="link-graph__edges" width="100%" height="100%" aria-hidden="true">
    {#each edgePaths as edge (edge.id)}
      <path
        class:link-edge--active={activeEdgeIds.has(edge.id)}
        class:link-edge--muted={Boolean(activeId) && !activeEdgeIds.has(edge.id)}
        class="link-edge"
        data-link-edge={edge.id}
        d={edge.path}
        style={`--edge-accent: ${edge.accent}`}
        vector-effect="non-scaling-stroke"
      />
    {/each}
  </svg>

  {#each linkNodes as node (node.id)}
    {@const point = positions[node.id] ?? { x: 0, y: 0 }}
    {@const nodeSize = sizes[node.id] ?? getInitialNodeDimensions(node)}
    {@const nodeClass = `link-node link-node--${node.kind}`}
    {@const nodeStyle = `--node-accent: ${node.accent}; --node-x: ${point.x}px; --node-y: ${point.y}px; --node-width: ${nodeSize.width}px; --node-height: ${nodeSize.height}px; z-index: ${zOrder[node.id]}`}
    {#if node.href}
      <a
        class:link-node--active={activeNodeIds.has(node.id)}
        class:link-node--muted={Boolean(activeId) && !activeNodeIds.has(node.id)}
        class:link-node--dragging={drag?.nodeId === node.id}
        class:link-node--resizing={resize?.nodeId === node.id}
        class={nodeClass}
        style={nodeStyle}
        data-link-node={node.id}
        href={node.href}
        target="_blank"
        rel="noreferrer"
        draggable="false"
        aria-label={getAriaLabel(node)}
        onpointerdown={(event) => handlePointerDown(event, node)}
        onpointermove={(event) => {
          if (resize?.nodeId === node.id) handleResizePointerMove(event);
          else handlePointerMove(event);
        }}
        onpointerup={(event) => {
          finishDrag(event);
          finishResize(event);
        }}
        onpointercancel={(event) => {
          finishDrag(event);
          finishResize(event);
        }}
        onlostpointercapture={(event) => {
          finishDrag(event);
          finishResize(event);
        }}
        onpointerenter={() => (hoveredId = node.id)}
        onpointerleave={() => {
          if (drag?.nodeId !== node.id && resize?.nodeId !== node.id)
            hoveredId = null;
        }}
        onfocus={() => (focusedId = node.id)}
        onblur={() => {
          if (focusedId === node.id) focusedId = null;
        }}
        onclick={(event) => handleClick(event, node)}
        onkeydown={(event) => handleKeyDown(event, node)}
      >
        {@render nodeContents(node)}
      </a>
    {:else}
      <button
        class:link-node--active={activeNodeIds.has(node.id)}
        class:link-node--muted={Boolean(activeId) && !activeNodeIds.has(node.id)}
        class:link-node--dragging={drag?.nodeId === node.id}
        class:link-node--resizing={resize?.nodeId === node.id}
        class={nodeClass}
        style={nodeStyle}
        data-link-node={node.id}
        type="button"
        aria-label={getAriaLabel(node)}
        aria-pressed={selectedId === node.id}
        aria-disabled={node.kind === "link" ? "true" : undefined}
        onpointerdown={(event) => handlePointerDown(event, node)}
        onpointermove={(event) => {
          if (resize?.nodeId === node.id) handleResizePointerMove(event);
          else handlePointerMove(event);
        }}
        onpointerup={(event) => {
          finishDrag(event);
          finishResize(event);
        }}
        onpointercancel={(event) => {
          finishDrag(event);
          finishResize(event);
        }}
        onlostpointercapture={(event) => {
          finishDrag(event);
          finishResize(event);
        }}
        onpointerenter={() => (hoveredId = node.id)}
        onpointerleave={() => {
          if (drag?.nodeId !== node.id && resize?.nodeId !== node.id)
            hoveredId = null;
        }}
        onfocus={() => (focusedId = node.id)}
        onblur={() => {
          if (focusedId === node.id) focusedId = null;
        }}
        onclick={(event) => handleClick(event, node)}
        onkeydown={(event) => handleKeyDown(event, node)}
      >
        {@render nodeContents(node)}
      </button>
    {/if}
  {/each}
</div>

<style>
  .link-graph,
  .link-graph * {
    box-sizing: border-box;
  }

  .link-graph {
    position: relative;
    isolation: isolate;
    inline-size: 100%;
    block-size: 100%;
    min-inline-size: 0;
    overflow: hidden;
    border: 0;
    border-radius: 0.75rem;
    background-color: transparent;
    background-image:
      linear-gradient(
        color-mix(in srgb, var(--color-ink) 4%, transparent) 0.0625rem,
        transparent 0.0625rem
      ),
      linear-gradient(
        90deg,
        color-mix(in srgb, var(--color-ink) 4%, transparent) 0.0625rem,
        transparent 0.0625rem
      );
    background-size: 1.5rem 1.5rem;
    outline: none;
    pointer-events: auto;
  }

  .link-graph__instructions {
    position: absolute;
    inline-size: 0.0625rem;
    block-size: 0.0625rem;
    padding: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
  }

  .link-graph__edges {
    position: absolute;
    z-index: 0;
    inset: 0;
    overflow: visible;
    pointer-events: none;
  }

  .link-edge {
    fill: none;
    stroke: var(--edge-accent);
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-dasharray: 0.34rem 0.3rem;
    stroke-width: 2;
    opacity: 0.72;
    transition:
      opacity 150ms ease,
      stroke-width 150ms ease;
  }

  .link-edge--active {
    animation: link-edge-flow 850ms linear infinite;
    stroke-width: 3.25;
    opacity: 1;
  }

  @keyframes link-edge-flow {
    to {
      stroke-dashoffset: -0.9rem;
    }
  }

  .link-edge--muted {
    opacity: 0.24;
  }

  .link-node {
    --node-x: 0;
    --node-y: 0;
    --node-accent: var(--color-ink);

    position: absolute;
    inset-block-start: 0;
    inset-inline-start: 0;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    inline-size: var(--node-width);
    block-size: var(--node-height);
    padding: 0.6rem 0.75rem;
    border: 1px solid var(--color-ink);
    border-radius: 0.45rem;
    background: var(--color-paper);
    box-shadow: 0.2rem 0.2rem 0 var(--node-accent);
    color: var(--color-ink);
    font: inherit;
    font-size: 0.875rem;
    line-height: 1;
    text-align: start;
    text-decoration: none;
    touch-action: none;
    cursor: grab;
    opacity: 1;
    transform: translate3d(var(--node-x), var(--node-y), 0);
    transition:
      box-shadow 150ms ease,
      opacity 150ms ease;
    user-select: none;
    will-change: transform;
  }

  .link-node::before,
  .link-node::after {
    position: absolute;
    z-index: 2;
    inset-block-start: 50%;
    inline-size: 0.55rem;
    block-size: 0.55rem;
    border: 1px solid var(--color-ink);
    border-radius: 50%;
    background: var(--node-accent);
    content: "";
    transform: translateY(-50%);
  }

  .link-node::before {
    inset-inline-start: -0.34rem;
  }

  .link-node::after {
    inset-inline-end: -0.34rem;
  }

  .link-node:focus-visible {
    outline: 0.2rem solid var(--color-ink);
    outline-offset: 0.2rem;
  }

  .link-node--hub {
    display: grid;
    padding: 0.35rem;
    border-radius: 1.25rem;
    box-shadow:
      0.2rem 0.2rem 0 var(--color-cyan),
      0.4rem 0.4rem 0 var(--color-pink);
  }

  .link-node--category {
    background: var(--node-accent);
    font-weight: 500;
    letter-spacing: 0.08em;
  }

  .link-node--link {
    box-shadow: inset 0 0.24rem 0 var(--node-accent);
  }

  .link-node--active {
    box-shadow: 0.32rem 0.32rem 0 var(--node-accent);
  }

  .link-node--hub.link-node--active {
    box-shadow:
      0.25rem 0.25rem 0 var(--color-cyan),
      0.5rem 0.5rem 0 var(--color-pink),
      0.75rem 0.75rem 0 var(--color-green);
  }

  .link-node--muted {
    opacity: 0.36;
  }

  .link-node--dragging {
    cursor: grabbing;
    opacity: 1;
  }

  .link-node--resizing {
    box-shadow: 0.32rem 0.32rem 0 var(--node-accent);
    opacity: 1;
  }

  .link-node__hub-image {
    inline-size: 100%;
    block-size: 100%;
    border-radius: 0.9rem;
    object-fit: cover;
    pointer-events: none;
  }

  .link-node__hub-label {
    position: absolute;
    inset-block-end: 0.45rem;
    inset-inline-end: 0.45rem;
    padding: 0.15rem 0.25rem;
    border: 1px solid var(--color-ink);
    background: var(--color-yellow);
    font-size: 0.5625rem;
    letter-spacing: 0.08em;
  }

  .link-node__lead {
    display: grid;
    flex: none;
    place-items: center;
    inline-size: 1.2rem;
    block-size: 1.2rem;
  }

  .link-node__lead img {
    inline-size: 1rem;
    block-size: 1rem;
  }

  .link-node__signal {
    inline-size: 0.6rem;
    block-size: 0.6rem;
    border: 1px solid var(--color-ink);
    background: var(--color-paper);
  }

  .link-node__label {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .link-node__arrow,
  .link-node__unavailable {
    margin-inline-start: auto;
    font-size: 1rem;
  }

  .link-node__unavailable {
    opacity: 0.42;
  }

  @media (width <= 56rem) {
    .link-node {
      padding: 0.55rem 0.65rem;
      font-size: 0.8125rem;
    }

    .link-node::before,
    .link-node::after {
      inset-block-start: auto;
      inset-inline: 50% auto;
      transform: translateX(-50%);
    }

    .link-node::before {
      inset-block-start: -0.34rem;
    }

    .link-node::after {
      inset-block-end: -0.34rem;
    }

  }

  @media (prefers-reduced-motion: reduce) {
    .link-edge,
    .link-edge--active,
    .link-node {
      animation: none;
      transition: none;
    }
  }
</style>

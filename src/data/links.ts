export type LinkNodeKind = "hub" | "category" | "link";

export type LinkIcon = "github" | "x" | "linkedin" | "bluesky";

export interface Point {
  x: number;
  y: number;
}

export interface LinkNode {
  id: string;
  label: string;
  kind: LinkNodeKind;
  accent: string;
  parentId?: string;
  href?: string;
  icon?: LinkIcon;
  initial: {
    wide: Point;
    compact: Point;
  };
}

export interface LinkEdge {
  id: string;
  source: string;
  target: string;
  accent: string;
}

export const linkNodes: LinkNode[] = [
  {
    id: "kenji",
    label: "Kenji",
    kind: "hub",
    accent: "var(--color-ink)",
    initial: { wide: { x: 0.46, y: 390 }, compact: { x: 0.5, y: 20 } },
  },
  {
    id: "work",
    label: "WORK",
    kind: "category",
    accent: "var(--color-cyan)",
    parentId: "kenji",
    initial: { wide: { x: 0.65, y: 70 }, compact: { x: 0.18, y: 170 } },
  },
  {
    id: "github",
    label: "GitHub",
    kind: "link",
    accent: "var(--color-cyan)",
    parentId: "work",
    href: "https://github.com/jp-knj",
    icon: "github",
    initial: { wide: { x: 0.92, y: 10 }, compact: { x: 0.72, y: 250 } },
  },
  {
    id: "cv",
    label: "CV",
    kind: "link",
    accent: "var(--color-cyan)",
    parentId: "work",
    initial: { wide: { x: 0.88, y: 180 }, compact: { x: 0.15, y: 325 } },
  },
  {
    id: "social",
    label: "SOCIAL",
    kind: "category",
    accent: "var(--color-pink)",
    parentId: "kenji",
    initial: { wide: { x: 0.66, y: 550 }, compact: { x: 0.62, y: 415 } },
  },
  {
    id: "x",
    label: "X",
    kind: "link",
    accent: "var(--color-pink)",
    parentId: "social",
    href: "https://x.com/jp_knj",
    icon: "x",
    initial: { wide: { x: 0.91, y: 450 }, compact: { x: 0.1, y: 495 } },
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    kind: "link",
    accent: "var(--color-pink)",
    parentId: "social",
    href: "https://www.linkedin.com/in/kenji-wu-10103b210/",
    icon: "linkedin",
    initial: { wide: { x: 0.94, y: 580 }, compact: { x: 0.75, y: 570 } },
  },
  {
    id: "bluesky",
    label: "Bluesky",
    kind: "link",
    accent: "var(--color-pink)",
    parentId: "social",
    href: "https://bsky.app/profile/jp-knj.bsky.social",
    icon: "bluesky",
    initial: { wide: { x: 0.77, y: 700 }, compact: { x: 0.42, y: 645 } },
  },
  {
    id: "contact",
    label: "CONTACT",
    kind: "category",
    accent: "var(--color-green)",
    parentId: "kenji",
    initial: { wide: { x: 0.24, y: 560 }, compact: { x: 0.18, y: 740 } },
  },
  {
    id: "email",
    label: "Email",
    kind: "link",
    accent: "var(--color-green)",
    parentId: "contact",
    initial: { wide: { x: 0.01, y: 700 }, compact: { x: 0.7, y: 820 } },
  },
  {
    id: "feed",
    label: "FEED",
    kind: "category",
    accent: "var(--color-yellow)",
    parentId: "kenji",
    initial: { wide: { x: 0.24, y: 70 }, compact: { x: 0.62, y: 915 } },
  },
  {
    id: "rss",
    label: "RSS",
    kind: "link",
    accent: "var(--color-yellow)",
    parentId: "feed",
    initial: { wide: { x: 0.01, y: 190 }, compact: { x: 0.25, y: 995 } },
  },
];

export const linkEdges: LinkEdge[] = linkNodes.flatMap((node) =>
  node.parentId
    ? [
        {
          id: `${node.parentId}-${node.id}`,
          source: node.parentId,
          target: node.id,
          accent: node.accent,
        },
      ]
    : [],
);

export interface WritingAndTalkEntry {
    year: string;
    month: string;
    type: string;
    title: string;
    link: string;
    description?: string;
    image?: string;
    featured?: boolean;
}

export const writingAndTalks: WritingAndTalkEntry[] = [
    {
        year: "2026",
        month: "Mar",
        type: "Talk",
        title: "Astro Islands internals at Vue.js Japan User Group",
        link: "https://vuejs-meetup.connpass.com/event/385025/",
        description:
            "Walked through Astro Islands — from the build pipeline to browser behavior — through the lens of HTML-first architecture.",
        image: "https://media.connpass.com/thumbs/d5/2a/d52a49641dd80e4b134272b9d1ceb986.png",
        featured: true,
    },
    {
        year: "2026",
        month: "Feb",
        type: "Project",
        title: "xmdx — streaming Markdown/MDX engine in Rust",
        link: "https://github.com/jp-knj/xmdx",
        description:
            "A streaming Markdown/MDX engine in Rust, designed for high-performance processing in Astro and Starlight.",
        featured: true,
    },
    {
        year: "2026",
        month: "Feb",
        type: "Talk",
        title: "Hosted the first Astro Japan Meetup",
        link: "https://astrojp.connpass.com/event/376291/",
        description: "First in-person meetup of the Astro Japan community.",
        image: "https://media.connpass.com/thumbs/4e/6f/4e6fea1be082b36f0245d10e7df610ae.png",
        featured: true,
    },
    {
        year: "2025",
        month: "Sep",
        type: "Talk",
        title: "Lightning Talk at Frontend Conference Tokyo",
        link: "https://fec-tokyo.github.io/2025/",
        description: "Lightning talk at Tokyo's annual frontend conference.",
        image: "https://unavatar.io/x/fec_tokyo",
    },
    {
        year: "2023",
        month: "May",
        type: "Writing",
        title: "Introduction to Design Systems",
        link: "https://zenn.dev/ignorant_kenji/books/introduction-to-design-systems",
        description:
            "Japanese translation of Figma's design systems course — fundamentals for designers and developers.",
        image: "https://res.cloudinary.com/zenn/image/fetch/s--hb_aZF7d--/c_fill%2Cf_jpg%2Cfl_progressive%2Ch_700%2Cq_90%2Cw_500/https://static.zenn.studio/user-upload/book_cover/2b317fba30.png?_a=BACAGSGT",
    },
];

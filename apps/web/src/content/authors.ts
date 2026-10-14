import type { Author } from "./types";

export const authors = {
  "abhigyan-raj": {
    name: "Abhigyan Raj",
    url: "/about",
    sameAs: [],
    jobTitle: "Founder",
  },
} satisfies Record<string, Author>;

export type AuthorId = keyof typeof authors;

export function getAuthor(id: string | undefined): Author {
  return (authors as Record<string, Author>)[id ?? ""] ?? authors["abhigyan-raj"];
}

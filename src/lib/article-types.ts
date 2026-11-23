// Long-form page copy. Every tool page carries a full article below the
// action, ordered by importance: what it is, how it works, when it is the
// right tool, what happens to your content, and the details worth knowing.
// The homepage carries its own narrative in the same shape.

export interface ArticleSection {
  heading: string
  paragraphs: string[]
  list?: string[]
}

export interface AppArticle {
  /** Opening paragraphs: what this is, stated plainly. */
  lede: string[]
  /** Importance-ordered: mechanics first, then scenarios, privacy, details. */
  sections: ArticleSection[]
}

export interface HomeArticle {
  lede: string[]
  sections: ArticleSection[]
}

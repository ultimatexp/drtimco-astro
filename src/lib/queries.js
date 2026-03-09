// ============================================================
// GraphQL Query Definitions for WPGraphQL
// ============================================================
// No Yoast/RankMath SEO plugin — SEO meta is derived from
// WordPress core fields (title, excerpt, featured image).
// ============================================================

// ── Fragments ────────────────────────────────────────────────

export const POST_FIELDS = `
  fragment PostFields on Post {
    id
    databaseId
    title
    slug
    date
    modified
    excerpt
    content
    featuredImage {
      node {
        sourceUrl
        altText
        mediaDetails {
          width
          height
        }
      }
    }
    author {
      node {
        name
        slug
        avatar {
          url
        }
        description
      }
    }
    categories {
      nodes {
        name
        slug
        databaseId
      }
    }
    tags {
      nodes {
        name
        slug
      }
    }
  }
`;

export const PAGE_FIELDS = `
  fragment PageFields on Page {
    id
    databaseId
    title
    slug
    date
    modified
    content
    featuredImage {
      node {
        sourceUrl
        altText
        mediaDetails {
          width
          height
        }
      }
    }
  }
`;

// ── Post Queries ─────────────────────────────────────────────

/**
 * Paginated listing of all published posts.
 * Variables: { first: Int, after: String }
 */
export const GET_ALL_POSTS = `
  ${POST_FIELDS}
  query GetAllPosts($first: Int = 10, $after: String) {
    posts(first: $first, after: $after, where: { status: PUBLISH }) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        ...PostFields
      }
    }
  }
`;

/**
 * Single post by slug — full content + adjacent posts for navigation.
 * Variables: { slug: String! }
 */
export const GET_POST_BY_SLUG = `
  ${POST_FIELDS}
  query GetPostBySlug($slug: ID!) {
    post(id: $slug, idType: SLUG) {
      ...PostFields
    }
  }
`;

/**
 * Get all post slugs for static path generation.
 * Returns only slugs for minimal payload.
 */
export const GET_ALL_POST_SLUGS = `
  query GetAllPostSlugs($first: Int = 100, $after: String) {
    posts(first: $first, after: $after, where: { status: PUBLISH }) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        slug
      }
    }
  }
`;

// ── Category Queries ─────────────────────────────────────────

/**
 * All categories with post counts.
 */
export const GET_CATEGORIES = `
  query GetCategories {
    categories(first: 100, where: { hideEmpty: true }) {
      nodes {
        name
        slug
        databaseId
        description
        count
      }
    }
  }
`;

/**
 * Posts filtered by category slug.
 * Variables: { categorySlug: String!, first: Int, after: String }
 */
export const GET_POSTS_BY_CATEGORY = `
  ${POST_FIELDS}
  query GetPostsByCategory($categorySlug: String!, $first: Int = 10, $after: String) {
    posts(
      first: $first,
      after: $after,
      where: { categoryName: $categorySlug, status: PUBLISH }
    ) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        ...PostFields
      }
    }
  }
`;

// ── Page Queries ─────────────────────────────────────────────

/**
 * Single page by slug.
 * Variables: { slug: String! }
 */
export const GET_PAGE_BY_SLUG = `
  ${PAGE_FIELDS}
  query GetPageBySlug($slug: ID!) {
    page(id: $slug, idType: URI) {
      ...PageFields
    }
  }
`;

// ── Menu / Site Queries ──────────────────────────────────────

/**
 * Site-wide info (title, description, language).
 */
export const GET_SITE_INFO = `
  query GetSiteInfo {
    generalSettings {
      title
      description
      language
      url
    }
  }
`;

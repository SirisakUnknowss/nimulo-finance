import type { NextConfig } from "next";

// Static export for GitHub Pages. The repo is served at
// https://<user>.github.io/nimulo-finance/, a subpath, so basePath/assetPrefix
// only apply during the GitHub Pages build (GH_PAGES=true, set by the
// deploy workflow) - local dev and other hosts keep root-relative paths.
const isGithubPages = process.env.GH_PAGES === "true";
const repoName = "nimulo-finance";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  basePath: isGithubPages ? `/${repoName}` : undefined,
  assetPrefix: isGithubPages ? `/${repoName}/` : undefined,
  // Raw <img src> doesn't get basePath automatically; expose it for assetPath().
  env: { NEXT_PUBLIC_BASE_PATH: isGithubPages ? `/${repoName}` : "" },
};

export default nextConfig;

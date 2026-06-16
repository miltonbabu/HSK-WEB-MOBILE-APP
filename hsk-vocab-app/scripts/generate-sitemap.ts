import { writeFileSync } from 'fs'
import { generateSitemapEntries } from '../src/utils/seo'

const BASE_URL = 'https://xuetong.app'

function generateSitemap(): string {
  const entries = generateSitemapEntries(BASE_URL)
  const today = new Date().toISOString().split('T')[0]

  const urls = entries.map((url) => `  <url>
    <loc>${url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${url === BASE_URL ? 'daily' : 'weekly'}</changefreq>
    <priority>${url === BASE_URL ? '1.0' : url.includes('/mode/') ? '0.7' : '0.8'}</priority>
  </url>`).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>`
}

const sitemap = generateSitemap()
writeFileSync('public/sitemap.xml', sitemap)
console.log(`Sitemap generated with ${generateSitemapEntries().length} URLs`)

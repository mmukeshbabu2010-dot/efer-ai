# EFER AI Font Hosting & Backup Reference

EFER AI self-hosts all typography inside `public/fonts/` so the application makes zero runtime requests to external font CDNs and remains offline-ready for future PWA/desktop packaging.

## Self-Hosted Fonts & Licenses

- **Inter** (weights 400, 500, 600, 700): `public/fonts/inter/` — Licensed under SIL Open Font License 1.1 (`public/fonts/inter/LICENSE.txt`, from `rsms/inter`).
- **JetBrains Mono** (weights 400, 500, 600, 700): `public/fonts/jetbrains-mono/` — Licensed under SIL Open Font License 1.1 (`public/fonts/jetbrains-mono/LICENSE.txt`, from `JetBrains/JetBrainsMono`).

## Manual Google Fonts Backup (Not Loaded at Runtime)

If you ever need a temporary external CDN backup while developing in an environment without local font files, add the following inside `index.html` `<head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
  rel="stylesheet"
/>
```

# Kambar Mangibayev — Portfolio

Self-hosted portfolio rebuilt from the original Wix site as a static site.
Plain HTML, CSS, and vanilla JS. Animations via GSAP + Lenis (loaded from
CDN — no build step required).

## Stack

- HTML / CSS / JS (no framework, no bundler)
- [GSAP](https://gsap.com) + ScrollTrigger — scroll animations
- [Lenis](https://github.com/darkroomengineering/lenis) — smooth scroll
- Google Fonts — Fraunces, Inter, JetBrains Mono

## Local preview

The simplest way is Python's built-in server:

```bash
cd portfolio
python3 -m http.server 8000
# then open http://localhost:8000
```

Or VS Code's "Live Server" extension. Or any static file server.

## Deploy to GitHub Pages

This is the recommended host — free, fast, works with custom domains.

### One-time setup

1. Create a new GitHub repository. Two common naming choices:
   - **`yourusername.github.io`** — site lives at `https://yourusername.github.io` (root-level, recommended for portfolios).
   - **`portfolio`** (or any name) — site lives at `https://yourusername.github.io/portfolio`.

2. From this folder, push the contents (NOT this folder itself — the files inside it):

   ```bash
   cd portfolio
   git init
   git add .
   git commit -m "initial portfolio"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<repo-name>.git
   git push -u origin main
   ```

3. On GitHub: **Settings → Pages**.
   - **Source:** "Deploy from a branch"
   - **Branch:** `main`, folder `/ (root)`
   - Click **Save**.

4. Wait ~1 minute, then visit your site. GitHub will show the live URL at the top of the Pages settings.

### Updates

Any push to `main` redeploys automatically:

```bash
git add .
git commit -m "update copy"
git push
```

### Custom domain (optional)

1. Buy a domain (Cloudflare Registrar, Namecheap, etc).
2. In your repo: **Settings → Pages → Custom domain** — enter your domain, **Save**, and check **Enforce HTTPS**.
3. With your DNS provider, add records:
   - Apex (`yourdomain.com`) → four `A` records pointing to:
     ```
     185.199.108.153
     185.199.109.153
     185.199.110.153
     185.199.111.153
     ```
   - Or `www` → `CNAME` to `yourusername.github.io`.
4. GitHub auto-creates a `CNAME` file in the repo. Don't delete it.

The included `.nojekyll` file tells GitHub Pages to serve the files exactly as-is (no Jekyll processing — important if you ever add files starting with `_`).

## Editing the content

Everything lives in one `index.html` file. Sections are clearly labelled — search for `<!-- hero -->`, `<!-- selected work -->`, etc.

- **Add a project:** copy a `<li class="work">` block in the `#work` section, change the number, title, tag, and description.
- **Update the bio:** edit the `.about__copy` paragraphs.
- **Change the email:** find `kambarmangibayev@gmail.com` (appears twice) and replace.
- **Tweak colors:** open `assets/css/styles.css` — every color is a CSS variable at the very top (`:root`). Change `--accent` to swap the rust accent across the whole site.
- **Replace images:** drop new files into `assets/img/` and update the `<img src>`.

## Files

```
portfolio/
├── index.html              # all markup, single page
├── .nojekyll               # tells GH Pages to skip Jekyll processing
├── README.md               # this file
└── assets/
    ├── css/styles.css      # all styles, variables at top
    ├── js/main.js          # animations + interactions
    └── img/
        ├── portrait.jpg
        ├── slicer.png
        ├── flight-dynamics.png
        └── ray-logo.png
```

## Performance / accessibility notes

- Respects `prefers-reduced-motion` — animations and the custom cursor disable themselves.
- All interactive controls are real `<a>` / `<button>` elements with proper aria labels.
- Images use `loading="lazy"`.
- Fonts use `display=swap` so text renders before fonts arrive.
- No third-party trackers, no cookies.

## License

All content (text, images, projects) © Kambar Mangibayev.
The site code is yours to modify freely.

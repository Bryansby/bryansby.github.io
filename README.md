# Boyun Song’s personal website

A lightweight, responsive academic website inspired by the layout of https://mingdeyu.github.io/. The styling and markup are original; the reference author’s biography, publications, and assets are not copied.

## Preview

Run from this folder:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open http://127.0.0.1:8000. You can also open `index.html` directly. There are no dependencies, build step, external fonts, or JavaScript requirements.

## Personalize

The current version is a draft based on the supplied CV. Publications and talks are awaiting details.

- `index.html`: introduction, interests, and news.
- `research.html`: research overview and publications.
- `education.html`: degrees and experience.
- `talks.html`: presentations.
- `software.html`: projects and repository links.
- `contact.html`: university email, affiliation, GitHub, and LinkedIn links.
- All HTML files: update the displayed name, page title, description, and footer if needed. Navigation is repeated so each page works without JavaScript.
- `assets/style.css`: typography, spacing, and colors; edit `--accent` for the link color.
- `assets/favicon.svg`: site initial.

The requested GitHub username is `Bryansby`; its profile links are included. The homepage introduction is drafted from the supplied CV. Education, experience, research interests, project summaries, technical skills, and university email were transcribed or paraphrased from the supplied CV. LinkedIn was supplied directly by the owner. Publications and talks have no supplied entries yet. No project-specific repository links have been supplied. The CV itself and its telephone number are not included in the website files.

## Publish on GitHub Pages

1. Create a repository named `bryansby.github.io` under `Bryansby` (or use `<username>.github.io` for a different account). A public repository works with GitHub Free.
2. Upload this website’s files and `assets` folder to the repository’s `main` branch at the repository root. Include the empty `.nojekyll` file. Do not upload the local `.git` folder.
3. In the repository, open **Settings → Pages**. Select **Deploy from a branch**, then **main** and **/ (root)**, and save.
4. Wait for the Pages deployment to finish. Your address will be `https://bryansby.github.io/`.

Relative asset and navigation links also support a project site such as `https://bryansby.github.io/personal-website/` without code changes.

Official instructions: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site

Repository: https://github.com/Bryansby/bryansby.github.io

GitHub Pages address: https://bryansby.github.io/

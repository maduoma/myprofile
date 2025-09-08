# My RESPONSIVE Profile with HTML and CSS ONLY

> This is my profile developed with HTML and CSS ONLY.
>
> > My Profile:
> > [Visit My Profile Page](https://maduoma.github.io/myprofile/)

## Frameworks and Libraries

1. [MEAN Stack](http://meanjs.org/ "MongoDB, Express, AngularJS, and Node.js")
2. [GitHub - MEAN Stack](http://github.com/meanjs/mean "MEAN Stack")

## Freebies

1. [Angela Yu - Resources](https://www.appbrewery.co/p/web-development-course-resources)
2. [Web Color Pallet](https://colorhunt.co/)
3. [Emoji](http://emojipedia.org)
4. [Unicode Characters](https://unicode-table.com/en/)
5. [DevDocs API Documentation](https://devdocs.io/)
6. [Create Your Favicon](https://www.favicon.cc/)
7. [Basic CSS Box Model Demo](http://markusvogl.com/web1/interactive_box_model/css_box_demo.html)
8. [CSS Font Stack For the Web](https://www.cssfontstack.com/)
9. [CSS Tricks](https://css-tricks.com/)
10. [Embed Your Own fonts To Look Same On All Platforms](https://fonts.google.com/)
11. [Free Icons](https://www.flaticon.com/)
12. [Image Animations](https://giphy.com/)
13. [CSS Button Generator](https://www.css3buttongenerator.com/)
14. [NodeJS](https://nodejs.org/)
15. [Image Color Picker](https://imagecolorpicker.com/)
16. [PNG Pictures/Images](https://www.picpng.com/)

## My Favorite Web Development Editors & Tools

1. [Visual Studio Code](https://code.visualstudio.com/download)
2. [Pesticide](https://pesticide.io)

> Note:
> If you want to open any links above on a new tab, do a (CTRL + Click) or (Command + Click) on the link to achieve that.

---

## Senior Engineer / AI Profile Upgrade

This repository now includes a modern, production-ready senior software & AI/ML engineering profile with multiple formats:

| Asset | Purpose |
|-------|---------|
| `senior-profile.html` | Fully responsive interactive profile (dark/light theme, filters, timeline). |
| `css/senior-profile.css` | Design system (tokens, layout, animations, accessibility focused). |
| `PROFILE.md` | Comprehensive markdown profile (full detail). |
| `PROFILE_SHORT.md` | Condensed recruiter snapshot version. |
| `cv.tex` | LaTeX resume (compile with `xelatex cv.tex`). |
| `index.html` | Original landing page (now links to the senior profile). |

## Features

- Theme toggle (persisted in localStorage)
- Progressive section reveal (IntersectionObserver)
- Scroll spy navigation highlighting
- Project category filtering (data-attribute driven)
- Accessibility considerations (aria labels, reduced motion fallback)
- Responsive grid + timeline layout

## Quick Run (local)

Just open `senior-profile.html` in a browser. For a quick static server (Python 3):

```bash
python -m http.server 8080
```

Then navigate to: <http://localhost:8080/senior-profile.html>

## Customize

1. Replace placeholder company names (Company A–D) in `PROFILE.md`, `PROFILE_SHORT.md`, and `cv.tex`.
2. Update MSc institution details.
3. Add/rename real project titles and concrete metrics.
4. Extend project cards in `senior-profile.html` (duplicate an `<article class="card">`).
5. Adjust color palette or typography via CSS custom properties in `css/senior-profile.css`.

## Export to PDF

- Use browser print (Chrome/Edge) on `senior-profile.html` with background graphics enabled.
- Or compile `cv.tex` using XeLaTeX for a print-optimized resume.

## Future Ideas (Optional)

- Add skills radar chart (Canvas or SVG)
- Integrate project detail modal dialogs
- Hook contact form to EmailJS or Formspree
- Add Lighthouse CI workflow for performance budgets

---

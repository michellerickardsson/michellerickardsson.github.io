# Michelle Rickardsson, portfolio

Live site: **https://michellerickardsson.github.io**

My growth marketing portfolio, built while studying Growth Marketing at Berghs School of Communication.
Photography portfolio: https://michellerickardsson.com

## What is in here

| Page | What it is |
|---|---|
| `index.html` | The portfolio: who I am, experience, school projects and contact. |
| `projects.html` | Overview of the school projects. |
| `stargazing.html` | **A Stargazer's Guide.** An interactive tool that suggests the best time and place to see stars, using live weather, moon and aurora data. |
| `djurboom-pandemin.html` | **Djurboomen under pandemin.** A data story (in Swedish) about the pandemic dog boom and what happened to the dogs afterwards. Charts built from public statistics. |

## How it is built

- Plain HTML, CSS and JavaScript. No framework and no build step.
- Hosted on GitHub Pages.
- The orange thread that follows the page is a `<canvas>` drawn in `portfolio.js`. On phones the canvas scrolls with the page, on desktop it stays pinned and is redrawn on scroll.
- Charts: [Chart.js](https://www.chartjs.org/). Map: [Leaflet](https://leafletjs.com/).
- Data in the Stargazer's Guide comes from [Open-Meteo](https://open-meteo.com/), [sunrise-sunset.org](https://sunrise-sunset.org/api) and [NOAA SWPC](https://www.swpc.noaa.gov/).
- Analytics: Google Tag Manager with a small `dataLayer` setup. Clicks on elements with a `data-dl-event` attribute are pushed as events (`nav_click`, `contact_click`).
- Images are WebP, sized for the screens they are shown on.

## Run it locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Contact

[contact@michellerickardsson.com](mailto:contact@michellerickardsson.com) · [LinkedIn](https://www.linkedin.com/in/michelle-rickardsson-069485132)

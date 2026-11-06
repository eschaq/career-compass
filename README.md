# Career Compass

A guided, *What Color Is Your Parachute*-style questionnaire that takes a list of O*NET career matches and sorts them by real fit: the work itself, working conditions, pay against the lifestyle you want, how long and how book-heavy the training is, and the fastest way in (including live-in options like Job Corps, military and employer academies).

**Live site:** https://eschaq.github.io/career-compass/

## How it works
1. Nine short steps: what you like doing, working conditions, schedule and life, a Kansas City budget builder, training, top values, then job cards with the facts for each job.
2. Every job gets a fit score (0-100), a suggested Yes / Maybe / No, and the reasons.
3. The results page ranks the top 10 and lists all jobs. Export with **Copy results** (paste into the Google Sheet's *Assessment Results* tab, cell A1), CSV, or JSON.

Answers save only in the browser on the device being used. Nothing is sent anywhere.

## Data
`data/jobs.js` holds 257 occupations with approximate national pay (BLS OEWS May 2024 levels; low/high are estimates), typical paths in, conditions scored 1-5, and notes. Each job card links to O*NET, CareerOneStop Kansas City pay data, and Apprenticeship.gov so figures can be checked.

## Hosting
GitHub Pages: Settings → Pages → Deploy from a branch → `main` / root.

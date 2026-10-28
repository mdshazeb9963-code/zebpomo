# zebpomo AI Worker

This Cloudflare Worker is the private server-side bridge between the static GitHub Pages app and the OpenAI Responses API.

## Deploy

From this folder:

```powershell
npx wrangler login
npx wrangler secret put OPENAI_API_KEY
npx wrangler deploy
```

The deploy command prints a Worker URL. Put that URL with `/plan` appended into the public `ai-config.js` file in the site root, then push the change to GitHub Pages.

The API key is stored as a Worker secret. Do not put it in `ai-config.js`, browser storage, or the repository. The model receives only the goal and schedule settings submitted for that plan. The OpenAI request sets `store: false`.

# Write backend set-up

The app **reads** the Google Sheet directly, through its public CSV endpoint. That
works with nothing but `VITE_SHEET_ID`.

**Writing** is different. A browser cannot append a row to a Sheet or put a file in
Drive on its own, so every write — creating a vendor, a BWG, an inward entry,
uploading a PDF or a photo — goes through the Apps Script Web App in `Code.gs`.

Until the steps below are done, `VITE_SHEET_API_URL` is empty, and every create form
refuses to save with *"Saving is not connected yet."*

## 1. Create the Drive folder

Make a folder in Drive to hold the uploads (the script creates `Documents/` and
`Photos/` inside it on first use). Open it and copy the id from the address bar:

```
https://drive.google.com/drive/folders/<THIS IS THE FOLDER ID>
```

## 2. Add the script

1. Open the `Chintan_Waste_Data` spreadsheet.
2. **Extensions → Apps Script**.
3. Delete whatever is in `Code.gs` and paste in the contents of this folder's `Code.gs`.
4. At the top of the file, set:
   - `API_KEY` — any long random string you invent. Treat it as a password.
   - `ROOT_FOLDER_ID` — the folder id from step 1.
5. Save.

## 3. Deploy it

1. **Deploy → New deployment**.
2. Gear icon → **Web app**.
3. Set **Execute as: Me**, and **Who has access: Anyone**.
4. **Deploy**, then authorise when Google asks. The "unverified app" warning is
   expected for your own script — choose *Advanced → Go to … (unsafe)*.
5. Copy the **Web app URL**. It ends in `/exec`.

> After *any* later edit to `Code.gs` you must run **Deploy → Manage deployments →
> edit → New version**. Saving alone does not update the live URL.

## 4. Point the app at it

In `.env` in the project root:

```
VITE_SHEET_ID=1vSTj0KwymQxn-UCUbzMxRL69y3CtCx7cq529siCS-zY
VITE_DRIVE_FOLDER_ID=<folder id from step 1>
VITE_SHEET_API_URL=<the /exec URL from step 3>
VITE_SHEET_API_KEY=<the same string you put in API_KEY>
```

Restart `npm run dev` — Vite only reads `.env` at startup.

To check the deployment is alive, open the `/exec` URL in a browser. It should
answer `{"ok":true,"service":"Chintan Waste write API"}`.

## A note on the API key

Vite inlines every `VITE_*` value into the built JavaScript, so `VITE_SHEET_API_KEY`
is readable by anyone who opens the deployed site. It stops casual writes from
strangers who do not have it; it is not a real secret.

If the data warrants more than that, the check in `doPost` should become a real
authorisation step — for example requiring a signed-in Google user via
`Session.getActiveUser()` with the deployment set to your workspace domain rather
than "Anyone".

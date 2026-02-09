# Money Book User Manual (Windows / macOS / Ubuntu)

## What this app does
Money Book helps you track personal income and expenses from your own SQLite database.  
You can:
- Browse recent records
- Add new records
- See friendly statistics for a month or custom date range
- Undo the last change

## Quick Start (All Systems)
1. Install Node.js 18+ (includes npm).
2. Open a terminal in the `money-book` folder.
3. Run:
   ```bash
   npm install
   npm run dev
   ```
4. Open the app in your browser:
   - `http://localhost:5173`

The API runs at `http://localhost:3001` in the background.

## Windows (10/11)
### Install Node.js
- Download Node.js 18+ from the official Node.js website and install it.
- Make sure “Add to PATH” is checked during installation.

### Run the app
Open **PowerShell** or **Command Prompt** in the `money-book` folder:
```bash
npm install
npm run dev
```

### If sqlite3 build fails
Some Windows machines need build tools. If you see errors about `sqlite3`:
1. Install **Build Tools for Visual Studio**.
2. Re-run `npm install`.

## macOS
### Install Node.js
Recommended:
```bash
brew install node
```
Or download Node.js 18+ from the official website.

### Run the app
Open **Terminal** in the `money-book` folder:
```bash
npm install
npm run dev
```

## Ubuntu (Linux)
### Install Node.js
Recommended (NodeSource):
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Run the app
```bash
npm install
npm run dev
```

## Using the App
### Date Range
- Pick a month or set custom **From** and **To** dates.
- Stats and tables refresh automatically.

### Add a Record
- Fill in the form under **Add Record**.
- Date and Description are required.
- Click **Add Record** to save.

### Undo
Click **Undo Last Change** to revert the most recent insert.

### Manage Lists
Add new Accounts, Tags, Target Tags, and Targets in **Manage Lists**.

## Resetting Data
To reset back to the original dataset:
1. Stop the server.
2. Delete `server/data/ledger.db`.
3. Start the server again (`npm run dev`).

## Production Mode (Optional)
Build and serve the app from the backend:
```bash
npm run build
npm start
```
Then open:
`http://localhost:3001`

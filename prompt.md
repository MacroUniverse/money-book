Write a personal financial management app called `money-book`
- with React and JS and node.js that
- can run locally on my Ubuntu, Mac, and Windows system.
- use SQLite3 as db, and an example dump file `ledger.db.sql` (the app should not change anything except records)
- there should be a friendly statistics function for a month, or a selected period of time
- user should be able to add new records undo changes to all tables
- as you go, write a developer manual so that other developers can join
- look at the `"assets"` table in the sql file (from SQLite), (where 1e4 means
  the "amount" should be multiplied by 10000), which I just added, add a new
  page in the current program to show statistics of my total asset in a pie
  graph and a form, converting/showing everything to rmb, and update "to_rmb"
  column in real-time, by looking up the converting ratio of other currencies
  and assets in real-time (if no internet, use the previous ratio)
